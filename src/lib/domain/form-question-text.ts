/**
 * アンケートの設問文を、制度マスタの内容から組み立てる。
 *
 * アンケートの文面は「手で書くもの」ではなく「制度の設定を写したもの」にする。
 * 等級要件・昇格要件・行動指針・KPI設問はそれぞれ別の画面で設定されており、
 * その文言が正であって、アンケート側で言い回しを直すと、
 * どちらが本当の制度なのか誰にも分からなくなるため。
 *
 * ここが決めるのは「設定の文言をどう設問文に組み立てるか」だけで、
 * 文言そのものは一切書き換えない。閾値・配点・昇格に必要な点数も入れない
 * （評価基準の非開示。scoring.ts の方針と同じ）。
 *
 * 答え方が分からない設問を作らないための決めごと:
 *   - はい／いいえの設問は、必ず「〜しましたか？」の形で聞く。
 *     状態を言い切る文（「インテークやアセスメント」）のままだと、
 *     「はい」が「できた」なのか「これから」なのか読み取れない。
 *   - はい／いいえの選択肢には、その設問での意味をかっこ書きで添える
 *     （「はい（提出した）」）。○×やチェックだけでは、どちらが達成側か伝わらない。
 *   - 数値の設問は、単位と入力できる値の範囲を説明文に必ず書く。
 */

export interface Choice {
  value: string;
  label: string;
  score: number;
}

export interface BuiltQuestion {
  questionType: "yesno" | "single" | "number" | "text";
  title: string;
  helpText: string;
  unit: string | null;
  options: Choice[] | null;
  validationMin: number | null;
  validationMax: number | null;
}

/** 二重かぎかっこ・句点の重なりを避けて、設定の文言をそのまま引用する。 */
export function quoteSetting(text: string): string {
  const trimmed = text.trim().replace(/[。．]+$/, "");
  const unwrapped = /^[「『].*[」』]$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  return `「${unwrapped}」`;
}

/**
 * はい／いいえの選択肢。
 * 達成側を必ず先頭（score 1）に置く。評価側の集計は「1 なら達成」で読む（evaluate.ts）。
 */
export function yesNoChoices(yesMeaning: string, noMeaning: string): Choice[] {
  return [
    { value: "1", label: `はい（${yesMeaning}）`, score: 1 },
    { value: "0", label: `いいえ（${noMeaning}）`, score: 0 },
  ];
}

/** 等級要件（支援・運営）の設問。達成した件数が等級要件達成率になる。 */
export function requirementQuestion(category: "support" | "operation", text: string): BuiltQuestion {
  const doing = category === "support" ? "支援の業務" : "運営の業務";
  return {
    questionType: "yesno",
    title: `${quoteSetting(text)}を、この半期に自分の担当として行いましたか？`,
    helpText: `行った場合は「はい」、まだ行っていない場合は「いいえ」を選んでください（${doing}）。どちらか一方を必ず選びます。`,
    unit: null,
    options: yesNoChoices("行った", "まだ行っていない"),
    validationMin: null,
    validationMax: null,
  };
}

/** 昇格要件（受講後の報告書・独学後のテスト）の設問。 */
export function promotionQuestion(kind: "report" | "test", text: string): BuiltQuestion {
  if (kind === "report") {
    return {
      questionType: "yesno",
      title: `${quoteSetting(text)}を受講し、報告書を提出しましたか？`,
      helpText: "提出まで終わっていれば「はい」、受講しただけ・まだ受けていない場合は「いいえ」を選んでください。",
      unit: null,
      options: yesNoChoices("提出した", "まだ提出していない"),
      validationMin: null,
      validationMax: null,
    };
  }
  return {
    questionType: "yesno",
    title: `${quoteSetting(text)}のテストに合格しましたか？`,
    helpText: "合格していれば「はい」、受けていない・不合格だった場合は「いいえ」を選んでください。",
    unit: null,
    options: yesNoChoices("合格した", "まだ合格していない"),
    validationMin: null,
    validationMax: null,
  };
}

/** 行動指針の説明文。選択肢そのものは制度マスタ（behavior_levels）の文言をそのまま使う。 */
export const BEHAVIOR_HELP = "この半期のふだんの行動に、もっとも近いものを1つだけ選んでください。";

/**
 * 「3,2,1,0,-1 から選択」のように、選べる値が決まっている入力チェックを選択肢にする。
 * 決まっていなければ null（＝数値の自由入力）。
 */
export function parseChoiceValidation(validation: string | null | undefined): number[] | null {
  const m = (validation ?? "").match(/^\s*(-?\d+(?:\s*[,、]\s*-?\d+)+)\s*(?:から|より)?選択/);
  if (!m) return null;
  const values = m[1]
    .split(/[,、]/)
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length >= 2 ? values : null;
}

/** 入力チェックの文言から、入力欄の下限を決める。 */
export function minimumFromValidation(validation: string | null | undefined): number | null {
  const v = validation ?? "";
  if (v.includes("1以上")) return 1;
  if (v.includes("0以上")) return 0;
  return null;
}

/** 入力チェックの文言を、答える人向けの一言にする。 */
export function inputRuleNote(validation: string | null | undefined): string {
  const v = validation ?? "";
  if (v.includes("1以上") && v.includes("整数")) return "1以上の整数で入力してください。";
  if (v.includes("0以上") && v.includes("整数")) return "0以上の整数で入力してください（0でもかまいません）。";
  if (v.includes("0より大きい")) return "0より大きい数を入力してください。";
  if (v.includes("マイナス可")) return "整数で入力してください（マイナスの数も入力できます）。";
  if (v.includes("整数")) return "整数で入力してください。";
  return "";
}

/**
 * KPI設問（実績の数値）。設問文はマスタ（kpi_questions.text）の文言をそのまま使い、
 * 説明文で「何の集計に使うか・単位・入力できる値」を補う。
 */
export function kpiQuestion(
  q: { text: string; inputType: string; unit: string | null; validation: string | null },
  itemName: string,
): BuiltQuestion {
  const unit = q.unit && q.unit !== "-" ? q.unit : null;
  const choices = parseChoiceValidation(q.validation);
  const purpose = itemName ? `${itemName}の集計に使います。` : "";

  if (choices) {
    return {
      questionType: "single",
      title: q.text.trim(),
      helpText: `${purpose}当てはまるものを1つだけ選んでください。`,
      unit: null,
      options: choices.map((n) => ({ value: String(n), label: `${n}`, score: n })),
      validationMin: null,
      validationMax: null,
    };
  }

  if (q.inputType === "text") {
    return {
      questionType: "text",
      title: q.text.trim(),
      helpText: `${purpose}そのまま文章で書いてください。`,
      unit: null,
      options: null,
      validationMin: null,
      validationMax: null,
    };
  }

  const rule = inputRuleNote(q.validation);
  const unitNote = unit ? `単位は「${unit}」です。` : "";
  return {
    questionType: "number",
    title: q.text.trim(),
    helpText: [purpose, unitNote, rule, "半角の数字だけを入力してください。"].filter(Boolean).join(""),
    unit,
    options: null,
    validationMin: minimumFromValidation(q.validation),
    validationMax: null,
  };
}
