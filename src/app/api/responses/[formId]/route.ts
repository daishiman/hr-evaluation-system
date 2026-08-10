import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, insertMany, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** draft = 入力途中の自動保存 / submitted = 提出 */
  status: z.enum(["draft", "submitted"]),
  note: z.string().max(2000).nullish(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        valueNumber: z.number().finite().nullish(),
        valueText: z.string().max(4000).nullish(),
      }),
    )
    .max(500),
});

/**
 * アンケートの回答を保存する。
 *
 * 保存できるのは「自分の等級のアンケート」に対する「自分の回答」だけ。
 * 画面を経由せずここを直接叩かれても、他人の回答は作れない。
 */
export async function POST(req: Request, ctx: { params: Promise<{ formId: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");
    const { formId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, formId), eq(s.forms.companyId, viewer.companyId ?? "")))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");
    if (form.status !== "published") throw new HttpError(400, "このアンケートは今、回答を受け付けていません。");
    if (form.gradeId !== viewer.gradeId) throw new HttpError(403, "この等級向けのアンケートではありません。");

    const existing = (
      await db
        .select()
        .from(s.formResponses)
        .where(and(eq(s.formResponses.formId, formId), eq(s.formResponses.employeeId, viewer.id)))
        .limit(1)
    )[0];
    if (existing?.status === "submitted") {
      throw new HttpError(400, "すでに提出済みのため、内容を変更できません。修正が必要な場合は上長にご連絡ください。");
    }

    const responseId = existing?.id ?? newId("res");
    if (!existing) {
      await db.insert(s.formResponses).values({
        id: responseId,
        companyId: form.companyId,
        formId,
        cycleId: form.cycleId,
        employeeId: viewer.id,
        gradeId: form.gradeId,
        status: body.status,
        respondentNote: body.note ?? null,
        submittedAt: body.status === "submitted" ? new Date() : null,
      });
    } else {
      await db
        .update(s.formResponses)
        .set({
          status: body.status,
          respondentNote: body.note ?? null,
          submittedAt: body.status === "submitted" ? new Date() : null,
        })
        .where(eq(s.formResponses.id, responseId));
    }

    // 設問は同じフォームのものだけ受け付ける（他フォームのIDを混ぜられないようにする）
    const questions = await db.select({ id: s.formQuestions.id, required: s.formQuestions.required, title: s.formQuestions.title })
      .from(s.formQuestions)
      .where(eq(s.formQuestions.formId, formId));
    const valid = new Set(questions.map((q) => q.id));
    const incoming = body.answers.filter((a) => valid.has(a.questionId));

    if (body.status === "submitted") {
      const answered = new Set(
        incoming.filter((a) => a.valueNumber !== null && a.valueNumber !== undefined).map((a) => a.questionId),
      );
      const missing = questions.filter((q) => q.required && !answered.has(q.id));
      if (missing.length > 0) {
        throw new HttpError(
          400,
          `未入力の項目が${missing.length}件あります（例：${missing[0].title}）。入力してから提出してください。`,
        );
      }
    }

    await db.delete(s.formAnswers).where(eq(s.formAnswers.responseId, responseId));
    await insertMany(
      (rows) => db.insert(s.formAnswers).values(rows),
      incoming.map((a) => ({
        id: newId("fa"),
        companyId: form.companyId,
        responseId,
        questionId: a.questionId,
        valueNumber: a.valueNumber ?? null,
        valueText: a.valueText ?? null,
      })),
    );

    return {
      responseId,
      status: body.status,
      savedAt: new Date().toISOString(),
      message: body.status === "submitted" ? "提出しました。" : "入力内容を保存しました。",
    };
  });
}
