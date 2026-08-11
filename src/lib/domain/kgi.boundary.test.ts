import { describe, expect, it } from "vitest";
import {
  checkKgiCoverage,
  checkRangeCoverage,
  computeBonus,
  effectiveOfficeId,
  kgiRangeLabel,
  matchKgiCoefficient,
  planBonusRecalc,
  type KgiCoefficientRow,
} from "./kgi";

/**
 * 達成係数（賞与の掛け算）の境目を、両側とちょうどの値で押さえる。
 * 係数が1段ずれると賞与額が数万円変わるため、境界をそのまま試験にしている。
 */

const rows: KgiCoefficientRow[] = [
  { label: "121%以上", lowerBound: 121, upperBound: null, coefficient: 1.5, displayOrder: 1 },
  { label: "111〜120%", lowerBound: 111, upperBound: 121, coefficient: 1.2, displayOrder: 2 },
  { label: "100〜110%", lowerBound: 100, upperBound: 111, coefficient: 1.0, displayOrder: 3 },
  { label: "95〜99%", lowerBound: 95, upperBound: 100, coefficient: 0.6, displayOrder: 4 },
  { label: "90〜94%", lowerBound: 90, upperBound: 95, coefficient: 0.4, displayOrder: 5 },
  { label: "89%以下", lowerBound: null, upperBound: 90, coefficient: 0.2, displayOrder: 6 },
];

describe("達成係数の境界（下限は含む・上限は含まない）", () => {
  const cases: [number, number][] = [
    [89.9, 0.2],
    [90, 0.4],
    [90.1, 0.4],
    [94.9, 0.4],
    [95, 0.6],
    [95.1, 0.6],
    [99.9, 0.6],
    [100, 1.0],
    [100.1, 1.0],
    [110.9, 1.0],
    [111, 1.2],
    [111.1, 1.2],
    [120.9, 1.2],
    [121, 1.5],
    [121.1, 1.5],
    [0, 0.2],
    [-1, 0.2],
    [1000, 1.5],
  ];
  for (const [rate, coefficient] of cases) {
    it(`達成率 ${rate}% は係数 ${coefficient}`, () => {
      expect(matchKgiCoefficient(rate, rows)!.coefficient).toBe(coefficient);
    });
  }

  it("元の表が整数刻みで抜けていた 99.5% も、必ずどこかに入る", () => {
    expect(matchKgiCoefficient(99.5, rows)!.coefficient).toBe(0.6);
    expect(matchKgiCoefficient(110.5, rows)!.coefficient).toBe(1.0);
  });

  it("表の並び順（displayOrder）に沿って上から当てる", () => {
    const shuffled = [...rows].reverse();
    expect(matchKgiCoefficient(105, shuffled)!.coefficient).toBe(1.0);
  });

  it("どこにも当てはまらなければ、低い係数に丸めず「無い」と返す", () => {
    const holed = rows.filter((r) => r.label !== "95〜99%");
    expect(matchKgiCoefficient(97, holed)).toBeNull();
    expect(matchKgiCoefficient(50, [])).toBeNull();
  });

  it("説明文は、判定に使った境界から作る（旧表記をそのまま出さない）", () => {
    expect(matchKgiCoefficient(99.5, rows)!.rationale).toContain("95%以上 100%未満");
  });
});

describe("係数の範囲の書き方", () => {
  it("両端・片端・両端なしの4通り", () => {
    expect(kgiRangeLabel({ lowerBound: 95, upperBound: 100 })).toBe("95%以上 100%未満");
    expect(kgiRangeLabel({ lowerBound: 121, upperBound: null })).toBe("121%以上");
    expect(kgiRangeLabel({ lowerBound: null, upperBound: 90 })).toBe("90%未満");
    expect(kgiRangeLabel({ lowerBound: null, upperBound: null })).toBe("すべての達成率が該当");
  });

  it("小数の境界も書き分ける", () => {
    expect(kgiRangeLabel({ lowerBound: 99.5, upperBound: 100.25 })).toBe("99.5%以上 100.3%未満");
  });
});

describe("賞与の計算", () => {
  it("個人Pt ＝ 評価点 × 係数（整数に四捨五入）／ 賞与額 ＝ 個人Pt × 単価", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: 121,
      coefficients: rows,
      yenPerPoint: 3200,
    });
    expect(r.coefficient).toBe(1.5);
    expect(r.personalPoints).toBe(93);
    expect(r.bonusYen).toBe(297600);
  });

  it("元の表の検算例と一致する（62点 × 各係数）", () => {
    const expected: [number, number][] = [
      [121, 93],
      [111, 74], // 74.4 → 74
      [100, 62],
      [95, 37], // 37.2 → 37
      [90, 25], // 24.8 → 25
      [80, 12], // 12.4 → 12
    ];
    for (const [rate, points] of expected) {
      const r = computeBonus({
        kpiTotalScore: 62,
        officeAchievementRate: rate,
        coefficients: rows,
        yenPerPoint: 0,
      });
      expect(r.personalPoints, `達成率 ${rate}%`).toBe(points);
    }
  });

  it("四捨五入の境目（.5 は上に寄せる）", () => {
    const r = computeBonus({
      kpiTotalScore: 62.5,
      officeAchievementRate: 100,
      coefficients: rows,
      yenPerPoint: 0,
    });
    expect(r.personalPoints).toBe(63);
  });

  it("単価が0円なら賞与額は出さない（0円と書かない）", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: 100,
      coefficients: rows,
      yenPerPoint: 0,
    });
    expect(r.bonusYen).toBeNull();
    expect(r.rationale).not.toContain("賞与額");
  });

  it("達成率が未入力なら、0円ではなく空のまま返す", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: null,
      coefficients: rows,
      yenPerPoint: 3200,
    });
    expect(r).toMatchObject({ coefficient: null, personalPoints: null, bonusYen: null });
    expect(r.rationale).toContain("未入力");
  });

  it("係数を引き当てられなければ、表の抜けを理由として返す", () => {
    const r = computeBonus({
      kpiTotalScore: 62,
      officeAchievementRate: 97,
      coefficients: rows.filter((x) => x.label !== "95〜99%"),
      yenPerPoint: 3200,
    });
    expect(r.coefficient).toBeNull();
    expect(r.rationale).toContain("抜けがある");
  });

  it("評価点が0点なら個人Ptも0Pt（賞与額も0円）", () => {
    const r = computeBonus({
      kpiTotalScore: 0,
      officeAchievementRate: 100,
      coefficients: rows,
      yenPerPoint: 3200,
    });
    expect(r.personalPoints).toBe(0);
    expect(r.bonusYen).toBe(0);
  });
});

