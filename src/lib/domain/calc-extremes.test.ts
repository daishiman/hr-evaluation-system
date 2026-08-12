/**
 * 数字に関わるところの「端」と「組み合わせ」を、観点ごとに洗い出して確かめる。
 *
 * 洗い出しの考え方（件数ではなく観点で網羅する）:
 *  1. 設定そのもの   … 配点の型・項目数・固定枠・重い枠が、等級区分ごとに成り立つか
 *  2. 一つの値の端   … ちょうど・その両側・空欄（制限なし）・0・負・極端に大きい値
 *  3. 値どうしの関係 … 隣り合うランクの継ぎ目、重なり、隙間
 *  4. 組み合わせ     … 全部が上限のとき／全部が下限のときの合計が、満点を超えず下回らないか
 *  5. 数え方の端     … 分母0（在籍0・出題0）、分子が分母を超える、四捨五入の刻み
 *
 * すでにある試験と重ならない範囲で、上の観点の抜けだけをここに足している。
 */
import { describe, it, expect } from "vitest";
import { validateScheme, type SchemeSelection } from "./scheme";
import { checkGradePointRule, expectedItemCount, type GradePointRule } from "./grade-points";
import {
  judgeRank,
  matchesCriterion,
  scoreFromRank,
  judgeOverall,
  gradeRequirementRate,
  type RankCriterion,
  type RankRatio,
  type ScoredItem,
} from "./scoring";
import { computeBonus, matchKgiCoefficient, type KgiCoefficientRow } from "./kgi";
import { parseChoiceValidation } from "./form-question-text";
import { buildThresholdScale } from "./evaluation-view";

/* ───────── 観点1: 設定そのもの（KPIの配点の型） ───────── */

/** 実際に使っている5つの等級区分の型。合計はすべて100点。 */
const RULES: GradePointRule[] = [
  { pointGroup: "Beginner", totalPoints: 100, fixedSlotPoints: 100, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 0, minorSlotCount: 0 },
  { pointGroup: "Regular", totalPoints: 100, fixedSlotPoints: 80, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 2 },
  { pointGroup: "Chief", totalPoints: 100, fixedSlotPoints: 40, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 4 },
  { pointGroup: "AM", totalPoints: 100, fixedSlotPoints: 30, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 5 },
  { pointGroup: "Manager", totalPoints: 100, fixedSlotPoints: 20, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 6 },
];

function selectionsFor(rule: GradePointRule): SchemeSelection[] {
  const out: SchemeSelection[] = [
    { kpiItemId: "fixed", categoryId: "c1", weight: rule.fixedSlotPoints, isFixedSlot: true, isMajorSlot: false },
  ];
  for (let i = 0; i < rule.majorSlotCount; i++) {
    out.push({ kpiItemId: `major${i}`, categoryId: "c1", weight: rule.majorSlotPoints, isFixedSlot: false, isMajorSlot: true });
  }
  for (let i = 0; i < rule.minorSlotCount; i++) {
    out.push({ kpiItemId: `minor${i}`, categoryId: "c1", weight: rule.minorSlotPoints, isFixedSlot: false, isMajorSlot: false });
  }
  return out;
}

