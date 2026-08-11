import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, insertMany, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { judgeFormDeadline } from "@/lib/domain/form-deadline";
import { isAnswered, questionSnapshot } from "@/lib/domain/answer-snapshot";
import { checkAnswerNumbers } from "@/lib/domain/number-input";

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
        /** 複数選択で選んだ選択肢の value。ほかの形式では使わない */
        valueChoices: z.array(z.string().max(200)).max(100).nullish(),
      }),
    )
    .max(500),
});

/**
 * アンケートの回答を保存する。
 *
 * 保存できるのは「自分の等級のアンケート」に対する「自分の回答」だけ。
 * 画面を経由せずここを直接叩かれても、他人の回答は作れない。
 *
 * 回答期間（opens_at / closes_at）はここで必ず判定する。
 * 画面のボタンを消すだけでは、URLを直接叩かれたときに素通りしてしまうため。
 * 下書きの自動保存も締切後は受け付けない——「保存はできたのに提出はできない」状態にすると、
 * 入力し終えてから初めて締切に気づくことになり、いちばん徒労が大きいため。
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
    if (form.gradeId !== viewer.gradeId) throw new HttpError(403, "この等級向けのアンケートではありません。");

    // この人にだけ与えられた期限の延長（取り消されていないもの）
    const extensions = await db
      .select({ extendedUntil: s.formDeadlineExtensions.extendedUntil })
      .from(s.formDeadlineExtensions)
      .where(
        and(
          eq(s.formDeadlineExtensions.formId, form.id),
          eq(s.formDeadlineExtensions.employeeId, viewer.id),
          isNull(s.formDeadlineExtensions.revokedAt),
        ),
      );

    const judgement = judgeFormDeadline({
      status: form.status,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      extensions: extensions.map((e) => e.extendedUntil),
      now: new Date(),
    });
    if (!judgement.canAnswer) throw new HttpError(400, judgement.message);

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

    /* 設問の読み込みと検査は、回答の状態を書き換える前に済ませる。
       順番が逆だと、断られた提出でも「提出済み」の印だけが残り、
       その人は二度と自分で直せなくなる（実際にそうなっていた）。 */

    // 設問は同じフォームのものだけ受け付ける（他フォームのIDを混ぜられないようにする）
    const questions = await db
      .select()
      .from(s.formQuestions)
      .where(eq(s.formQuestions.formId, formId));
    const byId = new Map(questions.map((q) => [q.id, q]));

    const incoming = body.answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => {
        const q = byId.get(a.questionId)!;
        const choices = a.valueChoices ?? null;
        return {
          question: q,
          valueNumber: q.questionType === "text" || q.questionType === "multi" ? null : (a.valueNumber ?? null),
          valueText: a.valueText ?? null,
          // 複数選択だけ value_json を使う（列を空けたまま multi を保存できない状態だった）
          valueJson: q.questionType === "multi" && choices ? JSON.stringify(choices) : null,
        };
      });

    if (body.status === "submitted") {
      /* 数値の回答が設問の決まり（0以上・1以上など）に収まっているかを、受け口の側でも見る。
         画面の制限だけでは、画面を通さずに送られたときに素通りするため。
         下書きの自動保存には当てない（打っている最中に断ると入力が止まる）。 */
      const range = checkAnswerNumbers(
        incoming.map((a) => ({
          title: a.question.title,
          validationMin: a.question.validationMin,
          validationMax: a.question.validationMax,
          value: a.valueNumber,
        })),
      );
      if (!range.ok) throw new HttpError(400, range.message);

      const answeredIds = new Set(
        incoming.filter((a) => isAnswered(a.question.questionType, a)).map((a) => a.question.id),
      );
      const missing = questions.filter((q) => q.required && !answeredIds.has(q.id));
      if (missing.length > 0) {
        throw new HttpError(
          400,
          `未入力の項目が${missing.length}件あります（例：${missing[0].title}）。入力してから提出してください。`,
        );
      }
    }

    const responseId = existing?.id ?? newId("res");
    if (!existing) {
      // 回答時点の所属事業所を写し取る。
      // 期中に異動すると、いまの所属で賞与の事業所KGI係数が決まってしまい、
      // 「実績を出した事業所」と「係数を借りた事業所」がずれるため（CSV取込では以前から写している）。
      const me = (
        await db.select({ officeId: s.users.officeId }).from(s.users).where(eq(s.users.id, viewer.id)).limit(1)
      )[0];
      await db.insert(s.formResponses).values({
        id: responseId,
        companyId: form.companyId,
        formId,
        cycleId: form.cycleId,
        employeeId: viewer.id,
        gradeId: form.gradeId,
        officeId: me?.officeId ?? null,
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

    await db.delete(s.formAnswers).where(eq(s.formAnswers.responseId, responseId));
    await insertMany(
      (rows) => db.insert(s.formAnswers).values(rows),
      incoming.map((a) => ({
        id: newId("fa"),
        companyId: form.companyId,
        responseId,
        questionId: a.question.id,
        valueNumber: a.valueNumber,
        valueText: a.valueText,
        valueJson: a.valueJson,
        // 当時の設問文をこの行に写し取る（設問が将来変わっても、当時の文面で読み返せるようにする）
        ...questionSnapshot(a.question),
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
