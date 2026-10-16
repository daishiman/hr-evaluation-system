import { describe, expect, it } from "vitest";
import { diffFormKpiItems, effectiveAskedItems, staleAskingItems } from "./form-sync";

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
});
