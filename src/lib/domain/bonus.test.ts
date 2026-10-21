import { describe, expect, it } from "vitest";
import { computeBonus } from "./bonus";

/**
 * 個人Pt ＝ KPI評価点合計（整数に四捨五入）、賞与額 ＝ 個人Pt × 1点あたりの金額。
 * 丸めが1点ずれると賞与額が1点あたりの金額ぶん変わるため、端数の境目をそのまま試験にしている。
 */

describe("computeBonus — 個人Pt は KPI評価点合計を整数に四捨五入する", () => {
  const cases: [number, number][] = [
    [0, 0],
    [0.4, 0],
    [0.5, 1],
    [61.4, 61],
    [61.5, 62],
    [61.6, 62],
    [62, 62],
    [62.49, 62],
    [99.5, 100],
    [100, 100],
  ];
  for (const [total, pt] of cases) {
    it(`KPI評価点合計 ${total}点 → 個人Pt ${pt}`, () => {
      expect(computeBonus({ kpiTotalScore: total, yenPerPoint: 3200 }).personalPoints).toBe(pt);
    });
  }

  it("賞与額は丸めた後の個人Ptに掛ける（丸める前の点数には掛けない）", () => {
    const r = computeBonus({ kpiTotalScore: 61.5, yenPerPoint: 3200 });
    expect(r.personalPoints).toBe(62);
    expect(r.bonusYen).toBe(62 * 3200);
  });
});

describe("computeBonus — 賞与額", () => {
  it("1点あたりの金額が正なら 個人Pt × 1点あたりの金額", () => {
    const r = computeBonus({ kpiTotalScore: 62, yenPerPoint: 3200 });
    expect(r).toEqual({
      personalPoints: 62,
      bonusYen: 198400,
      rationale: "個人Pt ＝ KPI評価点合計 62点 ＝ 62Pt。賞与額 ＝ 62Pt × 1点あたり3,200円 ＝ 198,400円。",
    });
  });

  it("1点あたりの金額に端数があっても、賞与額は円に四捨五入する", () => {
    expect(computeBonus({ kpiTotalScore: 3, yenPerPoint: 0.5 }).bonusYen).toBe(2);
    expect(computeBonus({ kpiTotalScore: 3, yenPerPoint: 0.3 }).bonusYen).toBe(1);
  });

  it("KPI評価点合計が0点なら個人Ptも賞与額も0（null ではない。画面は0円を出さない）", () => {
    const r = computeBonus({ kpiTotalScore: 0, yenPerPoint: 3200 });
    expect(r.personalPoints).toBe(0);
    expect(r.bonusYen).toBe(0);
  });

  it("1点あたりの金額が0なら、賞与額は0円ではなく null（賞与なしと誤読させない）", () => {
    const r = computeBonus({ kpiTotalScore: 80, yenPerPoint: 0 });
    expect(r.personalPoints).toBe(80);
    expect(r.bonusYen).toBeNull();
    expect(r.rationale).toBe("個人Pt ＝ KPI評価点合計 80点 ＝ 80Pt。1点あたりの金額が設定されていないため、賞与額は出しません。");
  });

  it("1点あたりの金額が未設定（null）や負の値でも、賞与額は null", () => {
    expect(computeBonus({ kpiTotalScore: 80, yenPerPoint: null }).bonusYen).toBeNull();
    expect(computeBonus({ kpiTotalScore: 80, yenPerPoint: -1 }).bonusYen).toBeNull();
  });
});

describe("computeBonus — KPI評価点合計が出ていないとき", () => {
  it("個人Ptも賞与額も null のまま返し、その理由を文で返す", () => {
    expect(computeBonus({ kpiTotalScore: null, yenPerPoint: 3200 })).toEqual({
      personalPoints: null,
      bonusYen: null,
      rationale: "KPI評価点の合計が出ていないため、個人Ptと賞与額を出せません。",
    });
  });
});

describe("computeBonus — 根拠の文", () => {
  it("合計点は小数第1位まで書き、個人Ptは整数で書く", () => {
    expect(computeBonus({ kpiTotalScore: 61.46, yenPerPoint: 0 }).rationale).toContain(
      "KPI評価点合計 61.5点 ＝ 61Pt。",
    );
  });

  it("係数や達成率の話を含まない（個人Pt は合計点だけで決まる）", () => {
    const r = computeBonus({ kpiTotalScore: 62, yenPerPoint: 3200 });
    expect(r.rationale).not.toContain("係数");
    expect(r.rationale).not.toContain("達成率");
  });
});
