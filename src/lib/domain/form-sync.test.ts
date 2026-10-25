import { describe, expect, it } from "vitest";
import {
  diffFormKpiItems,
  effectiveAskedItems,
  linkedQuestionsMatch,
  questionsKeptOnRebuild,
  staleAskingItems,
  type LinkedQuestionContent,
  type RebuildQuestion,
} from "./form-sync";

/**
 * 評価セットとアンケートのズレ検出。
 *
 * ここが黙って通ると、「選んだのに聞かれていない項目」が判定外のまま半期が終わる。
 * 気づくのは評価を確定するときで、そのときにはもう回答を取り直せない。
 */

const NAMES: Record<string, string> = { k1: "等級要件達成率", k9: "売上達成率", k24: "利益率" };
const nameOf = (id: string) => NAMES[id] ?? id;

describe("diffFormKpiItems", () => {
  it("同じ顔ぶれならズレなし（並び順は見ない）", () => {
    const d = diffFormKpiItems(["k1", "k9"], ["k9", "k1"]);
    expect(d).toEqual({ missing: [], extra: [] });
  });

  it("選んだのに聞いていない項目を欠落として出す", () => {
    const d = diffFormKpiItems(["k1", "k9"], ["k1"]);
    expect(d.missing).toEqual(["k9"]);
    expect(d.extra).toEqual([]);
  });

  it("聞いているのに使わない項目を余分として出す", () => {
    const d = diffFormKpiItems(["k1"], ["k1", "k24"]);
    expect(d).toEqual({ missing: [], extra: ["k24"] });
  });

  it("欠落と余分が同時にあれば、両方をそれぞれの側に出す（文にするのは comparison-gap.ts）", () => {
    const d = diffFormKpiItems(["k1", "k9"], ["k1", "k24"]);
    expect(d).toEqual({ missing: ["k9"], extra: ["k24"] });
    expect([...d.missing, ...d.extra].map(nameOf)).toEqual(["売上達成率", "利益率"]);
  });

  it("同じ項目が重複して渡されても1件として数える（設問は1項目に複数ある）", () => {
    const d = diffFormKpiItems(["k1"], ["k1", "k1", "k9", "k9"]);
    expect(d.extra).toEqual(["k9"]);
  });
});

describe("effectiveAskedItems", () => {
  /* 等級要件達成率（固定枠）は、KPI設問ではなく支援・運営の「はい／いいえ」から出す。
     同じことを2回聞かないためにKPI設問を載せていないので、
     それを「聞いていない」と数えると、点が付く項目に警告を出し続けることになる。 */
  it("等級要件の設問があれば、固定枠も聞いているものとして数える", () => {
    const asked = effectiveAskedItems(["k9"], { fixedSlotItemIds: ["k1"], hasRequirementQuestions: true });
    expect(new Set(asked)).toEqual(new Set(["k1", "k9"]));
    expect(diffFormKpiItems(["k1", "k9"], asked)).toEqual({ missing: [], extra: [] });
  });

  it("等級要件の設問が1問も無ければ、固定枠は欠落として残す", () => {
    const asked = effectiveAskedItems(["k9"], { fixedSlotItemIds: ["k1"], hasRequirementQuestions: false });
    expect(asked).toEqual(["k9"]);
    expect(diffFormKpiItems(["k1", "k9"], asked).missing).toEqual(["k1"]);
  });
});

