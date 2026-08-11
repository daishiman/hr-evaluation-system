import { describe, expect, it } from "vitest";
import { describeFormKpiDiff, diffFormKpiItems, isFormInSync } from "./form-sync";

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
    expect(isFormInSync(d)).toBe(true);
    expect(describeFormKpiDiff(d, nameOf)).toBeNull();
  });

  it("選んだのに聞いていない項目を欠落として出す", () => {
    const d = diffFormKpiItems(["k1", "k9"], ["k1"]);
    expect(d.missing).toEqual(["k9"]);
    expect(d.extra).toEqual([]);
    expect(describeFormKpiDiff(d, nameOf)).toContain("「売上達成率」");
    expect(describeFormKpiDiff(d, nameOf)).toContain("点が付きません");
  });

  it("聞いているのに使わない項目を余分として出す", () => {
    const d = diffFormKpiItems(["k1"], ["k1", "k24"]);
    expect(d.extra).toEqual(["k24"]);
    expect(describeFormKpiDiff(d, nameOf)).toContain("「利益率」");
  });

  it("欠落と余分が同時にあるときは1文にまとめる", () => {
    const msg = describeFormKpiDiff(diffFormKpiItems(["k1", "k9"], ["k1", "k24"]), nameOf);
    expect(msg).toContain("「売上達成率」");
    expect(msg).toContain("「利益率」");
    expect(msg).toContain("作り直すと揃います");
  });

  it("同じ項目が重複して渡されても1件として数える（設問は1項目に複数ある）", () => {
    const d = diffFormKpiItems(["k1"], ["k1", "k1", "k9", "k9"]);
    expect(d.extra).toEqual(["k9"]);
  });
});
