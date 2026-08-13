import { describe, expect, it } from "vitest";
import {
  buildEmployeeItemRationale,
  buildRadarValues,
  buildThresholdScale,
  containsCriteriaLeak,
  employeePromotionBlockedReason,
  employeeRaiseReason,
  scopeEvaluationItem,
} from "./evaluation-view";
import { checkGradePointRule, type GradePointRule } from "./grade-points";
import { changesForMove, inactiveOf, type RequirementRow } from "./grade-requirements";
import { copiedBandSetName, defaultLevelText } from "./behavior";
import { summarizeBuildResults, FINALIZED_SKIP_MESSAGE } from "./build-summary";
import { formatAnswer, parseOptions, type AnswerReadRow } from "./answer-snapshot";

/**
 * 評価に関わるモジュールのうち、既存の試験で通っていなかった分かれ道を埋める。
 *
 * ここに集めたのは「めったに起きないが、起きたときに数字が黙って変わる」経路。
 * 0・空・上限・想定外の値を入れて、何が起きるかを試験として固定する。
 */

/* ───────────── 本人向け表示の削り落とし ───────────── */

describe("本人に見せてよい形へ削る", () => {
  it("文が空・未設定なら、点数漏れは無いと判定する", () => {
    expect(containsCriteriaLeak(null)).toBe(false);
    expect(containsCriteriaLeak(undefined)).toBe(false);
    expect(containsCriteriaLeak("")).toBe(false);
  });

  it("実績値はあるが単位が無い項目でも、数値をそのまま添える", () => {
    expect(buildEmployeeItemRationale({ itemName: "件数", rank: "B", actualValue: 12, unit: null })).toContain(
      "実績値は 12 です。",
    );
  });

  it("ランクは付いたが実績値が残っていない項目は、ランクだけを伝える", () => {
    const text = buildEmployeeItemRationale({ itemName: "支援", rank: "C", actualValue: null, unit: "%" });
    expect(text).toContain("ランク C と判定しました");
    expect(text).not.toContain("実績値");
  });

  it("実績値も判定も無ければ「判定外」と伝える（0点と書かない）", () => {
    const text = buildEmployeeItemRationale({ itemName: "支援", rank: null, actualValue: null, unit: "%" });
    expect(text).toContain("判定外");
    expect(text).not.toMatch(/0点/);
  });

  it("評価者向けの表示では、根拠文が空でも欄を落とさず空文字にする", () => {
    const scoped = scopeEvaluationItem(
      {
        itemName: "利益率",
        rank: "A",
        actualValue: 100,
        unit: "%",
        points: 20,
        maxPoints: 20,
        thresholdLabel: "100%以上",
        thresholdLower: 100,
        thresholdUpper: null,
        rationale: null,
        rationaleEmployee: null,
        calcNote: "q1_1 ÷ q1_2",
      },
      true,
    );
    expect(scoped.rationale).toBe("");
    expect(scoped.points).toBe(20);
    expect(scoped.calcNote).toBe("q1_1 ÷ q1_2");
  });

  it("昇給できなかった本人には、見送りの理由を数値抜きで伝える", () => {
    const text = employeeRaiseReason(null, false);
    expect(text).toContain("見送り");
    expect(containsCriteriaLeak(text)).toBe(false);
  });

  it("昇給できた本人には、要件を満たした旨を数値抜きで伝える", () => {
    const text = employeeRaiseReason(null, true);
    expect(text).toContain("昇給の要件を満たして");
    expect(containsCriteriaLeak(text)).toBe(false);
  });

  it("保存済みの本人向けの文に点数が混ざっていたら、組み立て直した文へ差し替える", () => {
    const text = employeeRaiseReason("あと10点で昇給でした", false);
    expect(text).not.toContain("10点");
  });

  it("評価者側に昇格の理由が無いなら、本人にも何も出さない", () => {
    expect(employeePromotionBlockedReason("なにか", false)).toBeNull();
  });
});

/* ───────────── レーダーチャート ───────────── */

