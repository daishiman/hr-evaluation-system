/**
 * KPIの「実績値の計算式」を評価する小さな式エンジン。
 *
 * 元スプレッドシートの計算式をそのまま扱えるようにしている。例:
 *   q1_1 ÷ 【等級別の半期目標設定上限数】 × 100
 *   ( q6_1 ÷ q6_2 ) ÷ q6_3 × 100
 *   q2_1 + q2_2 + q2_3
 *   q10_1 ÷ ( q10_2 × q10_3 × 0.9 ) × 100
 *   q19_3 ÷ ( q19_1 + q19_2 − q19_4 ) × 100
 *
 * 式は会社ごとにDBで持つ値であり、コードに埋め込まない。
 * eval() は使わない（DBの値をそのまま実行させないため）。
 */

export type FormulaVars = Record<string, number>;

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly kind: "syntax" | "missing-var" | "divide-by-zero" | "too-complex" | "overflow",
  ) {
    super(message);
    this.name = "FormulaError";
  }
}

/**
 * 式の複雑さの上限。
 *
 * この式の読み取りは括弧の中に入るたびに自分自身を呼び直す作りで、
 * 括弧が数千重なると計算そのものが続けられなくなる。そのとき出るのは
 * 計算機の内部事情の言葉で、読んでも直しようがない
 * （その項目だけ理由の分からない「判定外」になって消えていた）。
 * 上限を先に置いて、**直せる言葉で断る**ようにする。
 *
 * 実際に登録されている式は、いちばん長いもので52文字・括弧は2重までだった。
 * 下の上限はそのどれより桁違いに大きいので、いまの式が弾かれることはない。
 */
export const FORMULA_LIMITS = {
  /** 式の文字数（登録済みの最長は52文字） */
  length: 2000,
  /** 括弧の深さ（登録済みの最深は2重） */
  depth: 50,
  /** 数・記号・設問IDの個数（登録済みの最多は20個ほど） */
  tokens: 500,
} as const;

