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

/** 保存応答で届いた設問が、今回送った内容か。新規のIDは採番されるが、既存のIDは変わらない。 */
export function matchesSavedQuestions(sent: readonly BuilderQuestion[], saved: readonly BuilderQuestion[]): boolean {
  const content = (row: BuilderQuestion) => JSON.stringify([
    row.section, row.questionType, row.title.trim(), row.helpText, row.unit, row.required,
    row.validationMin, row.validationMax, row.questionType === "number" ? row.validationInteger : false,
    row.options, row.isGate, row.gradeRequirementId, row.promotionRequirementId,
    row.behaviorGuidelineId, row.kpiItemId, row.kpiQuestionKey,
  ]);
  return sent.length === saved.length && sent.every((row, index) =>
    (!row.id || row.id === saved[index].id) && content(row) === content(saved[index]),
  );
}

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

/**
 * 選択肢を足すときの値。今ある数字の値の最大＋1（数字でない値は数えない）。
 *
 * 件数＋1 で作ると、途中の選択肢を消してから足したときに既存の値と重なり、
 * 回答画面で2つの選択肢が一緒に光って押した方が選べないように見えていた。
 */
export function nextOptionValue(options: readonly { value: string }[]): string {
  let max = 0;
  for (const o of options) {
    const text = o.value.trim();
    const n = Number(text);
    if (text !== "" && Number.isInteger(n) && n > max) max = n;
  }
  return String(max + 1);
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

/**
 * 並べ替えの部品（ReorderList）が渡す並び（キーの配列）で、行を並べ直す（S11）。
 * キーの集まりが今の行と食い違えば（並べている間に足した・消した）、並べ直さずに元の行を返す。
 */
export function reorderByKeys<T>(rows: readonly T[], keys: readonly string[], keyOf: (row: T) => string): T[] {
  const byKey = new Map(rows.map((row) => [keyOf(row), row]));
  if (byKey.size !== rows.length || keys.length !== rows.length || new Set(keys).size !== keys.length) return [...rows];
  const next = keys.map((key) => byKey.get(key));
  return next.every((row) => row !== undefined) ? (next as T[]) : [...rows];
}

/**
 * 選択肢の並べ替えに使うキー。値をそのまま使い、同じ値が重なるとき（保存前の入力途中・古いデータ）だけ
 * 2つ目から「値#2」のように何番目の重なりかを付ける。表示の文言はキーに使わない（打つたびにキーが変わり、入力欄が作り直されるため）。
 */
export function optionKeys(options: readonly { value: string }[]): string[] {
  const seen = new Map<string, number>();
  const reserved = new Set(options.map((option) => option.value));
  const used = new Set<string>();
  return options.map((o) => {
    const count = (seen.get(o.value) ?? 0) + 1;
    seen.set(o.value, count);
    let suffix = count;
    let key = count === 1 ? o.value : `${o.value}#${suffix}`;
    while (used.has(key) || (count > 1 && reserved.has(key))) key = `${o.value}#${++suffix}`;
    used.add(key);
    return key;
  });
}
