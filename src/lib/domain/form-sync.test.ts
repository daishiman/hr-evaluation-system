import { describe, expect, it } from "vitest";
import { diffFormKpiItems, effectiveAskedItems } from "./form-sync";

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
