/**
 * 回答時点の設問スナップショットと、設問形式ごとの「答えの入れ場所」。
 *
 * なぜスナップショットを取るか:
 *  form_answers.question_id は form_questions への外部キーで ON DELETE cascade。
 *  D1 では外部キー制約が実際に効くため、設問を1行消すと過去の回答も道連れで消える。
 *  API側に「回答があるアンケートの設問は編集不可」というガードはあるが、それは1枚の板でしかない。
 *  過去に自分が何を聞かれて何と答えたかは、回答行だけで読み返せるようにする。
 *
 * 設問形式ごとの入れ場所（作れる形式は全部答えられるようにする、という方針の実装箇所）:
 *  yesno  … value_number（はい=1 / いいえ=0）＋ value_text に選んだ言葉
 *  single … value_number（選択肢の score）＋ value_text に選んだ言葉
 *  scale  … value_number（段階の数値）
 *  number … value_number
 *  text   … value_text（自由記述。数値は入らない）
 *  multi  … value_json（選んだ選択肢の value の配列）＋ value_text に読める形の控え
 */

export type QuestionLike = {
  id: string;
  title: string;
  questionType: string;
  section: string;
  unit: string | null;
  optionsJson: string | null;
  displayOrder: number;
};

export interface QuestionSnapshot {
  questionTitle: string;
  questionType: string;
  questionSection: string;
  questionUnit: string | null;
  questionOptionsJson: string | null;
  questionDisplayOrder: number;
}

/** 回答行に写し取る設問の内容。回答を作る側（Web回答・CSV取込）は必ずこれを使う。 */
export function questionSnapshot(q: QuestionLike): QuestionSnapshot {
  return {
    questionTitle: q.title,
    questionType: q.questionType,
    questionSection: q.section,
    questionUnit: q.unit ?? null,
    questionOptionsJson: q.optionsJson ?? null,
    questionDisplayOrder: q.displayOrder,
  };
}

export type AnswerValueLike = {
  valueNumber: number | null | undefined;
  valueText: string | null | undefined;
  valueJson?: string | null | undefined;
};

/**
 * その設問に「答えた」と言えるか。必須チェックはこれで判定する。
 *
 * これまでは形式によらず value_number だけを見ていたため、
 * 必須の自由記述（text）は何を書いても「未入力」になり提出できなかった。
 */
export function isAnswered(questionType: string, v: AnswerValueLike | null | undefined): boolean {
  if (!v) return false;
  switch (questionType) {
    case "text":
      return typeof v.valueText === "string" && v.valueText.trim() !== "";
    case "multi":
      return parseMulti(v.valueJson).length > 0;
    default:
      return v.valueNumber !== null && v.valueNumber !== undefined;
  }
}

/** 複数選択の値（JSON文字列）を配列にする。壊れていても落とさず空扱いにする。 */
export function parseMulti(valueJson: string | null | undefined): string[] {
  if (!valueJson) return [];
  try {
    const parsed: unknown = JSON.parse(valueJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export type OptionLike = { value: string; label: string; score?: number };

export function parseOptions(optionsJson: string | null | undefined): OptionLike[] {
  if (!optionsJson) return [];
  try {
    const parsed: unknown = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o): o is OptionLike => !!o && typeof o === "object" && "value" in o && "label" in o);
  } catch {
    return [];
  }
}

/**
 * 過去の回答を読むときの1行分。
 *
 * スナップショットがある行はそれを正として描く（設問が将来変わっても当時の文面で読める）。
 * スナップショットが空の古い行だけ、いまの設問（form_questions）で補う。
 */
export interface AnswerReadRow {
  questionId: string;
  title: string;
  section: string;
  questionType: string;
  unit: string | null;
  options: OptionLike[];
  displayOrder: number;
  valueNumber: number | null;
  valueText: string | null;
  valueJson: string | null;
  /** 当時の設問が残っておらず、いまの設問で補ったか（画面で正直に断る） */
  fromCurrentQuestion: boolean;
}

type StoredAnswer = {
  questionId: string;
  valueNumber: number | null;
  valueText: string | null;
  valueJson: string | null;
  questionTitle: string | null;
  questionType: string | null;
  questionSection: string | null;
  questionUnit: string | null;
  questionOptionsJson: string | null;
  questionDisplayOrder: number | null;
};

export function toAnswerRows(answers: StoredAnswer[], currentQuestions: QuestionLike[]): AnswerReadRow[] {
  const byId = new Map(currentQuestions.map((q) => [q.id, q]));
  const rows = answers.map((a): AnswerReadRow => {
    const q = byId.get(a.questionId);
    const hasSnapshot = Boolean(a.questionTitle);
    return {
      questionId: a.questionId,
      title: a.questionTitle ?? q?.title ?? "（当時の設問文が残っていません）",
      section: a.questionSection ?? q?.section ?? "free",
      questionType: a.questionType ?? q?.questionType ?? "number",
      unit: a.questionUnit ?? q?.unit ?? null,
      options: parseOptions(a.questionOptionsJson ?? q?.optionsJson ?? null),
      displayOrder: a.questionDisplayOrder ?? q?.displayOrder ?? 9999,
      valueNumber: a.valueNumber,
      valueText: a.valueText,
      valueJson: a.valueJson,
      fromCurrentQuestion: !hasSnapshot,
    };
  });
  return rows.sort((a, b) => a.displayOrder - b.displayOrder);
}

/** 回答を人が読める1つの文字列にする。未回答は null（画面側で「未回答」と出す）。 */
export function formatAnswer(row: AnswerReadRow): string | null {
  if (row.questionType === "multi") {
    const picked = parseMulti(row.valueJson);
    if (picked.length === 0) return row.valueText?.trim() || null;
    const labels = picked.map((v) => row.options.find((o) => o.value === v)?.label ?? v);
    return labels.join("、");
  }
  if (row.questionType === "text") {
    return row.valueText?.trim() || null;
  }
  if (row.valueText && row.valueText.trim() !== "" && row.questionType !== "number") {
    return row.valueText.trim();
  }
  if (row.valueNumber === null || row.valueNumber === undefined) return row.valueText?.trim() || null;
  return row.unit ? `${row.valueNumber}${row.unit}` : String(row.valueNumber);
}
