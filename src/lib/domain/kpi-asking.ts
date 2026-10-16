/**
 * KPI項目の「実績の聞き方」を画面で組むための決まり（DD-016）。
 *
 * 聞き方は、アンケートで聞く数（設問のひな形 kpi_questions）と、その答えから実績値を出す
 * 計算式（kpi_items.formula）の組でできている。画面では設問を A・B・C… の文字で並べ、
 * 式も文字で書いてもらう。保存するときに文字を設問ID（q5_1 など）へ置き換える。
 * 設問IDを人に打たせると、打ち間違いがそのまま「理由の分からない判定外」になるため。
 *
 * 設問の役割（分子・分母など）は人に選ばせず、式から決める。役割は基準の画面の表示にだけ
 * 使われ、点の計算は式だけで決まる。選ばせると、式と食い違った表示が残りうる。
 */
import { FormulaError, splitFormulaNote, variablePlacements } from "@/lib/domain/formula";
import { parseChoiceValidation } from "@/lib/domain/form-question-text";

/**
 * 式の中で【】で囲んで使える、等級から決まる値。
 * 値の出し方は gradeFormulaValues にまとめ、点の計算（src/lib/evaluate.ts）と同じものを使う。
 */
export const GRADE_FORMULA_VARIABLES = ["等級別の半期目標設定上限数", "等級別の1人あたり必要回数"] as const;

/** 等級から決まる値を、式の変数として渡せる形にする。 */
export function gradeFormulaValues(grade: { targetCap: number; pointGroup: string }): Record<string, number> {
  const [cap, perPerson] = GRADE_FORMULA_VARIABLES;
  return { [cap]: grade.targetCap, [perPerson]: grade.pointGroup === "AM" ? 3 : 2 };
}

/** 1項目で聞ける数の上限と、画面で設問を指す文字。見本のいちばん多い項目は4つ。 */
export const ASKING_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export const ASKING_LIMIT = ASKING_LETTERS.length;

/**
 * 画面で選べる入力の決まり。どれもアンケートの入力欄（form-question-text.ts）が読める文言で、
 * 見本の数の設問はすべてこの4つのどれかを使っている。
 */
export const ASKING_VALIDATIONS = ["0以上の整数", "1以上の整数", "整数（マイナス可）", "0より大きい数値"] as const;
export type AskingValidation = (typeof ASKING_VALIDATIONS)[number];
export const DEFAULT_ASKING_VALIDATION: AskingValidation = "0以上の整数";

export function isAskingValidation(v: string): v is AskingValidation {
  return (ASKING_VALIDATIONS as readonly string[]).includes(v);
}

export type KpiQuestionRole = "numerator" | "denominator" | "denominator_subtract" | "direct" | "identify";

export const KPI_QUESTION_ROLE_LABEL: Record<KpiQuestionRole, string> = {
  numerator: "分子",
  denominator: "分母",
  denominator_subtract: "分母から引く",
  direct: "そのまま実績値",
  identify: "識別のため",
};

/** 保存された役割の表示名。知らない値はそのまま出す。 */
export function roleLabel(role: string): string {
  return (KPI_QUESTION_ROLE_LABEL as Record<string, string>)[role] ?? role;
}

const IDENT_START = /[A-Za-z_Ａ-Ｚａ-ｚ＿]/;
const IDENT_PART = /[A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]/;

function toHalfWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９＿]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 式の本体に出てくる名前（A や q5_1）だけを差し替える。全角の英字は半角に直してから渡す。
 * 【】の中と、末尾の人向けの注釈（「※…」や日本語の括弧書き）には触れない。
 */
function rewriteNames(formula: string, replace: (name: string) => string): string {
  const { body, note } = splitFormulaNote(formula);
  let out = "";
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === "【") {
      const end = body.indexOf("】", i);
      const stop = end < 0 ? body.length : end + 1;
      out += body.slice(i, stop);
      i = stop;
      continue;
    }
    if (IDENT_START.test(c)) {
      let j = i + 1;
      while (j < body.length && IDENT_PART.test(body[j])) j++;
      out += replace(toHalfWidth(body.slice(i, j)));
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out + note;
}

function letterIndex(name: string): number {
  return name.length === 1 ? (ASKING_LETTERS as readonly string[]).indexOf(name.toUpperCase()) : -1;
}

/** 文字で書いた式を、設問IDの式にする。keys[0] が A。 */
export function lettersToKeys(formula: string, keys: readonly string[]): string {
  return rewriteNames(formula, (name) => {
    const i = letterIndex(name);
    return i >= 0 && i < keys.length ? keys[i] : name;
  });
}

/** 設問IDの式を、画面で見せる文字の式にする。この項目の設問でない名前はそのまま残す。 */
export function keysToLetters(formula: string, keys: readonly string[]): string {
  return rewriteNames(formula, (name) => {
    const i = keys.indexOf(name);
    return i >= 0 && i < ASKING_LETTERS.length ? ASKING_LETTERS[i] : name;
  });
}