describe("達成率を入れ直したときの、既存評価への当て方", () => {
  const input = { achievementRate: 100, coefficients: rows, yenPerPoint: 3200 };

  it("確認中の評価だけ書き換え、確定済みは据え置く", () => {
    const plan = planBonusRecalc(
      [
        { evaluationId: "ev_draft", status: "draft", totalScore: 80 },
        { evaluationId: "ev_fixed", status: "finalized", totalScore: 80 },
      ],
      input,
    );
    expect(plan.updates.map((u) => u.evaluationId)).toEqual(["ev_draft"]);
    expect(plan.skippedFinalized).toEqual(["ev_fixed"]);
    expect(plan.updates[0].personalPoints).toBe(80);
  });

  it("係数を引き当てられない評価は、書き換えつつ印を付ける", () => {
    const plan = planBonusRecalc([{ evaluationId: "ev_1", status: "draft", totalScore: 80 }], {
      ...input,
      achievementRate: 97,
      coefficients: rows.filter((x) => x.label !== "95〜99%"),
    });
    expect(plan.unmatched).toEqual(["ev_1"]);
    expect(plan.updates[0].bonusYen).toBeNull();
  });

  it("対象が無ければ何もしない", () => {
    expect(planBonusRecalc([], input)).toEqual({ updates: [], skippedFinalized: [], unmatched: [] });
  });
});

describe("どの事業所の達成率を当てるか", () => {
  it("評価に写した所属 → 回答時点の所属 → いまの所属 の順に使う", () => {
    expect(
      effectiveOfficeId({ evalOfficeId: "a", responseOfficeId: "b", userOfficeId: "c" }),
    ).toBe("a");
    expect(
      effectiveOfficeId({ evalOfficeId: null, responseOfficeId: "b", userOfficeId: "c" }),
    ).toBe("b");
    expect(
      effectiveOfficeId({ evalOfficeId: null, responseOfficeId: null, userOfficeId: "c" }),
    ).toBe("c");
    expect(
      effectiveOfficeId({ evalOfficeId: null, responseOfficeId: null, userOfficeId: null }),
    ).toBeNull();
  });
});

describe("範囲表の抜け・重なりの検査", () => {
  it("行が1件も無ければ、指摘しない", () => {
    expect(checkRangeCoverage([], "達成率")).toEqual([]);
    expect(checkKgiCoverage([])).toEqual([]);
  });

  it("端から端まで隙間なく並んでいれば、指摘しない", () => {
    expect(checkKgiCoverage(rows)).toEqual([]);
  });

  it("いちばん下の区間に下限が入っていると、それより小さい値の行き先が無い", () => {
    const problems = checkKgiCoverage(
      rows.map((r) => (r.label === "89%以下" ? { ...r, lowerBound: 0 } : r)),
    );
    expect(problems.some((p) => p.kind === "gap" && p.message.includes("下限を空に"))).toBe(true);
  });

  it("いちばん上の区間に上限が入っていると、それ以上の値の行き先が無い", () => {
    const problems = checkKgiCoverage(
      rows.map((r) => (r.label === "121%以上" ? { ...r, upperBound: 200 } : r)),
    );
    expect(problems.some((p) => p.kind === "gap" && p.message.includes("上限を空に"))).toBe(true);
  });

  it("隣り合う区間の間が空いていると、抜けとして指摘する", () => {
    const problems = checkKgiCoverage(
      rows.map((r) => (r.label === "95〜99%" ? { ...r, upperBound: 99 } : r)),
    );
    expect(problems.some((p) => p.kind === "gap" && p.message.includes("間が空いています"))).toBe(true);
  });

  it("隣り合う区間が重なっていると、重なりとして指摘する", () => {
    const problems = checkKgiCoverage(
      rows.map((r) => (r.label === "95〜99%" ? { ...r, upperBound: 105 } : r)),
    );
    expect(problems.some((p) => p.kind === "overlap")).toBe(true);
  });

  it("下限が上限以上の行は、その1行だけで矛盾として指摘する", () => {
    const problems = checkRangeCoverage(
      [{ label: "変な行", lowerBound: 100, upperBound: 100 }],
      "達成率",
    );
    expect(problems.some((p) => p.kind === "overlap" && p.message.includes("以上になっています"))).toBe(
      true,
    );
  });

  it("上下が開いた1行だけなら、数直線をすべて覆うので指摘しない", () => {
    expect(
      checkRangeCoverage([{ label: "すべて", lowerBound: null, upperBound: null }], "達成率"),
    ).toEqual([]);
  });
});
