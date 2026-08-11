import { describe, expect, it } from "vitest";
import {
  buildEmployeeItemRationale,
  buildRadarValues,
  buildThresholdScale,
  containsCriteriaLeak,
  employeePromotionBlockedReason,
  employeeRaiseReason,
  RANK_LEGEND,
  scopeEvaluationItem,
  scopeEvaluationRow,
} from "@/lib/domain/evaluation-view";

/**
 * 本人向けの出力に、配点・満点・必要点数・合計点が1つも混ざらないことを固定する。
 * 画面の書き忘れではなく、ここを通ったかどうかで担保する。
 */

const evaluatorItem = {
  id: "i1",
  kpiItemId: "k1",
  itemName: "等級要件達成率",
  categoryName: "個人実績",
  unit: "%",
  rank: "B",
  actualValue: 92.5,
  points: 8,
  maxPoints: 10,
  thresholdLabel: "90%以上 100%未満",
  thresholdLower: 90,
  thresholdUpper: 100,
  rationale:
    "実績値 92.5% が「90%以上 100%未満」に該当するため B と判定しました。一律割合方式：配点10点 × ランクBの割合80% ＝ 8点。",
  rationaleEmployee: null as string | null,
  calcNote: "q1_1 ÷ 5 × 100",
  isProvisional: false,
};

const evaluatorRow = {
  id: "e1",
  employeeId: "u1",
  totalScore: 78,
  maxScore: 100,
  behaviorTotal: 12,
  requirementRate: 60,
  raiseEligible: false,
  promotionBlockedReason: "KPI評価点が78点で、昇格に必要な80点に達していません。",
  requiredKpiPointsSnapshot: 80,
  requiredBehaviorPointsSnapshot: 15,
};

describe("containsCriteriaLeak", () => {
  it("配点・点数・閾値・必要点数の表現を見つける", () => {
    const leaks = [
      "配点10点 × ランクBの割合80% ＝ 8点。",
      "KPI評価点が78点で、昇格に必要な80点に達していません。",
      "実績値 92.5% が「90%以上 100%未満」に該当するため B と判定しました。",
      "この項目の満点は10点です。",
      "行動指針の評価が12点でした。",
      "賞与額は120000円です。",
      "個人Ptは78Ptです。",
    ];
    for (const t of leaks) expect(containsCriteriaLeak(t), t).toBe(true);
  });

  it("本人に見せてよい文（ランクと実績値だけ）は通す", () => {
    const safe = [
      "「等級要件達成率」は実績値 92.5% により、ランク B と判定しました。",
      "「ヒヤリ報告件数」は実績値 3件 により、ランク A と判定しました。",
      "Aに届かなかった項目があるため、この期の昇給は見送りです。",
    ];
    for (const t of safe) expect(containsCriteriaLeak(t), t).toBe(false);
  });
});

describe("scopeEvaluationItem", () => {
  it("評価者にはそのまま返す", () => {
    const r = scopeEvaluationItem(evaluatorItem, true);
    expect(r.points).toBe(8);
    expect(r.maxPoints).toBe(10);
    expect(r.thresholdLabel).toBe("90%以上 100%未満");
    expect(r.rationale).toContain("配点10点");
  });

  it("本人には配点・満点・閾値・計算式を返さない", () => {
    const r = scopeEvaluationItem(evaluatorItem, false);
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
    expect(r.thresholdLabel).toBeNull();
    expect(r.thresholdLower).toBeNull();
    expect(r.thresholdUpper).toBeNull();
    expect(r.calcNote).toBeNull();
  });

  it("本人のレスポンスに評価者向けの根拠文が1文字も混ざらない", () => {
    const r = scopeEvaluationItem(evaluatorItem, false);
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("配点");
    expect(serialized).not.toContain("割合");
    expect(serialized).not.toContain("90%以上");
    expect(containsCriteriaLeak(r.rationale)).toBe(false);
    expect(containsCriteriaLeak(r.rationaleEmployee)).toBe(false);
    // 数値まるごとではなく「点」を伴う数値が無いことを見る（実績値は出してよい）
    expect(r.rationale).not.toMatch(/[0-9]\s*点/);
    expect(r.rationale).toContain("92.5%");
    expect(r.rationale).toContain("ランク B");
  });

  it("本人向けの列が空なら、その場で組み立てた説明文に差し替える（評価者向けへは落とさない）", () => {
    const r = scopeEvaluationItem(evaluatorItem, false);
    expect(r.rationale).toContain("記録方式を変える前に確定");
    expect(r.rationale).not.toContain(evaluatorItem.rationale);
  });

  it("本人向けの列に点数が混ざっていたら採用しない", () => {
    const dirty = { ...evaluatorItem, rationaleEmployee: "配点10点のうち8点でした。" };
    const r = scopeEvaluationItem(dirty, false);
    expect(r.rationale).not.toContain("8点");
    expect(containsCriteriaLeak(r.rationale)).toBe(false);
  });

  it("安全な本人向けの列はそのまま使う", () => {
    const clean = { ...evaluatorItem, rationaleEmployee: "目標に一歩届きませんでした。" };
    expect(scopeEvaluationItem(clean, false).rationale).toBe("目標に一歩届きませんでした。");
  });

  it("判定外（ランクなし）は0点ではなく「判定できていない」と説明する", () => {
    const r = scopeEvaluationItem({ ...evaluatorItem, rank: null, actualValue: null }, false);
    expect(r.rationale).toContain("判定外");
    expect(containsCriteriaLeak(r.rationale)).toBe(false);
  });
});

