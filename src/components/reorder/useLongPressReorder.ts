"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { moveItem } from "@/lib/domain/reorder";
import { PINNED_CARD_HEAD_CLASS, STICKY_PAGE_HEAD_SELECTOR } from "@/components/ui";

/**
 * 長押しで並べ替える（S11・A10・DD-005）。
 *
 * 状態の移り変わりは reorderReducer（純粋な関数）に寄せ、DOM の無い試験でも
 * マウス・タッチ（長押し）・キーボードの3つの操作で同じ並びになることを確かめる。
 * hook が受け持つのは、長押しのタイマー・ポインターの捕捉・指の下の行の判定・端での自動スクロールと、
 * 見た目の動き（持っている行を指について浮かせる・ほかの行を滑らせる）だけ。
 */

/** タッチで、動かさずに押し続けて持ち上げるまでの時間 */
export const LONG_PRESS_MS = 350;
/** 持ち上げる前にこれだけ動いたら、並べ替えではなくスクロールのつもりとみなす */
export const MOVE_TOLERANCE_PX = 8;
/** 画面の上下の端からこの距離に入ったら、その向きへ自動でスクロールする */
export const EDGE_SCROLL_PX = 56;
/** 自動スクロールの1コマあたりの最大量 */
export const EDGE_SCROLL_MAX_PX = 16;
/** 並びが変わったときに、ほかの行が新しい位置へ滑る時間 */
export const SLIDE_MS = 180;
const SLIDE_ID = "reorder-slide";
/** 画面の上に張り付いて一覧を覆うもの（ヘッダー・固定した見出しの帯・カードの頭）。自動スクロールの上端はこの下 */
const STICKY_SELECTOR = `.app-header, ${STICKY_PAGE_HEAD_SELECTOR}, .${PINNED_CARD_HEAD_CLASS}`;

/** つまみの印。フォーカスの行き先を探すのに使う */
export const HANDLE_ATTR = "data-reorder-handle";

export type ReorderPhase =
  // 何もしていない
  | "idle"
  // 指で押して、長押しになるのを待っている
  | "pressing"
  // ポインター（マウス・指）で持ち上げている
  | "dragging"
  // キーボードで持ち上げている
  | "keyboard";

export type ReorderState = {
  phase: ReorderPhase;
  /** 画面に出す並び（持ち上げている間は、置く予定の位置へ動かしたもの） */
  order: string[];
  /** 持ち上げる前の並び。取り消し・保存の失敗はここへ戻す */
  origin: string[];
  /** 押している・持ち上げている項目の、いまの位置 */
  active: number | null;
  /** 押し始めた位置（長押しを待つ間の揺れを測る） */
  start: { x: number; y: number } | null;
  /** 置いて並びが変わったときの並び。これが新しくなったら保存する */
  committed: string[] | null;
  /** aria-live で読み上げる文 */
  announcement: string;
};

export type ReorderEvent =
  | { type: "pointerdown"; pointerType: string; index: number; x: number; y: number }
  | { type: "longpress" }
  // overIndex は指（ポインター）の下の行の位置。行と行の間などで決まらなければ null
  | { type: "pointermove"; x: number; y: number; overIndex: number | null }
  | { type: "pointerup" }
  | { type: "pointercancel" }
  | { type: "keydown"; key: string; index: number }
  // キーボードで持ち上げたまま、つまみからフォーカスが外れた
  | { type: "blur" }
  // 矢印のボタン（先頭・上・下・末尾）。持ち上げずに1回で動かして置く
  | { type: "step"; index: number; to: number }
  // 外から渡された並びが変わった（保存のあとの再読み込み・ほかのタブでの変更）
  | { type: "reset"; ids: readonly string[] }
  // 保存できなかった。committed が今のものと同じときだけ、置く前の並びへ戻す
  | { type: "revert"; committed: string[] };

export function initialReorderState(ids: readonly string[]): ReorderState {
  return {
    phase: "idle",
    order: [...ids],
    origin: [...ids],
    active: null,
    start: null,
    committed: null,
    announcement: "",
  };
}

const KEYBOARD_GUIDE = "↑↓で動かし、Space か Enter で置きます。Esc で元に戻します。";

function lift(state: ReorderState, phase: "dragging" | "keyboard", index: number): ReorderState {
  return {
    ...state,
    phase,
    origin: state.order,
    active: index,
    committed: null,
    announcement: `${index + 1}番目の項目を持ち上げました。${phase === "keyboard" ? KEYBOARD_GUIDE : ""}`,
  };
}

