import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  REORDER_HINT,
  REORDER_WIDTHS,
  ReorderList,
  reorderHandleLabel,
  reorderWidthTokens,
} from "@/components/reorder/ReorderList";
import {
  EDGE_SCROLL_MAX_PX,
  EDGE_SCROLL_PX,
  dragOffset,
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

  it("行の操作は本文の外の列に描き、読む順は「つまみ → 本文 → 操作 → 矢印」。null の行には列を作らない", () => {
    const withActions = renderToStaticMarkup(
      createElement(ReorderList<(typeof ITEMS)[number]>, {
        items: ITEMS,
        label: "設問の並び",
        onCommit: () => {},
        renderActions: (item) => (item.id === "b" ? null : createElement("button", { type: "button" }, `${item.label}を直す`)),
      }),
    );
    const rows = withActions.match(/<li [\s\S]*?<\/li>/g) ?? [];
    expect(rows).toHaveLength(ITEMS.length);
    expect(rows.map((row) => row.includes('class="reorder-actions"'))).toEqual([true, false, true]);
    const order = (row: string) =>
      ["reorder-handle", "reorder-body", "reorder-actions", "reorder-steps"]
        .map((name) => row.indexOf(name))
        .filter((at) => at >= 0);
    for (const row of rows) expect(order(row)).toEqual([...order(row)].sort((a, b) => a - b));
    // 操作は本文の箱の中に入れない（矢印と右端をそろえるため）
    expect(rows[0]).toMatch(/<div class="reorder-body">設問A<\/div><div class="reorder-actions">/);
  });
});

