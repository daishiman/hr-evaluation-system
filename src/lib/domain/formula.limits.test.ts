import { describe, expect, it } from "vitest";
import { computeActualValue, extractVariables, FORMULA_LIMITS, FormulaError } from "./formula";

/**
 * 計算式の複雑さの上限と、計算の途中で数が大きくなりすぎた場合。
 *
 * 上限が無かったころ、括弧が数千重なった式は「計算そのものが続けられない」形で落ち、
 * その項目だけが理由の分からない判定外になっていた。読んで直せる言葉で断るのが狙い。
 *
 * 上限は、いま登録されている式（最長52文字・括弧は2重まで）より桁違いに大きく取ってある。
 * ここでは**いまの式が弾かれないこと**もあわせて固定する。
 */

const nest = (depth: number) => "(".repeat(depth) + "q1_1" + ")".repeat(depth);

describe("いま登録されている形の式は必ず通る", () => {
  it("本番にある式がそのまま計算できる", () => {
    expect(computeActualValue("q22_1 ÷ ( q22_2 × 18 ) × 100 ※1人あたり半期18件が基準", { q22_1: 90, q22_2: 5 })).toBe(100);
    expect(computeActualValue("( q24_1 ÷ q24_2 × 100 ) ÷ q24_3 × 100 ※予算利益率に対する達成度", { q24_1: 5, q24_2: 100, q24_3: 5 })).toBe(100);
    expect(computeActualValue("q19_3 ÷ ( q19_1 + q19_2 − q19_4 ) × 100", { q19_1: 10, q19_2: 5, q19_3: 6, q19_4: 3 })).toBe(50);
  });

  it("本番の最長の式（52文字）は上限のはるか手前にある", () => {
    expect("q10_1 ÷ ( q10_2 × q10_3 × 0.9 ) × 100 ※利用率90%達成で100%".length).toBeLessThan(FORMULA_LIMITS.length);
  });
});

describe("括弧の深さ（ちょうど・その両側）", () => {
  it("深さ1（いちばん浅い括弧）は通る", () => {
    expect(computeActualValue(nest(1), { q1_1: 7 })).toBe(7);
  });

  it("上限ちょうど（50重）は通る", () => {
    expect(computeActualValue(nest(FORMULA_LIMITS.depth), { q1_1: 7 })).toBe(7);
  });

  it("上限を1つ超えると、直せる言葉で断る", () => {
    try {
      computeActualValue(nest(FORMULA_LIMITS.depth + 1), { q1_1: 7 });
      throw new Error("断られませんでした");
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaError);
      expect((e as FormulaError).kind).toBe("too-complex");
      expect((e as FormulaError).message).toContain("括弧が深すぎます");
    }
  });

  it("括弧が2万重なっても、計算機の都合ではなく計算式の話として断る", () => {
    // 以前はここで RangeError（計算機の内部事情）になっていた
    expect(() => computeActualValue(nest(20000), { q1_1: 1 })).toThrowError(FormulaError);
  });

  it("開いた括弧を閉じてから開き直す式は、深さを数え直す", () => {
    // 「浅い括弧が何度も出てくる」だけの式を、深いと誤解しないこと
    const shallowButMany = Array.from({ length: 100 }, () => "( q1_1 )").join("+");
    expect(computeActualValue(shallowButMany, { q1_1: 1 })).toBe(100);
  });
});

describe("式の長さ・項目の数（ちょうど・その両側）", () => {
  it("上限ちょうどの長さは通る", () => {
    // 空白で長さだけを上限ちょうどまで伸ばす（項目の数は増やさない）
    const src = "q1_1".padEnd(FORMULA_LIMITS.length, " ");
    expect(src.length).toBe(FORMULA_LIMITS.length);
    expect(computeActualValue(src, { q1_1: 3 })).toBe(3);
  });

  it("上限を1文字超えると断る", () => {
    const src = "1".repeat(FORMULA_LIMITS.length + 1);
    expect(() => computeActualValue(src, {})).toThrowError(/長すぎます/);
  });

  it("短くても項目が多すぎる式は断る", () => {
    // 全角の記号で書くと、文字数の上限より先に項目数の上限に当たる
    const many = "1" + "+1".repeat(FORMULA_LIMITS.tokens);
    expect(() => computeActualValue(many, {})).toThrowError(FormulaError);
  });

  it("空の式は今までどおり「途中で終わっています」と言う（長さの上限に巻き込まれない）", () => {
    expect(() => computeActualValue("", {})).toThrowError(/途中で終わって/);
  });
});

describe("計算の途中で数が大きくなりすぎたとき", () => {
  it("結果が無限大になる掛け算は、理由を言って断る", () => {
    try {
      computeActualValue("q1_1 × 10", { q1_1: 1e308 });
      throw new Error("断られませんでした");
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaError);
      expect((e as FormulaError).kind).toBe("overflow");
      expect((e as FormulaError).message).toContain("桁の多すぎる値");
    }
  });

  it("受け付けている上限（1兆）どうしを3回掛けても無限大にならない", () => {
    // 上限をこの値にした理由そのもの。ここが崩れると、通した値で無限大が作れてしまう
    expect(computeActualValue("q1_1 × q1_2 × q1_3", { q1_1: 1e12, q1_2: 1e12, q1_3: 1e12 })).toBe(1e36);
  });

  it("マイナスの無限大も同じように断る", () => {
    expect(() => computeActualValue("-q1_1 × 10", { q1_1: 1e308 })).toThrowError(/大きくなりすぎ/);
  });
});

describe("設問IDの取り出しは、複雑すぎる式でも落ちない", () => {
  it("上限を超える式では空の一覧を返す（例外を投げない）", () => {
    expect(extractVariables(nest(FORMULA_LIMITS.depth + 1))).toEqual([]);
    expect(extractVariables("1".repeat(FORMULA_LIMITS.length + 1))).toEqual([]);
  });

  it("普通の式からは今までどおり設問IDを拾う", () => {
    expect(extractVariables("q6_1 ÷ q6_2 × 100")).toEqual(["q6_1", "q6_2"]);
  });
});