describe("観点1: 等級区分ごとの配点の型", () => {
  it.each(RULES)("$pointGroup は型そのものが100点ちょうどで成り立つ", (rule) => {
    expect(checkGradePointRule(rule)).toEqual([]);
  });

  it.each(RULES)("$pointGroup は、型どおりに選ぶと合計がちょうど満点になる", (rule) => {
    const sel = selectionsFor(rule);
    const res = validateScheme(sel, { rule, fixedSlotItemIds: ["fixed"] });
    expect(res.errors).toEqual([]);
    expect(res.total).toBe(100);
    expect(sel).toHaveLength(expectedItemCount(rule));
  });

  it("いちばん少ない構成（Beginner・1項目）と、いちばん多い構成（Manager・8項目）の両端が通る", () => {
    expect(expectedItemCount(RULES[0])).toBe(1);
    expect(expectedItemCount(RULES[4])).toBe(8);
  });

  it("1点でも足りない・多いと保存させない（合計100点ちょうどを外れたとき）", () => {
    const rule = RULES[2];
    const short = selectionsFor(rule);
    short[short.length - 1] = { ...short[short.length - 1], weight: 9 };
    const a = validateScheme(short, { rule, fixedSlotItemIds: ["fixed"] });
    expect(a.ok).toBe(false);
    expect(a.errors.join("")).toContain("99点");

    const over = selectionsFor(rule);
    over[over.length - 1] = { ...over[over.length - 1], weight: 11 };
    const b = validateScheme(over, { rule, fixedSlotItemIds: ["fixed"] });
    expect(b.ok).toBe(false);
    expect(b.errors.join("")).toContain("101点");
  });

  it("配点に負の値を入れても通さない（合計が合っていても弾く）", () => {
    const rule = RULES[2];
    const sel = selectionsFor(rule);
    sel[1] = { ...sel[1], weight: -10 };
    sel[2] = { ...sel[2], weight: 40 };
    const res = validateScheme(sel, { rule, fixedSlotItemIds: ["fixed"] });
    expect(res.ok).toBe(false);
    expect(res.errors.join("")).toContain("1点以上");
  });

  it("項目を1つも選ばないと、件数と固定枠の両方で止まる", () => {
    const rule = RULES[3];
    const res = validateScheme([], { rule, fixedSlotItemIds: ["fixed"] });
    expect(res.ok).toBe(false);
    expect(res.errors.join("")).toContain("固定枠");
    expect(res.total).toBe(0);
  });

  it("型そのものが破綻していれば（合計が満点にならない型）、その場で気づける", () => {
    const broken: GradePointRule = { ...RULES[2], minorSlotCount: 3 };
    expect(checkGradePointRule(broken).join("")).toContain("100点になりません");
  });
});

/* ───────── 観点2・3: ランクの判定（端・継ぎ目・重なり・隙間） ───────── */

const higher: RankCriterion[] = [
  { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null, meaning: null },
  { rank: "B", displayLabel: "90%以上100%未満", lowerBound: 90, upperBound: 100, meaning: null },
  { rank: "C", displayLabel: "80%以上90%未満", lowerBound: 80, upperBound: 90, meaning: null },
  { rank: "D", displayLabel: "70%以上80%未満", lowerBound: 70, upperBound: 80, meaning: null },
  { rank: "E", displayLabel: "70%未満", lowerBound: null, upperBound: 70, meaning: null },
];

describe("観点2: ランクの判定は、ちょうどの値とその両側で切り替わる", () => {
  it.each([
    [69.9, "E"],
    [70, "D"],
    [70.1, "D"],
    [79.9, "D"],
    [80, "C"],
    [89.9, "C"],
    [90, "B"],
    [99.9, "B"],
    [100, "A"],
    [100.1, "A"],
  ])("実績 %s は %s", (value, rank) => {
    expect(judgeRank(value as number, higher, "higher").rank).toBe(rank);
  });

  it("上限が空欄のランクは青天井（極端に大きい値でもAのまま）", () => {
    expect(judgeRank(1e12, higher, "higher").rank).toBe("A");
  });

  it("下限が空欄のランクは下限なし（0でも負でもEのまま）", () => {
    expect(judgeRank(0, higher, "higher").rank).toBe("E");
    expect(judgeRank(-50, higher, "higher").rank).toBe("E");
  });

  it("下限も上限も空欄の基準は、どんな値でも当たる（設定の誤りとして表に出る形）", () => {
    const anything: RankCriterion = { rank: "C", displayLabel: "制限なし", lowerBound: null, upperBound: null, meaning: null };
    expect(matchesCriterion(-1e9, anything, "higher")).toBe(true);
    expect(matchesCriterion(1e9, anything, "lower")).toBe(true);
  });

  it("低いほど良い項目は、含む側が逆になる（上限を含み、下限は含まない）", () => {
    const lower: RankCriterion[] = [
      { rank: "A", displayLabel: "5%以下", lowerBound: null, upperBound: 5, meaning: null },
      { rank: "B", displayLabel: "5%超10%以下", lowerBound: 5, upperBound: 10, meaning: null },
      { rank: "C", displayLabel: "10%超15%以下", lowerBound: 10, upperBound: 15, meaning: null },
      { rank: "D", displayLabel: "15%超20%以下", lowerBound: 15, upperBound: 20, meaning: null },
      { rank: "E", displayLabel: "20%超", lowerBound: 20, upperBound: null, meaning: null },
    ];
    expect(judgeRank(4.9, lower, "lower").rank).toBe("A");
    expect(judgeRank(5, lower, "lower").rank).toBe("A"); // ちょうどは上（良い側）に入る
    expect(judgeRank(5.1, lower, "lower").rank).toBe("B");
    expect(judgeRank(20, lower, "lower").rank).toBe("D");
    expect(judgeRank(20.1, lower, "lower").rank).toBe("E");
    expect(judgeRank(0, lower, "lower").rank).toBe("A");
    expect(judgeRank(-3, lower, "lower").rank).toBe("A");
  });
});