describe("staleAskingItems（版の設問が、いまの計算式の変数をそろえているか。DD-016）", () => {
  const RATE = { id: "kpi_rate", name: "稼働率", formula: "q2_1 ÷ q2_2 × 100" };
  const FIXED = { id: "kpi_fixed", name: "等級要件達成率", formula: null };
  const template = (kpiItemId: string, questionKey: string, targetGrades: string | null = null) => ({ kpiItemId, questionKey, targetGrades });
  const asked = (kpiItemId: string, ...keys: string[]) => keys.map((kpiQuestionKey) => ({ kpiItemId, kpiQuestionKey }));
  const base = {
    pointGroup: "Regular",
    schemeItems: [
      { kpiItemId: FIXED.id, isFixedSlot: true },
      { kpiItemId: RATE.id, isFixedSlot: false },
    ],
    kpiItems: [FIXED, RATE],
  };

  it("版の key が式の変数をそろえていれば、何も出さない", () => {
    expect(
      staleAskingItems({ ...base, formQuestions: asked(RATE.id, "q2_1", "q2_2"), templates: [template(RATE.id, "q2_1"), template(RATE.id, "q2_2")] }),
    ).toEqual([]);
  });

  it("聞くことを足して式が変わった項目は、作り直せば直る", () => {
    const kpiItems = [FIXED, { ...RATE, formula: "(q2_1 + q2_3) ÷ q2_2 × 100" }];
    const templates = [template(RATE.id, "q2_1"), template(RATE.id, "q2_2"), template(RATE.id, "q2_3")];
    expect(staleAskingItems({ ...base, kpiItems, formQuestions: asked(RATE.id, "q2_1", "q2_2"), templates })).toEqual([
      { kpiItemId: RATE.id, name: "稼働率", rebuildFixes: true },
    ]);
  });

  it("式がこの区分のひな形に無い key を使っていれば、作り直しても直らない", () => {
    // q2_2 は Chief 向けだけ。Regular の版は作り直しても q2_2 を聞かない
    const templates = [template(RATE.id, "q2_1", "Regular／Chief"), template(RATE.id, "q2_2", "Chief")];
    expect(staleAskingItems({ ...base, formQuestions: asked(RATE.id, "q2_1"), templates })).toEqual([
      { kpiItemId: RATE.id, name: "稼働率", rebuildFixes: false },
    ]);
  });

  it("この区分向けのひな形が1件も無ければ、組み立てと同じく全部を載せる前提で見る", () => {
    const templates = [template(RATE.id, "q2_1", "Chief"), template(RATE.id, "q2_2", "Manager")];
    expect(staleAskingItems({ ...base, formQuestions: asked(RATE.id, "q2_1"), templates })).toEqual([
      { kpiItemId: RATE.id, name: "稼働率", rebuildFixes: true },
    ]);
  });

  it("等級から決まる値（【】）は設問に求めない", () => {
    const kpiItems = [FIXED, { ...RATE, formula: "q2_1 ÷ 【等級別の半期目標設定上限数】 × 100" }];
    expect(staleAskingItems({ ...base, kpiItems, formQuestions: asked(RATE.id, "q2_1"), templates: [template(RATE.id, "q2_1")] })).toEqual([]);
  });

  it("点の計算と同じく、版全体の key で探す（別の項目の設問の key でもそろう）", () => {
    const OTHER = { id: "kpi_other", name: "残業率", formula: "q3_1" };
    const kpiItems = [FIXED, RATE, OTHER];
    const schemeItems = [...base.schemeItems, { kpiItemId: OTHER.id, isFixedSlot: false }];
    const formQuestions = [...asked(RATE.id, "q2_1"), ...asked(OTHER.id, "q3_1", "q2_2")];
    expect(staleAskingItems({ ...base, kpiItems, schemeItems, formQuestions, templates: [] })).toEqual([]);
  });

  it("固定枠・聞いていない項目・評価セットのこの区分に無い項目は見ない", () => {
    const LOST = { id: "kpi_lost", name: "選び外した項目", formula: "q9_1" };
    const kpiItems = [{ ...FIXED, formula: "q1_1" }, RATE, LOST];
    // 固定枠は式を使わない。稼働率は聞いていない（比べる警告が出す）。LOST は点を付けない
    const formQuestions = [...asked(FIXED.id, "q1_9"), ...asked(LOST.id, "q9_0")];
    expect(staleAskingItems({ ...base, kpiItems, formQuestions, templates: [] })).toEqual([]);
  });

  it("式がまだ無い点の項目は、求める変数が無いので出さない（式の無いことは別の警告が言う）", () => {
    const kpiItems = [FIXED, { ...RATE, formula: null }];
    expect(staleAskingItems({ ...base, kpiItems, formQuestions: asked(RATE.id, "q2_1"), templates: [template(RATE.id, "q2_1")] })).toEqual([]);
  });
});

