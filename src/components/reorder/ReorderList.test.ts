import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REORDER_HINT, ReorderList, reorderHandleLabel } from "@/components/reorder/ReorderList";
import {
  EDGE_SCROLL_MAX_PX,
  EDGE_SCROLL_PX,
  edgeScrollSpeed,
  initialReorderState,
  pickOverIndex,
  reorderReducer,
  type ReorderEvent,
  type ReorderState,
} from "@/components/reorder/useLongPressReorder";

/*
 * 並べ替えの部品（S11・DD-005）。
 * 3つの操作の契約は useLongPressReorder.test.ts。ここは、その外側
 * （矢印のボタン・保存の失敗・外からの並びの差し替え・指の下の行の選び方・読み上げの名前）を固定する。
 */

const IDS = ["a", "b", "c", "d"];
const ITEMS = [
  { id: "a", label: "設問A" },
  { id: "b", label: "設問B" },
  { id: "c", label: "設問C" },
];

function run(events: ReorderEvent[], state: ReorderState = initialReorderState(IDS)): ReorderState {
  return events.reduce(reorderReducer, state);
}

/** 描いた HTML の <button ...> の開きタグ（属性の並び順に頼らずに調べる） */
function buttons(html: string): string[] {
  return html.match(/<button [^>]*>/g) ?? [];
}

function render(busy = false): string {
  return renderToStaticMarkup(createElement(ReorderList, { items: ITEMS, label: "設問の並び", onCommit: () => {}, busy }));
}

describe("ReorderList の読み上げと押せる場所", () => {
  const html = render();

  it("つまみは「n番目『…』を並べ替え」で、使い方を aria-describedby で読む", () => {
    const names = [...html.matchAll(/aria-label="([^"]*を並べ替え)"/g)].map((m) => m[1]);
    expect(names).toEqual(["1番目『設問A』を並べ替え", "2番目『設問B』を並べ替え", "3番目『設問C』を並べ替え"]);
    expect(reorderHandleLabel(2, "設問B")).toBe(names[1]);
    // e2e はこの形でつまみだけを拾う（矢印のボタンを拾わない）
    const e2e = /番目『.+』を並べ替え$/;
    const all = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(all.filter((name) => e2e.test(name))).toEqual(names);

    const hintId = /<p id="([^"]+)" hidden="">/.exec(html)?.[1];
    expect(hintId).toBeTruthy();
    expect(html.match(new RegExp(`aria-describedby="${hintId}"`, "g"))).toHaveLength(ITEMS.length);
    expect(html).toContain(REORDER_HINT);
  });

  it("矢印のボタンは4つずつ。端の行では動けない向きだけ押せない", () => {
    expect(html.match(/data-reorder-action=/g)).toHaveLength(ITEMS.length * 4);
    expect(html).toContain('aria-label="『設問B』を1つ上に移動"');
    const disabled = buttons(html)
      .filter((tag) => tag.includes('disabled=""'))
      .map((tag) => /aria-label="([^"]+)"/.exec(tag)?.[1]);
    expect(disabled).toEqual(["『設問A』を先頭に移動", "『設問A』を1つ上に移動", "『設問C』を1つ下に移動", "『設問C』を末尾に移動"]);
  });

  it("ボタンはフォームを送らない。読み上げの場所がある", () => {
    expect(buttons(html).filter((tag) => !tag.includes('type="button"'))).toEqual([]);
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('aria-label="設問の並び"');
  });

  it("保存中は押せないことを伝えるが、フォーカスは外さない（disabled にしない）", () => {
    const saving = render(true);
    expect(saving).toContain('aria-busy="true"');
    expect(saving.match(/aria-disabled="true"/g)).toHaveLength(ITEMS.length * 5);
    expect(saving.match(/disabled=""/g)).toHaveLength(4);
  });
});

