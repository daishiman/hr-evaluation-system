"use client";

import { useEffect, useState } from "react";
import { explicitTheme, storedTheme, THEME_STORAGE_KEY, THEMES, type Theme } from "@/lib/theme";
import { recordAppliedThemeChoice } from "@/lib/theme-usage";
import { Segmented } from "@/components/ui";

/**
 * 画面の明るさ（自動・明るい・暗い）の切り替え。
 *
 * 色そのものは globals.css の変数が持っている。ここがやるのは
 * html の data-theme を付け外しすることだけ。
 * ・自動 … 属性を外す。CSS 側の prefers-color-scheme に任せる
 * ・明るい / 暗い … data-theme を入れて、端末の設定より優先する
 *
 * 選んだ値は localStorage に残す。次に来たときへ引き継ぐのは
 * 共有契約の THEME_INIT_SCRIPT の役目（描画の前に走らせる）。
 */

const LABELS: Record<Theme, string> = { auto: "自動", light: "明るい", dark: "暗い" };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const explicit = explicitTheme(theme);
  if (explicit === null) delete root.dataset.theme;
  else root.dataset.theme = explicit;
}

export function ThemeToggle() {
  /* 初期値は「自動」。実際に保存されている値は、下の useEffect で読み直す。
     サーバーには localStorage が無いので、ここで読むと表示がずれる。 */
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      setTheme(storedTheme(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      /* 保存できない設定の端末では、毎回「自動」から始める */
    }
  }, []);

  function choose(next: Theme) {
    // 選択中の札の押し直しは、保存と計測のどちらも行わない。
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    try {
      if (next === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* 保存できなくても、この画面の間は選んだ見た目のまま使える */
    }
    // 見た目を変えてから数える（→ lib/theme-usage.ts）。数えられなくても画面は変わっている。
    recordAppliedThemeChoice();
  }

  return (
    <Segmented
      label="画面の明るさ"
      value={theme}
      onChange={choose}
      options={THEMES.map((value) => ({ value, label: LABELS[value], srLabel: `画面の明るさ: ${LABELS[value]}` }))}
    />
  );
}
