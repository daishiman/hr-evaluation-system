import { describe, it, expect } from "vitest";
import { judgeRank, matchesCriterion, scoreFromRank, judgeOverall, type RankCriterion } from "./scoring";

/** No.1 等級要件達成率（高いほど良い） 100/80/60/40 */
const requirementRate: RankCriterion[] = [
  { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
  { rank: "B", displayLabel: "80%以上 100%未満", lowerBound: 80, upperBound: 100 },
  { rank: "C", displayLabel: "60%以上 80%未満", lowerBound: 60, upperBound: 80 },
  { rank: "D", displayLabel: "40%以上 60%未満", lowerBound: 40, upperBound: 60 },
  { rank: "E", displayLabel: "40%未満", lowerBound: null, upperBound: 40 },
];

/** No.8 残業率（低いほど良い＝逆転指標） A=95%以下 */
const overtimeRate: RankCriterion[] = [
  { rank: "A", displayLabel: "95%以下", lowerBound: null, upperBound: 95 },
  { rank: "B", displayLabel: "95%超 100%以下", lowerBound: 95, upperBound: 100 },
  { rank: "C", displayLabel: "100%超 105%以下", lowerBound: 100, upperBound: 105 },
  { rank: "D", displayLabel: "105%超 110%以下", lowerBound: 105, upperBound: 110 },
  { rank: "E", displayLabel: "110%超", lowerBound: 110, upperBound: null },
];

/** No.15 欠員日数（逆転指標・ゼロ型） A=0日 */
const vacancyDays: RankCriterion[] = [
  { rank: "A", displayLabel: "0日", lowerBound: null, upperBound: 0 },
  { rank: "B", displayLabel: "1日以上 2日以下", lowerBound: 0, upperBound: 2 },
  { rank: "C", displayLabel: "2日超 5日以下", lowerBound: 2, upperBound: 5 },
  { rank: "D", displayLabel: "5日超 10日以下", lowerBound: 5, upperBound: 10 },
  { rank: "E", displayLabel: "10日超", lowerBound: 10, upperBound: null },
];

describe("matchesCriterion — 境界の扱い", () => {
  it("高いほど良い項目は「下限以上・上限未満」", () => {
    const b = requirementRate[1]; // 80以上100未満
    expect(matchesCriterion(80, b, "higher")).toBe(true); // 下限ちょうどは含む
    expect(matchesCriterion(99.9, b, "higher")).toBe(true);
    expect(matchesCriterion(100, b, "higher")).toBe(false); // 上限ちょうどは含まない
    expect(matchesCriterion(79.9, b, "higher")).toBe(false);
  });

  it("逆転指標は「上限以下・下限超」", () => {
    const a = overtimeRate[0]; // 95以下
    expect(matchesCriterion(95, a, "lower")).toBe(true); // 上限ちょうどは含む
    expect(matchesCriterion(95.1, a, "lower")).toBe(false);
    const b = overtimeRate[1]; // 95超100以下
    expect(matchesCriterion(95, b, "lower")).toBe(false); // 下限ちょうどは含まない
    expect(matchesCriterion(100, b, "lower")).toBe(true);
  });

  it("上限・下限が null の側は判定しない", () => {
    expect(matchesCriterion(1000, requirementRate[0], "higher")).toBe(true);
    expect(matchesCriterion(0, requirementRate[4], "higher")).toBe(true);
  });
});

describe("judgeRank — 隣り合うランクで二重に該当しない", () => {
  it("ちょうど100%はA（Bではない）", () => {
    expect(judgeRank(100, requirementRate, "higher").rank).toBe("A");
  });

  it("ちょうど80%はB", () => {
    expect(judgeRank(80, requirementRate, "higher").rank).toBe("B");
  });

  it("60%はC（半期上限5件中3件達成の例）", () => {
    expect(judgeRank(60, requirementRate, "higher").rank).toBe("C");
  });

  it("39%はE", () => {
    expect(judgeRank(39, requirementRate, "higher").rank).toBe("E");
  });

  it("すべての基準値でランクが1つに定まる", () => {
    for (let v = 0; v <= 130; v += 0.5) {
      const hit = requirementRate.filter((c) => matchesCriterion(v, c, "higher"));
      expect(hit, `実績値 ${v} で該当するランクが ${hit.length} 件`).toHaveLength(1);
    }
  });

  it("逆転指標でもランクが1つに定まる", () => {
    for (let v = 80; v <= 130; v += 0.5) {
      const hit = overtimeRate.filter((c) => matchesCriterion(v, c, "lower"));
      expect(hit, `残業率 ${v} で該当するランクが ${hit.length} 件`).toHaveLength(1);
    }
  });

  it("欠員日数0日はA、1日はB", () => {
    expect(judgeRank(0, vacancyDays, "lower").rank).toBe("A");
    expect(judgeRank(1, vacancyDays, "lower").rank).toBe("B");
    expect(judgeRank(11, vacancyDays, "lower").rank).toBe("E");
  });

  it("判定根拠が日本語で残る", () => {
    const r = judgeRank(60, requirementRate, "higher");
    expect(r.rationale).toContain("60");
    expect(r.rationale).toContain("60%以上 80%未満");
    expect(r.fellThrough).toBe(false);
  });

  it("基準表に穴がある場合はEに丸め、その事実を残す", () => {
    const holed: RankCriterion[] = [{ rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null }];
    const r = judgeRank(50, holed, "higher");
    expect(r.rank).toBe("E");
    expect(r.fellThrough).toBe(true);
    expect(r.rationale).toContain("基準表の見直し");
  });
});

describe("scoreFromRank", () => {
  const ratios = [
    { rank: "A" as const, ratio: 1 },
    { rank: "B" as const, ratio: 0.8 },
    { rank: "C" as const, ratio: 0.6 },
    { rank: "D" as const, ratio: 0.4 },
    { rank: "E" as const, ratio: 0 },
  ];
  it("配点×割合で得点が出る", () => {
    expect(scoreFromRank("A", 20, ratios)).toBe(20);
    expect(scoreFromRank("B", 20, ratios)).toBe(16);
    expect(scoreFromRank("E", 20, ratios)).toBe(0);
  });
});

describe("judgeOverall — 昇給と昇格の判定", () => {
  const mk = (ranks: ("A" | "B" | "C" | "D" | "E")[]) =>
    ranks.map((r, i) => ({
      kpiItemId: `k${i}`,
      itemName: `項目${i + 1}`,
      rank: r,
      points: r === "A" ? 12.5 : 0,
      maxPoints: 12.5,
    }));

  it("8項目すべてAなら昇給の要件を満たす", () => {
    const res = judgeOverall({
      items: mk(["A", "A", "A", "A", "A", "A", "A", "A"]),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseEligible).toBe(true);
    expect(res.totalScore).toBe(100);
    expect(res.raiseReason).toContain("昇給の要件を満たします");
  });

  it("1項目でもB以下なら昇給は見送り、理由に項目名が入る", () => {
    const res = judgeOverall({
      items: mk(["A", "A", "A", "A", "A", "A", "A", "B"]),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseEligible).toBe(false);
    expect(res.raiseReason).toContain("項目8（B）");
    expect(res.raiseReason).toContain("見送り");
  });

  it("昇格要件（受講後報告書提出）が未達なら点数が足りていても昇格できない", () => {
    const res = judgeOverall({
      items: mk(["A", "A", "A", "A", "A", "A", "A", "A"]),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: 10,
      behaviorTotal: 12,
      gates: [
        { text: "スキルアップ研修（チーフ以上）", achieved: true },
        { text: "IT機器基礎研修（本部）", achieved: false },
      ],
    });
    expect(res.promotionEligible).toBe(false);
    expect(res.promotionBlockedReason).toContain("IT機器基礎研修（本部）");
  });

  it("行動指針の点数が足りない場合も昇格できない", () => {
    const res = judgeOverall({
      items: mk(["A", "A", "A", "A", "A", "A", "A", "A"]),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: 10,
      behaviorTotal: 7,
      gates: [],
    });
    expect(res.promotionEligible).toBe(false);
    expect(res.promotionBlockedReason).toContain("行動指針");
  });

  it("すべて満たせば昇格できる", () => {
    const res = judgeOverall({
      items: mk(["A", "A", "A", "A", "A", "A", "A", "A"]),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: 10,
      behaviorTotal: 12,
      gates: [{ text: "スキルアップ研修", achieved: true }],
    });
    expect(res.promotionEligible).toBe(true);
    expect(res.promotionBlockedReason).toBeNull();
  });
});
