import { describe, it, expect } from "vitest";
import { computeActualValue, extractVariables, FormulaError } from "./formula";

describe("computeActualValue — 元シートの計算式をそのまま扱える", () => {
  it("分子÷分母×100（No.3 報告書送付率）", () => {
    expect(computeActualValue("q3_1 ÷ q3_2 × 100", { q3_1: 48, q3_2: 50 })).toBe(96);
  });

  it("【等級別の半期目標設定上限数】のような自動決定値を使える（No.1）", () => {
    const v = computeActualValue("q1_1 ÷ 【等級別の半期目標設定上限数】 × 100", {
      q1_1: 3,
      等級別の半期目標設定上限数: 5,
    });
    expect(v).toBe(60); // 元シートの例「半期上限5件中3件達成＝60% →Cランク」と一致
  });

  it("合計（No.2 ヒヤリ報告件数）", () => {
    expect(computeActualValue("q2_1 + q2_2 + q2_3", { q2_1: 8, q2_2: 9, q2_3: 7 })).toBe(24);
  });

  it("括弧つきの入れ子（No.6 単価率）", () => {
    expect(computeActualValue("( q6_1 ÷ q6_2 ) ÷ q6_3 × 100", { q6_1: 1000, q6_2: 10, q6_3: 100 })).toBe(100);
  });

  it("係数入り（No.10 利用率90％以上）", () => {
    // 定員20 × 開所日数120 × 0.9 が分母。実利用2160で100%
    const v = computeActualValue("q10_1 ÷ ( q10_2 × q10_3 × 0.9 ) × 100", { q10_1: 2160, q10_2: 20, q10_3: 120 });
    expect(v).toBe(100);
  });

  it("引き算を含む分母（No.19 利用者継続率）", () => {
    const v = computeActualValue("q19_3 ÷ ( q19_1 + q19_2 − q19_4 ) × 100", {
      q19_1: 18,
      q19_2: 4,
      q19_3: 20,
      q19_4: 2,
    });
    expect(v).toBe(100);
  });

  it("固定値18が入る式（No.22 ヒヤリハット提出件数）と末尾の注釈を無視する", () => {
    const v = computeActualValue("q22_1 ÷ ( q22_2 × 18 ) × 100　※1人あたり半期18件が基準", { q22_1: 234, q22_2: 10 });
    expect(v).toBe(130);
  });

  it("そのまま実績値になる式（No.26 チームワーク）", () => {
    expect(computeActualValue("q26_1", { q26_1: 3 })).toBe(3);
  });

  it("末尾の日本語注釈は式ではないので無視する（No.27 改善提案）", () => {
    expect(computeActualValue("q27_1（件数をそのまま実績値とする）", { q27_1: 6 })).toBe(6);
    expect(computeActualValue("q2_1 + q2_2 + q2_3（合計件数をそのまま実績値とする）", { q2_1: 8, q2_2: 9, q2_3: 7 })).toBe(24);
  });

  it("注釈と区別して、本物の括弧は残す", () => {
    expect(computeActualValue("( q6_1 ÷ q6_2 ) ÷ q6_3 × 100（単価率）", { q6_1: 1000, q6_2: 10, q6_3: 100 })).toBe(100);
    expect(extractVariables("q2_1 + q2_2 + q2_3（合計件数をそのまま実績値とする）")).toEqual(["q2_1", "q2_2", "q2_3"]);
  });

  it("小数は第2位で丸める", () => {
    expect(computeActualValue("q1 ÷ q2 × 100", { q1: 1, q2: 3 })).toBe(33.33);
  });

  it("分母が0なら日本語のエラーになる", () => {
    expect(() => computeActualValue("q3_1 ÷ q3_2 × 100", { q3_1: 10, q3_2: 0 })).toThrowError(FormulaError);
    try {
      computeActualValue("q3_1 ÷ q3_2 × 100", { q3_1: 10, q3_2: 0 });
    } catch (e) {
      expect((e as FormulaError).kind).toBe("divide-by-zero");
      expect((e as FormulaError).message).toContain("分母が0");
    }
  });

  it("値が入っていない設問があればエラーになる", () => {
    try {
      computeActualValue("q3_1 ÷ q3_2 × 100", { q3_1: 10 });
      throw new Error("エラーになるはず");
    } catch (e) {
      expect((e as FormulaError).kind).toBe("missing-var");
      expect((e as FormulaError).message).toContain("q3_2");
    }
  });
});

describe("extractVariables", () => {
  it("式に出てくる設問IDを列挙する", () => {
    expect(extractVariables("q19_3 ÷ ( q19_1 + q19_2 − q19_4 ) × 100")).toEqual(["q19_3", "q19_1", "q19_2", "q19_4"]);
  });
  it("自動決定値も列挙する", () => {
    expect(extractVariables("q1_1 ÷ 【等級別の半期目標設定上限数】 × 100")).toEqual([
      "q1_1",
      "等級別の半期目標設定上限数",
    ]);
  });
});
