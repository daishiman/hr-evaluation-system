import { describe, expect, it } from "vitest";
import {
  buildEvaluationReport,
  compareByPeriod,
  peerStat,
  REPORT_PEER_MIN,
  round1,
  scoreRatio,
  type ReportInput,
  type ReportEvaluationInput,
  type ReportPeerInput,
  type ReviewerReport,
  type SelfReport,
} from "@/lib/domain/report";
import { DECISION_UNRECORDED_TEXT } from "@/lib/domain/final-decision";

type Row = ReportEvaluationInput & { cycleId: string };

const GENERATED_AT = new Date("2026-10-20T03:00:00Z");

function row(over: Partial<Row> & { id: string }): Row {
  return {
    cycleId: `c-${over.id}`,
    cycleName: `期-${over.id}`,
    periodStart: "2025-04-01",
    periodEnd: "2025-09-30",
    gradeId: "g2",
    gradeName: "等級2",
    gradeOrder: 2,
    totalScore: 60,
    maxScore: 80,
    requirementRate: 75,
    requirementAchieved: 3,
    requirementTotal: 4,
    behaviorTotal: 12.25,
    evaluatorComment: "次の期も期待しています。",
    raiseEligible: true,
    promotionEligible: false,
    raiseDecision: "follow",
    raiseDecisionReason: null,
    promotionDecision: "follow",
    promotionDecisionReason: null,
    decisionRecordedBy: "u-boss",
    decisionRecordedAt: new Date("2025-10-10T01:00:00Z"),
    status: "finalized",
    ...over,
  };
}

const ITEMS = [
  { itemName: "売上", rank: "A", points: 30, maxPoints: 30 },
  { itemName: "提案数", rank: "C", points: 12, maxPoints: 20 },
  { itemName: "後輩の育成", rank: null, points: null, maxPoints: 30 },
];

const PREVIOUS_ITEMS = [
  { itemName: "売上", rank: "B", points: 24, maxPoints: 30 },
  { itemName: "後輩の育成", rank: null, points: null, maxPoints: 30 },
];

