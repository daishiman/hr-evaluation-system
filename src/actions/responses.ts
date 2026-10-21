"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { judgeFormDeadline } from "@/lib/domain/form-deadline";
import { canAnswerForm } from "@/lib/domain/form-entry";
import { questionSnapshot } from "@/lib/domain/answer-snapshot";
import { saveResponseWithAnswers } from "@/lib/response-write";
import { getForm } from "@/lib/queries";
import { checkSubmission, normalizeAnswers } from "@/lib/submission-check";

const responseSchema = z.object({
  formId: z.string().min(1),
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
 * アンケートの回答を保存する（下書きの自動保存と提出）。
 *
 * 保存できるのは「自分の等級のアンケート」に対する「自分の回答」だけ。
 * 画面を経由せずここを直接呼ばれても、他人の回答は作れない。
 *
 * 回答期間（opens_at / closes_at）はここで必ず判定する。
 * 画面のボタンを消すだけでは、直接呼ばれたときに素通りしてしまうため。
 * 下書きの自動保存も締切後は受け付けない——「保存はできたのに提出はできない」状態にすると、
 * 入力し終えてから初めて締切に気づくことになり、いちばん徒労が大きいため。
 */
export async function saveResponse(raw: unknown) {
  return runAction({ operation: "responses.save", input: responseSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const formId = input.formId;
    const db = await getDb();

    const form = await getForm(viewer.companyId, formId);
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");
    // 中身は誰でも読めるが、書けるのは自分の等級のアンケートだけ。
    // 画面で入力欄を出さないことは制御ではないので、ここで必ず弾く（下書きの自動保存も同じ扱い）。
    if (!canAnswerForm(viewer.gradeId, form.gradeId)) {
      throw new HttpError(403, "この等級向けのアンケートではないため、回答できません。内容の確認のみできます。");
    }

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
      cycleStatus: form.cycleStatus ?? "unknown",
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
    // 設問でない答えを落とし、形式ごとの列にそろえる（submission-check.ts）
    const incoming = normalizeAnswers(questions, input.answers);

    if (input.status === "submitted") {
      /* 数値の範囲と必須を、受け口の側でも見る（画面の制限だけでは、画面を通さずに送られたときに素通りする）。
         断るときに挙げる欄は、回答画面の上から最初のもの。管理者の試しの回答も同じ検査を使う。 */
      const check = checkSubmission(questions, incoming);
      if (!check.ok) throw new HttpError(400, check.message);
    }

    const responseId = existing?.id ?? newId("res");
    // 回答時点の所属事業所を写し取る。評価レポートの見出しの事業所はこの写しを使う。
    // 期中に異動しても「実績を出した事業所」のまま残すため（CSV取込でも写している）。
    // 事業所は会社ごとの値なので、いまの会社での所属の値（viewer.officeId）を使う。
    const officeId = existing ? existing.officeId : (viewer.officeId ?? null);

    const answerRows = incoming.map((a) => ({
      id: newId("fa"),
      companyId: form.companyId,
      responseId,
      questionId: a.question.id,
      valueNumber: a.valueNumber,
      valueText: a.valueText,
      valueJson: a.valueJson,
      // 当時の設問文をこの行に写し取る（設問が将来変わっても、当時の文面で読み返せるようにする）
      ...questionSnapshot(a.question),
    }));

    /* responseの状態と回答本文は1つのD1 transactionで確定する。
       子行の途中で失敗しても、提出済みの印だけ・回答の一部だけを残さない。 */
    await saveResponseWithAnswers(
      db,
      {
        id: responseId,
        companyId: form.companyId,
        formId,
        cycleId: form.cycleId,
        employeeId: viewer.id,
        gradeId: form.gradeId,
        officeId,
        status: input.status,
        respondentNote: input.note ?? null,
        submittedAt: input.status === "submitted" ? new Date() : null,
      },
      answerRows,
      Boolean(existing),
    );

    return {
      responseId,
      status: input.status,
      savedAt: new Date().toISOString(),
      message: input.status === "submitted" ? "提出しました。" : "入力内容を保存しました。",
    };
  });
}