/** 長押しを待つのをやめる（何も動かしていないので、読み上げも変えない） */
function stop(state: ReorderState): ReorderState {
  return { ...state, phase: "idle", active: null, start: null };
}

function cancel(state: ReorderState): ReorderState {
  return {
    ...state,
    phase: "idle",
    order: state.origin,
    active: null,
    start: null,
    committed: null,
    announcement: "並べ替えを取り消し、元の並びに戻しました",
  };
}

/** from の項目を to へ動かす。動かなければ同じ state を返す（呼び手が「何もしなかった」と分かる） */
function moveTo(state: ReorderState, from: number, to: number): ReorderState {
  const last = state.order.length - 1;
  if (from < 0 || from > last) return state;
  const target = Math.min(Math.max(to, 0), last);
  if (target === from) return state;
  return {
    ...state,
    order: moveItem(state.order, from, target),
    active: target,
    announcement: `${target + 1}番目に移動しました`,
  };
}

/** キーボードは端で止まったことも読み上げる（何も言わないと、効いていないのか分からない） */
function keyboardMove(state: ReorderState, from: number, to: number, toward: "上" | "下"): ReorderState {
  const moved = moveTo(state, from, to);
  return moved !== state ? moved : { ...state, announcement: `これ以上は${toward}へ動かせません` };
}

function drop(state: ReorderState, at: number): ReorderState {
  const changed = state.order.some((id, i) => id !== state.origin[i]);
  return {
    ...state,
    phase: "idle",
    active: null,
    start: null,
    // origin は残す。保存に失敗したら revert でここへ戻す
    committed: changed ? state.order : null,
    announcement: changed ? `${at + 1}番目に置きました` : "元の位置に置きました",
  };
}

function keydown(state: ReorderState, key: string, index: number): ReorderState {
  switch (state.phase) {
    case "idle":
      return key === " " ? lift(state, "keyboard", index) : state;
    case "pressing":
      return key === "Escape" ? stop(state) : state;
    case "dragging":
      return key === "Escape" ? cancel(state) : state;
    case "keyboard":
      break;
  }
  const at = state.active ?? index;
  switch (key) {
    case "ArrowUp":
      return keyboardMove(state, at, at - 1, "上");
    case "ArrowDown":
      return keyboardMove(state, at, at + 1, "下");
    case "Home":
      return keyboardMove(state, at, 0, "上");
    case "End":
      return keyboardMove(state, at, state.order.length - 1, "下");
    case " ":
    case "Enter":
      return drop(state, at);
    case "Escape":
      return cancel(state);
    default:
      return state;
  }
}

/**
 * 並べ替えの状態の移り変わり。受け取らない出来事には、同じ state をそのまま返す
 * （hook はそれを見て、キーの既定の動きを止めるかどうかを決める）。
 */
export function reorderReducer(state: ReorderState, event: ReorderEvent): ReorderState {
  switch (event.type) {
    case "pointerdown": {
      if (state.phase !== "idle") return state;
      const start = { x: event.x, y: event.y };
      // マウスは押した時点で持ち上げる。指は長押しを待つ（すぐ動かすのはスクロール）
      if (event.pointerType === "mouse") return { ...lift(state, "dragging", event.index), start };
      return { ...state, phase: "pressing", active: event.index, start, committed: null };
    }
    case "longpress":
      return state.phase === "pressing" && state.active !== null ? lift(state, "dragging", state.active) : state;
    case "pointermove":
      if (state.phase === "pressing" && state.start) {
        const moved = Math.hypot(event.x - state.start.x, event.y - state.start.y);
        return moved >= MOVE_TOLERANCE_PX ? stop(state) : state;
      }
      if (state.phase === "dragging" && state.active !== null && event.overIndex !== null) {
        return moveTo(state, state.active, event.overIndex);
      }
      return state;
    case "pointerup":
      if (state.phase === "pressing") return stop(state);
      return state.phase === "dragging" && state.active !== null ? drop(state, state.active) : state;
    case "pointercancel":
      if (state.phase === "pressing") return stop(state);
      return state.phase === "dragging" ? cancel(state) : state;
    case "keydown":
      return keydown(state, event.key, event.index);
    case "blur":
      return state.phase === "keyboard" ? cancel(state) : state;
    case "step": {
      if (state.phase !== "idle") return state;
      const moved = moveTo(state, event.index, event.to);
      if (moved === state) return state;
      return { ...moved, active: null, origin: state.order, committed: moved.order };
    }
    case "reset":
      return { ...initialReorderState(event.ids), announcement: state.announcement };
    case "revert":
      if (state.phase !== "idle" || state.committed !== event.committed) return state;
      return { ...state, order: state.origin, committed: null, announcement: "保存できなかったため、元の並びに戻しました" };
  }
}

