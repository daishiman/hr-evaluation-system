import { describe, it, expect } from "vitest";
import {
  matchKgiCoefficient,
  checkKgiCoverage,
  checkRangeCoverage,
  computeBonus,
  type KgiCoefficientRow,
} from "./kgi";

/**
 * 元シート「KPI基準定義_配点」の事業所KGI達成係数。
 * 元表は 121%以上 / 111〜120% / 100〜110% / 95〜99% / 90〜94% / 89%以下 で、
 * 99%と100%の間・110%と111%の間に穴があった。
 * 下限以上・上限未満で連続させる形に補完した値をここに置く（DBのシード値と同じ）。
 */
const coefficients: KgiCoefficientRow[] = [
  { label: "121%以上", lowerBound: 121, upperBound: null, coefficient: 1.5, displayOrder: 1 },
  { label: "111〜120%", lowerBound: 111, upperBound: 121, coefficient: 1.2, displayOrder: 2 },
  { label: "100〜110%", lowerBound: 100, upperBound: 111, coefficient: 1.0, displayOrder: 3 },
  { label: "95〜99%", lowerBound: 95, upperBound: 100, coefficient: 0.6, displayOrder: 4 },
  { label: "90〜94%", lowerBound: 90, upperBound: 95, coefficient: 0.4, displayOrder: 5 },
  { label: "89%以下", lowerBound: null, upperBound: 90, coefficient: 0.2, displayOrder: 6 },
];

describe("matchKgiCoefficient — 係数の引き当て", () => {
  it("元表に書かれていた代表値がそのままの係数になる", () => {
    expect(matchKgiCoefficient(121, coefficients)?.coefficient).toBe(1.5);
    expect(matchKgiCoefficient(115, coefficients)?.coefficient).toBe(1.2);
    expect(matchKgiCoefficient(105, coefficients)?.coefficient).toBe(1.0);
    expect(matchKgiCoefficient(97, coefficients)?.coefficient).toBe(0.6);
    expect(matchKgiCoefficient(92, coefficients)?.coefficient).toBe(0.4);
    expect(matchKgiCoefficient(80, coefficients)?.coefficient).toBe(0.2);
  });

  it("境界は「下限以上・上限未満」で、隣の区分と二重に当たらない", () => {
    expect(matchKgiCoefficient(120.9, coefficients)?.coefficient).toBe(1.2);
    expect(matchKgiCoefficient(121, coefficients)?.coefficient).toBe(1.5);
    expect(matchKgiCoefficient(110.9, coefficients)?.coefficient).toBe(1.0);
    expect(matchKgiCoefficient(111, coefficients)?.coefficient).toBe(1.2);
    expect(matchKgiCoefficient(99.9, coefficients)?.coefficient).toBe(0.6);
    expect(matchKgiCoefficient(100, coefficients)?.coefficient).toBe(1.0);
  });

  it("元表で抜けていた小数（99.5% / 110.5%）も必ずどれかに当たる", () => {
    expect(matchKgiCoefficient(99.5, coefficients)?.coefficient).toBe(0.6);
    expect(matchKgiCoefficient(110.5, coefficients)?.coefficient).toBe(1.0);
  });

  it("判定根拠に達成率と区分名が日本語で残る", () => {
    expect(matchKgiCoefficient(97, coefficients)?.rationale).toContain("95〜99%");
    expect(matchKgiCoefficient(97, coefficients)?.rationale).toContain("0.6");
  });
});

describe("checkKgiCoverage — 係数表の穴と重なり", () => {
  it("補完後の表は問題なしと判定される", () => {
    expect(checkKgiCoverage(coefficients)).toEqual([]);
  });

  it("元シートのままの表（穴あり）は穴として検出される", () => {
    const original: KgiCoefficientRow[] = [
      { label: "121%以上", lowerBound: 121, upperBound: null, coefficient: 1.5, displayOrder: 1 },
      { label: "111〜120%", lowerBound: 111, upperBound: 120, coefficient: 1.2, displayOrder: 2 },
      { label: "100〜110%", lowerBound: 100, upperBound: 110, coefficient: 1.0, displayOrder: 3 },
      { label: "95〜99%", lowerBound: 95, upperBound: 99, coefficient: 0.6, displayOrder: 4 },
      { label: "90〜94%", lowerBound: 90, upperBound: 94, coefficient: 0.4, displayOrder: 5 },
      { label: "89%以下", lowerBound: null, upperBound: 89, coefficient: 0.2, displayOrder: 6 },
    ];
    const problems = checkKgiCoverage(original);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.kind === "gap")).toBe(true);
    // 99↔100 と 110↔111 の穴が日本語で説明される
    expect(problems.some((p) => p.message.includes("99") && p.message.includes("100"))).toBe(true);
    expect(problems.some((p) => p.message.includes("110") && p.message.includes("111"))).toBe(true);
  });

  it("範囲が重なっていれば重なりとして検出される", () => {
    const overlapped: KgiCoefficientRow[] = [
      { label: "上", lowerBound: 100, upperBound: null, coefficient: 1.5, displayOrder: 1 },
      { label: "下", lowerBound: null, upperBound: 110, coefficient: 0.2, displayOrder: 2 },
    ];
    const problems = checkKgiCoverage(overlapped);
    expect(problems.some((p) => p.kind === "overlap")).toBe(true);
  });
});