const EVALUATIONS: Row[] = [
  row({ id: "e3", cycleId: "c3", cycleName: "2026年度上期", periodStart: "2026-04-01", periodEnd: "2026-09-30", totalScore: 72, maxScore: 90 }),
  row({ id: "e1", cycleId: "c1", cycleName: "2025年度上期", periodStart: "2025-04-01", periodEnd: "2025-09-30", gradeId: "g1", gradeName: "等級1", gradeOrder: 1, totalScore: 40, maxScore: 80, requirementRate: 50 }),
  row({ id: "e2", cycleId: "c2", cycleName: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", totalScore: 60, maxScore: 80 }),
  row({ id: "e4", cycleId: "c4", cycleName: "2026年度下期", periodStart: "2026-10-01", periodEnd: "2027-03-31", status: "evaluator_review" }),
];

const LATEST = {
  items: ITEMS,
  behaviors: [
    { aspectName: "誠実", score: 4, levelLabel: "よくできた" },
    { aspectName: "挑戦", score: 3, levelLabel: "できた" },
  ],
  raiseReason: "昇給の要件を満たしています。\n- KPI評価点の合計が基準以上",
  promotionBlockedReason: "等級要件が未達です。\n- 後輩の育成",
};

function peers(gradeId: string, cycleId: string, ratios: number[]): ReportPeerInput[] {
  return ratios.map((r, i) => ({ employeeId: `p-${gradeId}-${i}`, cycleId, gradeId, totalScore: r, maxScore: 100 }));
}

function reviewerInput(over: Partial<Extract<ReportInput, { view: "reviewer" }>> = {}): ReportInput {
  return {
    view: "reviewer",
    employeeName: "社員A",
    currentGradeName: "等級2",
    officeName: "本社",
    generatedAt: GENERATED_AT,
    evaluations: EVALUATIONS,
    latest: LATEST,
    previousItems: PREVIOUS_ITEMS,
    recorderNames: { "u-boss": "上長B" },
    peers: [...peers("g2", "c3", [70, 80, 90]), ...peers("g2", "c2", [50, 60]), ...peers("g1", "c1", [40, 45, 50])],
    ...over,
  };
}

function selfInput(over: Partial<Extract<ReportInput, { view: "self" }>> = {}): ReportInput {
  const { view: _v, peers: _p, ...base } = reviewerInput() as Extract<ReportInput, { view: "reviewer" }>;
  return {
    ...base,
    view: "self",
    // 本人向けの行は、listEvaluations が点数を削って返す
    evaluations: EVALUATIONS.map((e) => ({ ...e, totalScore: null, maxScore: null, behaviorTotal: null })),
    latest: { ...LATEST, behaviors: LATEST.behaviors.map((b) => ({ ...b, score: null })) },
    ...over,
  };
}

const asReviewer = (input: ReportInput) => {
  const r = buildEvaluationReport(input);
  if (r.kind !== "reviewer") throw new Error(`reviewer ではない: ${r.kind}`);
  return r;
};

const asSelf = (input: ReportInput) => {
  const r = buildEvaluationReport(input);
  if (r.kind !== "self") throw new Error(`self ではない: ${r.kind}`);
  return r;
};

/** オブジェクトの中に出てくる鍵をすべて集める（本人向けに点数の鍵が無いことを調べる） */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

describe("小さな規則", () => {
  it("round1 は小数第1位に丸める", () => {
    expect(round1(66.66)).toBe(66.7);
    expect(round1(12.25)).toBe(12.3);
    expect(round1(80)).toBe(80);
  });

  it("scoreRatio は満点に対する割合。満点が無い・0 のときは null", () => {
    expect(scoreRatio(72, 90)).toBe(80);
    expect(scoreRatio(2, 3)).toBe(66.7);
    expect(scoreRatio(null, 90)).toBeNull();
    expect(scoreRatio(10, null)).toBeNull();
    expect(scoreRatio(10, 0)).toBeNull();
  });

  it("compareByPeriod は開始日→終了日→id の順。日付が無い期は先頭", () => {
    const rows = [
      { id: "b", periodStart: "2025-04-01", periodEnd: "2025-09-30" },
      { id: "a", periodStart: "2025-04-01", periodEnd: "2025-09-30" },
      { id: "c", periodStart: "2025-04-01", periodEnd: "2025-06-30" },
      { id: "d", periodStart: null, periodEnd: null },
      { id: "e", periodStart: "2025-04-01", periodEnd: null },
    ];
    expect([...rows].sort(compareByPeriod).map((r) => r.id)).toEqual(["d", "e", "c", "a", "b"]);
  });

  it("peerStat は3人以上のときだけ平均と幅を返す。同じ人の2期は1人と数える", () => {
    expect(REPORT_PEER_MIN).toBe(3);
    expect(
      peerStat([
        { employeeId: "x", ratio: 50 },
        { employeeId: "x", ratio: 70 },
        { employeeId: "y", ratio: 60 },
      ]),
    ).toBeNull();
    expect(
      peerStat([
        { employeeId: "x", ratio: 50 },
        { employeeId: "y", ratio: 70.04 },
        { employeeId: "z", ratio: 61 },
      ]),
    ).toEqual({ average: 60.3, min: 50, max: 70, people: 3 });
  });
});

describe("確定した評価が無いとき", () => {
  it("確定が1件も無ければ空のレポート", () => {
    const r = buildEvaluationReport(reviewerInput({ evaluations: [EVALUATIONS[3]] }));
    expect(r).toEqual({
      kind: "empty",
      view: "reviewer",
      employeeName: "社員A",
      currentGradeName: "等級2",
      generatedAt: GENERATED_AT,
    });
  });

  it("基にする中身が読めないときも空のレポート（本人向け）", () => {
    expect(buildEvaluationReport(selfInput({ latest: null }))).toMatchObject({ kind: "empty", view: "self" });
  });
});

describe("評価者向けのレポート", () => {
  it("同じ入力から2回作っても同じ結果になる（入力の並びにもよらない）", () => {
    const a = buildEvaluationReport(reviewerInput());
    const b = buildEvaluationReport(reviewerInput({ evaluations: [...EVALUATIONS].reverse() }));
    expect(b).toEqual(a);
  });

  it("① 見出しは最新の確定の期と作った時刻を示す", () => {
    expect(asReviewer(reviewerInput()).header).toEqual({
      employeeName: "社員A",
      currentGradeName: "等級2",
      officeName: "本社",
      baseCycleName: "2026年度上期",
      basePeriodStart: "2026-04-01",
      basePeriodEnd: "2026-09-30",
      generatedAt: GENERATED_AT,
    });
  });

  it("② 判定どおりなら、結論・点数の判定・短い理由・記録した人を出し、判断の理由は出さない", () => {
    const [raise, promotion] = asReviewer(reviewerInput()).decisions;
    expect(raise).toEqual({
      subject: "raise",
      label: "昇給",
      conclusion: "昇給：あり",
      approved: true,
      overridden: false,
      unrecorded: false,
      scoreJudgement: true,
      decision: "follow",
      scoreJudgementText: "点数の判定では可",
      scoreReason: "昇給の要件を満たしています。",
      decisionKind: "点数の判定どおり",
      decisionReason: null,
      recordedBy: "上長B",
      recordedAt: new Date("2025-10-10T01:00:00Z"),
    });
    expect(promotion).toMatchObject({
      subject: "promotion",
      conclusion: "昇格：見送り",
      scoreJudgementText: "点数の判定では否",
      scoreReason: "等級要件が未達です。",
    });
  });

  it("② 変えたときは「上司の判断」の印と判断の理由を出す（可→見送り・否→あり）", () => {
    const latest = row({
      id: "e9",
      periodStart: "2027-04-01",
      raiseDecision: "override",
      raiseDecisionReason: "部署の予算の都合で今期は見送ります。",
      promotionDecision: "override",
      promotionDecisionReason: "後輩の育成は次の期で補えると判断しました。",
    });
    const [raise, promotion] = asReviewer(reviewerInput({ evaluations: [latest] })).decisions;
    expect(raise).toMatchObject({
      conclusion: "昇給：見送り（上司の判断）",
      approved: false,
      overridden: true,
      decisionKind: "変える",
      decisionReason: "部署の予算の都合で今期は見送ります。",
    });
    expect(promotion).toMatchObject({
      conclusion: "昇格：あり（上司の判断）",
      approved: true,
      decisionReason: "後輩の育成は次の期で補えると判断しました。",
    });
  });

  it("② 判断の記録が無い古い確定は、点数の判定を結論にして記録なしと示す", () => {
    const old = row({
      id: "e0",
      raiseDecision: null,
      promotionDecision: null,
      decisionRecordedBy: null,
      decisionRecordedAt: null,
    });
    const [raise] = asReviewer(reviewerInput({ evaluations: [old], latest: { ...LATEST, raiseReason: null } })).decisions;
    expect(raise).toMatchObject({
      conclusion: "昇給：あり",
      unrecorded: true,
      decisionKind: DECISION_UNRECORDED_TEXT,
      scoreReason: "昇給の要件を満たしています。",
      recordedBy: null,
      recordedAt: null,
    });
  });

  it("② 記録した人の名前が分からない・記録日時が無いときは空ける", () => {
    const e = row({ id: "e5", decisionRecordedBy: "u-gone", decisionRecordedAt: undefined });
    const [raise] = asReviewer(reviewerInput({ evaluations: [e] })).decisions;
    expect(raise.recordedBy).toBeNull();
    expect(raise.recordedAt).toBeNull();
    const noRecorder = row({ id: "e6", decisionRecordedBy: null });
    expect(asReviewer(reviewerInput({ evaluations: [noRecorder] })).decisions[0].recordedBy).toBeNull();
  });

  it("③ 点数は小数第1位で、満点に対する割合を添える", () => {
    expect(asReviewer(reviewerInput()).scores).toEqual({
      kpiTotal: 72,
      kpiMax: 90,
      kpiRatio: 80,
      requirementRate: 75,
      requirementAchieved: 3,
      requirementTotal: 4,
      behaviorTotal: 12.3,
      behaviors: [
        { aspectName: "誠実", score: 4, levelLabel: "よくできた" },
        { aspectName: "挑戦", score: 3, levelLabel: "できた" },
      ],
    });
  });

  it("③ 点数が無い行は空けたまま（0点と混ぜない）", () => {
    const e = row({ id: "e7", totalScore: null, maxScore: null, behaviorTotal: null });
    const r = asReviewer(reviewerInput({ evaluations: [e] }));
    expect(r.scores).toMatchObject({ kpiTotal: null, kpiMax: null, kpiRatio: null, behaviorTotal: null });
    expect(r.history[0]).toMatchObject({ kpiTotal: null, kpiMax: null, kpiRatio: null });
  });

  it("④ レーダー図は獲得点÷配点で、前の期の同じ項目を重ねる", () => {
    expect(asReviewer(reviewerInput()).radar).toEqual({
      axes: [
        { item: "売上", points: 30, maxPoints: 30, value: 100, rank: "A", unrated: false, previousValue: 80, previousRank: "B" },
        { item: "提案数", points: 12, maxPoints: 20, value: 60, rank: "C", unrated: false, previousValue: null, previousRank: null },
        { item: "後輩の育成", points: null, maxPoints: 30, value: null, rank: null, unrated: true, previousValue: null, previousRank: null },
      ],
      asBars: false,
      previousCycleName: "2025年度下期",
      basis: "ratio",
    });
  });

  it("④ 軸が3未満なら棒グラフ。前の期が無ければ重ねない", () => {
    const radar = asReviewer(
      reviewerInput({
        evaluations: [row({ id: "e8", cycleName: null })],
        latest: { ...LATEST, items: ITEMS.slice(0, 2) },
        previousItems: null,
      }),
    ).radar;
    expect(radar.asBars).toBe(true);
    expect(radar.previousCycleName).toBeNull();
    expect(radar.axes.every((a) => a.previousValue === null)).toBe(true);
  });

  it("④ 5軸・6軸ならレーダー図のまま", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ itemName: `項目${i}`, rank: "B", points: 8, maxPoints: 10 }));
    for (const n of [5, 6]) {
      const radar = asReviewer(reviewerInput({ latest: { ...LATEST, items: six.slice(0, n) } })).radar;
      expect(radar.axes).toHaveLength(n);
      expect(radar.asBars).toBe(false);
    }
  });

  it("⑤ 等級をまたぐ全確定期を古い順に並べ、各期の等級・期の平均を3人以上のときだけ添える", () => {
    const r = asReviewer(reviewerInput());
    expect(r.trend).toEqual([
      { cycleName: "2025年度上期", periodStart: "2025-04-01", periodEnd: "2025-09-30", gradeName: "等級1", value: 50, peer: { average: 45, min: 40, max: 50, people: 3 } },
      { cycleName: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", gradeName: "等級2", value: 75, peer: null },
      {
        cycleName: "2026年度上期",
        periodStart: "2026-04-01",
        periodEnd: "2026-09-30",
        gradeName: "等級2",
        value: 80,
        peer: { average: 80, min: 70, max: 90, people: 3 },
      },
    ]);
  });

  it("⑥ 経た等級ごとに本人の平均と、その等級の全期の平均を出す", () => {
    expect(asReviewer(reviewerInput()).grades).toEqual([
      { gradeName: "等級1", periods: 1, average: 50, peer: { average: 45, min: 40, max: 50, people: 3 } },
      { gradeName: "等級2", periods: 2, average: 77.5, peer: { average: 70, min: 50, max: 90, people: 3 } },
    ]);
  });

  it("⑥ 等級が分からない評価は名前でまとめ、平均を比べない。満点0の人は平均から外す", () => {
    const r = asReviewer(
      reviewerInput({
        evaluations: [
          row({ id: "x1", periodStart: "2024-04-01", gradeId: null, gradeName: null, gradeOrder: null, maxScore: 0 }),
          row({ id: "x2", periodStart: "2024-10-01", gradeId: null, gradeName: "旧等級", gradeOrder: null }),
          row({ id: "x3", periodStart: "2025-04-01" }),
        ],
        peers: [
          ...peers("g2", "c-x3", [70, 80]),
          { employeeId: "zero", cycleId: "c-x3", gradeId: "g2", totalScore: 0, maxScore: 0 },
          { employeeId: "nog", cycleId: "c-x1", gradeId: null, totalScore: 50, maxScore: 100 },
        ],
      }),
    );
    expect(r.grades).toEqual([
      { gradeName: "等級2", periods: 1, average: 75, peer: null },
      { gradeName: "—", periods: 1, average: null, peer: null },
      { gradeName: "旧等級", periods: 1, average: 75, peer: null },
    ]);
    expect(r.trend.map((t) => t.peer)).toEqual([null, null, null]);
  });

  it("⑦ 履歴は古い順に、結論を上司の判断込みで並べる", () => {
    const r = asReviewer(reviewerInput());
    expect(r.history.map((h) => [h.cycleName, h.gradeName, h.kpiRatio, h.raise, h.promotion])).toEqual([
      ["2025年度上期", "等級1", 50, "あり", "見送り"],
      ["2025年度下期", "等級2", 75, "あり", "見送り"],
      ["2026年度上期", "等級2", 80, "あり", "見送り"],
    ]);
  });

  it("上長からのコメントは最新の確定のもの。空白だけなら出さない", () => {
    expect(asReviewer(reviewerInput()).comment).toBe("次の期も期待しています。");
    expect(asReviewer(reviewerInput({ evaluations: [row({ id: "s", evaluatorComment: "  " })] })).comment).toBeNull();
    expect(asReviewer(reviewerInput({ evaluations: [row({ id: "t", evaluatorComment: null })] })).comment).toBeNull();
  });
});