/**
 * 浮かせて動かしている行（dragged）の位置から、行き先を選ぶ。rows は置き場所（配置の上での位置）で、active は持っている行。
 * 下へ動かしているときは、浮いた行の下端が越えた行のうち一番下の行へ。上へは、上端が越えた行のうち一番上の行へ。
 * 越えたかは相手の行の真ん中で決める。つかんだ点（つまみは行の頭にある）によらず、上へも下へも半分重なれば入れ替わる。
 * 向きと逆の側は相手にしないので、高さの違う行どうしで、入れ替えた直後にまた入れ替わり返すことがない。
 */
export function pickOverIndex(
  rows: readonly { top: number; bottom: number }[],
  active: number,
  dragged: { top: number; bottom: number },
  dy: number,
): number | null {
  const middle = (row: { top: number; bottom: number }) => (row.top + row.bottom) / 2;
  if (dy > 0) {
    for (let j = rows.length - 1; j > active; j--) if (dragged.bottom > middle(rows[j])) return j;
  } else if (dy < 0) {
    for (let j = 0; j < active && j < rows.length; j++) if (dragged.top < middle(rows[j])) return j;
  }
  return null;
}

/**
 * 画面の端に近いほど速くスクロールする量。上は負、下は正、端から遠ければ 0。
 * top・bottom は上下に張り付いて画面を覆っている分（ヘッダー・下の操作の帯）で、端はその内側から数える。
 * list を渡すと、その向きの一覧の端がもう見えているときは流さない（一覧の外まで画面を送らない）。
 */
export function edgeScrollSpeed(
  y: number,
  viewportHeight: number,
  { top = 0, bottom = 0, list }: { top?: number; bottom?: number; list?: { top: number; bottom: number } } = {},
): number {
  const ramp = (depth: number) => Math.ceil((EDGE_SCROLL_MAX_PX * Math.min(depth, EDGE_SCROLL_PX)) / EDGE_SCROLL_PX);
  const upper = top + EDGE_SCROLL_PX;
  const lower = viewportHeight - bottom - EDGE_SCROLL_PX;
  if (y < upper) return list && list.top >= top ? 0 : -ramp(upper - y);
  if (y > lower) return list && list.bottom <= viewportHeight - bottom ? 0 : ramp(y - lower);
  return 0;
}

/**
 * 持っている行を、指（ポインター）について動かすずらし量。
 * 行の置き場所（layoutTop）から、つかんだ点が指の下に来る位置までの差を、一覧の上端と下端の間に収める。
 */
export function dragOffset({
  pointerY,
  grab,
  layoutTop,
  height,
  listTop,
  listBottom,
}: {
  pointerY: number;
  /** 押したときの、行の上端からつかんだ点までの距離 */
  grab: number;
  layoutTop: number;
  height: number;
  listTop: number;
  listBottom: number;
}): number {
  const wanted = pointerY - grab;
  const top = Math.min(Math.max(wanted, listTop), Math.max(listTop, listBottom - height));
  return top - layoutTop;
}

/** 画面の上に張り付いているもの（ヘッダーなど）の下端。sticky の top の位置に止まっているものだけを数える */
function stuckTop(): number {
  let edge = 0;
  for (const el of document.querySelectorAll<HTMLElement>(STICKY_SELECTOR)) {
    const style = getComputedStyle(el);
    if (style.position !== "sticky" && style.position !== "fixed") continue;
    const rect = el.getBoundingClientRect();
    // sticky の top は、配置の済んだ要素では px の値で返る（calc(var(--header-h) + 8px) のような指定でも）
    const offset = parseFloat(style.top);
    if (rect.height > 0 && Number.isFinite(offset) && Math.abs(rect.top - offset) <= 1) edge = Math.max(edge, rect.bottom);
  }
  // 張り付いたものが画面の大半を覆う狭い画面でも、上へ流せる余地は残す
  return Math.min(edge, window.innerHeight * 0.4);
}

