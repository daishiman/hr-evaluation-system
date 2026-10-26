import type { AnswerQuestion, AnswerValue } from "@/components/QuestionField";
import { findChosenOption, optionAnswer, parseMulti, singleChoiceOptions, type AnswerValueLike } from "@/lib/domain/answer-snapshot";
import { stripOptionScores } from "@/lib/domain/form-visibility";

/**
 * 回答画面（本物の回答と、管理者の試しの回答）へ渡す設問の形。
 * 行には配点や昇格の要件も入っているが、回答に要る項目だけを渡す。
 * props はページに埋め込まれて読めるので、選択肢の配点も外す。採点はサーバーだけが行う（submission-check.ts）。
 */
export function toAnswerQuestions(rows: readonly AnswerQuestion[]): AnswerQuestion[] {
  return rows.map((q) => ({
    id: q.id,
    section: q.section,
    questionType: q.questionType,
    title: q.title,
    helpText: q.helpText,
    unit: q.unit,
    required: q.required,
    validationMin: q.validationMin,
    validationMax: q.validationMax,
    validationInteger: q.validationInteger,
    optionsJson: stripOptionScores(q.optionsJson),
    displayOrder: q.displayOrder,
  }));
}

/**
 * 保存済みの採点結果を、配点を持たない編集初期値へ戻す。
 * 配点を落とす前のサーバー設問で旧回答も同定し、公開するのは選択値と言葉だけにする。
 * 保存行を spread しない（設問スナップショットにも配点が入っている）。
 */
export function toAnswerValues(
  questions: readonly Pick<AnswerQuestion, "id" | "questionType" | "optionsJson">[],
  answers: readonly (AnswerValueLike & { questionId: string })[],
): AnswerValue[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answers.flatMap((a) => {
    const q = byId.get(a.questionId);
    if (!q) return [];
    const options = singleChoiceOptions(q);
    if (options.length > 0) {
      const chosen = findChosenOption(options, a);
      return [{ questionId: q.id, ...(chosen ? optionAnswer(chosen) : { valueNumber: null, valueText: null, valueChoices: null }) }];
    }
    return [{
      questionId: q.id,
      valueNumber: q.questionType === "text" || q.questionType === "multi" || q.questionType === "single" ? null : a.valueNumber ?? null,
      valueText: q.questionType === "single" ? null : a.valueText ?? null,
      valueChoices: q.questionType === "multi" ? [...(a.valueChoices ?? parseMulti(a.valueJson))] : null,
    }];
  });
}