type Token =
  | { t: "num"; v: number }
  | { t: "var"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

/** かな・漢字を含むか（＝式ではなく人間向けの注釈か）の判定に使う */
const JA = /[ぁ-んァ-ヶ一-龥]/;

/**
 * 式の末尾に付いた人間向けの注釈を落とす。
 * 元シートには「q27_1（件数をそのまま実績値とする）」「... ※1人あたり半期18件が基準」のように
 * 説明が式に混ざった行があるため、計算に入る前に取り除く。
 * 括弧の中身にかな・漢字が無ければ本物の括弧なので残す（例: ( q6_1 ÷ q6_2 )）。
 */
function stripNotes(src: string): string {
  let s = src.replace(/※[\s\S]*$/, "").trim();
  for (;;) {
    const m = /[（(]([^（()）]*)[）)]\s*$/.exec(s);
    if (!m || !JA.test(m[1])) return s;
    s = s.slice(0, m.index).trim();
  }
}

/** 全角・記号ゆれを吸収する */
function normalize(src: string): string {
  return stripNotes(src)
    .replace(/[÷／]/g, "/")
    .replace(/[×✕✖]/g, "*")
    .replace(/[−–—ー]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .trim();
}

function tokenize(src: string): Token[] {
  if (src.length > FORMULA_LIMITS.length) {
    throw new FormulaError(
      `計算式が長すぎます（${src.length}文字。${FORMULA_LIMITS.length}文字までです）。式を分けてください。`,
      "too-complex",
    );
  }
  const s = normalize(src);
  const tokens: Token[] = [];
  let i = 0;
  let depth = 0;

  while (i < s.length) {
    const c = s[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      depth++;
      if (depth > FORMULA_LIMITS.depth) {
        throw new FormulaError(
          `計算式の括弧が深すぎます（${FORMULA_LIMITS.depth}重までです）。括弧を減らすか、式を分けてください。`,
          "too-complex",
        );
      }
      tokens.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      depth--;
      tokens.push({ t: "rp" });
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    // 【等級別の半期目標設定上限数】のような、等級から自動決定される値
    if (c === "【") {
      const end = s.indexOf("】", i);
      if (end < 0) throw new FormulaError(`計算式の【】が閉じていません: ${src}`, "syntax");
      tokens.push({ t: "var", v: s.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    // 数値
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (num) {
      tokens.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    // 設問ID（q1_1 など）およびその他の識別子
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (ident) {
      tokens.push({ t: "var", v: ident[0] });
      i += ident[0].length;
      continue;
    }
    throw new FormulaError(`計算式に解釈できない文字があります: 「${c}」（${src}）`, "syntax");
  }
  if (tokens.length > FORMULA_LIMITS.tokens) {
    throw new FormulaError(
      `計算式の項目が多すぎます（${tokens.length}個。${FORMULA_LIMITS.tokens}個までです）。式を分けてください。`,
      "too-complex",
    );
  }
  return tokens;
}

/**
 * 再帰下降パーサ + 評価。
 * expr := term (('+'|'-') term)*
 * term := factor (('*'|'/') factor)*
 * factor := number | var | '(' expr ')' | '-' factor
 */
function evaluate(tokens: Token[], vars: FormulaVars, src: string): number {
  let pos = 0;
  const peek = () => tokens[pos];

  function expr(): number {
    let left = term();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && (tk.v === "+" || tk.v === "-")) {
        pos++;
        const right = term();
        left = tk.v === "+" ? left + right : left - right;
      } else break;
    }
    return left;
  }

  function term(): number {
    let left = factor();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && (tk.v === "*" || tk.v === "/")) {
        pos++;
        const right = factor();
        if (tk.v === "/") {
          if (right === 0) {
            throw new FormulaError("分母が0のため計算できません。分母の欄に1以上の数値を入力してください。", "divide-by-zero");
          }
          left = left / right;
        } else {
          left = left * right;
        }
      } else break;
    }
    return left;
  }

  function factor(): number {
    const tk = peek();
    if (!tk) throw new FormulaError(`計算式が途中で終わっています: ${src}`, "syntax");
    if (tk.t === "op" && tk.v === "-") {
      pos++;
      return -factor();
    }
    if (tk.t === "num") {
      pos++;
      return tk.v;
    }
    if (tk.t === "var") {
      pos++;
      const v = vars[tk.v];
      if (v === undefined || v === null || Number.isNaN(v)) {
        throw new FormulaError(`「${tk.v}」の値が入力されていません。`, "missing-var");
      }
      return v;
    }
    if (tk.t === "lp") {
      pos++;
      const v = expr();
      if (peek()?.t !== "rp") throw new FormulaError(`括弧が閉じていません: ${src}`, "syntax");
      pos++;
      return v;
    }
    throw new FormulaError(`計算式を解釈できません: ${src}`, "syntax");
  }

  const result = expr();
  if (pos !== tokens.length) throw new FormulaError(`計算式に余分な記述があります: ${src}`, "syntax");
  return result;
}

/** 計算式に登場する変数名（設問IDなど）を列挙する。フォーム生成で使う。 */
export function extractVariables(formula: string): string[] {
  try {
    return [...new Set(tokenize(formula).filter((t): t is Extract<Token, { t: "var" }> => t.t === "var").map((t) => t.v))];
  } catch {
    return [];
  }
}

/**
 * 計算式を評価して実績値を返す。小数は第2位で丸める。
 *
 * 途中の掛け算で計算機の扱える範囲を超えると、結果は「無限大」になる。
 * 無限大をそのまま実績値として返すと、ランク判定はどの帯にも当たらず、
 * **理由の分からない判定外**になる。ここで気づいて、値がおかしいことを言葉で返す。
 */
export function computeActualValue(formula: string, vars: FormulaVars): number {
  const raw = evaluate(tokenize(formula), vars, formula);
  if (!Number.isFinite(raw)) {
    throw new FormulaError(
      "計算の途中で数が大きくなりすぎました。回答に桁の多すぎる値が入っていないかご確認ください。",
      "overflow",
    );
  }
  return Math.round(raw * 100) / 100;
}
