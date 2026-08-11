import { describe, it, expect } from "vitest";
import { judgeRank, matchesCriterion, scoreFromRank, judgeOverall, gradeRequirementRate, type RankCriterion } from "./scoring";

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

/* 現行GAS（移行元）の実際の出力と突き合わせて固定したふるまい。
   一次資料は data/_gas-internal-json.md（回答一覧「評価結果」シートの内部JSON）。 */
describe("gradeRequirementRate — 等級要件達成率（2026-08-10 決定の第3案）", () => {
  it("分母は実際に出題した等級要件の項目数（半期の目標設定上限数ではない）", () => {
    // 27項目中18項目達成 → 66.7%（評価詳細画面に出す表記そのもの）
    expect(gradeRequirementRate(18, 27)).toBe(66.7);
    // 現行GASの実績: 等級３Chief 17件達成。旧仕様は上限5件が分母で100%だったが、
    // 出題20項目が分母になり85%になる。
    expect(gradeRequirementRate(17, 20)).toBe(85);
  });

  it("全項目達成のときだけ100%になる（上限方式のように全員100%にならない）", () => {
    expect(gradeRequirementRate(20, 20)).toBe(100);
    expect(gradeRequirementRate(19, 20)).toBe(95);
  });

  it("未回答は分母に残り未達として数える（回答を空にして達成率を上げられない）", () => {
    // 15項目出題・8項目○・7項目未回答 → 53.3%
    expect(gradeRequirementRate(8, 15)).toBe(53.3);
  });

  it("達成0件なら0%", () => {
    expect(gradeRequirementRate(0, 15)).toBe(0);
  });

  it("等級要件が1件も出題されていなければ判定外（0%にしない）", () => {
    expect(gradeRequirementRate(0, 0)).toBeNull();
    expect(gradeRequirementRate(2, 0)).toBeNull();
  });

  /* これは **デモ用シードデータ（scripts/seed-data.mjs）に対する回帰テスト** であって、
     ランク基準（100%以上=A 〜 40%未満=E）が制度として妥当であることの証明ではない。
     実運用のデータはまだ1件も無く、閾値の妥当性は検証できていない（docs/migration-mapping.md §9-6）。
     ここが崩れたら「シードか計算式を変えた」合図として気づくためのもの。 */
  it("シードデータの達成率がA〜Eすべてに散り、Aも到達できる（シードに対する回帰テスト）", () => {
    // デモ用シードが作った48件から拾った「達成数／出題数」の代表例。
    // 実運用の実績ではない（実データは1件も無い）。
    const samples: [number, number][] = [
      [15, 15], [20, 20], [5, 5],   // 100% → A
      [17, 20], [12, 15], [4, 5],   // 85% / 80% / 80% → B
      [14, 20], [11, 15], [3, 5],   // 70% / 73.3% / 60% → C
      [7, 15], [5, 10], [4, 10],    // 46.7% / 50% / 40% → D
      [3, 10],                      // 30% → E
    ];
    const ranks = samples.map(([a, n]) => judgeRank(gradeRequirementRate(a, n)!, requirementRate, "higher").rank);
    expect(new Set(ranks)).toEqual(new Set(["A", "B", "C", "D", "E"]));
    expect(ranks.filter((r) => r === "A").length).toBe(3);
  });
});