/** 画面の下に張り付いている操作の帯の高さ（StickyActionBar が --action-bar-height に px で書く） */
function stuckBottom(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--action-bar-height"));
  return Number.isFinite(value) ? value : 0;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 行の置き場所（ずらし・滑らせる動きを除いた、配置の上での位置）。一覧（position: relative）からの距離で測る */
function layoutRects(list: HTMLOListElement): { top: number; bottom: number }[] {
  const origin = list.getBoundingClientRect().top;
  return Array.from(list.children, (row) => {
    const el = row as HTMLElement;
    const top = origin + el.offsetTop;
    return { top, bottom: top + el.offsetHeight };
  });
}

type Options = {
  /** 外から渡す並び（id の配列）。変わったら、手元の並びを捨ててこれに合わせる */
  ids: readonly string[];
  /** 並びが変わって置かれたときに呼ぶ。false を返したら（解決したら）置く前の並びへ戻す */
  onCommit: (ids: string[]) => void | boolean | Promise<void | boolean>;
  /** 保存中など、新しく持ち上げさせないとき */
  busy?: boolean;
};

/**
 * 一覧（ol）の直下の子を1行として扱う。つまみには handleProps(index) を、一覧には listProps を渡す。
 * 持ち上げている間も行は DOM の中で実際に動かし（置く位置がそのまま見える）、置いたら onCommit へ並び全体を渡す。
 */
export function useLongPressReorder({ ids, onCommit, busy = false }: Options) {
  const [state, dispatch] = useReducer(reorderReducer, ids, initialReorderState);

  // 外の並びが変わったら合わせる（保存後や 409 のあとの再読み込み・ほかのタブでの変更）。
  // effect で合わせると古い並びが1回描かれるので、描画の途中で合わせる。
  const key = JSON.stringify(ids);
  const [syncedKey, setSyncedKey] = useState(key);
  if (syncedKey !== key) {
    setSyncedKey(key);
    dispatch({ type: "reset", ids });
  }

  const listRef = useRef<HTMLOListElement>(null);
  const stateRef = useRef(state);
  const onCommitRef = useRef(onCommit);
  /** 捕まえているポインターと、最後に見た位置 */
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  /** 押したときの、行の上端からつかんだ点までの距離（浮いた行は、この点が指の下に来るように動く） */
  const grabRef = useRef(0);
  /** 並びが変わる直前の、行ごとの見えている位置（id → 一覧の上端からの距離）。描き直したあと、ここから滑らせる */
  const slideFromRef = useRef<Map<string, number> | null>(null);
  /** ずらし（--reorder-dy）を書いた行。持つのをやめたら消す */
  const placedRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    stateRef.current = state;
    onCommitRef.current = onCommit;
  });

  /** 持っている行の、指（ポインター）について浮かせた位置。置き場所と一覧の端も一緒に返す */
  const floating = useCallback((pointerY: number) => {
    const list = listRef.current;
    const { phase, active } = stateRef.current;
    if (!list || phase !== "dragging" || active === null) return null;
    const row = list.children[active] as HTMLElement | undefined;
    if (!row) return null;
    const box = list.getBoundingClientRect();
    const layoutTop = box.top + row.offsetTop;
    const height = row.offsetHeight;
    const offset = dragOffset({ pointerY, grab: grabRef.current, layoutTop, height, listTop: box.top, listBottom: box.bottom });
    return { list, row, active, offset, top: layoutTop + offset, height };
  }, []);

  /** 持っている行を指の位置へずらし、置き場所の目印をその行の置き場所へ合わせる */
  const place = useCallback(() => {
    const pointer = pointerRef.current;
    const at = pointer ? floating(pointer.y) : null;
    if (!at) return;
    if (placedRef.current && placedRef.current !== at.row) placedRef.current.style.removeProperty("--reorder-dy");
    placedRef.current = at.row;
    at.row.style.setProperty("--reorder-dy", `${at.offset}px`);
    at.list.style.setProperty("--reorder-slot-top", `${at.row.offsetTop}px`);
    at.list.style.setProperty("--reorder-slot-h", `${at.height}px`);
  }, [floating]);

  /**
   * 出来事を送る。並びが変わるとき（と、持っていた行を置くとき）は、その前に行ごとの見えている位置を控える。
   * 位置は一覧の上端から測る。描き直すまでに画面がスクロールしても（端での自動スクロール・キーボードで動かした行を
   * 見える所へ送る scrollIntoView）、ずれた分を行の動きと取り違えない。
   */
  const send = useCallback((event: ReorderEvent) => {
    const current = stateRef.current;
    const next = reorderReducer(current, event);
    const list = listRef.current;
    const lands = current.phase === "dragging" && next.phase !== "dragging";
    if (list && !slideFromRef.current && (next.order !== current.order || lands)) {
      const origin = list.getBoundingClientRect().top;
      const from = new Map<string, number>();
      current.order.forEach((id, i) => {
        const row = list.children[i];
        if (row) from.set(id, row.getBoundingClientRect().top - origin);
      });
      slideFromRef.current = from;
    }
    dispatch(event);
  }, []);

  // 描き直したあと（色を塗る前）: 持っている行を指の位置へ合わせ、並びの変わった行を元の見えていた位置から滑らせる。
  // 指で持っている行は place が動かすので滑らせない。置いたときは、浮いていた位置から置き場所へ滑らせる
  useLayoutEffect(() => {
    if (state.phase === "dragging") {
      place();
    } else if (placedRef.current) {
      placedRef.current.style.removeProperty("--reorder-dy");
      placedRef.current = null;
    }
    const from = slideFromRef.current;
    slideFromRef.current = null;
    const list = listRef.current;
    if (!from || !list || prefersReducedMotion()) return;
    const held = state.phase === "dragging" ? state.active : null;
    const rows = state.order.map((id, i) => ({ id, i, row: list.children[i] as HTMLElement | undefined }));
    const moving = rows.filter(
      (r): r is { id: string; i: number; row: HTMLElement } =>
        r.row !== undefined && r.i !== held && from.has(r.id) && typeof r.row.animate === "function",
    );
    // 途中の動きを止めてから測る（書く → 読むを行ごとに繰り返すと、そのたびに配置を計算し直す）
    for (const { row } of moving) for (const animation of row.getAnimations()) if (animation.id === SLIDE_ID) animation.cancel();
    const origin = list.getBoundingClientRect().top;
    const deltas = moving.map(({ id, row }) => from.get(id)! - (row.getBoundingClientRect().top - origin));
    moving.forEach(({ row }, k) => {
      if (Math.abs(deltas[k]) < 1) return;
      row.animate([{ transform: `translateY(${deltas[k]}px)` }, { transform: "none" }], {
        id: SLIDE_ID,
        duration: SLIDE_MS,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
    });
  });

  // 置いて並びが変わったら保存する。保存できなければ置く前の並びへ戻す
  const { committed } = state;
  useEffect(() => {
    if (!committed) return;
    const restore = () => send({ type: "revert", committed });
    void Promise.resolve()
      .then(() => onCommitRef.current(committed))
      .then(
        (ok) => {
          if (ok === false) restore();
        },
        (error: unknown) => {
          restore();
          throw error;
        },
      );
  }, [committed, send]);

  // 指で押し続けたら持ち上げる。待つ間に離れた・動いた・取り消されたら、タイマーごと捨てる
  useEffect(() => {
    if (state.phase !== "pressing") return;
    const timer = window.setTimeout(() => dispatch({ type: "longpress" }), LONG_PRESS_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  /**
   * 指の位置から行き先を選んで知らせ、浮いた行を指へ合わせる。
   * 行き先は置き場所（offsetTop・offsetHeight）で決める。見えている位置は滑らせている途中の動きを含み、
   * それで決めると、動いている行を追いかけて入れ替わりが行ったり来たりする。
   */
  const follow = useCallback(
    (x: number, y: number, dy: number) => {
      const at = floating(y);
      const overIndex = at
        ? pickOverIndex(layoutRects(at.list), at.active, { top: at.top, bottom: at.top + at.height }, dy)
        : null;
      send({ type: "pointermove", x, y, overIndex });
      place();
    },
    [floating, place, send],
  );

  // 持ち上げたまま画面の端へ来たら、その向きへスクロールし続ける。
  // 端は、上に張り付いたヘッダー・見出しの帯と、下の操作の帯の内側から数える。一覧の端が見えたら止める
  useEffect(() => {
    if (state.phase !== "dragging") return;
    let frame = window.requestAnimationFrame(function tick() {
      const pointer = pointerRef.current;
      const list = listRef.current;
      const speed =
        pointer && list
          ? edgeScrollSpeed(pointer.y, window.innerHeight, {
              top: stuckTop(),
              bottom: stuckBottom(),
              list: list.getBoundingClientRect(),
            })
          : 0;
      if (pointer && speed !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, speed);
        // 指は止まっていても下の行は流れた。下へ流した分だけ指が進んだのと同じに扱う
        if (window.scrollY !== before) follow(pointer.x, pointer.y, window.scrollY - before);
      }
      frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.phase, follow]);

  // キーボードで動かした行のつまみにフォーカスを置き続け、画面の外へ出たら見える所までスクロールする
  useLayoutEffect(() => {
    if (state.phase !== "keyboard" || state.active === null) return;
    // 行の中に別の並べ替えがあっても、この行のつまみ（直下）だけを探す
    const handle = listRef.current?.children[state.active]?.querySelector<HTMLElement>(`:scope > [${HANDLE_ATTR}]`);
    if (!handle) return;
    if (document.activeElement !== handle) handle.focus({ preventScroll: true });
    handle.scrollIntoView({ block: "nearest" });
  }, [state.phase, state.active]);

  const onPointerMove = (e: PointerEvent<HTMLOListElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== e.pointerId) return;
    pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    follow(e.clientX, e.clientY, e.clientY - pointer.y);
  };

  const finish = (type: "pointerup" | "pointercancel") => (e: PointerEvent<HTMLOListElement>) => {
    if (pointerRef.current?.id !== e.pointerId) return;
    pointerRef.current = null;
    send({ type });
  };

  const handleProps = (index: number) => ({
    [HANDLE_ATTR]: "",
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (busy || stateRef.current.phase !== "idle" || pointerRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // 行は持ち上げている間に DOM の中で動く。動いた要素は捕捉を失うことがあるので、動かない一覧のほうで捕まえる
      const list = listRef.current;
      list?.setPointerCapture(e.pointerId);
      const row = list?.children[index] as HTMLElement | undefined;
      grabRef.current = list && row ? e.clientY - (list.getBoundingClientRect().top + row.offsetTop) : 0;
      pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      dispatch({ type: "pointerdown", pointerType: e.pointerType, index, x: e.clientX, y: e.clientY });
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const current = stateRef.current;
      if (busy && current.phase === "idle") return;
      // 押しっぱなしの Space で、持ち上げと置くを繰り返さない
      if (e.repeat && (e.key === " " || e.key === "Enter")) {
        if (current.phase === "keyboard") e.preventDefault();
        return;
      }
      const event: ReorderEvent = { type: "keydown", key: e.key, index };
      // 並べ替えが受け取るキーだけ、既定の動き（Space や矢印でのスクロール）を止める
      if (reorderReducer(current, event) === current) return;
      e.preventDefault();
      send(event);
    },
    onBlur: () => {
      if (stateRef.current.phase !== "keyboard") return;
      // 行を DOM の中で動かすと、ブラウザによってはフォーカスが一瞬外れる（React がすぐ戻す）。
      // 戻ったあとも一覧のつまみの外にあるときだけ、持ち上げを取り消す
      window.setTimeout(() => {
        const focused = document.activeElement;
        // 入れ子の一覧（設問の中の選択肢）のつまみは、この一覧のつまみに数えない（一番近い ol で見分ける）
        if (focused instanceof HTMLElement && focused.hasAttribute(HANDLE_ATTR) && focused.closest("ol") === listRef.current) {
          return;
        }
        send({ type: "blur" });
      }, 0);
    },
    // 長押しで端末のメニュー（コピー・共有など）を出さない
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  });

  return {
    state,
    listRef,
    listProps: {
      ref: listRef,
      "data-reorder-phase": state.phase,
      onPointerMove,
      onPointerUp: finish("pointerup"),
      onPointerCancel: finish("pointercancel"),
      // 捕捉が切れたのに離した知らせが来ないとき（要素が外された等）は、取り消しとして扱う
      onLostPointerCapture: finish("pointercancel"),
    },
    handleProps,
    /** 矢印のボタンから、index の項目を to へ動かして置く */
    step: (index: number, to: number) => {
      if (!busy) send({ type: "step", index, to });
    },
  };
}
