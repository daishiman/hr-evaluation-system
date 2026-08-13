import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { canTransitionCycleStatus } from "@/lib/domain/cycle-lifecycle";
import { cycleOpenReadiness } from "@/lib/domain/setup-readiness";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は 2026-04-01 の形式で入力してください"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は 2026-09-30 の形式で入力してください"),
});

/** 評価期間（半期）の作成。有効な評価セットを紐づけて、集計で使う基準を明示する。 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = createSchema.parse(await req.json());
    if (body.periodEnd <= body.periodStart) {
      throw new HttpError(400, "終了日は開始日より後の日付にしてください。");
    }

    const db = await getDb();
    const scheme = (
      await db
        .select()
        .from(s.evaluationSchemes)
        .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.status, "active")))
        .limit(1)
    )[0];
    if (!scheme) throw new HttpError(400, "有効な評価セットがありません。先に「KPI・評価セット」で項目と配点を設定してください。");
    const readiness = await loadSchemeReadiness(companyId, scheme.id);
    if (!readiness.schemeReady) throw new HttpError(409, readiness.schemeMessage);

    const id = newId("cyc");
    await db.insert(s.evaluationCycles).values({
      id,
      companyId,
      name: body.name.trim(),
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      schemeId: scheme.id,
      status: "planning",
    });
    return { id, message: "評価期間を作りました。次にアンケートを作ってください。" };
  });
}

const patchSchema = z.object({
  cycleId: z.string().min(1),
  status: z.enum(["planning", "open", "closed"]),
});

/** 評価期間の開始・締め切り。締め切ると回答は受け付けなくなる（記録は残る）。 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const cycle = (
      await db
        .select()
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.id, body.cycleId), eq(s.evaluationCycles.companyId, companyId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");

    if (!canTransitionCycleStatus(cycle.status, body.status)) {
      throw new HttpError(409, "現在の状態からその状態へは変更できません。画面を更新し、表示されている次の操作を選んでください。");
    }

    // 同じ会社で受付中にできる評価期間は1つだけ。回答先と管理画面の「現在」が分裂するのを防ぐ。
    if (body.status === "open") {
      const [schemeReadiness, publishedForms] = await Promise.all([
        loadSchemeReadiness(companyId, cycle.schemeId),
        db.select({ id: s.forms.id }).from(s.forms)
          .where(and(eq(s.forms.cycleId, cycle.id), eq(s.forms.status, "published"))),
      ]);
      const readiness = cycleOpenReadiness({
        schemeReady: schemeReadiness.schemeReady,
        publishedFormCount: publishedForms.length,
      });
      if (!readiness.ready) throw new HttpError(409, readiness.message);
      const anotherOpen = (
        await db
          .select({ id: s.evaluationCycles.id, name: s.evaluationCycles.name })
          .from(s.evaluationCycles)
          .where(
            and(
              eq(s.evaluationCycles.companyId, companyId),
              eq(s.evaluationCycles.status, "open"),
              ne(s.evaluationCycles.id, cycle.id),
            ),
          )
          .limit(1)
      )[0];
      if (anotherOpen) {
        throw new HttpError(409, `「${anotherOpen.name}」という別の評価期間が受付中です。先にそちらを締め切ってください。`);
      }
    }

    // 締め切ったらアンケートも閉じる（回答画面に「締め切りました」と出る）
    if (body.status === "closed") {
      // 期間だけ終了・アンケートだけ公開中という中間状態を残さない。
      await db.batch([
        db.update(s.evaluationCycles).set({ status: body.status }).where(eq(s.evaluationCycles.id, cycle.id)),
        db
          .update(s.forms)
          .set({ status: "closed" })
          .where(and(eq(s.forms.cycleId, cycle.id), eq(s.forms.status, "published"))),
      ]);
    } else {
      await db.update(s.evaluationCycles).set({ status: body.status }).where(eq(s.evaluationCycles.id, cycle.id));
    }

    const message =
      body.status === "open"
        ? "回答の受付を開始しました。対象の方の画面にアンケートが出ます。"
        : body.status === "closed"
          ? "受付を締め切りました。回答内容と評価の記録はそのまま残ります。"
          : "準備中に戻しました。";
    return { message };
  });
}
