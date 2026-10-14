"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

/**
 * 小さな「i」を押す・指す・フォーカスすると出る、短い説明（DD-006）。
 *
 * WCAG 2.2 SC 1.4.13（ホバーやフォーカスで出る内容）の3つを守る。
 * - 消せる: Esc で消す。窓（dialog 要素）の中でも、先に説明だけを消す（窓は閉じない）。
 * - 上に乗せられる: 説明の上へポインターを動かしても消さない（離れてから少し待って消す）。
 * - 出たまま: 自分で消すか、ポインター・フォーカスが離れるまで消さない。
 *
 * タップでも出す（ホバーの無い端末で、説明を読めない人を作らない）。
 *
 * 説明は画面に固定の位置（position: fixed）で出し、置き場所は body か、開いている窓の中にする。
 * 表の枠（横にスクロールする容器）の中に置くと、下の方の行で説明が切れるため。
 *
 * 読み上げには、ボタンの説明（aria-describedby）として同じ文を渡す。
 * 吹き出しが出ていないときでも、フォーカスしただけで条件まで読まれる。
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const descId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<Element | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef("mouse");
  // タップでfocusが先に起きても、押し始めの開閉状態から切り替える。
  const openOnPointerDown = useRef(false);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const show = () => {
    cancelClose();
    setHost(buttonRef.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  /* ボタンから説明へ動かす途中の隙間で消さないよう、少し待つ */
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  const place = useCallback(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!button || !tip) return;
    const r = button.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - tip.offsetWidth - 8);
    const below = r.bottom + 6;
    // 下に入りきらなければボタンの上に出す
    const top = below + tip.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 6) : below;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, host, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 窓の中では、Esc で窓まで閉じないようにする（説明だけを先に消す）
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !tipRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") show();
  };
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") hideSoon();
  };

  return (
    <span ref={wrapRef} className="info-tip" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <button
        ref={buttonRef}
        type="button"
        className="info-tip-button"
        aria-label={`${label}の説明`}
        aria-describedby={descId}
        aria-expanded={open}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
          openOnPointerDown.current = open;
        }}
        onClick={(e) => {
          // マウスは指した時点で出ているので、押しても消さない。タップは押すたびに出す・消すを切り替える
          if (e.detail === 0 || lastPointer.current === "mouse" || !openOnPointerDown.current) show();
          else setOpen(false);
        }}
        onFocus={show}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <Icon name="info" size={16} />
      </button>
      <span id={descId} hidden>
        {children}
      </span>
      {open &&
        host &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="info-tip-bubble"
            style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
          >
            {children}
          </div>,
          host,
        )}
    </span>
  );
}