describe("scopeEvaluationRow", () => {
  it("本人には合計点・満点・必要点数・行動指針の合計・評価者向けの理由を返さない", () => {
    const r = scopeEvaluationRow(evaluatorRow, false);
    expect(r.totalScore).toBeNull();
    expect(r.maxScore).toBeNull();
    expect(r.behaviorTotal).toBeNull();
    expect(r.requiredKpiPointsSnapshot).toBeNull();
    expect(r.requiredBehaviorPointsSnapshot).toBeNull();
    expect(r.promotionBlockedReason).toBeNull();
    expect(JSON.stringify(r)).not.toContain("昇格に必要");
    expect(JSON.stringify(r)).not.toMatch(/[0-9]\s*点/);
  });

  it("本人にも見せてよい欄（達成率・昇給可否）は残す", () => {
    const r = scopeEvaluationRow(evaluatorRow, false);
    expect(r.requirementRate).toBe(60);
    expect(r.raiseEligible).toBe(false);
  });

  it("評価者には削らずに返す", () => {
    const r = scopeEvaluationRow(evaluatorRow, true);
    expect(r.totalScore).toBe(78);
    expect(r.promotionBlockedReason).toContain("80点");
  });
});

describe("昇給・昇格の理由（本人向け）", () => {
  it("保存が無ければ数値を含まない言い換えを組み立てる", () => {
    const raise = employeeRaiseReason(null, false);
    expect(containsCriteriaLeak(raise)).toBe(false);
    const blocked = employeePromotionBlockedReason(null, true);
    expect(blocked).not.toBeNull();
    expect(containsCriteriaLeak(blocked)).toBe(false);
  });

  it("評価者向けの理由が無ければ、本人にも理由を出さない", () => {
    expect(employeePromotionBlockedReason(null, false)).toBeNull();
  });

  it("保存済みの本人向けの文に点数が混ざっていたら採用しない", () => {
    const blocked = employeePromotionBlockedReason("あと2点で昇格でした。", true);
    expect(blocked).not.toContain("2点");
  });
});

describe("buildEmployeeItemRationale", () => {
  it("ランクの意味を添えるが、配点には触れない", () => {
    const t = buildEmployeeItemRationale({ itemName: "離職率", rank: "A", actualValue: 0, unit: "%" });
    expect(t).toContain("離職率");
    expect(t).toContain("ランク A");
    expect(containsCriteriaLeak(t)).toBe(false);
  });
});

describe("buildRadarValues", () => {
  const items = [
    { itemName: "A項目", rank: "B", points: 4, maxPoints: 20 },
    { itemName: "B項目", rank: null, points: 0, maxPoints: 10 },
  ];

  it("評価者には実際の 獲得点 ÷ 配点 で描く", () => {
    const r = buildRadarValues(items, true);
    expect(r[0].value).toBe(20);
  });

  it("本人にはランク由来の値で描く（配点は使わない）", () => {
    const r = buildRadarValues(items, false);
    expect(r[0].value).toBe(80);
  });

  it("判定外は0ではなく欠損にする", () => {
    for (const full of [true, false]) {
      const r = buildRadarValues(items, full);
      expect(r[1].value).toBeNull();
      expect(r[1].unrated).toBe(true);
    }
  });

  it("項目数が可変でも壊れない", () => {
    expect(buildRadarValues([], true)).toEqual([]);
    expect(buildRadarValues(items.slice(0, 1), true)).toHaveLength(1);
  });
});

describe("buildThresholdScale", () => {
  const criteria = [
    { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
    { rank: "B", displayLabel: "90%以上 100%未満", lowerBound: 90, upperBound: 100 },
    { rank: "C", displayLabel: "80%以上 90%未満", lowerBound: 80, upperBound: 90 },
    { rank: "D", displayLabel: "70%以上 80%未満", lowerBound: 70, upperBound: 80 },
    { rank: "E", displayLabel: "70%未満", lowerBound: null, upperBound: 70 },
  ];

  it("A〜Eを左から順に並べ、当たったランクに印を付ける", () => {
    const scale = buildThresholdScale(criteria, 92.5, "B");
    expect(scale).not.toBeNull();
    expect(scale!.segments.map((s) => s.rank)).toEqual(["E", "D", "C", "B", "A"]);
    expect(scale!.segments.filter((s) => s.hit).map((s) => s.rank)).toEqual(["B"]);
  });

  it("実績値の位置は0〜100%に収まる", () => {
    for (const v of [0, 70, 92.5, 100, 999]) {
      const scale = buildThresholdScale(criteria, v, "B")!;
      expect(scale.markerLeft).toBeGreaterThanOrEqual(0);
      expect(scale.markerLeft).toBeLessThanOrEqual(100);
    }
  });

  it("実績値が無ければ印を置かない", () => {
    expect(buildThresholdScale(criteria, null)!.markerLeft).toBeNull();
  });

  it("基準が無い・境界が全部空なら描かない", () => {
    expect(buildThresholdScale([], 10)).toBeNull();
    expect(
      buildThresholdScale([{ rank: "A", displayLabel: "常にA", lowerBound: null, upperBound: null }], 10),
    ).toBeNull();
  });
});

describe("RANK_LEGEND", () => {
  it("正本（data/_authoritative-kpi-criteria.tsv）のランクの意味と揃っている", () => {
    expect(RANK_LEGEND.map((r) => r.rank)).toEqual(["A", "B", "C", "D", "E"]);
    expect(RANK_LEGEND[0].meaning).toContain("昇給要件を満たす");
    expect(RANK_LEGEND[1].meaning).toContain("一歩届かない");
    expect(RANK_LEGEND[2].meaning).toContain("必達");
    expect(RANK_LEGEND[3].meaning).toContain("要改善");
    expect(RANK_LEGEND[4].meaning).toContain("未達");
    // 凡例に配点は書かない
    for (const r of RANK_LEGEND) expect(containsCriteriaLeak(r.meaning)).toBe(false);
  });
});
