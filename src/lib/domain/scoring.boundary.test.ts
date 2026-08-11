import { describe, expect, it } from "vitest";
import {
  gradeRequirementRate,
  judgeOverall,
  judgeRank,
  matchesCriterion,
  rangeLabel,
  rankLevelLabel,
  scoreFromRank,
  scoreItem,
  type RankCriterion,
  type RankRatio,
} from "./scoring";

/**
 * ランク判定と得点化の「境目」を、両側とちょうどの値で押さえる。
 *
 * 評価は1点ずれれば昇給・昇格が変わる。効くのは行を全部通すことではなく、
 * 判定が切り替わるまさにその点なので、下限・上限・0・負の値・空欄を
 * すべて 手前 / ちょうど / 直後 の3点で確かめる。
 */

const ratios: RankRatio[] = [
  { rank: "A", ratio: 1 },
  { rank: "B", ratio: 0.8 },
  { rank: "C", ratio: 0.6 },
  { rank: "D", ratio: 0.4 },
  { rank: "E", ratio: 0 },
];

/** 通常の項目（高いほど良い）：下限を含み、上限を含まない */
const higher: RankCriterion[] = [
  { rank: "A", displayLabel: "A", lowerBound: 100, upperBound: null },
  { rank: "B", displayLabel: "B", lowerBound: 90, upperBound: 100 },
  { rank: "C", displayLabel: "C", lowerBound: 80, upperBound: 90 },
  { rank: "D", displayLabel: "D", lowerBound: 70, upperBound: 80 },
  { rank: "E", displayLabel: "E", lowerBound: null, upperBound: 70 },
];

/** 逆転指標（低いほど良い）：上限を含み、下限を含まない */
const lower: RankCriterion[] = [
  { rank: "A", displayLabel: "A", lowerBound: null, upperBound: 5 },
  { rank: "B", displayLabel: "B", lowerBound: 5, upperBound: 10 },
  { rank: "C", displayLabel: "C", lowerBound: 10, upperBound: 15 },
  { rank: "D", displayLabel: "D", lowerBound: 15, upperBound: 20 },
  { rank: "E", displayLabel: "E", lowerBound: 20, upperBound: null },
];

describe("ランク判定の境界（下限は含む・上限は含まない）", () => {
  const cases: [number, string][] = [
    [69.9, "E"],
    [70, "D"],
    [70.1, "D"],
    [79.9, "D"],
    [80, "C"],
    [80.1, "C"],
    [89.9, "C"],
    [90, "B"],
    [90.1, "B"],
    [99.9, "B"],
    [100, "A"],
    [100.1, "A"],
  ];
  for (const [value, rank] of cases) {
    it(`${value} は ${rank}`, () => {
      expect(judgeRank(value, higher, "higher").rank).toBe(rank);
    });
  }

  it("0 と 負の値 は最下位に落ちる（下限なしのEに入る）", () => {
    expect(judgeRank(0, higher, "higher").rank).toBe("E");
    expect(judgeRank(-1, higher, "higher").rank).toBe("E");
    expect(judgeRank(0, higher, "higher").fellThrough).toBe(false);
  });

  it("並び順がばらばらでも、A→Eの順に当てはめる", () => {
    const shuffled = [higher[3], higher[0], higher[4], higher[2], higher[1]];
    expect(judgeRank(95, shuffled, "higher").rank).toBe("B");
  });
});

describe("逆転指標の境界（上限は含む・下限は含まない）", () => {
  const cases: [number, string][] = [
    [4.9, "A"],
    [5, "A"],
    [5.1, "B"],
    [9.9, "B"],
    [10, "B"],
    [10.1, "C"],
    [14.9, "C"],
    [15, "C"],
    [15.1, "D"],
    [19.9, "D"],
    [20, "D"],
    [20.1, "E"],
  ];
  for (const [value, rank] of cases) {
    it(`${value} は ${rank}`, () => {
      expect(judgeRank(value, lower, "lower").rank).toBe(rank);
    });
  }

  it("0 と 負の値 は最上位（上限なしの側）に入る", () => {
    expect(judgeRank(0, lower, "lower").rank).toBe("A");
    expect(judgeRank(-5, lower, "lower").rank).toBe("A");
  });
});