describe("一覧の幅と段組み（data-reorder-w）", () => {
  // 段組みは size container ではなく、部品が測って書く印で選ぶ（DD-005 の保険）。行が描かれなくなる不具合の根は、
  // fieldset の直下で子が出入りするのと同じフレームに size container の中身が変わること（DD-017）
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const section = css.slice(css.indexOf("/* 並べ替え（S11"), css.indexOf("/* カードの中の一覧"));

  it("超えた境目だけを、小さい順に空白で区切って書く。境目ちょうどは超えたとみなす", () => {
    expect(reorderWidthTokens(0, 16)).toBe("");
    expect(reorderWidthTokens(30 * 16 - 1, 16)).toBe("");
    expect(reorderWidthTokens(30 * 16, 16)).toBe("30");
    expect(reorderWidthTokens(37.4 * 16, 16)).toBe("30 36");
    expect(reorderWidthTokens(61.9 * 16, 16)).toBe("30 36 60");
    // 文字の大きさを変えた人には rem で測る（幅が同じでも段組みが狭い側へ寄る）
    expect(reorderWidthTokens(640, 16)).toBe("30 36");
    expect(reorderWidthTokens(640, 20)).toBe("30");
  });

  it("CSS の境目は部品の境目と同じ。測ったあとは size container を使わない", () => {
    for (const rem of REORDER_WIDTHS) {
      expect(section).toContain(`[data-reorder-w~="${rem}"]`);
      expect(section).toContain(`@container reorder (min-width: ${rem}rem)`);
    }
    const tokens = [...section.matchAll(/data-reorder-w~="(\d+)"/g)].map((m) => Number(m[1]));
    expect(new Set(tokens)).toEqual(new Set(REORDER_WIDTHS));
    // container を宣言してよいのは、まだ測っていない一覧（JS が動く前）だけ
    const containers = section.match(/^[^{}]*\{[^{}]*container:[^{}]*\}/gm) ?? [];
    expect(containers.map((rule) => rule.trim())).toEqual([".reorder-list:not([data-reorder-w]) { container: reorder / inline-size; }"]);
    // 測る前の規則は、まだ測っていない一覧にだけ当てる（測ったあとに container の規則が残らない）
    const queries = section.split("@container reorder").slice(1);
    for (const query of queries) {
      const body = query.slice(0, query.indexOf("\n}\n"));
      for (const selector of body.match(/^\s+[^\s{}][^{}]*\{/gm) ?? []) {
        if (selector.includes(".reorder-list")) expect(selector).toContain(":not([data-reorder-w])");
      }
    }
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

describe("pickOverIndex（浮いた行の行き先）", () => {
  // 高さの違う3行の置き場所（0〜50・60〜260・270〜300。真ん中は 25・160・285）
  const rows = [
    { top: 0, bottom: 50 },
    { top: 60, bottom: 260 },
    { top: 270, bottom: 300 },
  ];
  const at = (top: number, height: number) => ({ top, bottom: top + height });

  it("浮いた行の端が、向きの先にある行の真ん中を越えたら、その行の位置へ", () => {
    // 先頭の低い行（高さ50）を下へ: 下端が 160 を越えたら2番目、285 を越えたら末尾
    expect(pickOverIndex(rows, 0, at(100, 50), +1)).toBeNull();
    expect(pickOverIndex(rows, 0, at(120, 50), +1)).toBe(1);
    expect(pickOverIndex(rows, 0, at(250, 50), +1)).toBe(2);
    // 背の高い行（高さ200）を上へ: 上端が 25 を下回ったら先頭。つかんだ点が行のどこでも同じ
    expect(pickOverIndex(rows, 1, at(30, 200), -1)).toBeNull();
    expect(pickOverIndex(rows, 1, at(20, 200), -1)).toBe(0);
  });

  it("向きと逆の側は相手にしない（入れ替えた直後に入れ替わり返さない）", () => {
    // 背の高い行が低い行を越えて下へ入れ替わった直後（低い行 0〜50、背の高い行 60〜260）。
    // 少し上へ戻しても、上端が低い行の真ん中（25）を下回るまでは動かない
    const swapped = [
      { top: 0, bottom: 50 },
      { top: 60, bottom: 260 },
    ];
    expect(pickOverIndex(swapped, 1, at(40, 200), -1)).toBeNull();
    expect(pickOverIndex(rows, 1, at(20, 200), +1)).toBeNull();
    expect(pickOverIndex(rows, 1, at(100, 200), +1)).toBe(2);
    expect(pickOverIndex(rows, 1, at(20, 200), 0)).toBeNull();
    expect(pickOverIndex([], 0, at(0, 50), +1)).toBeNull();
  });
});

describe("dragOffset（持っている行を指について動かす）", () => {
  const base = { grab: 10, layoutTop: 200, height: 50, listTop: 100, listBottom: 600 };

  it("つかんだ点が指の下に来るだけずらす", () => {
    expect(dragOffset({ ...base, pointerY: 210 })).toBe(0);
    expect(dragOffset({ ...base, pointerY: 300 })).toBe(90);
    expect(dragOffset({ ...base, pointerY: 150 })).toBe(-60);
  });

  it("一覧の上端と下端の間に収める（一覧の外へ浮かせない）", () => {
    expect(dragOffset({ ...base, pointerY: 0 })).toBe(-100);
    expect(dragOffset({ ...base, pointerY: 2000 })).toBe(350);
    // 一覧より行のほうが高い（1行だけの一覧など）ときは、一覧の上端にそろえる
    expect(dragOffset({ ...base, pointerY: 2000, listBottom: 120 })).toBe(-100);
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

  it("上下に張り付いたもの（ヘッダー・操作の帯）の内側から端を数える", () => {
    // ヘッダーの下端が 100 なら、上の端の帯は 100〜156
    expect(edgeScrollSpeed(200, 800, { top: 100 })).toBe(0);
    expect(edgeScrollSpeed(120, 800, { top: 100 })).toBeLessThan(0);
    expect(edgeScrollSpeed(40, 800, { top: 100 })).toBe(-EDGE_SCROLL_MAX_PX);
    // 下に 80 の操作の帯があれば、下の端の帯は 664〜720
    expect(edgeScrollSpeed(700, 800, { bottom: 80 })).toBeGreaterThan(0);
    expect(edgeScrollSpeed(700, 800)).toBe(0);
  });

  it("その向きの一覧の端がもう見えていれば流さない", () => {
    expect(edgeScrollSpeed(10, 800, { list: { top: 5, bottom: 2000 } })).toBe(0);
    expect(edgeScrollSpeed(10, 800, { list: { top: -300, bottom: 2000 } })).toBeLessThan(0);
    expect(edgeScrollSpeed(120, 800, { top: 100, list: { top: 110, bottom: 2000 } })).toBe(0);
    expect(edgeScrollSpeed(790, 800, { list: { top: -300, bottom: 700 } })).toBe(0);
    expect(edgeScrollSpeed(790, 800, { list: { top: -300, bottom: 900 } })).toBeGreaterThan(0);
  });
});
