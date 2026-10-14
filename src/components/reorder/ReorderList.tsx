"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui";
import { HANDLE_ATTR, useLongPressReorder } from "@/components/reorder/useLongPressReorder";

/**
 * 並べ替えのできる一覧（S11・A10・DD-005）。
 *
 * 1行に、つまみ（長押し・マウス・キーボードで持ち上げる）と、矢印のボタン（先頭・上・下・末尾）を置く。
 * 矢印のボタンは、ドラッグできない人のための代わりの手段（WCAG 2.2 SC 2.5.7）なので、つまみがあっても消さない。
 * 置いたら onCommit へ並び全体（id の配列）を渡す。保存の結果で items が変われば、並びはそれに合わせ直す。
 */

export type ReorderItem = { id: string; label: string };

/** つまみの使い方（aria-describedby で読み上げる） */
export const REORDER_HINT =
  "Space で持ち上げ、↑↓で動かし、Space か Enter で置きます。Esc で元に戻します。指では、つまみを長押ししてから動かします。";

type StepAction = "top" | "up" | "down" | "bottom";

const STEPS: { action: StepAction; glyph: string; name: string }[] = [
  { action: "top", glyph: "⇈", name: "先頭に移動" },
  { action: "up", glyph: "↑", name: "1つ上に移動" },
  { action: "down", glyph: "↓", name: "1つ下に移動" },
  { action: "bottom", glyph: "⇊", name: "末尾に移動" },
];

/** 押したボタンが端で使えなくなったら、フォーカスは残った側のボタンへ移す */
const FALLBACK: Record<StepAction, StepAction> = { top: "down", up: "down", down: "up", bottom: "up" };

function stepTarget(action: StepAction, index: number, last: number): number {
  switch (action) {
    case "top":
      return 0;
    case "up":
      return index - 1;
    case "down":
      return index + 1;
    case "bottom":
      return last;
  }
}

/** つまみの読み上げ名。e2e はこの形（「n番目『…』を並べ替え」）でつまみを探す */
export function reorderHandleLabel(position: number, label: string): string {
  return `${position}番目『${label}』を並べ替え`;
}

export function ReorderList<T extends ReorderItem>({
  items,
  label,
  onCommit,
  renderItem,
  busy = false,
  className,
}: {
  items: readonly T[];
  /** 一覧の名前（読み上げ用）。例: 「設問の並び」 */
  label: string;
  /** 並びが変わったときに呼ぶ。false を返したら（解決したら）置く前の並びへ戻す */
  onCommit: (ids: string[]) => void | boolean | Promise<void | boolean>;
  /** 行の中身。省略すると label だけを出す */
  renderItem?: (item: T, index: number) => ReactNode;
  /** 保存中。持ち上げ・矢印のボタンを受け付けない（フォーカスは外さない） */
  busy?: boolean;
  className?: string;
}) {
  const { state, listRef, listProps, handleProps, step } = useLongPressReorder({
    ids: items.map((item) => item.id),
    onCommit,
    busy,
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const hintId = useId();
  const pendingFocus = useRef<{ id: string; action: StepAction } | null>(null);
  const last = state.order.length - 1;

  // 矢印のボタンで動かしたあと、動いた行の同じボタンへフォーカスを戻す。端で押せなくなったら残った側へ
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (!pending || state.phase !== "idle") return;
    const row = listRef.current?.children[state.order.indexOf(pending.id)];
    // 行の中に別の並べ替え（設問の中の選択肢）があっても、この行のボタンだけを探す（:scope > で直下に限る）
    const button = (action: StepAction) =>
      row?.querySelector<HTMLButtonElement>(`:scope > .reorder-steps > [data-reorder-action="${action}"]`);
    const target = [button(pending.action), button(FALLBACK[pending.action])].find((b) => b && !b.disabled);
    (target ?? row?.querySelector<HTMLElement>(`:scope > [${HANDLE_ATTR}]`))?.focus();
  }, [state.order, state.phase, listRef]);

  return (
    <>
      <p id={hintId} hidden>
        {REORDER_HINT}
      </p>
      <ol {...listProps} className={clsx("reorder-list", className)} aria-label={label} aria-busy={busy || undefined}>
        {state.order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const held = state.active === index && state.phase !== "idle";
          return (
            <li
              key={id}
              className="reorder-row"
              data-reorder-state={held ? (state.phase === "pressing" ? "pressing" : "lifted") : undefined}
            >
              <Button
                type="button"
                variant="tertiary"
                className="reorder-handle"
                aria-label={reorderHandleLabel(index + 1, item.label)}
                aria-describedby={hintId}
                aria-disabled={busy || undefined}
                {...handleProps(index)}
              >
                <span className="reorder-grip" aria-hidden="true" />
              </Button>
              <div className="reorder-body">{renderItem ? renderItem(item, index) : item.label}</div>
              <div className="reorder-steps">
                {STEPS.map(({ action, glyph, name }) => {
                  const to = stepTarget(action, index, last);
                  return (
                    <Button
                      key={action}
                      type="button"
                      variant="tertiary"
                      className="reorder-step"
                      data-reorder-action={action}
                      aria-label={`『${item.label}』を${name}`}
                      disabled={to < 0 || to > last || to === index}
                      aria-disabled={busy || undefined}
                      onClick={() => {
                        if (busy || state.phase !== "idle") return;
                        pendingFocus.current = { id, action };
                        step(index, to);
                      }}
                    >
                      <span aria-hidden="true">{glyph}</span>
                    </Button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {state.announcement}
      </p>
    </>
  );
}
