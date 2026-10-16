import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockedHelp, blockedRows } from "@/components/UsedByDetail";
import { BLOCKED_HELP_LABEL, BLOCKED_KEEP, BLOCKED_WHAT, BLOCKED_WHY, blockedMark } from "@/lib/domain/master-delete";

/**
 * 使用中の行を消せない理由（spec §22-5）は、等級要件・昇格要件・行動指針の観点・基準セットで同じ文にする。
 * 4つの画面は BlockedHelp を置くだけなので、描いた中身はここで1回だけ見る。
 */
describe("使用中の行を消せない理由（BlockedHelp）", () => {
  it("押すと開く畳みの中に、理由 → 消さずに残す訳 → 代わりにできること の順で3段を出す", () => {
    expect(renderToStaticMarkup(createElement(BlockedHelp))).toBe(
      '<details class="disclosure card">' +
        `<summary><span>${BLOCKED_HELP_LABEL}</span></summary>` +
        '<div class="disclosure-body">' +
        `<p class="m-0 text-sub">${BLOCKED_WHY}</p>` +
        `<p class="m-0 mt-1 text-sub">${BLOCKED_KEEP}</p>` +
        `<p class="m-0 mt-1 text-sub">${BLOCKED_WHAT}</p>` +
        "</div></details>",
    );
  });
});

describe("行ごとの使っている場所と印（blockedRows）", () => {
  const usage = { a: ["アンケートA", "評価B"], b: [] };

  it("使っている場所と印は usage から引き、載っていない行は使っていない扱いにする", () => {
    const { usedByOf, markOf } = blockedRows(usage, [{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(usedByOf("a")).toEqual(["アンケートA", "評価B"]);
    expect(usedByOf("c")).toEqual([]);
    // 印は blockedMark と同じ文（行の印と、使っている場所の件数を食い違わせない）
    expect(markOf("a")).toBe(blockedMark(["アンケートA", "評価B"]));
    expect(markOf("a")).not.toBeNull();
    expect(markOf("b")).toBeNull();
    expect(markOf("c")).toBeNull();
  });

  it("一覧の下に理由を出すかどうかは、渡した行の中に使用中が1つでもあるかで決める", () => {
    expect(blockedRows(usage, [{ id: "a" }, { id: "b" }]).anyBlocked).toBe(true);
    expect(blockedRows(usage, [{ id: "b" }, { id: "c" }]).anyBlocked).toBe(false);
    // 画面に出していない行（行動指針のほかの基準の観点など）が使用中でも、この一覧の理由は出さない
    expect(blockedRows(usage, []).anyBlocked).toBe(false);
  });
});
