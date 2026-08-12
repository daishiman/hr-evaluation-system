"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 「固定した見出しの帯の下端」を実測して、--sticky-top に入れる。
 *
 * カードの中の固定見出し（ui.tsx の CardHead pinned）と、表の列見出しは、どちらも
 * --sticky-top に貼り付く。この値を決め打ちの数値にしていると、
 * 文字サイズを変えたり、パンくず・札が1行増えたりしただけで、
 * 帯が見出しの下に潜り込んで見えなくなる（読めない・触れない）。
 *
 * 見出しの帯の高さは画面によって違う（パンくずの有無・札の行数・折返し）ので、
 * CSSだけでは表せない。ここで実際の高さを測って1箇所で配る。
 *
 * ・CSS側にも同じ意味の初期値を書いてある（globals.css の --sticky-top）。
 *   画面が出た直後のごく短い間はそちらが使われる。
 * ・画面を移ったとき（pathname）と、帯の高さが変わったとき（ResizeObserver）に測り直す。
 */
export function StickyOffset() {
  const pathname = usePathname();

  /**
   * 画面に文字盤（スマートフォンのキーボード）が出ている間を見分けて、
   * html の data-keyboard に入れる（CSS側で固定をやめるため）。
   *
   * 文字盤は見える範囲を半分近く奪うのに、CSSの高さ（@media (max-height)）は変わらない。
   * そのため CSS だけでは「打っている欄が帯と文字盤に挟まれて見えない」状態を防げない。
   * 実際に見えている高さは visualViewport にしか出ないので、ここで見る。
   * しきい値は 0.75（見える範囲が1/4以上減ったら出ていると見なす）。
   * アドレスバーの伸び縮み（数十px）では反応しない大きさにしてある。
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const open = vv.height < window.innerHeight * 0.75;
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };
    apply();
    vv.addEventListener("resize", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      delete root.dataset.keyboard;
    };
  }, []);

  useEffect(() => {
    const head = document.querySelector<HTMLElement>('.page-head[data-sticky="true"]');
    // html に置く。scroll-padding-top（html に効く）もこの値を読むため、
    // body に置くと html から読めない。
    const root = document.documentElement;

    if (!head) {
      // 見出しを固定しない画面。CSS側の初期値（固定ヘッダーの下端）に戻す。
      root.style.removeProperty("--sticky-top");
      return;
    }

    const apply = () => {
      const h = Math.round(head.getBoundingClientRect().height);
      root.style.setProperty("--sticky-top", `calc(var(--header-h) + ${h}px)`);
    };

    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(head);
    window.addEventListener("resize", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--sticky-top");
    };
  }, [pathname]);

  return null;
}
