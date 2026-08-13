export interface BuilderQuestion {
  id?: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  validationInteger: boolean;
  options: { value: string; label: string; score?: number }[];
  isGate: boolean;
  linkLabel: string | null;
  gradeRequirementId: string | null;
  promotionRequirementId: string | null;
  behaviorGuidelineId: string | null;
  kpiItemId: string | null;
  kpiQuestionKey: string | null;
}

export type BuilderQuestionDraft = BuilderQuestion & { clientKey: string };

/** 保存済みIDがある設問と未保存の設問の双方へ、画面内で変わらないキーを付ける。 */
export function withClientKeys(rows: BuilderQuestion[]): BuilderQuestionDraft[] {
  return rows.map((row, index) => ({
    ...row,
    clientKey: row.id ? `saved:${row.id}` : `initial:${index}`,
  }));
}

export function createBlankQuestion(
  section: string,
  questionType: string,
  clientKey: string,
): BuilderQuestionDraft {
  return {
    clientKey,
    section,
    questionType,
    title: "",
    helpText: null,
    unit: null,
    required: true,
    validationMin: questionType === "number" ? 0 : null,
    validationMax: null,
    // 単位が決まっていない新しい設問は、まず小数を許す。
    validationInteger: false,
    options:
      questionType === "single" || questionType === "multi"
        ? [
            { value: "1", label: "選択肢1" },
            { value: "2", label: "選択肢2" },
          ]
        : [],
    // 直前の設問が連携済みでも、新規設問は自由設問として作る。
    isGate: false,
    linkLabel: null,
    gradeRequirementId: null,
    promotionRequirementId: null,
    behaviorGuidelineId: null,
    kpiItemId: null,
    kpiQuestionKey: null,
  };
}

export function insertBlankQuestionAfter(
  rows: BuilderQuestionDraft[],
  index: number,
  clientKey: string,
): { rows: BuilderQuestionDraft[]; openKey: string } {
  const source = rows[index];
  if (!source) return { rows, openKey: clientKey };
  const next = [...rows];
  next.splice(index + 1, 0, createBlankQuestion(source.section, source.questionType, clientKey));
  return { rows: next, openKey: clientKey };
}
