"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * 狭い画面で重ねて開くメニュー（引き出し）の開閉を、1箇所で持つ。
 *
 * 開くボタンは上のヘッダーの左端、閉じるボタンと本体は左のメニューの中にある。
 * 別の部品なので、状態をどちらかの中に置くと片方が食い違う
 * （閉じたのに「開いています」と読み上げる、など）。
 *
 * 開いているかどうかは <html data-drawer> にも入れる。
 * 引き出しが出ている間、背面をスクロールさせないためにCSS側で使う。
 */

interface DrawerState {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const DrawerContext = createContext<DrawerState | null>(null);

export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) document.documentElement.dataset.drawer = "open";
    else delete document.documentElement.dataset.drawer;
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useSidebarDrawer(): DrawerState {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("SidebarDrawerProvider の中で使ってください");
  return ctx;
}

/** ヘッダーの左端に置く、引き出しを開くボタン。文字だけのボタンにする。 */
export function SidebarOpenButton() {
  const { open, setOpen } = useSidebarDrawer();
  return (
    <button type="button" className="sidebar-open-sp" onClick={() => setOpen(true)} aria-expanded={open}>
      メニュー
    </button>
  );
}