describe("レーダーチャートの形", () => {
  it("A〜E以外のランク文字が入っていても、0として描き画面を落とさない", () => {
    const [v] = buildRadarValues([{ itemName: "謎", rank: "S", points: 10, maxPoints: 10 }], false);
    expect(v).toMatchObject({ value: 0, rank: "S", unrated: false });
  });

  it("評価者向けでも、配点が0の項目はランク由来の形で描く（0で割らない）", () => {
    const [v] = buildRadarValues([{ itemName: "配点0", rank: "B", points: 0, maxPoints: 0 }], true);
    expect(v.value).toBe(80);
  });

  it("評価者向けで獲得点が記録されていない項目は、ランク由来の形にする", () => {
    const [v] = buildRadarValues([{ itemName: "点数なし", rank: "C", points: null, maxPoints: 20 }], true);
    expect(v.value).toBe(60);
  });
});

/* ───────────── 閾値の帯 ───────────── */

describe("判定範囲の帯", () => {
  it("基準が1件も無ければ帯を作らない", () => {
    expect(buildThresholdScale([], 50)).toBeNull();
  });

  it("上下とも開いた基準だけなら、目盛りを作れないので帯を出さない", () => {
    expect(
      buildThresholdScale([{ rank: "A", displayLabel: "すべて", lowerBound: null, upperBound: null }], 50),
    ).toBeNull();
  });

  it("境目が1つしかなくても帯を作る（幅が0にならない）", () => {
    const scale = buildThresholdScale(
      [
        { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
        { rank: "E", displayLabel: "100%未満", lowerBound: null, upperBound: 100 },
      ],
      100,
      "A",
    )!;
    expect(scale.segments).toHaveLength(2);
    expect(scale.segments.every((s) => s.width > 0)).toBe(true);
    expect(scale.segments.find((s) => s.rank === "A")!.hit).toBe(true);
    // 下限が空の区間が左に来る
    expect(scale.segments[0].rank).toBe("E");
  });

  it("下限が空の区間が複数あっても、左から順に並べる", () => {
    const scale = buildThresholdScale(
      [
        { rank: "C", displayLabel: "80%以上90%未満", lowerBound: 80, upperBound: 90 },
        { rank: "E", displayLabel: "70%未満", lowerBound: null, upperBound: 70 },
        { rank: "D", displayLabel: "70%以上80%未満", lowerBound: 70, upperBound: 80 },
        { rank: "B", displayLabel: "90%以上100%未満", lowerBound: 90, upperBound: 100 },
        { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
      ],
      85,
      "C",
    )!;
    expect(scale.segments.map((x) => x.rank)).toEqual(["E", "D", "C", "B", "A"]);
    expect(scale.segments.filter((x) => x.hit).map((x) => x.rank)).toEqual(["C"]);
    // 85 は C の区間の中にある
    const c = scale.segments.find((x) => x.rank === "C")!;
    expect(scale.markerLeft!).toBeGreaterThan(c.left);
    expect(scale.markerLeft!).toBeLessThan(c.left + c.width);
  });

  /**
   * 帯の幅が0以下になる経路（`span <= 0` で null を返す枝）は、
   * 上下に必ず余白（最低1）を足してから幅を測るため、実際には通らない。
   * ＝到達不能な保険であり、テストが書けていないのではない。
   */
  it("境目が0だけでも帯を作れる（幅が0にならない）", () => {
    const scale = buildThresholdScale(
      [{ rank: "A", displayLabel: "0以上", lowerBound: 0, upperBound: null }],
      0,
      "A",
    )!;
    expect(scale.segments[0].width).toBeGreaterThan(0);
    expect(scale.markerLeft).toBe(50);
  });

  it("実績値が帯の外でも、端に丸めて必ず帯の中に置く", () => {
    const criteria = [
      { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
      { rank: "E", displayLabel: "70%未満", lowerBound: null, upperBound: 70 },
    ];
    expect(buildThresholdScale(criteria, 100000)!.markerLeft).toBe(100);
    expect(buildThresholdScale(criteria, -100000)!.markerLeft).toBe(0);
  });

  it("実績値が無ければ目盛りは置かない", () => {
    const scale = buildThresholdScale(
      [{ rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null }],
      null,
    )!;
    expect(scale.markerLeft).toBeNull();
  });

  it("どのランクにも当たっていなければ、光る区間は無い", () => {
    const scale = buildThresholdScale(
      [{ rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null }],
      null,
      null,
    )!;
    expect(scale.segments.every((s) => !s.hit)).toBe(true);
  });
});

/* ───────────── 配点の型の検算 ───────────── */

describe("等級区分ごとの配点の型が破綻していないか", () => {
  const ok: GradePointRule = {
    pointGroup: "Chief",
    totalPoints: 100,
    fixedSlotPoints: 40,
    majorSlotPoints: 20,
    majorSlotCount: 1,
    minorSlotPoints: 10,
    minorSlotCount: 4,
  };

  it("40 + 20×1 + 10×4 ＝ 100 なら指摘なし", () => {
    expect(checkGradePointRule(ok)).toEqual([]);
  });

  it("合計が満点に1点でも足りなければ指摘する", () => {
    expect(checkGradePointRule({ ...ok, minorSlotCount: 3 })[0]).toContain("90点");
  });

  it("固定枠が0点なら指摘する", () => {
    expect(checkGradePointRule({ ...ok, fixedSlotPoints: 0, totalPoints: 60 }).join("")).toContain(
      "固定枠",
    );
  });

  it("枠数が負の数なら指摘する", () => {
    expect(
      checkGradePointRule({ ...ok, minorSlotCount: -4, totalPoints: 20 }).join(""),
    ).toContain("負の数");
    expect(
      checkGradePointRule({ ...ok, majorSlotCount: -1, totalPoints: 60 }).join(""),
    ).toContain("負の数");
  });

  it("枠を持つのに、その枠の配点が0点なら指摘する", () => {
    expect(
      checkGradePointRule({ ...ok, majorSlotPoints: 0, totalPoints: 80 }).join(""),
    ).toContain("20点枠");
    expect(
      checkGradePointRule({ ...ok, minorSlotPoints: 0, totalPoints: 60 }).join(""),
    ).toContain("10点枠");
  });

  it("枠が0個なら、その枠の配点が0点でも指摘しない", () => {
    expect(
      checkGradePointRule({
        pointGroup: "Beginner",
        totalPoints: 100,
        fixedSlotPoints: 100,
        majorSlotPoints: 0,
        majorSlotCount: 0,
        minorSlotPoints: 0,
        minorSlotCount: 0,
      }),
    ).toEqual([]);
  });
});

/* ───────────── 等級要件の並べ替え ───────────── */

describe("等級要件の並べ替え", () => {
  const rows: RequirementRow[] = [
    { id: "r1", category: "support", seq: 1, text: "支援1", isActive: true },
    { id: "r2", category: "support", seq: 2, text: "支援2", isActive: true },
    { id: "r3", category: "operation", seq: 1, text: "運営1", isActive: true },
    { id: "r9", category: "support", seq: 9, text: "使わない", isActive: false },
  ];

  it("使わない状態の項目だけを、並び順で取り出せる", () => {
    const withTwo = [
      ...rows,
      { id: "r8", category: "operation", seq: 8, text: "使わない2", isActive: false },
    ];
    expect(inactiveOf(withTwo).map((r) => r.id)).toEqual(["r8", "r9"]);
  });

  it("隣どうしの並び順を入れ替える", () => {
    expect(changesForMove(rows, "support", "r2", "up")).toEqual([
      { id: "r2", seq: 1 },
      { id: "r1", seq: 2 },
    ]);
  });

  it("先頭で↑・末尾で↓は動かさない", () => {
    expect(changesForMove(rows, "support", "r1", "up")).toBeNull();
    expect(changesForMove(rows, "support", "r2", "down")).toBeNull();
  });

  it("その区分に無い項目・使わない状態の項目は動かさない", () => {
    expect(changesForMove(rows, "support", "r3", "up")).toBeNull();
    expect(changesForMove(rows, "support", "r9", "up")).toBeNull();
    expect(changesForMove(rows, "operation", "r3", "down")).toBeNull();
  });
});

/* ───────────── 行動指針の基準セット ───────────── */

describe("行動指針の基準セット", () => {
  it("新しい観点には、書き換える前提の下書き文を入れる（空にしない）", () => {
    expect(defaultLevelText("責任感", "模範")).toContain("責任感");
    expect(defaultLevelText("責任感", "模範")).toContain("模範");
  });

  it("複製した名前は必ず既存と重ならない", () => {
    expect(copiedBandSetName([], "Chief・AM向け")).toBe("Chief・AM向けのコピー");
    expect(copiedBandSetName(["基準のコピー"], "基準")).toBe("基準のコピー2");
    expect(copiedBandSetName(["基準のコピー", "基準のコピー2"], "基準")).toBe("基準のコピー3");
  });

  it("番号を使い切っても、名前が重なるより別名を返す", () => {
    const taken = ["基準のコピー", ...Array.from({ length: 98 }, (_, i) => `基準のコピー${i + 2}`)];
    const name = copiedBandSetName(taken, "基準");
    expect(taken).not.toContain(name);
    expect(name.startsWith("基準のコピー")).toBe(true);
  });
});

/* ───────────── 集計し直しの要約 ───────────── */

describe("集計し直しの結果を1行で伝える", () => {
  it("作れなかった人が4人以上いても、名前は3人までにして残りは件数で言う", () => {
    const results = ["甲", "乙", "丙", "丁", "戊"].map((employeeName) => ({
      employeeName,
      ok: false,
      message: "回答がありません。",
    }));
    const text = summarizeBuildResults(results);
    expect(text).toContain("5人ぶんは作れませんでした");
    expect(text).toContain("ほか2人");
    expect(text).not.toContain("戊");
  });

  it("確定済みは、黙って飛ばさず件数を言う", () => {
    const text = summarizeBuildResults([
      { employeeName: "甲", ok: true, message: "" },
      { employeeName: "乙", ok: false, message: FINALIZED_SKIP_MESSAGE },
    ]);
    expect(text).toContain("1人ぶんの評価を作りました");
    expect(text).toContain("確定済みの1人ぶん");
  });

  it("対象が0件なら、次にやることを添えて伝える", () => {
    expect(summarizeBuildResults([])).toContain("確認してください");
  });
});

/* ───────────── 回答の読み出し ───────────── */

describe("保存された回答の読み出し", () => {
  const base: AnswerReadRow = {
    questionId: "q1",
    title: "件数",
    section: "kpi",
    questionType: "number",
    unit: "件",
    options: [],
    displayOrder: 1,
    valueNumber: null,
    valueText: null,
    valueJson: null,
    fromCurrentQuestion: false,
  };

  it("選択肢の記録が配列でない・壊れていれば、空として扱い画面を落とさない", () => {
    expect(parseOptions('{"value":"a"}')).toEqual([]);
    expect(parseOptions("これはJSONではない")).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions('[{"value":"a","label":"あ"},null,"x",{"value":"b"}]')).toEqual([
      { value: "a", label: "あ" },
    ]);
  });

  it("数量の回答は単位を添える。単位が無ければ数値だけ", () => {
    expect(formatAnswer({ ...base, valueNumber: 18 })).toBe("18件");
    expect(formatAnswer({ ...base, unit: null, valueNumber: 18 })).toBe("18");
  });

  it("0件は「未回答」ではなく 0 として出す", () => {
    expect(formatAnswer({ ...base, valueNumber: 0 })).toBe("0件");
  });

  it("数量の設問に文字だけが残っていれば、その文字を出す", () => {
    expect(formatAnswer({ ...base, valueText: "  未計測  " })).toBe("未計測");
  });

  it("数量の設問では、数値がある限り控えの文字より数値を優先する", () => {
    expect(formatAnswer({ ...base, valueNumber: 18, valueText: "18件と回答" })).toBe("18件");
  });

  it("選択式は、選んだ言葉をそのまま出す", () => {
    expect(formatAnswer({ ...base, questionType: "single", valueNumber: 3, valueText: "はい" })).toBe(
      "はい",
    );
  });

  it("複数選択は、選んだ言葉を並べる。選択肢が消えていた場合は記録された値をそのまま出す", () => {
    const row = {
      ...base,
      questionType: "multi",
      options: [{ value: "a", label: "あ" }],
      valueJson: '["a","z"]',
    };
    expect(formatAnswer(row)).toBe("あ、z");
  });

  it("複数選択で何も選ばれていなければ、控えの文字か「未回答」になる", () => {
    expect(formatAnswer({ ...base, questionType: "multi", valueJson: "[]" })).toBeNull();
    expect(formatAnswer({ ...base, questionType: "multi", valueJson: "[]", valueText: "あ" })).toBe("あ");
    expect(formatAnswer({ ...base, questionType: "multi", valueJson: "[]", valueText: "   " })).toBeNull();
  });

  it("自由記述は、空白だけなら未回答として扱う", () => {
    expect(formatAnswer({ ...base, questionType: "text", valueText: "   " })).toBeNull();
    expect(formatAnswer({ ...base, questionType: "text", valueText: " 所感 " })).toBe("所感");
  });

  it("何も入っていなければ未回答", () => {
    expect(formatAnswer(base)).toBeNull();
  });
});