/** 消した設問を指していた文字の跡。半角の名前ではないので、どの設問とも読まれない。 */
export const DELETED_QUESTION_MARK = "？";

/**
 * 設問の並びが変わったとき、式の文字を同じ設問を指すように付け替える。
 * fromIds が変わる前の並び（fromIds[0] が A）、toIds が変わった後の並び。画面の行のIDで渡す。
 * 消えた設問を指していた文字は DELETED_QUESTION_MARK にする。詰めた後の文字のままだと、
 * 式が黙って別の設問を指してしまうため。
 */
export function remapAskingLetters(formula: string, fromIds: readonly string[], toIds: readonly string[]): string {
  return rewriteNames(formula, (name) => {
    const i = letterIndex(name);
    if (i < 0 || i >= fromIds.length) return name;
    const j = toIds.indexOf(fromIds[i]);
    return j >= 0 ? ASKING_LETTERS[j] : DELETED_QUESTION_MARK;
  });
}

function letterRange(count: number): string {
  return count === 1 ? "A" : `A〜${ASKING_LETTERS[count - 1]}`;
}

/**
 * 文字で書いた式が、count 個の設問の聞き方として使えるかを確かめる。使えれば null、
 * 使えなければ直し方の分かる一文を返す。画面のその場の表示と、保存のときの検査で同じものを使う。
 */
export function checkAskingFormula(formula: string, count: number): string | null {
  if (count < 1) return "聞くことを1つ以上足してください。";
  if (count > ASKING_LIMIT) return `聞くことは${ASKING_LIMIT}つまでです。`;
  const { body } = splitFormulaNote(formula);
  if (body.trim() === "") return "計算式を入れてください。";
  if (body.includes(DELETED_QUESTION_MARK)) {
    return `計算式の「${DELETED_QUESTION_MARK}」は、消した設問のあった場所です。式を直してください。`;
  }

  const letters = ASKING_LETTERS.slice(0, count) as readonly string[];
  const used = new Set<string>();
  const unknown: string[] = [];
  const normalized = rewriteNames(formula, (name) => {
    const letter = name.length === 1 ? name.toUpperCase() : name;
    if (letters.includes(letter)) used.add(letter);
    else unknown.push(name);
    return letter;
  });
  if (unknown.length > 0) {
    return `計算式の「${unknown[0]}」は使えません。設問は${letterRange(count)}の文字で指してください。`;
  }
  for (const m of body.matchAll(/【([^】]*)】/g)) {
    if (!(GRADE_FORMULA_VARIABLES as readonly string[]).includes(m[1])) {
      const allowed = GRADE_FORMULA_VARIABLES.map((v) => `【${v}】`).join("と");
      return `【${m[1]}】は使えません。【】で使える値は${allowed}だけです。`;
    }
  }
  const unused = letters.filter((l) => !used.has(l));
  if (unused.length > 0) {
    return `設問${unused.join("・")}が計算式に入っていません。使わない設問は消してください。`;
  }
  try {
    variablePlacements(normalized);
  } catch (e) {
    if (e instanceof FormulaError) return e.message;
    throw e;
  }
  return null;
}

/**
 * 設問IDの式から、各設問の役割を決める（keys と同じ順で返す）。
 * 分母に何もない式は、1問ならそのまま実績値、2問以上なら合算の分子。
 * 分母がある式は、分母に入っている設問が分母（引かれていれば分母から引く）、残りが分子。
 * 見本の33項目の役割は、すべてこの決め方と一致する（kpi-asking.test.ts）。
 * 式として読めなければ FormulaError を投げる。
 */
export function deriveQuestionRoles(keyFormula: string, keys: readonly string[]): KpiQuestionRole[] {
  const placements = variablePlacements(keyFormula);
  const hasDenominator = placements.some((p) => p.inDenominator);
  return keys.map((key) => {
    if (!hasDenominator) return keys.length === 1 ? "direct" : "numerator";
    const inDenominator = placements.filter((p) => p.name === key && p.inDenominator);
    if (inDenominator.length === 0) return "numerator";
    return inDenominator.every((p) => p.subtracted) ? "denominator_subtract" : "denominator";
  });
}

/** 文字で書いた式から、画面の並び順の役割を出す。式が使えなければ null（役割は出さない）。 */
export function askingRoles(formula: string, count: number): KpiQuestionRole[] | null {
  if (checkAskingFormula(formula, count) !== null) return null;
  const letters = ASKING_LETTERS.slice(0, count) as readonly string[];
  return deriveQuestionRoles(lettersToKeys(formula, letters), letters);
}