describe("隣り合うランクで、同じ値が二重に当てはまらない", () => {
  for (const value of [70, 80, 90, 100, 69.9, 79.9, 89.9, 99.9, 100.1]) {
    it(`高いほど良い：${value} に当てはまる区分はちょうど1つ`, () => {
      const hits = higher.filter((c) => matchesCriterion(value, c, "higher"));
      expect(hits).toHaveLength(1);
    });
  }
  for (const value of [5, 10, 15, 20, 4.9, 10.1, 20.1]) {
    it(`低いほど良い：${value} に当てはまる区分はちょうど1つ`, () => {
      const hits = lower.filter((c) => matchesCriterion(value, c, "lower"));
      expect(hits).toHaveLength(1);
    });
  }
});

describe("基準表に穴があるとき", () => {
  it("どこにも当てはまらなければEに丸め、その事実を残す", () => {
    const holed = higher.filter((c) => c.rank !== "C");
    const j = judgeRank(85, holed, "higher");
    expect(j.rank).toBe("E");
    expect(j.fellThrough).toBe(true);
    expect(j.rationale).toContain("基準表の見直しが必要");
    expect(j.rationaleEmployee).toContain("評価基準の見直しが必要");
  });

  it("基準が1件も無ければ、当てはまった区分は空になる", () => {
    const j = judgeRank(85, [], "higher");
    expect(j.rank).toBe("E");
    expect(j.criterion).toBeNull();
  });
});

describe("本人向けの説明", () => {
  it("単位が付き、閾値の数値は出さない", () => {
    const j = judgeRank(92.5, higher, "higher", { unit: "%" });
    expect(j.rationaleEmployee).toContain("92.5%");
    expect(j.rationaleEmployee).not.toContain("90");
  });

  it("単位が「-」のときは何も付けない", () => {
    expect(judgeRank(92, higher, "higher", { unit: "-" }).rationaleEmployee).toContain("実績値 92 ");
  });

  it("ランクは上から何番目かで言い換える", () => {
    expect(rankLevelLabel("A")).toBe("もっとも高い水準");
    expect(rankLevelLabel("B")).toBe("上から2番目の水準");
    expect(rankLevelLabel("C")).toBe("上から3番目の水準");
    expect(rankLevelLabel("D")).toBe("上から4番目の水準");
    expect(rankLevelLabel("E")).toBe("もっとも下の水準");
  });
});

describe("範囲の表記は、判定に使う数値から必ず導く", () => {
  it("高いほど良い項目", () => {
    expect(rangeLabel({ lowerBound: 80, upperBound: 90 }, "%", "higher")).toBe("80%以上 90%未満");
    expect(rangeLabel({ lowerBound: 100, upperBound: null }, "%", "higher")).toBe("100%以上");
    expect(rangeLabel({ lowerBound: null, upperBound: 70 }, "%", "higher")).toBe("70%未満");
    expect(rangeLabel({ lowerBound: null, upperBound: null }, "%", "higher")).toBe("すべての実績値が該当");
  });

  it("低いほど良い項目", () => {
    expect(rangeLabel({ lowerBound: 5, upperBound: 10 }, "%", "lower")).toBe("5%超 10%以下");
    expect(rangeLabel({ lowerBound: null, upperBound: 5 }, "%", "lower")).toBe("5%以下");
    expect(rangeLabel({ lowerBound: 20, upperBound: null }, "%", "lower")).toBe("20%超");
    expect(rangeLabel({ lowerBound: null, upperBound: null }, "%", "lower")).toBe("すべての実績値が該当");
  });

  it("単位が無くても表記が壊れない", () => {
    expect(rangeLabel({ lowerBound: 3, upperBound: 5 }, null, "higher")).toBe("3以上 5未満");
  });

  it("小数の境界はそのまま表記に出る", () => {
    expect(rangeLabel({ lowerBound: 99.5, upperBound: 100.25 }, "%", "higher")).toBe(
      "99.5%以上 100.25%未満",
    );
  });
});

