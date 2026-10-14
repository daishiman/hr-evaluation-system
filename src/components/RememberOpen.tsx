"use client";

import { useEffect, useRef } from "react";

/**
 * 親の details 要素の開け閉めを、その端末（localStorage）に覚える。Disclosure の rememberAs から使う。
 *
 * 最初の描画は閉じたまま出し、読み込みのあとで覚えた状態に合わせる（サーバーの描画とずらさない）。
 * 保存できない端末（プライベートの窓など）では、覚えないだけで開け閉めはふつうに動く。
 */
export function RememberOpen({ storageKey }: { storageKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details) return;
    const key = `disclosure:${storageKey}`;
    try {
      if (localStorage.getItem(key) === "open") details.open = true;
    } catch {
      /* 覚えられない端末では閉じたまま始める */
    }
    const onToggle = () => {
      try {
        localStorage.setItem(key, details.open ? "open" : "closed");
      } catch {
        /* 覚えられなくても開け閉めは続ける */
      }
    };
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, [storageKey]);

  return <span ref={ref} hidden />;
}