describe("本人向けのレポート", () => {
  const SCORE_KEYS = ["kpiTotal", "kpiMax", "kpiRatio", "behaviorTotal", "score", "peer", "scores", "average", "points", "maxPoints"];

  it("点数と比べる値の鍵を持たない（値を空けるのではなく、型ごと無い）", () => {
    const r = asSelf(selfInput());
    const keys = allKeys(r);
    for (const k of SCORE_KEYS) expect(keys.has(k), k).toBe(false);
  });

  it("④ レーダー図は判定を等間隔に置いた形で描く（点数から作らない）", () => {
    const radar = asSelf(selfInput()).radar;
    expect(radar.basis).toBe("rank");
    expect(radar.axes.map((a) => [a.item, a.value, a.previousValue])).toEqual([
      ["売上", 100, 80],
      ["提案数", 60, null],
      ["後輩の育成", null, null],
    ]);
  });

  it("③ 判定の内訳は A〜E を0件も含めて並べ、判定外があれば足す", () => {
    const j = asSelf(selfInput()).judgements;
    expect(j.kpiRanks).toEqual([
      { item: "売上", rank: "A" },
      { item: "提案数", rank: "C" },
      { item: "後輩の育成", rank: null },
    ]);
    expect(j.rankCounts).toEqual([
      { rank: "A", count: 1 },
      { rank: "B", count: 0 },
      { rank: "C", count: 1 },
      { rank: "D", count: 0 },
      { rank: "E", count: 0 },
      { rank: "判定外", count: 1 },
    ]);
    expect(j.behaviors).toEqual([
      { aspectName: "誠実", levelLabel: "よくできた" },
      { aspectName: "挑戦", levelLabel: "できた" },
    ]);
    expect(j).toMatchObject({ requirementRate: 75, requirementAchieved: 3, requirementTotal: 4 });
  });

  it("③ 判定外が無ければ判定外の行を出さない", () => {
    const j = asSelf(selfInput({ latest: { ...LATEST, items: ITEMS.slice(0, 2) } })).judgements;
    expect(j.rankCounts.map((c) => c.rank)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("⑤⑥⑦ 推移・等級ごと・履歴は等級要件の達成率で描く", () => {
    const r: SelfReport = asSelf(selfInput());
    expect(r.trend.map((t) => [t.cycleName, t.gradeName, t.value])).toEqual([
      ["2025年度上期", "等級1", 50],
      ["2025年度下期", "等級2", 75],
      ["2026年度上期", "等級2", 75],
    ]);
    expect(r.grades).toEqual([
      { gradeName: "等級1", periods: 1, averageRequirementRate: 50 },
      { gradeName: "等級2", periods: 2, averageRequirementRate: 75 },
    ]);
    expect(r.history[0]).toEqual({
      cycleName: "2025年度上期",
      periodStart: "2025-04-01",
      periodEnd: "2025-09-30",
      gradeName: "等級1",
      requirementRate: 50,
      raise: "あり",
      promotion: "見送り",
    });
  });

  it("⑥ 達成率が無い期は平均から外し、全部無ければ空ける", () => {
    const r = asSelf(
      selfInput({ evaluations: [row({ id: "n1", requirementRate: null, totalScore: null, maxScore: null })] }),
    );
    expect(r.grades[0].averageRequirementRate).toBeNull();
  });

  it("② 上司の判断は本人にも同じ文で見せる", () => {
    const e = row({ id: "o1", raiseDecision: "override", raiseDecisionReason: "予算の都合で今期は見送ります。" });
    const [raise] = asSelf(selfInput({ evaluations: [e] })).decisions;
    expect(raise).toMatchObject({ conclusion: "昇給：見送り（上司の判断）", decisionReason: "予算の都合で今期は見送ります。" });
  });
});

describe("評価者向けと本人向けの型", () => {
  it("評価者向けは点数を持ち、本人向けは判定を持つ", () => {
    const reviewer: ReviewerReport = asReviewer(reviewerInput());
    const self: SelfReport = asSelf(selfInput());
    expect("scores" in reviewer && !("judgements" in reviewer)).toBe(true);
    expect("judgements" in self && !("scores" in self)).toBe(true);
  });
});
