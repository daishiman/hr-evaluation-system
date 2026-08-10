import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { buildFormDraft } from "@/lib/form-build";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  cycleId: z.string().min(1),
  /** 省略したら、その会社の全等級ぶんをまとめて作る */
  gradeIds: z.array(z.string().min(1)).optional(),
  title: z.string().max(80).optional(),
});

/** アンケートの下書きを制度マスタから作る。 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = createSchema.parse(await req.json());
    const db = await getDb();

    const grades = await db.select().from(s.grades).where(eq(s.grades.companyId, companyId));
    const targets = body.gradeIds
      ? grades.filter((g) => body.gradeIds!.includes(g.id))
      : grades.filter((g) => g.isActive);
    if (targets.length === 0) throw new HttpError(400, "対象の等級がありません。");

    const results = [];
    for (const g of targets) {
      const r = await buildFormDraft({ companyId, cycleId: body.cycleId, gradeId: g.id, title: body.title });
      results.push({ gradeId: g.id, gradeName: g.name, ...r });
    }
    const total = results.reduce((sum, r) => sum + r.questionCount, 0);
    return {
      results,
      message: `${results.length}件のアンケートを下書きで作りました（設問 合計${total}問）。内容を確認してから公開してください。`,
    };
  });
}

const patchSchema = z.object({
  formId: z.string().min(1),
  status: z.enum(["draft", "published", "closed"]).optional(),
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(400).nullable().optional(),
});

/** アンケートの公開・締め切り・タイトル変更。 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, body.formId), eq(s.forms.companyId, companyId)))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");

    if (body.status === "published") {
      const qs = await db.select({ id: s.formQuestions.id }).from(s.formQuestions).where(eq(s.formQuestions.formId, form.id));
      if (qs.length === 0) throw new HttpError(400, "設問が1問もありません。設問を追加してから公開してください。");
      // 同じサイクル・等級で公開中のものは自動で締める（回答先が2つに割れないようにする）
      const siblings = await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.cycleId, form.cycleId), eq(s.forms.gradeId, form.gradeId), eq(s.forms.status, "published")));
      for (const sib of siblings.filter((x) => x.id !== form.id)) {
        await db.update(s.forms).set({ status: "closed" }).where(eq(s.forms.id, sib.id));
      }
    }

    await db
      .update(s.forms)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.title ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      })
      .where(eq(s.forms.id, form.id));

    const message =
      body.status === "published"
        ? "アンケートを公開しました。対象の等級の方が回答できます。"
        : body.status === "closed"
          ? "アンケートを締め切りました。すでに提出された回答は残ります。"
          : "内容を保存しました。";
    return { message };
  });
}