describe("矢印のボタン・保存の失敗・外からの差し替え", () => {
  it("矢印のボタンは1回で置き、並び全体を保存に回す", () => {
    const s = run([{ type: "step", index: 3, to: 0 }]);
    expect(s.order).toEqual(["d", "a", "b", "c"]);
    expect(s.committed).toEqual(["d", "a", "b", "c"]);
    expect(s.origin).toEqual(IDS);
    expect(s.announcement).toBe("1番目に移動しました");
    // 動かない・範囲の外・持ち上げている最中は何もしない
    const idle = initialReorderState(IDS);
    expect(reorderReducer(idle, { type: "step", index: 0, to: -1 })).toBe(idle);
    expect(reorderReducer(idle, { type: "step", index: 9, to: 0 })).toBe(idle);
    const lifted = run([{ type: "keydown", key: " ", index: 0 }]);
    expect(reorderReducer(lifted, { type: "step", index: 1, to: 0 })).toBe(lifted);
  });

  it("保存に失敗したら置く前の並びへ戻す。別の置き方のあとに届いた失敗では戻さない", () => {
    const dropped = run([{ type: "step", index: 0, to: 2 }]);
    const reverted = reorderReducer(dropped, { type: "revert", committed: dropped.committed ?? [] });
    expect(reverted.order).toEqual(IDS);
    expect(reverted.committed).toBeNull();
    expect(reverted.announcement).toContain("元の並びに戻しました");
    expect(reorderReducer(dropped, { type: "revert", committed: [...(dropped.committed ?? [])] })).toBe(dropped);
  });

  it("外から並びが変わったら、持ち上げていても捨てて合わせる（読み上げは残す）", () => {
    const lifted = run([{ type: "keydown", key: " ", index: 1 }]);
    const s = reorderReducer(lifted, { type: "reset", ids: ["c", "a"] });
    expect(s.phase).toBe("idle");
    expect(s.order).toEqual(["c", "a"]);
    expect(s.announcement).toBe(lifted.announcement);
  });
});

describe("キーボードの細部", () => {
  const lifted = run([{ type: "keydown", key: " ", index: 1 }]);

  it("Home・End で端へ。端で止まったことも読み上げる", () => {
    expect(reorderReducer(lifted, { type: "keydown", key: "Home", index: 1 }).order).toEqual(["b", "a", "c", "d"]);
    const end = reorderReducer(lifted, { type: "keydown", key: "End", index: 1 });
    expect(end.order).toEqual(["a", "c", "d", "b"]);
    expect(reorderReducer(end, { type: "keydown", key: "ArrowDown", index: 3 }).announcement).toBe("これ以上は下へ動かせません");
    const top = reorderReducer(lifted, { type: "keydown", key: "ArrowUp", index: 1 });
    expect(reorderReducer(top, { type: "keydown", key: "ArrowUp", index: 0 }).announcement).toBe("これ以上は上へ動かせません");
  });

  it("動かさずに置けば保存しない。Enter でも置ける", () => {
    const s = reorderReducer(lifted, { type: "keydown", key: "Enter", index: 1 });
    expect(s.phase).toBe("idle");
    expect(s.committed).toBeNull();
    expect(s.announcement).toBe("元の位置に置きました");
  });

  it("持ち上げたままフォーカスが外れたら取り消す。受け取らないキーは同じ state を返す", () => {
    const moved = reorderReducer(lifted, { type: "keydown", key: "ArrowDown", index: 1 });
    const blurred = reorderReducer(moved, { type: "blur" });
    expect(blurred.order).toEqual(IDS);
    expect(blurred.phase).toBe("idle");
    expect(reorderReducer(lifted, { type: "keydown", key: "Tab", index: 1 })).toBe(lifted);
    const idle = initialReorderState(IDS);
    expect(reorderReducer(idle, { type: "blur" })).toBe(idle);
  });
});

