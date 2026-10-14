import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ state: undefined as unknown }));

/* 状態は1つだけなので、描画をまたいで1つの値を持てば足りる。関数で渡された更新は、いまの値に当てる */
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    if (mocks.state === undefined) mocks.state = initial;
    return [
      mocks.state,
      (next: unknown) => {
        mocks.state = typeof next === "function" ? (next as (current: unknown) => unknown)(mocks.state) : next;
      },
    ];
  },
}));

import { useDraftMap } from "./use-draft-map";

describe("useDraftMap", () => {
  beforeEach(() => {
    mocks.state = undefined;
  });

  it("開く・書き換える・閉じるを行ごとに持ち、ほかの行には触らない", () => {
    useDraftMap<string>().start("a", "元の文");
    useDraftMap<string>().start("b", "別の行");
    useDraftMap<string>().change("a", "直した文");
    expect(useDraftMap<string>().drafts).toEqual({ a: "直した文", b: "別の行" });

    useDraftMap<string>().stop("a");
    const map = useDraftMap<string>();
    expect(map.drafts).toEqual({ b: "別の行" });
    expect(map.isEditing("a")).toBe(false);
    expect(map.isEditing("b")).toBe(true);
  });

  it("閉じた行はキーごと消し、空欄のまま開いている行とは区別する", () => {
    useDraftMap<string>().start("a", "");
    expect(useDraftMap<string>().isEditing("a")).toBe(true);
    useDraftMap<string>().stop("a");
    expect("a" in useDraftMap<string>().drafts).toBe(false);
  });

  it("下書きは文字列でなくてもよい（段階の呼び名と文章の組）", () => {
    useDraftMap<{ label: string; text: string }>().start("lv", { label: "模範", text: "周りの手本になる" });
    useDraftMap<{ label: string; text: string }>().change("lv", { label: "模範", text: "直した文章" });
    expect(useDraftMap<{ label: string; text: string }>().drafts.lv).toEqual({ label: "模範", text: "直した文章" });
  });
});