/**
 * 新しい設問のID。q{項目No}_{n} の n は、この項目の設問と、会社の中で使われたことのあるID
 * （ひな形と、作ったアンケートの設問が覚えているID）のどれより大きい数から振る。
 * 消した設問のIDを使い回すと、下書きのアンケートに残った古い設問が、意味の違う新しい設問の
 * 答えとして数えられてしまうため。
 */
export function nextQuestionKeys(itemNo: number, takenKeys: Iterable<string>, count: number): string[] {
  const pattern = new RegExp(`^q${itemNo}_(\\d+)$`);
  let n = 0;
  for (const key of takenKeys) {
    const m = pattern.exec(key);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `q${itemNo}_${n + i + 1}`);
}

/** 式の欄をボタンで埋める型。押すと欄の字面が変わるだけで、何も覚えない。 */
export function askingPresets(count: number): { label: string; formula: string }[] {
  const letters = ASKING_LETTERS.slice(0, count);
  const presets: { label: string; formula: string }[] = [];
  if (count === 1) presets.push({ label: "答えをそのまま実績値にする", formula: "A" });
  if (count === 2) presets.push({ label: "割合（A ÷ B × 100）", formula: "A ÷ B × 100" });
  if (count >= 2) presets.push({ label: `合計（${letters.join(" + ")}）`, formula: letters.join(" + ") });
  return presets;
}

/** 分母に入る設問が0を受け付けると、答え次第で計算できなくなる。そのときの一言。 */
export function denominatorZeroHint(role: KpiQuestionRole, validation: string): string | null {
  if (role !== "denominator") return null;
  if (validation === "1以上の整数" || validation === "0より大きい数値") return null;
  return "分母に入る数です。0だと計算できないため、「1以上の整数」をおすすめします。";
}

export interface KpiQuestionLike {
  id: string;
  questionKey: string;
  text: string;
  inputType: string;
  unit: string | null;
  validation: string | null;
  role: string;
  targetGrades: string | null;
  displayOrder: number;
}

/**
 * 画面の選択肢で表せない設問か。表せなければ、その理由（「…ため」に続く形）を返す。
 * 選ぶ設問は入力形式も数でないので、狭い理由から先に見る。
 */
function fixedQuestionReason(q: Pick<KpiQuestionLike, "inputType" | "role" | "validation">): string | null {
  if (parseChoiceValidation(q.validation)) return "決まった値から選ぶ設問の";
  if (q.role === "identify") return "回答した人を見分けるための設問の";
  if (q.inputType !== "number") return "数で答える設問ではない";
  const v = normalizeValidation(q.validation);
  if (v !== null && !isAskingValidation(v)) return `入力の決まり「${v}」が画面で選べない`;
  return null;
}

function normalizeValidation(v: string | null): string | null {
  const t = (v ?? "").trim();
  return t === "" || t === "-" ? null : t;
}

/**
 * この項目の聞き方を画面から変えられない理由。変えられれば null。
 * 画面で表せない設問を、表せる形に書き直して保存すると、設問の中身が黙って変わるため断る。
 */
export function askingReadonlyReason(
  item: { isFixedSlot: boolean },
  questions: readonly Pick<KpiQuestionLike, "text" | "inputType" | "role" | "validation">[],
): string | null {
  if (item.isFixedSlot) return "固定枠の項目は、聞き方を画面から変えられません。";
  if (questions.length > ASKING_LIMIT) {
    return `設問が${ASKING_LIMIT}つより多いため、聞き方を画面から変えられません。`;
  }
  for (const q of questions) {
    const reason = fixedQuestionReason(q);
    if (reason) return `「${q.text}」は${reason}ため、聞き方を画面から変えられません。`;
  }
  return null;
}

export interface AskingQuestionView {
  key: string;
  text: string;
  unit: string;
  validation: string;
  role: string;
}

export interface AskingView {
  questions: AskingQuestionView[];
  /** 文字で書いた式。式が無ければ空文字。 */
  formula: string;
  /** 画面から変えられない理由。変えられれば null。 */
  readonlyReason: string | null;
}

/** 保存されている聞き方を、画面で見せる形にする。 */
export function askingView(
  item: { formula: string | null; isFixedSlot: boolean },
  questions: readonly KpiQuestionLike[],
): AskingView {
  const sorted = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
  const keys = sorted.map((q) => q.questionKey);
  const unitOf = (u: string | null) => (u === null || u.trim() === "-" ? "" : u);
  return {
    questions: sorted.map((q) => ({
      key: q.questionKey,
      text: q.text,
      unit: unitOf(q.unit),
      validation: normalizeValidation(q.validation) ?? DEFAULT_ASKING_VALIDATION,
      role: q.role,
    })),
    formula: item.formula ? keysToLetters(item.formula, keys) : "",
    readonlyReason: askingReadonlyReason(item, sorted),
  };
}