describe("観点3: 基準の設定に重なり・隙間があるときの振る舞い", () => {
  it("重なっているときは、良いほうのランクに入る（二重には数えない）", () => {
    const overlapped: RankCriterion[] = [
      { rank: "A", displayLabel: "90以上", lowerBound: 90, upperBound: null, meaning: null },
      { rank: "B", displayLabel: "85以上100未満", lowerBound: 85, upperBound: 100, meaning: null },
      { rank: "C", displayLabel: "80以上90未満", lowerBound: 80, upperBound: 90, meaning: null },
      { rank: "D", displayLabel: "70以上80未満", lowerBound: 70, upperBound: 80, meaning: null },
      { rank: "E", displayLabel: "70未満", lowerBound: null, upperBound: 70, meaning: null },
    ];
    const j = judgeRank(95, overlapped, "higher");
    expect(j.rank).toBe("A");
    expect(j.fellThrough).toBe(false);
  });

  it("隙間に落ちた値は、黙ってEにせず「基準表の見直しが必要」と残す", () => {
    const gapped: RankCriterion[] = [
      { rank: "A", displayLabel: "100以上", lowerBound: 100, upperBound: null, meaning: null },
      { rank: "B", displayLabel: "95以上100未満", lowerBound: 95, upperBound: 100, meaning: null },
      { rank: "C", displayLabel: "80以上90未満", lowerBound: 80, upperBound: 90, meaning: null },
      { rank: "D", displayLabel: "70以上80未満", lowerBound: 70, upperBound: 80, meaning: null },
      { rank: "E", displayLabel: "70未満", lowerBound: null, upperBound: 70, meaning: null },
    ];
    const j = judgeRank(92, gapped, "higher"); // 90〜95 が抜けている
    expect(j.rank).toBe("E");
    expect(j.fellThrough).toBe(true);
    expect(j.rationale).toContain("基準表の見直しが必要");
    expect(j.rationaleEmployee).toContain("評価基準の見直しが必要");
  });

  it("基準が1件も無ければ、Eに丸めたうえでその事実を残す", () => {
    const j = judgeRank(80, [], "higher");
    expect(j.rank).toBe("E");
    expect(j.fellThrough).toBe(true);
    expect(j.criterion).toBeNull();
  });
});

/* ───────── 観点4: 組み合わせ（全部が上限／全部が下限） ───────── */

const RATIOS: RankRatio[] = [
  { rank: "A", ratio: 1 },
  { rank: "B", ratio: 0.8 },
  { rank: "C", ratio: 0.6 },
  { rank: "D", ratio: 0.4 },
  { rank: "E", ratio: 0 },
];

function itemsAll(rank: ScoredItem["rank"], weights: number[]): ScoredItem[] {
  return weights.map((w, i) => ({
    kpiItemId: `k${i}`,
    itemName: `項目${i + 1}`,
    rank,
    points: rank === null ? 0 : scoreFromRank(rank, w, RATIOS),
    maxPoints: w,
  }));
}

