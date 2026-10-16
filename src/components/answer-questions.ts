import type { AnswerQuestion } from "@/components/QuestionField";

/**
 * 設問の行（listFormQuestions）から、回答画面（FormAnswer）に渡す項目だけを取り出す。
 *
 * 回答画面（/me/forms/[id]）と、管理者の試しの回答（/forms/[id]?try=1）が同じ1つを使う。
 * 片方だけ項目を足し忘れると、試しでは通る数が本物では断られる（整数だけの欄など）。
 * 配点や昇格の要件（isGate など）は、行に入っていても回答画面へは渡さない。
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
    optionsJson: q.optionsJson,
    displayOrder: q.displayOrder,
  }));
}