describe("judgeOverall — 実績が入力されていない項目（判定外）", () => {
  it("判定外の項目はA未満と断定せず、判定できていないと表示する", () => {
    const res = judgeOverall({
      items: [
        { kpiItemId: "k1", itemName: "等級要件達成率", rank: "A", points: 40, maxPoints: 40 },
        { kpiItemId: "k2", itemName: "ヒヤリ報告件数", rank: null, points: 0, maxPoints: 10 },
      ],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseEligible).toBe(false);
    expect(res.unratedItemNames).toEqual(["ヒヤリ報告件数"]);
    expect(res.raiseReason).toContain("判定できていません");
    expect(res.raiseReason).not.toContain("ヒヤリ報告件数（E）");
    // 未回答でも配点は分母に残る（現行GASと同じ: 40 / 70点 の考え方）
    expect(res.maxScore).toBe(50);
    expect(res.totalScore).toBe(40);
  });
});

/* ─────────── ランク→点数の換算方式（一律割合方式 / 項目別絶対点方式） ─────────── */

import { scoreItem, type AbsolutePointTable, type Rank } from "./scoring";

const ratios = [
  { rank: "A" as const, ratio: 1.0 },
  { rank: "B" as const, ratio: 0.8 },
  { rank: "C" as const, ratio: 0.6 },
  { rank: "D" as const, ratio: 0.4 },
  { rank: "E" as const, ratio: 0.0 },
];

/** 元の配点表（保留シート）の項目1: 100/85/70/55/0 */
const item1Absolute: AbsolutePointTable = {
  byRank: [
    { rank: "A", points: 100 },
    { rank: "B", points: 85 },
    { rank: "C", points: 70 },
    { rank: "D", points: 55 },
    { rank: "E", points: 0 },
  ],
};

/** 元の配点表の項目2: 10/8/7/5/0 */
const item2Absolute: AbsolutePointTable = {
  byRank: [
    { rank: "A", points: 10 },
    { rank: "B", points: 8 },
    { rank: "C", points: 7 },
    { rank: "D", points: 5 },
    { rank: "E", points: 0 },
  ],
};

describe("scoreItem — 一律割合方式（既定・仮）", () => {
  it("配点 × ランクの割合で点数が決まる", () => {
    const call = (rank: Rank) => scoreItem({ rank, weight: 20, mode: "ratio", ratios }).points;
    expect(call("A")).toBe(20);
    expect(call("B")).toBe(16);
    expect(call("C")).toBe(12);
    expect(call("D")).toBe(8);
    expect(call("E")).toBe(0);
  });

  it("満点は配点そのもので、どの項目も同じ割合で減る", () => {
    const r = scoreItem({ rank: "B", weight: 20, mode: "ratio", ratios });
    expect(r.maxPoints).toBe(20);
    expect(r.note).toContain("一律割合方式");
    expect(r.fellBackToRatio).toBe(false);
  });
});

describe("scoreItem — 項目別絶対点方式（元の配点表）", () => {
  it("項目1は 100/85/70/55/0 になる（一律割合の 100/80/60/40/0 とは違う）", () => {
    const call = (rank: Rank) =>
      scoreItem({ rank, weight: 100, mode: "absolute", ratios, absolute: item1Absolute }).points;
    expect(call("A")).toBe(100);
    expect(call("B")).toBe(85); // 一律割合方式なら80
    expect(call("C")).toBe(70); // 一律割合方式なら60
    expect(call("D")).toBe(55); // 一律割合方式なら40
    expect(call("E")).toBe(0);
  });

  it("項目2は 10/8/7/5/0 になる（項目ごとに刻みが違う）", () => {
    const call = (rank: Rank) =>
      scoreItem({ rank, weight: 10, mode: "absolute", ratios, absolute: item2Absolute }).points;
    expect(call("A")).toBe(10);
    expect(call("B")).toBe(8);
    expect(call("C")).toBe(7); // 一律割合方式なら6
    expect(call("D")).toBe(5); // 一律割合方式なら4
  });

  it("満点はその項目のAの点数になる", () => {
    expect(scoreItem({ rank: "C", weight: 999, mode: "absolute", ratios, absolute: item2Absolute }).maxPoints).toBe(10);
  });

  it("点数表が無い項目は0点にせず、一律割合方式へ退避してその旨を残す", () => {
    const r = scoreItem({ rank: "B", weight: 20, mode: "absolute", ratios, absolute: null });
    expect(r.points).toBe(16);
    expect(r.maxPoints).toBe(20);
    expect(r.fellBackToRatio).toBe(true);
    expect(r.note).toContain("元の配点表がない");
  });
});

/* ─────────── 本人向けの根拠文（配点・点数・閾値を出さない） ───────────
 *
 * 本人向けの文は evaluation_items.rationale_employee /
 * evaluations.raise_reason_employee / promotion_blocked_reason_employee に保存され、
 * 本人の画面にそのまま出る。表示側で数字を消すのではなく、
 * ここで数字を含まない文を作り切る（消し忘れが本人に見える事故になるため）。
 */

import {
  rankLevelLabel,
  UNRATED_RATIONALE_EMPLOYEE,
  UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE,
} from "./scoring";

/** 文字列に「数字」が含まれないこと。実績値を含む文ではこの関数を使わない。 */
const hasDigit = (s: string) => /[0-9０-９]/.test(s);

describe("judgeRank — 本人向けの根拠文", () => {
  it("閾値の表示文（80%以上 100%未満 など）を本人向けには出さない", () => {
    const j = judgeRank(92, requirementRate, "higher", { unit: "%" });
    expect(j.rank).toBe("B");
    expect(j.rationale).toContain("80%以上 100%未満"); // 評価者向けは従来どおり
    expect(j.rationaleEmployee).not.toContain("80%以上 100%未満");
    expect(j.rationaleEmployee).not.toContain("100");
    // 実績値とランクは本人に見せてよい
    expect(j.rationaleEmployee).toContain("92%");
    expect(j.rationaleEmployee).toContain("上から2番目の水準");
    expect(j.rationaleEmployee).toContain("B");
  });

  it("Aは「もっとも高い水準」、Eは「もっとも下の水準」と言い換える", () => {
    expect(rankLevelLabel("A")).toBe("もっとも高い水準");
    expect(rankLevelLabel("C")).toBe("上から3番目の水準");
    expect(rankLevelLabel("E")).toBe("もっとも下の水準");
    expect(judgeRank(100, requirementRate, "higher").rationaleEmployee).toContain("もっとも高い水準");
  });

  it("逆転指標でも本人向けに閾値を出さない", () => {
    const j = judgeRank(97, overtimeRate, "lower", { unit: "%" });
    expect(j.rank).toBe("B");
    expect(j.rationaleEmployee).not.toContain("95");
    expect(j.rationaleEmployee).toContain("97%");
  });

  it("基準表に穴があった事実は本人にも伏せない（黙ってEにしない）", () => {
    const holed: RankCriterion[] = [{ rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null }];
    const j = judgeRank(50, holed, "higher", { unit: "%" });
    expect(j.rationaleEmployee).toContain("評価基準の見直し");
    expect(j.rationaleEmployee).not.toContain("100%以上");
  });

  it("判定外の項目にも本人向けの文がある（数字を含まない）", () => {
    expect(hasDigit(UNRATED_RATIONALE_EMPLOYEE)).toBe(false);
    expect(hasDigit(UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE)).toBe(false);
    expect(UNRATED_RATIONALE_EMPLOYEE).toContain("判定外");
    expect(UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE).toContain("等級要件");
  });
});

describe("scoreItem — 本人向けの説明に配点・点数・割合が入らない", () => {
  it("一律割合方式でも項目別絶対点方式でも、数字はランクの文字だけ", () => {
    for (const r of [
      scoreItem({ rank: "B", weight: 20, mode: "ratio", ratios }),
      scoreItem({ rank: "C", weight: 100, mode: "absolute", ratios, absolute: item1Absolute }),
      scoreItem({ rank: "D", weight: 10, mode: "absolute", ratios, absolute: null }),
    ]) {
      expect(hasDigit(r.noteEmployee), r.noteEmployee).toBe(false);
      expect(r.noteEmployee).not.toContain("配点");
      expect(r.noteEmployee).not.toContain("満点");
      expect(r.noteEmployee).not.toContain("%");
    }
    expect(scoreItem({ rank: "B", weight: 20, mode: "ratio", ratios }).noteEmployee).toContain("B");
  });
});

describe("judgeOverall — 本人向けの昇給・昇格理由", () => {
  const items = [
    { kpiItemId: "k1", itemName: "等級要件達成率", rank: "B" as const, points: 16, maxPoints: 20 },
    { kpiItemId: "k9", itemName: "売上達成率", rank: "A" as const, points: 20, maxPoints: 20 },
  ];

  it("昇給が見送りのとき、点数を出さずに足りない項目名とランクだけを伝える", () => {
    const res = judgeOverall({
      items,
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseReasonEmployee).toContain("等級要件達成率（B）");
    expect(res.raiseReasonEmployee).toContain("見送り");
    expect(res.raiseReasonEmployee).not.toContain("点");
  });

  it("昇給の要件を満たすときも項目数や点数を出さない", () => {
    const res = judgeOverall({
      items: items.map((i) => ({ ...i, rank: "A" as const, points: i.maxPoints })),
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseEligible).toBe(true);
    expect(hasDigit(res.raiseReasonEmployee)).toBe(false);
    expect(res.raiseReason).toContain("2項目"); // 評価者向けは従来どおり件数を出す
  });

  it("「すべてA」を条件にしない会社でも、本人向けには合計点を出さない", () => {
    const res = judgeOverall({
      items,
      raiseRequiresAllA: false,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseReason).toContain("36点");
    expect(hasDigit(res.raiseReasonEmployee)).toBe(false);
  });

  it("昇格できない理由から必要点数・獲得点数を消す（昇格要件の文言は残す）", () => {
    const res = judgeOverall({
      items,
      raiseRequiresAllA: true,
      requiredKpiPoints: 100,
      requiredBehaviorPoints: 12,
      behaviorTotal: 7,
      gates: [{ text: "IT機器基礎研修（本部）", achieved: false }],
    });
    expect(res.promotionBlockedReason).toContain("必要な100点");
    expect(res.promotionBlockedReason).toContain("行動指針の評価が7点");
    const emp = res.promotionBlockedReasonEmployee!;
    expect(emp).toContain("IT機器基礎研修（本部）");
    expect(emp).toContain("KPI評価が、昇格に必要な水準に達していません。");
    expect(emp).toContain("行動指針の評価が、昇格に必要な水準に達していません。");
    expect(emp).not.toContain("100点");
    expect(emp).not.toContain("36点");
    expect(emp).not.toContain("7点");
  });

  it("昇格できるときは本人向けの理由も null", () => {
    const res = judgeOverall({
      items,
      raiseRequiresAllA: true,
      requiredKpiPoints: 10,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.promotionEligible).toBe(true);
    expect(res.promotionBlockedReasonEmployee).toBeNull();
  });

  it("判定外の項目は本人向けにも「判定できていません」と伝える", () => {
    const res = judgeOverall({
      items: [items[0], { kpiItemId: "k2", itemName: "ヒヤリ報告件数", rank: null, points: 0, maxPoints: 10 }],
      raiseRequiresAllA: true,
      requiredKpiPoints: null,
      requiredBehaviorPoints: null,
      behaviorTotal: null,
      gates: [],
    });
    expect(res.raiseReasonEmployee).toContain("ヒヤリ報告件数");
    expect(res.raiseReasonEmployee).toContain("判定できていません");
  });
});
