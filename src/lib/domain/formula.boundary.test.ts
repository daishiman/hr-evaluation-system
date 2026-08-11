import { describe, expect, it } from "vitest";
import { computeActualValue, extractVariables, FormulaError } from "./formula";

/**
 * 実績値の計算式の境目。
 *
 * ここは割り算が出る唯一の場所で、分母0・未回答・丸めがすべて集まる。
 * 「0で割ったら何が起きるか」「0.5はどちらに転ぶか」を言葉ではなく試験で決めておく。
 */

describe("分母が0のとき（ゼロ除算）", () => {
  it("例外を投げ、日本語で理由を伝える", () => {
    expect(() => computeActualValue("a ÷ b", { a: 1, b: 0 })).toThrowError(FormulaError);
    try {
      computeActualValue("a ÷ b", { a: 1, b: 0 });
    } catch (e) {
      expect((e as FormulaError).kind).toBe("divide-by-zero");
      expect((e as FormulaError).message).toContain("分母が0");
    }
  });

  it("分子が0でも、分母が0なら計算しない", () => {
    expect(() => computeActualValue("a ÷ b", { a: 0, b: 0 })).toThrowError(/分母が0/);
  });

  it("括弧の中が0になる場合も止める", () => {
    expect(() => computeActualValue("a ÷ ( b - c )", { a: 1, b: 5, c: 5 })).toThrowError(/分母が0/);
  });

  it("分母が0.0001でも計算は通る（0のときだけ止める）", () => {
    expect(computeActualValue("a ÷ b", { a: 1, b: 0.0001 })).toBe(10000);
  });

  it("分母が負の数なら、そのまま負の実績値になる", () => {
    expect(computeActualValue("a ÷ b", { a: 10, b: -2 })).toBe(-5);
  });
});

describe("回答が空のとき", () => {
  it("値が入っていない設問があれば、設問名を挙げて止める", () => {
    try {
      computeActualValue("q1_1 ÷ q1_2", { q1_1: 1 });
      throw new Error("ここに来てはいけない");
    } catch (e) {
      expect((e as FormulaError).kind).toBe("missing-var");
      expect((e as FormulaError).message).toContain("q1_2");
    }
  });

  it("0 は「空」ではないので、そのまま使う", () => {
    expect(computeActualValue("q1_1 + q1_2", { q1_1: 0, q1_2: 5 })).toBe(5);
  });

  it("数値にならない値（NaN）は未入力として扱う", () => {
    expect(() => computeActualValue("q1_1", { q1_1: Number.NaN })).toThrowError(/入力されていません/);
  });
});

describe("丸め（小数第2位まで）", () => {
  it("割り切れない値は第2位で丸める", () => {
    expect(computeActualValue("a ÷ b × 100", { a: 1, b: 3 })).toBe(33.33);
    expect(computeActualValue("a ÷ b × 100", { a: 2, b: 3 })).toBe(66.67);
    expect(computeActualValue("a ÷ b × 100", { a: 1, b: 7 })).toBe(14.29);
  });

  it("第3位が5のときは上に寄せる（0.125 のように誤差なく表せる値）", () => {
    expect(computeActualValue("a ÷ b", { a: 1, b: 8 })).toBe(0.13); // 0.125 → 0.13
    expect(computeActualValue("a ÷ b", { a: 3, b: 8 })).toBe(0.38); // 0.375 → 0.38
  });

  /**
   * ちょうど「第3位が5」に見える値（1.005 / 1.015 など）は、コンピュータ内部では
   * 5より僅かに小さい値として持たれるため、上ではなく下に寄る。
   * これは直せば過去の実績値が変わりうる箇所なので、直さずに現状を記録しておく。
   * 影響は実績値の第3位以下のみで、ランク境界に届くのは境界値と 0.005 未満しか
   * 違わない場合に限られる。
   */
  it("1.005 のように内部で表しきれない値は下に寄る（現状の記録）", () => {
    expect(computeActualValue("a ÷ b", { a: 1005, b: 1000 })).toBe(1);
    expect(computeActualValue("a ÷ b", { a: 1015, b: 1000 })).toBe(1.01);
  });

  it("負の値も同じ規則で丸める", () => {
    expect(computeActualValue("0 - a ÷ b", { a: 1, b: 8 })).toBe(-0.12); // -0.125 → -0.12
  });

  it("ちょうど割り切れる値はそのまま", () => {
    expect(computeActualValue("a ÷ b × 100", { a: 1, b: 2 })).toBe(50);
    expect(computeActualValue("a ÷ b × 100", { a: 0, b: 5 })).toBe(0);
  });
});