describe("questionsKeptOnRebuild（設定の保存で下書きを作り直すとき、残す設問。DD-028 の4）", () => {
  const unlinked: Omit<RebuildQuestion, "id" | "displayOrder"> = {
    kpiItemId: null,
    behaviorGuidelineId: null,
    gradeRequirementId: null,
    promotionRequirementId: null,
    isGate: false,
  };
  const question = (id: string, displayOrder: number, link: Partial<typeof unlinked> = {}) => ({ id, displayOrder, ...unlinked, ...link });

  it("設定とつながらない設問（手で足した設問）は、同じ id のまま作り直した設問の後ろに元の並びで残る", () => {
    const kept = questionsKeptOnRebuild([question("free_b", 9), question("kpi", 0, { kpiItemId: "k9" }), question("free_a", 3)], 5);
    expect(kept).toEqual([question("free_a", 5), question("free_b", 9)]);
  });

  it("作り直した設問より後ろの番号は元のまま残し、重なる番号だけ次の空きへ送る", () => {
    const kept = questionsKeptOnRebuild([question("free_c", 999), question("free_a", 6), question("free_b", 6)], 6);
    expect(kept.map((q) => [q.id, q.displayOrder])).toEqual([
      ["free_a", 6],
      ["free_b", 7],
      ["free_c", 999],
    ]);
  });

  it("設定とつながった設問は残さない（いまの設定から作り直す）", () => {
    const kept = questionsKeptOnRebuild(
      [
        question("kpi", 0, { kpiItemId: "k9" }),
        question("behavior", 1, { behaviorGuidelineId: "g1" }),
        question("grade", 2, { gradeRequirementId: "r1" }),
        question("promotion", 3, { promotionRequirementId: "p1" }),
      ],
      4,
    );
    expect(kept).toEqual([]);
  });

  it("入口の問い（isGate）は、紐づけが無くても作り直しの側が作るので残さない", () => {
    expect(questionsKeptOnRebuild([question("gate", 0, { isGate: true })], 1)).toEqual([]);
  });

  it("残す設問が無ければ空を返す", () => {
    expect(questionsKeptOnRebuild([], 3)).toEqual([]);
  });
});

describe("linkedQuestionsMatch（設定から作った設問が、いまの設定から作り直した設問と同じか。DD-028 の4）", () => {
  const behavior = { section: "behavior", questionType: "single", title: "挑戦する姿勢", optionsJson: '[{"value":"3"}]', behaviorGuidelineId: "g1" };
  const kpi = { section: "kpi", questionType: "number", title: "売上", unit: "円", kpiItemId: "k9", kpiQuestionKey: "q9_1" };
  // DB から読んだ行は、欠けた値が既定（必須・整数でない・入口の問いでない）と null で埋まっている
  const stored = (id: string, displayOrder: number, q: LinkedQuestionContent) => ({
    ...q,
    id,
    displayOrder,
    helpText: q.helpText ?? null,
    unit: q.unit ?? null,
    required: q.required ?? true,
    validationMin: q.validationMin ?? null,
    validationMax: q.validationMax ?? null,
    validationInteger: q.validationInteger ?? false,
    optionsJson: q.optionsJson ?? null,
    gradeRequirementId: q.gradeRequirementId ?? null,
    promotionRequirementId: q.promotionRequirementId ?? null,
    behaviorGuidelineId: q.behaviorGuidelineId ?? null,
    kpiItemId: q.kpiItemId ?? null,
    kpiQuestionKey: q.kpiQuestionKey ?? null,
    isGate: q.isGate ?? false,
  });
  const free = stored("free", 9, { section: "free", questionType: "text", title: "ひとこと" });

  it("中身が同じなら、並び・id・欠けた値の書き方が違っても同じとみなす", () => {
    expect(linkedQuestionsMatch([stored("b", 5, kpi), stored("a", 1, behavior)], [behavior, kpi])).toBe(true);
  });

  it("手で足した設問は比べない（作り直しても残るため）", () => {
    expect(linkedQuestionsMatch([stored("a", 0, behavior), free], [behavior])).toBe(true);
  });

  it("呼び名が変われば違う", () => {
    expect(linkedQuestionsMatch([stored("a", 0, behavior)], [{ ...behavior, title: "さらに新しい工夫" }])).toBe(false);
  });

  it("設定の行が増えたか減ったら違う", () => {
    expect(linkedQuestionsMatch([stored("a", 0, behavior)], [behavior, kpi])).toBe(false);
    expect(linkedQuestionsMatch([stored("a", 0, behavior), stored("b", 1, kpi)], [behavior])).toBe(false);
  });

  it("同じ中身の設問が2問あれば2問として数える", () => {
    expect(linkedQuestionsMatch([stored("a", 0, kpi), stored("b", 1, kpi)], [kpi])).toBe(false);
  });

  it("必須・整数・入口の問いの既定と違う値は違いとして出す", () => {
    expect(linkedQuestionsMatch([stored("b", 0, kpi)], [{ ...kpi, required: false }])).toBe(false);
    expect(linkedQuestionsMatch([stored("b", 0, kpi)], [{ ...kpi, validationInteger: true }])).toBe(false);
  });
});
