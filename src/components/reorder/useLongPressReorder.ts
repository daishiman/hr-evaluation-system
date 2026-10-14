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

/**
 * 長押しで並べ替える（S11・A10・DD-005）。
 *
 * 状態の移り変わりは reorderReducer（純粋な関数）に寄せ、DOM の無い試験でも
 * マウス・タッチ（長押し）・キーボードの3つの操作で同じ並びになることを確かめる。
 * hook が受け持つのは、長押しのタイマー・ポインターの捕捉・指の下の行の判定・端での自動スクロールだけ。
 */

/** タッチで、動かさずに押し続けて持ち上げるまでの時間 */
export const LONG_PRESS_MS = 350;
/** 持ち上げる前にこれだけ動いたら、並べ替えではなくスクロールのつもりとみなす */
export const MOVE_TOLERANCE_PX = 8;
/** 画面の上下の端からこの距離に入ったら、その向きへ自動でスクロールする */
export const EDGE_SCROLL_PX = 56;
/** 自動スクロールの1コマあたりの最大量 */
export const EDGE_SCROLL_MAX_PX = 16;

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
 * 指（ポインター）の下の行を、行き先として選ぶ。
 * 下へ動かしているときは下の行だけ、上へは上の行だけを相手にする。
 * 高さの違う行どうしで、入れ替えた直後に指の下へ来た行とまた入れ替わり返すのを防ぐため。
 * 一覧より上なら先頭、下なら末尾。行と行の間では決めない（null）。
 */
export function pickOverIndex(
  rows: readonly { top: number; bottom: number }[],
  active: number,
  y: number,
  dy: number,
): number | null {
  if (rows.length === 0) return null;
  if (y < rows[0].top) return 0;
  if (y >= rows[rows.length - 1].bottom) return rows.length - 1;
  const hit = rows.findIndex((row) => y >= row.top && y < row.bottom);
  if (hit < 0) return null;
  if (dy > 0 && hit > active) return hit;
  if (dy < 0 && hit < active) return hit;
  return null;
}

/** 画面の端に近いほど速くスクロールする量。上は負、下は正、端から遠ければ 0 */
export function edgeScrollSpeed(y: number, viewportHeight: number): number {
  const ramp = (depth: number) => Math.ceil((EDGE_SCROLL_MAX_PX * Math.min(depth, EDGE_SCROLL_PX)) / EDGE_SCROLL_PX);
  if (y < EDGE_SCROLL_PX) return -ramp(EDGE_SCROLL_PX - y);
  if (viewportHeight - y < EDGE_SCROLL_PX) return ramp(EDGE_SCROLL_PX - (viewportHeight - y));
  return 0;
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
  useLayoutEffect(() => {
    stateRef.current = state;
    onCommitRef.current = onCommit;
  });

  // 置いて並びが変わったら保存する。保存できなければ置く前の並びへ戻す
  const { committed } = state;
  useEffect(() => {
    if (!committed) return;
    const restore = () => dispatch({ type: "revert", committed });
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
  }, [committed]);

  // 指で押し続けたら持ち上げる。待つ間に離れた・動いた・取り消されたら、タイマーごと捨てる
  useEffect(() => {
    if (state.phase !== "pressing") return;
    const timer = window.setTimeout(() => dispatch({ type: "longpress" }), LONG_PRESS_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  /** 指の位置から行き先を選んで知らせる。行の位置は、いま描かれている DOM から読む */
  const follow = useCallback((x: number, y: number, dy: number) => {
    const current = stateRef.current;
    const rows = Array.from(listRef.current?.children ?? [], (row) => row.getBoundingClientRect());
    const overIndex =
      current.phase === "dragging" && current.active !== null ? pickOverIndex(rows, current.active, y, dy) : null;
    dispatch({ type: "pointermove", x, y, overIndex });
  }, []);

  // 持ち上げたまま画面の端へ来たら、その向きへスクロールし続ける
  useEffect(() => {
    if (state.phase !== "dragging") return;
    let frame = window.requestAnimationFrame(function tick() {
      const pointer = pointerRef.current;
      const speed = pointer ? edgeScrollSpeed(pointer.y, window.innerHeight) : 0;
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
    dispatch({ type });
  };

  const handleProps = (index: number) => ({
    [HANDLE_ATTR]: "",
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (busy || stateRef.current.phase !== "idle" || pointerRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // 行は持ち上げている間に DOM の中で動く。動いた要素は捕捉を失うことがあるので、動かない一覧のほうで捕まえる
      listRef.current?.setPointerCapture(e.pointerId);
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
      dispatch(event);
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
        dispatch({ type: "blur" });
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
      if (!busy) dispatch({ type: "step", index, to });
    },
  };
}