describe("観点4: 全項目が同じ端に寄ったときの合計", () => {
  const weights = [20, 20, 10, 10, 10, 10, 10, 10]; // Manager の型（合計100）

  it("全項目がAなら、合計はちょうど満点（100点）で、満点を超えない", () => {
    const r = judgeOverall({
      items: itemsAll("A", weights),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.totalScore).toBe(100);
    expect(r.maxScore).toBe(100);
    expect(r.totalScore).toBeLessThanOrEqual(r.maxScore);
    expect(r.raiseEligible).toBe(true);
    expect(r.promotionEligible).toBe(true);
  });

  it("全項目がEなら、合計は0点（負にはならない）", () => {
    const r = judgeOverall({
      items: itemsAll("E", weights),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.totalScore).toBe(0);
    expect(r.maxScore).toBe(100);
    expect(r.raiseEligible).toBe(false);
    expect(r.promotionEligible).toBe(false);
  });

  it("全項目が判定外なら、0点だが「Eだった」とは言わない", () => {
    const r = judgeOverall({
      items: itemsAll(null, weights),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.totalScore).toBe(0);
    expect(r.unratedItemNames).toHaveLength(weights.length);
    expect(r.raiseEligible).toBe(false);
    expect(r.raiseReason).toContain("判定");
  });

  it("8項目中7項目がAでも、1項目が判定外なら昇給の要件は満たさない", () => {
    const items = itemsAll("A", weights);
    items[3] = { ...items[3], rank: null, points: 0 };
    const r = judgeOverall({
      items,
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseEligible).toBe(false);
    expect(r.raiseReasonEmployee).toContain("判定できていません");
  });

  it("昇格に必要な点数ちょうどなら昇格でき、0.1点足りなければできない", () => {
    const base = {
      raiseRequiresAllA: false,
      requiredKpiPoints: 80,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [] as { text: string; achieved: boolean }[],
    };
    const just = judgeOverall({ ...base, items: [{ kpiItemId: "k", itemName: "項目", rank: "A", points: 80, maxPoints: 100 }] });
    expect(just.promotionEligible).toBe(true);
    const short = judgeOverall({ ...base, items: [{ kpiItemId: "k", itemName: "項目", rank: "A", points: 79.9, maxPoints: 100 }] });
    expect(short.promotionEligible).toBe(false);
    expect(short.promotionBlockedReason).toContain("80点");
  });

  it("点数が足りていても、必須の要件（受講後報告書など）が1つでも未達なら昇格できない", () => {
    const r = judgeOverall({
      items: itemsAll("A", weights),
      raiseRequiresAllA: false,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [{ text: "受講後報告書を提出した", achieved: false }],
    });
    expect(r.promotionEligible).toBe(false);
    expect(r.promotionBlockedReason).toContain("受講後報告書");
  });

  it("行動指針が必要点数ちょうどなら昇格でき、1点足りなければできない", () => {
    const base = {
      items: itemsAll("A", weights),
      raiseRequiresAllA: false,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: 3,
      gates: [] as { text: string; achieved: boolean }[],
    };
    expect(judgeOverall({ ...base, behaviorTotal: 3 }).promotionEligible).toBe(true);
    expect(judgeOverall({ ...base, behaviorTotal: 2 }).promotionEligible).toBe(false);
    // 行動指針は最低 -1 まで下がる（未回答の0とは別物）
    const minus = judgeOverall({ ...base, behaviorTotal: -1 });
    expect(minus.promotionEligible).toBe(false);
    expect(minus.promotionBlockedReason).toContain("-1点");
  });
});

/* ───────── 観点5: 数え方の端（分母0・上限の張り付き・刻み） ───────── */

describe("観点5: 割合の出し方の端", () => {
  it("出題が0件なら0%ではなく「出せない」（空）", () => {
    expect(gradeRequirementRate(0, 0)).toBeNull();
    expect(gradeRequirementRate(3, 0)).toBeNull();
    expect(gradeRequirementRate(0, -1)).toBeNull();
  });

  it("1件も達成していなければ0%、全部なら100%", () => {
    expect(gradeRequirementRate(0, 10)).toBe(0);
    expect(gradeRequirementRate(10, 10)).toBe(100);
  });

  it("達成が出題を上回っても100%を超えない", () => {
    expect(gradeRequirementRate(11, 10)).toBe(100);
    expect(gradeRequirementRate(1000, 1)).toBe(100);
  });

  it("割り切れない割合は小数第1位まで（1/3 → 33.3%）", () => {
    expect(gradeRequirementRate(1, 3)).toBe(33.3);
    expect(gradeRequirementRate(2, 3)).toBe(66.7);
  });

  it("点数の刻みは小数第1位まで（配点25点のB＝20点、7点のB＝5.6点）", () => {
    expect(scoreFromRank("B", 25, RATIOS)).toBe(20);
    expect(scoreFromRank("B", 7, RATIOS)).toBe(5.6);
    expect(scoreFromRank("E", 100, RATIOS)).toBe(0);
    expect(scoreFromRank("A", 0, RATIOS)).toBe(0);
  });

  it("割合の表に無いランクは0点にする（黙って満点にしない）", () => {
    expect(scoreFromRank("C", 10, [{ rank: "A", ratio: 1 }])).toBe(0);
  });
});

describe("観点5: 達成係数と賞与の端", () => {
  const rows: KgiCoefficientRow[] = [
    { label: "120%以上", lowerBound: 120, upperBound: null, coefficient: 1.5, displayOrder: 1 },
    { label: "100%以上120%未満", lowerBound: 100, upperBound: 120, coefficient: 1.2, displayOrder: 2 },
    { label: "80%以上100%未満", lowerBound: 80, upperBound: 100, coefficient: 1.0, displayOrder: 3 },
    { label: "80%未満", lowerBound: null, upperBound: 80, coefficient: 0.6, displayOrder: 4 },
  ];

  it.each([
    [79.9, 0.6],
    [80, 1.0],
    [99.9, 1.0],
    [100, 1.2],
    [119.9, 1.2],
    [120, 1.5],
    [1000, 1.5],
    [0, 0.6],
  ])("達成率 %s%% の係数は %s", (rate, coefficient) => {
    expect(matchKgiCoefficient(rate as number, rows)?.coefficient).toBe(coefficient);
  });

  it("達成率が未入力なら、0円ではなく「出せない」", () => {
    const r = computeBonus({ kpiTotalScore: 80, officeAchievementRate: null, coefficients: rows, yenPerPoint: 3200 });
    expect(r.bonusYen).toBeNull();
    expect(r.personalPoints).toBeNull();
  });

  it("係数の表に穴があって当たらないときも、0円ではなく「出せない」", () => {
    const holed: KgiCoefficientRow[] = [{ label: "100%以上", lowerBound: 100, upperBound: null, coefficient: 1.2, displayOrder: 1 }];
    const r = computeBonus({ kpiTotalScore: 80, officeAchievementRate: 50, coefficients: holed, yenPerPoint: 3200 });
    expect(r.coefficient).toBeNull();
    expect(r.rationale).toContain("抜けがある");
  });

  it("1点あたりの金額が0なら、金額は出さない（0円と書かない）", () => {
    const r = computeBonus({ kpiTotalScore: 80, officeAchievementRate: 100, coefficients: rows, yenPerPoint: 0 });
    expect(r.personalPoints).toBe(96);
    expect(r.bonusYen).toBeNull();
  });

  it("KPI合計が0点なら、個人Ptも0で金額も0円（未入力とは区別する）", () => {
    const r = computeBonus({ kpiTotalScore: 0, officeAchievementRate: 100, coefficients: rows, yenPerPoint: 3200 });
    expect(r.personalPoints).toBe(0);
    expect(r.bonusYen).toBe(0);
  });
});

/* ───────── 観点2の続き: 桁あふれ・表示の端 ───────── */

describe("観点2: 桁が極端な値の扱い", () => {
  it("選択肢の設定に、数として持てない桁の値が混ざっていたら選択肢にしない", () => {
    // 400桁の数は内部で「無限大」になる。選択肢として出すと選べない項目ができる。
    expect(parseChoiceValidation(`${"9".repeat(400)},5 から選択`)).toBeNull();
  });

  it("ランクの目盛りは、境界が1つしか無くても必ず幅を持つ（潰れない）", () => {
    const single = buildThresholdScale(
      [{ rank: "C", displayLabel: "80以上", lowerBound: 80, upperBound: null }],
      80,
      "C",
    );
    expect(single).not.toBeNull();
    expect(single!.segments.length).toBeGreaterThan(0);

    // 境界が 0 ちょうど1つでも、上下に最低1の余白が付く
    const atZero = buildThresholdScale(
      [{ rank: "C", displayLabel: "0以上", lowerBound: 0, upperBound: null }],
      0,
      "C",
    );
    expect(atZero).not.toBeNull();
    expect(atZero!.markerLeft).toBeGreaterThan(0);
    expect(atZero!.markerLeft).toBeLessThan(100);
  });
});