describe("ランクから点数へ", () => {
  it("配点 × 割合。小数第1位で丸める", () => {
    expect(scoreFromRank("A", 20, ratios)).toBe(20);
    expect(scoreFromRank("B", 20, ratios)).toBe(16);
    expect(scoreFromRank("C", 15, ratios)).toBe(9);
    expect(scoreFromRank("D", 15, ratios)).toBe(6);
    expect(scoreFromRank("E", 20, ratios)).toBe(0);
    // 10 × 0.8 = 8.0（浮動小数の誤差が残らないこと）
    expect(scoreFromRank("B", 10, ratios)).toBe(8);
    // 7 × 0.6 = 4.199999… → 4.2
    expect(scoreFromRank("C", 7, ratios)).toBe(4.2);
  });

  it("割合の表が無いランクは0点として扱う", () => {
    expect(scoreFromRank("A", 20, [])).toBe(0);
  });

  it("配点が0点なら、どのランクでも0点", () => {
    for (const rank of ["A", "B", "C", "D", "E"] as const) {
      expect(scoreFromRank(rank, 0, ratios)).toBe(0);
    }
  });

  it("一律割合方式では、割合を説明文に出す（評価者向けのみ）", () => {
    const r = scoreItem({ rank: "B", weight: 20, mode: "ratio", ratios });
    expect(r.points).toBe(16);
    expect(r.maxPoints).toBe(20);
    expect(r.note).toContain("80%");
    expect(r.noteEmployee).not.toMatch(/[0-9]/);
    expect(r.fellBackToRatio).toBe(false);
  });

  it("割合の表が空でも0点として通す（集計を止めない）", () => {
    const r = scoreItem({ rank: "B", weight: 20, mode: "ratio", ratios: [] });
    expect(r.points).toBe(0);
    expect(r.note).toContain("0%");
  });
});

describe("項目別絶対点方式（過去の評価の表示のために残している）", () => {
  const absolute = { byRank: [{ rank: "A", points: 20 }, { rank: "B", points: 15 }] };

  it("表にあるランクはその点数、満点はAの点数", () => {
    const r = scoreItem({ rank: "B", weight: 99, mode: "absolute", ratios, absolute });
    expect(r.points).toBe(15);
    expect(r.maxPoints).toBe(20);
    expect(r.fellBackToRatio).toBe(false);
  });

  it("表に無いランクは0点として扱う", () => {
    const r = scoreItem({ rank: "E", weight: 99, mode: "absolute", ratios, absolute });
    expect(r.points).toBe(0);
    expect(r.maxPoints).toBe(20);
  });

  it("表そのものが無ければ一律割合方式に退避し、退避したことを残す", () => {
    const r = scoreItem({ rank: "B", weight: 20, mode: "absolute", ratios, absolute: null });
    expect(r.points).toBe(16);
    expect(r.fellBackToRatio).toBe(true);
    expect(r.note).toContain("元の配点表がないため");
  });

  it("Aの行が無い表も、退避扱いにする（満点が決められないため）", () => {
    const r = scoreItem({
      rank: "B",
      weight: 20,
      mode: "absolute",
      ratios,
      absolute: { byRank: [{ rank: "B", points: 15 }] },
    });
    expect(r.fellBackToRatio).toBe(true);
  });
});

describe("等級要件達成率（割り算の境界）", () => {
  it("分母が0なら判定外（0%にしない）", () => {
    expect(gradeRequirementRate(0, 0)).toBeNull();
    expect(gradeRequirementRate(3, 0)).toBeNull();
    expect(gradeRequirementRate(1, -1)).toBeNull();
  });

  it("0件達成は0%", () => {
    expect(gradeRequirementRate(0, 5)).toBe(0);
  });

  it("小数第1位で丸める", () => {
    expect(gradeRequirementRate(1, 3)).toBe(33.3);
    expect(gradeRequirementRate(2, 3)).toBe(66.7);
    expect(gradeRequirementRate(1, 7)).toBe(14.3);
    expect(gradeRequirementRate(1, 8)).toBe(12.5);
  });

  it("100%を超えても100%で頭打ちにする", () => {
    expect(gradeRequirementRate(6, 5)).toBe(100);
    expect(gradeRequirementRate(5, 5)).toBe(100);
  });
});

