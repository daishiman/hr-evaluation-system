import { isAnswered } from "@/lib/domain/answer-snapshot";
import { checkAnswerNumbers } from "@/lib/domain/number-input";
import { inScreenOrder } from "@/lib/question-order";

/** 提出の検査に要る設問の項目。保存の受け口が読む設問の行も、回答画面の設問（AnswerQuestion）も満たす */
export type SubmissionQuestion = {
  id: string;
  section: string;
  displayOrder: number;
  questionType: string;
  title: string;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  validationInteger?: boolean | null;
  unit?: string | null;
};

/** 送られてきた答えの1項目（保存の受け口が受け取る形） */
export type SubmittedAnswer = {
  questionId: string;
  valueNumber?: number | null;
  valueText?: string | null;
  /** 複数選択で選んだ選択肢の value。ほかの形式では使わない */
  valueChoices?: readonly string[] | null;
};

/** 保存する形にそろえた答え */
export type NormalizedAnswer<Q extends SubmissionQuestion> = {
  question: Q;
  valueNumber: number | null;
  valueText: string | null;
  valueJson: string | null;
};

/**
 * 送られてきた答えを、保存する形にそろえる。
 *
 * そのアンケートの設問でない答えは落とす（他フォームのIDを混ぜられないようにする）。
 * 文章と複数選択は数値の列を使わない。複数選択だけ value_json を使う
 * （列を空けたまま multi を保存できない状態だった）。
 */
export function normalizeAnswers<Q extends SubmissionQuestion>(
  questions: readonly Q[],
  answers: readonly SubmittedAnswer[],
): NormalizedAnswer<Q>[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answers.flatMap((a) => {
    const q = byId.get(a.questionId);
    if (!q) return [];
    const choices = a.valueChoices ?? null;
    return [
      {
        question: q,
        valueNumber: q.questionType === "text" || q.questionType === "multi" ? null : (a.valueNumber ?? null),
        valueText: a.valueText ?? null,
        valueJson: q.questionType === "multi" && choices ? JSON.stringify(choices) : null,
      },
    ];
  });
}

/** 未入力の知らせ。回答画面の確認の欄と、保存の受け口の断りが同じ文を使う */
export function missingAnswersMessage(missing: readonly { title: string }[]): string {
  return `未入力の項目が${missing.length}件あります（例：${missing[0].title}）。入力してから提出してください。`;
}

/**
 * 答えていない必須の設問を、回答画面の上から下の順に返す。
 *
 * 回答画面（確認の欄の知らせ・「最初の未入力の欄へ移る」）と、提出の検査（checkSubmission）がこの1つを使う。
 * 2か所で別に拾うと、画面の知らせと受け口の断りで、件数や「例：」に挙がる設問が食い違う。
 * 答えたかどうかの見方は呼ぶ側が渡す（画面は入力中の値を、受け口は送られた答えを見る）。
 */
export function missingRequired<Q extends { id: string; section: string; displayOrder: number; required: boolean }>(
  questions: readonly Q[],
  isAnsweredOf: (question: Q) => boolean,
): Q[] {
  return inScreenOrder(questions).filter((q) => q.required && !isAnsweredOf(q));
}

/**
 * 提出してよいかを見る（下書きには当てない。打っている最中に断ると入力が止まる）。
 *
 * 数値の範囲（0以上・1以上・整数だけ、など）→ 必須の順に見て、最初に見つかった断りを1つ返す。
 * どちらも回答画面の上からの順で選ぶ。送られた順のまま調べると、範囲を外れた欄が2つあるときに
 * 画面の下の欄を挙げることがある。
 *
 * 保存の受け口（saveResponse）と、管理者の試しの回答（FormAnswer の trial）が、この1つを使う。
 * 試しで「通った」答えが本物の提出で断られる、という食い違いを作らないため。
 */
export function checkSubmission<Q extends SubmissionQuestion>(
  questions: readonly Q[],
  answers: readonly NormalizedAnswer<Q>[],
): { ok: true } | { ok: false; message: string } {
  const screen = inScreenOrder(questions);
  const screenRank = new Map(screen.map((q, i) => [q.id, i]));
  const rankOf = (a: NormalizedAnswer<Q>) => screenRank.get(a.question.id) ?? screen.length;

  const range = checkAnswerNumbers(
    [...answers]
      .sort((a, b) => rankOf(a) - rankOf(b))
      .map((a) => ({
        title: a.question.title,
        validationMin: a.question.validationMin,
        validationMax: a.question.validationMax,
        validationInteger: a.question.validationInteger,
        unit: a.question.unit,
        value: a.valueNumber,
      })),
  );
  if (!range.ok) return range;

  const answeredIds = new Set(
    answers.filter((a) => isAnswered(a.question.questionType, a)).map((a) => a.question.id),
  );
  const missing = missingRequired(questions, (q) => answeredIds.has(q.id));
  if (missing.length > 0) return { ok: false, message: missingAnswersMessage(missing) };
  return { ok: true };
}
