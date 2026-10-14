import { describe, expect, it } from "vitest";
import { REORDER_CONFLICT_MESSAGE, moveItem, renumber, reorderChanges, sameIdSet } from "@/lib/domain/reorder";

/*
 * 並べ替えの計算（S11・A10・DD-005）。
 * 3つの操作で同じ並びになることは src/components/reorder/useLongPressReorder.test.ts が確かめる。
 * ここは計算の枝を1つずつ固定する（src/lib/domain/** は網羅率100%が CI の条件）。
 */

const IDS = ["a", "b", "c", "d"] as const;

describe("moveItem", () => {
  it("下へ・上へ・同じ位置", () => {
    expect(moveItem(IDS, 1, 3)).toEqual(["a", "c", "d", "b"]);
    expect(moveItem(IDS, 2, 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveItem(IDS, 3, 3)).toEqual(IDS);
  });

  it("行き先が範囲の外なら端へ寄せる", () => {
    expect(moveItem(IDS, 1, IDS.length)).toEqual(["a", "c", "d", "b"]);
    expect(moveItem(IDS, 1, -1)).toEqual(["b", "a", "c", "d"]);
  });

  it("取り出す位置が範囲の外なら動かさず、写しを返す", () => {
    for (const from of [-1, IDS.length]) {
      const moved = moveItem(IDS, from, 0);
      expect(moved).toEqual(IDS);
      expect(moved).not.toBe(IDS);
    }
  });

  it("元の配列を変えない", () => {
    const list = ["x", "y"];
    moveItem(list, 0, 1);
    expect(list).toEqual(["x", "y"]);
  });

  it("空の並びと1件の並び", () => {
    expect(moveItem([], 0, 0)).toEqual([]);
    expect(moveItem(["a"], 0, 5)).toEqual(["a"]);
  });
});

describe("sameIdSet", () => {
  it("順番だけが違うなら同じ集まり", () => {
    expect(sameIdSet(IDS, ["b", "d", "a", "c"])).toBe(true);
    expect(sameIdSet([], [])).toBe(true);
  });

  it("足りない・多い・知らない id・重複は、どれも違う集まり（サーバーは 409）", () => {
    expect(sameIdSet(IDS, ["a", "b", "c"])).toBe(false);
    expect(sameIdSet(IDS, ["a", "b", "c", "d", "e"])).toBe(false);
    expect(sameIdSet(IDS, ["a", "b", "c", "x"])).toBe(false);
    expect(sameIdSet(IDS, ["a", "b", "d", "d"])).toBe(false);
  });

  it("409 の言葉は、再読み込みすれば直ることを伝える", () => {
    expect(REORDER_CONFLICT_MESSAGE).toContain("再読み込み");
  });
});

describe("renumber", () => {
  it("並びの順に1から間を空けずに振る", () => {
    expect(renumber(["d", "b", "a"])).toEqual([
      { id: "d", displayOrder: 1 },
      { id: "b", displayOrder: 2 },
      { id: "a", displayOrder: 3 },
    ]);
    expect(renumber([])).toEqual([]);
  });
});

describe("reorderChanges", () => {
  // 今の番号は間が空いていてもよい（使っていない行が間の番号を持っている）
  const current = [
    { id: "a", displayOrder: 1 },
    { id: "b", displayOrder: 2 },
    { id: "c", displayOrder: 5 },
  ];

  it("今の番号の集まりを新しい並びへ配り直し、番号が変わった行だけを前の番号つきで返す", () => {
    expect(reorderChanges(current, ["c", "a", "b"])).toEqual([
      { id: "c", before: 5, displayOrder: 1 },
      { id: "a", before: 1, displayOrder: 2 },
      { id: "b", before: 2, displayOrder: 5 },
    ]);
    // 動かない行（c）は書かない
    expect(reorderChanges(current, ["b", "a", "c"])).toEqual([
      { id: "b", before: 2, displayOrder: 1 },
      { id: "a", before: 1, displayOrder: 2 },
    ]);
  });

  it("並びが今と同じなら空の配列（書かない）", () => {
    expect(reorderChanges(current, ["a", "b", "c"])).toEqual([]);
  });

  it("今の番号に重複があれば1から振り直す", () => {
    const broken = [
      { id: "a", displayOrder: 1 },
      { id: "b", displayOrder: 1 },
      { id: "c", displayOrder: 2 },
    ];
    expect(reorderChanges(broken, ["a", "b", "c"])).toEqual([
      { id: "b", before: 1, displayOrder: 2 },
      { id: "c", before: 2, displayOrder: 3 },
    ]);
  });

  it("id の集まりが違えば null（ほかの人が足した・消した）", () => {
    expect(reorderChanges(current, ["a", "b"])).toBeNull();
    expect(reorderChanges(current, ["a", "b", "x"])).toBeNull();
    expect(reorderChanges(current, ["a", "a", "b"])).toBeNull();
  });
});