describe("総合判定（昇給・昇格）", () => {
  const item = (name: string, rank: "A" | "B" | "C" | "D" | "E" | null, points: number, max = 20) => ({
    kpiItemId: name,
    itemName: name,
    rank,
    points,
    maxPoints: max,
  });

  it("すべてAなら昇給の要件を満たす", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", "A", 20)],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseEligible).toBe(true);
    expect(r.totalScore).toBe(40);
    expect(r.maxScore).toBe(40);
    expect(r.raiseReasonEmployee).not.toMatch(/[0-9]/);
  });

  it("項目が1件も無ければ昇給にはしない", () => {
    const r = judgeOverall({
      items: [],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseEligible).toBe(false);
    expect(r.totalScore).toBe(0);
  });

  it("1つでもA未満なら見送り。どの項目かを名前で残す", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", "B", 16)],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseEligible).toBe(false);
    expect(r.raiseReason).toContain("項目2（B）");
  });

  it("判定外があるうちは昇給にしない（実績が無いのにEと断定もしない）", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", null, 0)],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseEligible).toBe(false);
    expect(r.unratedItemNames).toEqual(["項目2"]);
    expect(r.raiseReason).toContain("判定外");
  });

  it("すべてAを求めない設定：満点ちょうどで昇給、1点でも欠ければ見送り", () => {
    const full = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", "A", 20)],
      raiseRequiresAllA: false,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(full.raiseEligible).toBe(true);

    const short = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", "A", 19.9)],
      raiseRequiresAllA: false,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(short.raiseEligible).toBe(false);
  });

  it("すべてAを求めない設定でも、判定外は本人向けの文にも残す", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20), item("項目2", null, 0)],
      raiseRequiresAllA: false,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.raiseReason).toContain("項目2 は実績が未入力");
    expect(r.raiseReasonEmployee).toContain("項目2");
    expect(r.raiseReasonEmployee).not.toMatch(/[0-9]+点/);
  });

  describe("昇格に必要なKPI評価点の境界", () => {
    for (const [total, required, eligible] of [
      [79.9, 80, false],
      [80, 80, true],
      [80.1, 80, true],
      [0, 0, true],
    ] as [number, number, boolean][]) {
      it(`${total}点 / 必要${required}点 → ${eligible ? "可" : "不可"}`, () => {
        const r = judgeOverall({
          items: [item("項目1", "A", total, total)],
          raiseRequiresAllA: true,
          requiredKpiPoints: required,
          requiredBehaviorPoints: null,
          behaviorTotal: null,
          gates: [],
        });
        expect(r.promotionEligible).toBe(eligible);
      });
    }
  });

  describe("昇格に必要な行動指針の点数の境界", () => {
    for (const [behaviorTotal, required, eligible] of [
      [9, 10, false],
      [10, 10, true],
      [11, 10, true],
      [-1, 0, false],
      [0, 0, true],
    ] as [number, number, boolean][]) {
      it(`行動指針${behaviorTotal}点 / 必要${required}点 → ${eligible ? "可" : "不可"}`, () => {
        const r = judgeOverall({
          items: [item("項目1", "A", 20)],
          raiseRequiresAllA: true,
          requiredKpiPoints: null,
          requiredBehaviorPoints: required,
          behaviorTotal,
          gates: [],
        });
        expect(r.promotionEligible).toBe(eligible);
      });
    }

    it("行動指針の合計が無ければ、その条件は見ない", () => {
      const r = judgeOverall({
        items: [item("項目1", "A", 20)],
        raiseRequiresAllA: true,
        requiredKpiPoints: null,
        requiredBehaviorPoints: 99,
        behaviorTotal: null,
        gates: [],
      });
      expect(r.promotionEligible).toBe(true);
    });
  });

  it("必須ゲートが未達なら、点数が満点でも昇格できない", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20)],
      raiseRequiresAllA: true,
      requiredKpiPoints: 0,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [{ text: "受講後報告書の提出", achieved: false }],
    });
    expect(r.promotionEligible).toBe(false);
    expect(r.promotionBlockedReason).toContain("受講後報告書の提出");
    // 何をすれば近づくかは本人にも伝える
    expect(r.promotionBlockedReasonEmployee).toContain("受講後報告書の提出");
  });

  it("昇格できる場合、できない理由は空になる", () => {
    const r = judgeOverall({
      items: [item("項目1", "A", 20)],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [{ text: "受講後報告書の提出", achieved: true }],
    });
    expect(r.promotionEligible).toBe(true);
    expect(r.promotionBlockedReason).toBeNull();
    expect(r.promotionBlockedReasonEmployee).toBeNull();
  });

  it("合計点は小数第1位で丸める（浮動小数の誤差を持ち越さない）", () => {
    const r = judgeOverall({
      items: [item("1", "C", 4.2, 7), item("2", "C", 4.2, 7), item("3", "C", 4.2, 7)],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(r.totalScore).toBe(12.6);
    expect(r.maxScore).toBe(21);
  });

  it("本人向けの昇格理由には、必要点数も獲得点数も出さない", () => {
    const r = judgeOverall({
      items: [item("項目1", "B", 16)],
      raiseRequiresAllA: true,
      requiredKpiPoints: 80,
      requiredBehaviorPoints: 10,
      behaviorTotal: 5,
      gates: [],
    });
    expect(r.promotionBlockedReason).toContain("80");
    expect(r.promotionBlockedReasonEmployee).not.toMatch(/[0-9]/);
  });
});
