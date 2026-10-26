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
 *  yesno  … value_number（選択肢の配点。素の はい=1 / いいえ=0）＋ value_text に選んだ言葉
 *  single … value_number（選択肢の score。無ければ数字の value）＋ value_text に選んだ言葉
 *           （点数を持たない選択肢は value_number が空で、言葉だけが入る）
 *  scale  … value_number（選択肢付きは配点、選択肢なしは段階の数値）
 *  number … value_number
 *  text   … value_text（自由記述。数値は入らない）
 *  multi  … value_json（選んだ選択肢の value の配列）＋ value_text に読める形の控え
 *           （回答画面の手元では valueChoices に配列のまま持つ）
 *  yesno / single / 選択肢付きscale は value_json に選択値1つも残す。
 *  value_number の配点と選択肢の value が衝突しても識別でき、古い行は配点と言葉で読む。
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
  /** 選んだ value の配列（単一選択は1つ）。保存すると value_json になる */
  valueChoices?: readonly string[] | null | undefined;
};

/**
 * その設問に「答えた」と言えるか。必須チェックはこれで判定する。
 *
 * これまでは形式によらず value_number だけを見ていたため、
 * 必須の自由記述（text）は何を書いても「未入力」になり提出できなかった。
 * 複数選択も保存済みの形（value_json）しか見ておらず、画面で押しても回答数が増えなかった。
 */
export function isAnswered(questionType: string, v: AnswerValueLike | null | undefined): boolean {
  if (!v) return false;
  const hasText = typeof v.valueText === "string" && v.valueText.trim() !== "";
  const hasNumber = v.valueNumber !== null && v.valueNumber !== undefined;
  switch (questionType) {
    case "text":
      return hasText;
    case "multi":
      return (v.valueChoices ?? parseMulti(v.valueJson)).length > 0;
    case "single":
    case "yesno":
    case "scale":
      if (v.valueChoices != null || v.valueJson != null) {
        return (v.valueChoices ?? parseMulti(v.valueJson)).length === 1;
      }
      // 点数を持たない（値が数字でない）選択肢は、選んだ言葉だけが入る
      return hasNumber || (questionType === "single" && hasText);
    default:
      return hasNumber;
  }
}

/** 選択値（JSON文字列）を配列にする。壊れていても落とさず空扱いにする。 */
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
    return parsed.filter((o): o is OptionLike => !!o && typeof o === "object" && "value" in o && "label" in o)
      .map((o) => ({ ...o, value: String(o.value), label: String(o.label) }));
  } catch {
    return [];
  }
}

/**
 * 選択肢の点数。score を優先し、無ければ値（value）を数字として読む。
 *
 * 素の Number(value) だと、数字でない値は NaN になって選択中にならず、
 * 空白だけの値は 0 点になる。どちらも点数なし（null）として扱う。
 */