describe("checkRangeCoverage — ランク基準A〜Eにも同じ検査を使う", () => {
  it("No.1 等級要件達成率（100/80/60/40）は過不足なく覆えている", () => {
    expect(
      checkRangeCoverage(
        [
          { label: "A 100%以上", lowerBound: 100, upperBound: null },
          { label: "B 80%以上100%未満", lowerBound: 80, upperBound: 100 },
          { label: "C 60%以上80%未満", lowerBound: 60, upperBound: 80 },
          { label: "D 40%以上60%未満", lowerBound: 40, upperBound: 60 },
          { label: "E 40%未満", lowerBound: null, upperBound: 40 },
        ],
        "実績値",
      ),
    ).toEqual([]);
  });

  it("Cを消すと穴として検出される", () => {
    const problems = checkRangeCoverage(
      [
        { label: "A 100%以上", lowerBound: 100, upperBound: null },
        { label: "B 80%以上100%未満", lowerBound: 80, upperBound: 100 },
        { label: "D 40%以上60%未満", lowerBound: 40, upperBound: 60 },
        { label: "E 40%未満", lowerBound: null, upperBound: 40 },
      ],
      "実績値",
    );
    expect(problems.some((p) => p.kind === "gap")).toBe(true);
  });

  it("下限と上限が逆なら指摘される", () => {
    const problems = checkRangeCoverage(
      [
        { label: "A", lowerBound: 100, upperBound: null },
        { label: "B", lowerBound: 100, upperBound: 80 },
        { label: "E", lowerBound: null, upperBound: 80 },
      ],
      "実績値",
    );
    expect(problems.some((p) => p.kind === "overlap")).toBe(true);
  });
});

/**
 * 回帰テスト（元シートの数値をそのまま固定する）。
 *
 * 注意: これは「元シートの計算を再現できているか」を固定するテストであり、
 * 制度としての妥当性を検証したものではない。実運用のデータはまだ1件も無い。
 */
describe("computeBonus — 元シート Manager例（合計62点）の回帰", () => {
  const cases: { rate: number; coefficient: number; pt: number }[] = [
    { rate: 125, coefficient: 1.5, pt: 93 },
    { rate: 115, coefficient: 1.2, pt: 74 },
    { rate: 105, coefficient: 1.0, pt: 62 },
    { rate: 97, coefficient: 0.6, pt: 37 },
    { rate: 92, coefficient: 0.4, pt: 25 },
    { rate: 85, coefficient: 0.2, pt: 12 },
  ];

  for (const c of cases) {
    it(`達成率${c.rate}% → 係数${c.coefficient} → 個人Pt ${c.pt}`, () => {
      const r = computeBonus({
        kpiTotalScore: 62,
        officeAchievementRate: c.rate,
        coefficients,
        yenPerPoint: 3200,
      });
      expect(r.coefficient).toBe(c.coefficient);
      expect(r.personalPoints).toBe(c.pt);
      expect(r.bonusYen).toBe(c.pt * 3200);
    });
  }

  it("達成率が未入力なら0円ではなくnullを返す（賞与なしと誤読させない）", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: null,
      coefficients,
      yenPerPoint: 3200,
    });
    expect(r.personalPoints).toBeNull();
    expect(r.bonusYen).toBeNull();
    expect(r.rationale).toContain("未入力");
  });

  it("係数表に穴があって当てはまらない場合も0円に丸めない", () => {
    const holed: KgiCoefficientRow[] = [
      { label: "100%以上", lowerBound: 100, upperBound: null, coefficient: 1.0, displayOrder: 1 },
    ];
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: 80,
      coefficients: holed,
      yenPerPoint: 3200,
    });
    expect(r.coefficient).toBeNull();
    expect(r.bonusYen).toBeNull();
    expect(r.rationale).toContain("抜け");
  });

  it("1点あたり金額が未設定（0円）なら賞与額は出さないが個人Ptは出す", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: 105,
      coefficients,
      yenPerPoint: 0,
    });
    expect(r.personalPoints).toBe(62);
    expect(r.bonusYen).toBeNull();
  });
});