describe("式の書き方のゆれを吸収する", () => {
  it("全角の記号・数字を読める", () => {
    expect(computeActualValue("a ＋ １０", { a: 5 })).toBe(15);
    expect(computeActualValue("a × ２", { a: 5 })).toBe(10);
    expect(computeActualValue("a ／ ２", { a: 5 })).toBe(2.5);
    expect(computeActualValue("a − ２", { a: 5 })).toBe(3);
  });

  it("【】で囲んだ等級由来の値を使える", () => {
    expect(
      computeActualValue("q1_1 ÷ 【等級別の半期目標設定上限数】 × 100", {
        q1_1: 3,
        等級別の半期目標設定上限数: 5,
      }),
    ).toBe(60);
  });

  it("掛け算・割り算を足し算より先に計算する", () => {
    expect(computeActualValue("2 + 3 × 4", {})).toBe(14);
    expect(computeActualValue("( 2 + 3 ) × 4", {})).toBe(20);
    expect(computeActualValue("q19_3 ÷ ( q19_1 + q19_2 − q19_4 ) × 100", {
      q19_1: 10,
      q19_2: 10,
      q19_3: 5,
      q19_4: 5,
    })).toBe(33.33);
  });

  it("先頭のマイナス（符号）を読める", () => {
    expect(computeActualValue("-5 + 8", {})).toBe(3);
    expect(computeActualValue("0 - -5", {})).toBe(5);
  });

  it("式の末尾の注釈（かな漢字の括弧・※）は計算に入れない", () => {
    expect(computeActualValue("q27_1（件数をそのまま実績値とする）", { q27_1: 18 })).toBe(18);
    expect(computeActualValue("q27_1 ※1人あたり半期18件が基準", { q27_1: 18 })).toBe(18);
    // 中身に日本語が無い括弧は、本物の括弧として残す
    expect(computeActualValue("( q6_1 ÷ q6_2 )", { q6_1: 6, q6_2: 3 })).toBe(2);
  });
});

describe("式そのものが壊れているとき", () => {
  it("【】が閉じていない", () => {
    expect(() => computeActualValue("【上限数", {})).toThrowError(/【】が閉じていません/);
  });

  it("括弧が閉じていない", () => {
    expect(() => computeActualValue("( 1 + 2", {})).toThrowError(/括弧が閉じていません/);
  });

  it("途中で終わっている", () => {
    expect(() => computeActualValue("1 +", {})).toThrowError(/途中で終わっています/);
    expect(() => computeActualValue("", {})).toThrowError(/途中で終わっています/);
  });

  it("余分な記述が付いている", () => {
    expect(() => computeActualValue("1 + 2 )", {})).toThrowError(/余分な記述/);
  });

  it("解釈できない文字が混ざっている", () => {
    expect(() => computeActualValue("1 @ 2", {})).toThrowError(/解釈できない文字/);
  });

  it("設問名を全角英字で書くと、黙って別の数字を出さずに誤りとして止まる", () => {
    expect(() => computeActualValue("ａ", { ａ: 3 })).toThrowError(/解釈できない文字/);
  });

  it("演算子だけの式は解釈できない", () => {
    expect(() => computeActualValue("* 2", {})).toThrowError(/解釈できません/);
  });

  it("どの誤りでも、式の中身をそのまま実行しない（eval を使わない）", () => {
    expect(() => computeActualValue("process.exit(1)", {})).toThrowError(FormulaError);
  });
});

describe("式に出てくる設問の名前を取り出す", () => {
  it("重複を除いて、出てくる順に返す", () => {
    expect(extractVariables("q6_1 ÷ q6_2 ÷ q6_1 × 100")).toEqual(["q6_1", "q6_2"]);
  });

  it("【】の中も設問として数える", () => {
    expect(extractVariables("q1_1 ÷ 【等級別の半期目標設定上限数】")).toEqual([
      "q1_1",
      "等級別の半期目標設定上限数",
    ]);
  });

  it("式として読めない文字列は、空の一覧を返す（画面を落とさない）", () => {
    expect(extractVariables("【閉じていない")).toEqual([]);
    expect(extractVariables("1 @ 2")).toEqual([]);
  });

  it("式が空なら空の一覧", () => {
    expect(extractVariables("")).toEqual([]);
  });
});
