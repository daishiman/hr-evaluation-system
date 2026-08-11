import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { formatJpDate, jstDateString } from "@/lib/domain/form-deadline";

export const dynamic = "force-dynamic";

/**
 * 回答期限の個別延長。
 *
 * 締切を実際に効かせると、休職・出張・入力ミスなどで間に合わなかった人が
 * 何もできなくなる。そこで「その人だけ、いつまで」を記録できるようにした。
 * 誰がいつ何日まで延ばしたのかが後から分かるよう、行は消さずに積み上げ、
 * 取り消しは revoked_at を立てるだけにしている（削除APIは作らない方針に合わせる）。
 */

const grantSchema = z.object({
  employeeId: z.string().min(1),
  /** 延長後の期限（YYYY-MM-DD）。この日の終わり（日本時間）まで回答できる */
  extendedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は年月日で選んでください。"),
  reason: z.string().max(200).nullish(),
});

/** 期限を延ばす。 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("MANAGER");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const { id: formId } = await ctx.params;
    const body = grantSchema.parse(await req.json());
    const db = await getDb();

    const form = (
      await db
        .select({ id: s.forms.id, status: s.forms.status, closesAt: s.forms.closesAt, title: s.forms.title })
        .from(s.forms)
        .where(and(eq(s.forms.id, formId), eq(s.forms.companyId, companyId)))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");
    if (form.status === "draft") {
      throw new HttpError(400, "このアンケートはまだ公開されていません。公開してから期限を延ばしてください。");
    }
    if (form.status === "closed") {
      throw new HttpError(
        400,
        "このアンケートは締め切り済みです。個別に期限を延ばす前に、アンケートを公開中に戻してください。",
      );
    }

    const employee = (
      await db
        .select({ id: s.users.id, name: s.users.name })
        .from(s.users)
        .where(and(eq(s.users.id, body.employeeId), eq(s.users.companyId, companyId)))
        .limit(1)
    )[0];
    if (!employee) throw new HttpError(404, "対象の方が見つかりませんでした。");

    // 過ぎた日付を入れても意味がないので入口で止める（日本時間の今日を基準にする）
    const today = jstDateString(new Date());
    if (body.extendedUntil < today) {
      throw new HttpError(400, "過ぎた日付は指定できません。今日以降の日付を選んでください。");
    }
    if (form.closesAt && body.extendedUntil <= form.closesAt) {
      throw new HttpError(
        400,
        `もとの締切（${formatJpDate(form.closesAt)}）より後の日付を選んでください。締切を早める指定はできません。`,
      );
    }

    await db.insert(s.formDeadlineExtensions).values({
      id: newId("fde"),
      companyId,
      formId: form.id,
      employeeId: employee.id,
      extendedUntil: body.extendedUntil,
      reason: body.reason?.trim() || null,
      grantedById: viewer.id,
    });

    return {
      message: `${employee.name}さんの期限を${formatJpDate(body.extendedUntil)}まで延ばしました。ご本人の回答画面にも表示されます。`,
    };
  });
}

const revokeSchema = z.object({ extensionId: z.string().min(1) });

/** 延長を取り消す。行は消さず、取り消した日時と人を残す。 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("MANAGER");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const { id: formId } = await ctx.params;
    const body = revokeSchema.parse(await req.json());
    const db = await getDb();

    const row = (
      await db
        .select()
        .from(s.formDeadlineExtensions)
        .where(
          and(
            eq(s.formDeadlineExtensions.id, body.extensionId),
            eq(s.formDeadlineExtensions.companyId, companyId),
            eq(s.formDeadlineExtensions.formId, formId),
          ),
        )
        .limit(1)
    )[0];
    if (!row) throw new HttpError(404, "対象の延長が見つかりませんでした。");
    if (row.revokedAt) throw new HttpError(400, "この延長はすでに取り消されています。");

    await db
      .update(s.formDeadlineExtensions)
      .set({ revokedAt: new Date(), revokedById: viewer.id })
      .where(and(eq(s.formDeadlineExtensions.id, row.id), isNull(s.formDeadlineExtensions.revokedAt)));

    return { message: "延長を取り消しました。記録は履歴として残ります。" };
  });
}