export function optionScore(o: OptionLike): number | null {
  if (typeof o.score === "number" && Number.isFinite(o.score)) return o.score;
  // 古いデータでは value が数のまま入っていることがあるので、文字にしてから読む
  const text = String(o.value).trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** 1つ選ぶ設問の編集値。配点は使わず、公開valueと言葉と明示選択を持つ。 */
export function optionAnswer(o: OptionLike): { valueNumber: number | null; valueText: string; valueChoices: string[] } {
  return { valueNumber: optionScore({ value: o.value, label: o.label }), valueText: o.label, valueChoices: [String(o.value)] };
}

/**
 * 1つ選ぶ設問で、その選択肢が選ばれているか。
 *
 * 明示した選択値があればそれを優先する。不正・複数の明示値は旧形式で補わない。
 * 明示値が無い旧回答だけ、以下の互換判定を使う。
 * 値や点数が重なった古いデータでも押した1つだけを選択中にするため、選んだ言葉（value_text）を先に見る。
 * 同じ言葉の選択肢が複数あるときは点数で絞る。言葉がどの選択肢とも合わないとき
 * （取込で値や「○」と書かれた行など）だけ点数で照らす。
 * options には o を含む同じ設問の選択肢を全部渡す（省くと、この選択肢だけを候補とみなす）。
 */
export function isOptionSelected(
  o: OptionLike,
  v: AnswerValueLike | null | undefined,
  options: readonly OptionLike[] = [o],
): boolean {
  if (!v) return false;
  if (v.valueChoices != null || v.valueJson != null) return findChosenOption(options, v) === o;
  const byScore = (xs: readonly OptionLike[]) =>
    xs.filter((x) => {
      const score = optionScore(x);
      return score !== null && score === v.valueNumber;
    });
  const text = v.valueText?.trim();
  const byText = text ? options.filter((x) => String(x.label).trim() === text) : [];
  if (byText.length === 0) return byScore([o]).length > 0;
  const both = byScore(byText);
  return (both.length > 0 ? both : byText).includes(o);
}

/** 設問と一緒に作られた文言が無い「はい／いいえ」の設問で選ばせる選択肢 */
const PLAIN_YES_NO: readonly OptionLike[] = [
  { value: "1", label: "はい" },
  { value: "0", label: "いいえ" },
];

/**
 * 「はい／いいえ」の設問で選ばせる選択肢。
 * 「はい」がどちらの意味かは設問ごとに違うので、設問と一緒に作られた文言が2つ以上あればそれを使い、
 * 無いときだけ素の はい／いいえ にする。回答画面と採点（submission-check.ts）が同じものを使う。
 */
export function yesNoOptions(options: readonly OptionLike[]): readonly OptionLike[] {
  return options.length >= 2 ? options : PLAIN_YES_NO;
}

/** 回答画面・保存・編集初期値が同じ選択肢を使う。段階だけのscaleは空。 */
export function singleChoiceOptions(q: { questionType: string; optionsJson?: string | null }): readonly OptionLike[] {
  const options = parseOptions(q.optionsJson);
  if (q.questionType === "yesno") return yesNoOptions(options);
  return q.questionType === "single" || q.questionType === "scale" ? options : [];
}

/**
 * 1つ選ぶ設問で選ばれた選択肢を、サーバーが持つ選択肢から探す（DD-032 の8）。
 *
 * 明示した選択値（valueChoices / 保存済みのvalueJson）を先に読む。
 * 値が重複した旧設問は言葉も合わせる。不正な値・複数の単一選択は旧形式へ戻さない。
 * 明示値が無い旧回答だけ、言葉→配点→数値のvalueの互換順で読む。
 * 言葉がどの選択肢とも合わないときだけ、送られた数を選択肢の配点と照らす（isOptionSelected と同じ見方）。
 * どれとも合わなければ null（答えなし）。どの道でも、保存する点数は選択肢の配点の中からしか出ない。
 */
export function findChosenOption(
  options: readonly OptionLike[],
  v: AnswerValueLike,
): OptionLike | null {
  if (v.valueChoices != null || v.valueJson != null) {
    const choices = v.valueChoices ?? parseMulti(v.valueJson);
    if (choices.length !== 1) return null;
    const byValue = options.filter((o) => String(o.value) === choices[0]);
    if (byValue.length === 1) return byValue[0];
    const byLabel = byValue.filter((o) => String(o.label).trim() === v.valueText?.trim());
    return byLabel.length === 1 ? byLabel[0] : null;
  }
  const n = v.valueNumber ?? null;
  const scoreIs = (o: OptionLike) => n !== null && optionScore(o) === n;
  const valueIs = (o: OptionLike) => n !== null && optionScore({ value: o.value, label: o.label }) === n;
  const text = v.valueText?.trim();
  const byText = text ? options.filter((o) => String(o.label).trim() === text) : [];
  if (byText.length === 0) return options.find(scoreIs) ?? null;
  if (byText.length === 1) return byText[0];
  return byText.find(scoreIs) ?? byText.find(valueIs) ?? byText[0];
}

/**
 * 段階選択（scale）に表示する数値。
 *
 * 回答画面と管理者プレビューで同じ段階を見せるため、表示側に計算を重複させない。
 * 範囲が未設定・逆転・広すぎる場合は、回答画面の安全な既定値 1〜5 に戻す。
 */
export function scaleSteps(q: { validationMin: number | null; validationMax: number | null }): number[] {
  const min = q.validationMin ?? 1;
  const max = q.validationMax ?? 5;
  if (max <= min || max - min > 10) {
    return [1, 2, 3, 4, 5];
  }
  const steps: number[] = [];
  for (let n = min; n <= max; n++) steps.push(n);
  return steps;
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
