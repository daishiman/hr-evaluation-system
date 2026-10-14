import { describe, expect, it } from "vitest";
import {
  REORDER_CONFLICT_MESSAGE,
  moveItem,
  renumber,
  sameIdSet,
} from "@/lib/domain/reorder";
import {
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
  initialReorderState,
  reorderReducer,
  type ReorderEvent,
  type ReorderState,
} from "@/components/reorder/useLongPressReorder";

/*
 * 並べ替え（S11・A10）。
 *
 * hook の中身は状態遷移の関数（reorderReducer）に寄せ、DOM の無い環境でも
 * ポインター（マウス）・タッチ（長押し）・キーボードの3つの操作で同じ並びになることを確かめる。
 * サーバーは並び全体（id の配列）を受け取り、今の id の集まりと違えば 409 にする。
 */

const IDS = ["a", "b", "c", "d"];

function run(events: ReorderEvent[], state: ReorderState = initialReorderState(IDS)): ReorderState {
  return events.reduce(reorderReducer, state);
}

describe("reorder（並びの計算）", () => {
  it("moveItem は1つを取り出して指定の位置へ入れる", () => {
    expect(moveItem(IDS, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(IDS, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(IDS, 1, 1)).toEqual(IDS);
    // 範囲の外は端へ寄せる
    expect(moveItem(IDS, 0, 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveItem(IDS, 2, -5)).toEqual(["c", "a", "b", "d"]);
    // 元の配列は変えない
    expect(IDS).toEqual(["a", "b", "c", "d"]);
  });

  it("sameIdSet は過不足・重複があれば false（サーバーは 409 にする）", () => {
    expect(sameIdSet(IDS, ["d", "c", "b", "a"])).toBe(true);
    expect(sameIdSet(IDS, ["a", "b", "c"])).toBe(false);
    expect(sameIdSet(IDS, ["a", "b", "c", "e"])).toBe(false);
    expect(sameIdSet(IDS, ["a", "a", "b", "c"])).toBe(false);
    expect(REORDER_CONFLICT_MESSAGE).toContain("再読み込み");
  });

  it("renumber は display_order を1から振り直す", () => {
    expect(renumber(["c", "a"])).toEqual([
      { id: "c", displayOrder: 1 },
      { id: "a", displayOrder: 2 },
    ]);
  });
});

describe("3つの操作で同じ並びになる", () => {
  const expected = ["b", "c", "a", "d"];

  it("マウス: 押した時点で持ち上げ、動かして離すと置く", () => {
    const s = run([
      { type: "pointerdown", pointerType: "mouse", index: 0, x: 10, y: 10 },
      { type: "pointermove", x: 10, y: 80, overIndex: 2 },
      { type: "pointerup" },
    ]);
    expect(s.order).toEqual(expected);
    expect(s.phase).toBe("idle");
    expect(s.committed).toEqual(expected);
  });

  it(`タッチ: ${LONG_PRESS_MS}ms 押し続けると持ち上げる`, () => {
    const pressing = run([{ type: "pointerdown", pointerType: "touch", index: 0, x: 10, y: 10 }]);
    expect(pressing.phase).toBe("pressing");
    const s = run(
      [
        { type: "longpress" },
        { type: "pointermove", x: 10, y: 80, overIndex: 2 },
        { type: "pointerup" },
      ],
      pressing,
    );
    expect(s.order).toEqual(expected);
    expect(s.committed).toEqual(expected);
  });

  it("キーボード: Space で持ち上げ、↓で動かし、Space で置く。動かすたびに読み上げる", () => {
    const lifted = run([{ type: "keydown", key: " ", index: 0 }]);
    expect(lifted.phase).toBe("keyboard");
    const moved = run([{ type: "keydown", key: "ArrowDown", index: 0 }, { type: "keydown", key: "ArrowDown", index: 1 }], lifted);
    expect(moved.announcement).toBe("3番目に移動しました");
    const s = run([{ type: "keydown", key: " ", index: 2 }], moved);
    expect(s.order).toEqual(expected);
    expect(s.committed).toEqual(expected);
  });
});

describe("持ち上げない・元に戻す", () => {
  it(`待つ間に ${MOVE_TOLERANCE_PX}px 以上動けばスクロールとみなして持ち上げない`, () => {
    const s = run([
      { type: "pointerdown", pointerType: "touch", index: 0, x: 10, y: 10 },
      { type: "pointermove", x: 10, y: 10 + MOVE_TOLERANCE_PX, overIndex: 0 },
      { type: "longpress" },
    ]);
    expect(s.phase).toBe("idle");
    expect(s.order).toEqual(IDS);
    expect(s.committed).toBeNull();
  });

  it("8px 未満の揺れでは長押しを続ける", () => {
    const s = run([
      { type: "pointerdown", pointerType: "touch", index: 1, x: 10, y: 10 },
      { type: "pointermove", x: 13, y: 16, overIndex: 1 },
      { type: "longpress" },
    ]);
    expect(s.phase).toBe("dragging");
  });

  it("待つ間に pointercancel が来たら（ブラウザがスクロールを始めた）持ち上げずに終える", () => {
    const s = run([
      { type: "pointerdown", pointerType: "touch", index: 0, x: 10, y: 10 },
      { type: "pointercancel" },
      { type: "longpress" },
    ]);
    expect(s.phase).toBe("idle");
    expect(s.committed).toBeNull();
  });

  it("持ち上げたあとの pointercancel と Esc は元の並びへ戻す", () => {
    const dragging = run([
      { type: "pointerdown", pointerType: "mouse", index: 0, x: 0, y: 0 },
      { type: "pointermove", x: 0, y: 90, overIndex: 3 },
    ]);
    expect(dragging.order).toEqual(["b", "c", "d", "a"]);
    for (const cancel of [{ type: "pointercancel" }, { type: "keydown", key: "Escape", index: 3 }] as ReorderEvent[]) {
      const s = reorderReducer(dragging, cancel);
      expect(s.order).toEqual(IDS);
      expect(s.phase).toBe("idle");
      expect(s.committed).toBeNull();
    }
  });

  it("キーボードで持ち上げていないときの矢印キーは何もしない", () => {
    const s = run([{ type: "keydown", key: "ArrowDown", index: 0 }]);
    expect(s.order).toEqual(IDS);
    expect(s.phase).toBe("idle");
  });
});
