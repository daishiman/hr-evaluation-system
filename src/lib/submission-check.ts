import { findChosenOption, isAnswered, optionScore, parseMulti, parseOptions, singleChoiceOptions } from "@/lib/domain/answer-snapshot";
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
  /** 選択肢（JSON）。1つ選ぶ設問の点数は、送られた数ではなくこれから決める */
  optionsJson?: string | null;
};

/** 送られてきた答えの1項目（保存の受け口が受け取る形） */
export type SubmittedAnswer = {
  questionId: string;
  valueNumber?: number | null;
  valueText?: string | null;
  /** 選んだ選択肢の value（単一選択は1つ、複数選択はいくつでも） */
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
 * 文章と複数選択は数値の列を使わない。選択値は単一・複数とも value_json に残す。
 * 1つ選ぶ設問は、明示選択値（無い旧回答は言葉・数）で探し、点数と言葉を選択肢から決め直す（DD-032 の8）。
 * 回答画面は配点を持たず、送られた数を信じると画面を通さずに好きな点数を保存できてしまうため。
 */
export function normalizeAnswers<Q extends SubmissionQuestion>(
  questions: readonly Q[],
  answers: readonly SubmittedAnswer[],
): NormalizedAnswer<Q>[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answers.flatMap((a) => {
    const q = byId.get(a.questionId);
    if (!q) return [];
    const options = singleChoiceOptions(q);
    if (options.length > 0) {
      const chosen = findChosenOption(options, { valueNumber: a.valueNumber, valueText: a.valueText, valueChoices: a.valueChoices });
      return [
        {
          question: q,
          valueNumber: chosen ? optionScore(chosen) : null,
          valueText: chosen ? chosen.label : null,
          // 不正な明示選択も残し、提出時の所属検査で断る（旧形式の配点で正当化しない）。
          valueJson: chosen ? JSON.stringify([String(chosen.value)]) : a.valueChoices != null ? JSON.stringify(a.valueChoices) : null,
        },
      ];
    }
    const choices = a.valueChoices ?? null;
    return [
      {
        question: q,
        valueNumber: q.questionType === "text" || q.questionType === "multi" || q.questionType === "single" ? null : (a.valueNumber ?? null),
        valueText: q.questionType === "single" ? null : a.valueText ?? null,
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
 * 数値欄の範囲（0以上・1以上・整数だけ、など）→ 選択肢への所属 → 必須の順に見て、最初の断りを1つ返す。
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
      .filter((a) => a.question.questionType === "number" ||
        (a.question.questionType === "scale" && singleChoiceOptions(a.question).length === 0))
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

  // 選択肢の妥当性は配点の範囲ではなく所属で見る。試しの回答にも配点は不要。
  for (const a of [...answers].sort((a, b) => rankOf(a) - rankOf(b))) {
    const singleOptions = singleChoiceOptions(a.question);
    const options = a.question.questionType === "multi" ? parseOptions(a.question.optionsJson) : singleOptions;
    if (options.length === 0) continue;
    const choices = parseMulti(a.valueJson);
    if ((a.question.questionType !== "multi" && choices.length > 1) ||
        choices.some((value) => !options.some((o) => String(o.value) === value)) ||
        (singleOptions.length > 0 && choices.length === 1 && findChosenOption(singleOptions, a) === null)) {
      return { ok: false, message: `「${a.question.title}」は登録された選択肢から選んでください。` };
    }
  }

  const answeredIds = new Set(
    answers.filter((a) => isAnswered(a.question.questionType, a)).map((a) => a.question.id),
  );
  const missing = missingRequired(questions, (q) => answeredIds.has(q.id));
  if (missing.length > 0) return { ok: false, message: missingAnswersMessage(missing) };
  return { ok: true };
}