describe("ポインターの細部", () => {
  it("押している最中のもう1本の指・長押しを待つ間の Esc", () => {
    const pressing = run([{ type: "pointerdown", pointerType: "touch", index: 2, x: 0, y: 0 }]);
    expect(reorderReducer(pressing, { type: "pointerdown", pointerType: "touch", index: 0, x: 0, y: 0 })).toBe(pressing);
    const escaped = reorderReducer(pressing, { type: "keydown", key: "Escape", index: 2 });
    expect(escaped.phase).toBe("idle");
    expect(escaped.announcement).toBe("");
    expect(reorderReducer(escaped, { type: "longpress" }).phase).toBe("idle");
  });

  it("行と行の間（overIndex が null）では動かさない", () => {
    const dragging = run([{ type: "pointerdown", pointerType: "mouse", index: 0, x: 0, y: 0 }]);
    expect(reorderReducer(dragging, { type: "pointermove", x: 0, y: 30, overIndex: null })).toBe(dragging);
    // 持ち上げている最中の Esc 以外のキーは受け取らない（キーの既定の動きを止めない）
    expect(reorderReducer(dragging, { type: "keydown", key: "ArrowDown", index: 0 })).toBe(dragging);
  });

  it("長押しになる前に指を離したら、持ち上げず保存もしない", () => {
    const pressing = run([{ type: "pointerdown", pointerType: "pen", index: 1, x: 0, y: 0 }]);
    expect(reorderReducer(pressing, { type: "keydown", key: " ", index: 1 })).toBe(pressing);
    const s = run([{ type: "pointerup" }, { type: "longpress" }], pressing);
    expect(s.phase).toBe("idle");
    expect(s.order).toEqual(IDS);
    expect(s.committed).toBeNull();
  });

  it("何もしていないときに届いた離す・取り消す・動かすの知らせは無視する", () => {
    const idle = initialReorderState(IDS);
    for (const event of [
      { type: "pointerup" },
      { type: "pointercancel" },
      { type: "pointermove", x: 0, y: 0, overIndex: 2 },
      { type: "longpress" },
    ] as ReorderEvent[]) {
      expect(reorderReducer(idle, event)).toBe(idle);
    }
  });
});

describe("キーボードで持ち上げたあとの Esc", () => {
  it("何段動かしていても、持ち上げる前の並びへ戻す", () => {
    const s = run([
      { type: "keydown", key: " ", index: 0 },
      { type: "keydown", key: "End", index: 0 },
      { type: "keydown", key: "Escape", index: 3 },
    ]);
    expect(s.order).toEqual(IDS);
    expect(s.phase).toBe("idle");
    expect(s.committed).toBeNull();
    expect(s.announcement).toBe("並べ替えを取り消し、元の並びに戻しました");
  });

  it("位置を失った状態でも、押されたつまみの位置から動かす", () => {
    const s = reorderReducer(
      { ...initialReorderState(IDS), phase: "keyboard" },
      { type: "keydown", key: "ArrowDown", index: 1 },
    );
    expect(s.order).toEqual(["a", "c", "b", "d"]);
  });
});

describe("pickOverIndex（指の下の行）", () => {
  // 高さの違う3行（0〜50・60〜260・270〜300。行の間に10pxの隙間）
  const rows = [
    { top: 0, bottom: 50 },
    { top: 60, bottom: 260 },
    { top: 270, bottom: 300 },
  ];

  it("向きの先にある行だけを選ぶ（入れ替え直後の揺り戻しを防ぐ）", () => {
    expect(pickOverIndex(rows, 0, 100, +1)).toBe(1);
    expect(pickOverIndex(rows, 1, 20, +1)).toBeNull();
    expect(pickOverIndex(rows, 1, 20, -1)).toBe(0);
    expect(pickOverIndex(rows, 0, 100, -1)).toBeNull();
    expect(pickOverIndex(rows, 1, 100, 0)).toBeNull();
  });

  it("一覧の上なら先頭、下なら末尾、行の間と空の一覧では決めない", () => {
    expect(pickOverIndex(rows, 2, -40, -1)).toBe(0);
    expect(pickOverIndex(rows, 0, 900, +1)).toBe(2);
    expect(pickOverIndex(rows, 0, 55, +1)).toBeNull();
    expect(pickOverIndex([], 0, 10, +1)).toBeNull();
  });
});

describe("edgeScrollSpeed（端での自動スクロール）", () => {
  it("端に近いほど速く、端から遠ければ止まる。画面の外でも上限を超えない", () => {
    expect(edgeScrollSpeed(400, 800)).toBe(0);
    expect(edgeScrollSpeed(EDGE_SCROLL_PX, 800)).toBe(0);
    expect(edgeScrollSpeed(0, 800)).toBe(-EDGE_SCROLL_MAX_PX);
    expect(edgeScrollSpeed(-100, 800)).toBe(-EDGE_SCROLL_MAX_PX);
    expect(edgeScrollSpeed(800, 800)).toBe(EDGE_SCROLL_MAX_PX);
    expect(edgeScrollSpeed(2000, 800)).toBe(EDGE_SCROLL_MAX_PX);
    const near = edgeScrollSpeed(800 - EDGE_SCROLL_PX / 2, 800);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(EDGE_SCROLL_MAX_PX);
  });
});
