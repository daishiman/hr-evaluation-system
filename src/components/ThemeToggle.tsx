"use client";

import { explicitTheme, storedTheme, THEME_STORAGE_KEY, THEMES, type Theme } from "@/lib/theme";
import { useAppearanceChoice } from "@/lib/use-appearance-choice";
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

export function ThemeToggle() {
  const { value: theme, choose } = useAppearanceChoice<Theme>({
    attribute: "theme",
    storageKey: THEME_STORAGE_KEY,
    defaultValue: "auto",
    stored: storedTheme,
    explicit: explicitTheme,
  });

  return (
    <Segmented
      label="画面の明るさ"
      value={theme}
      onChange={choose}
      options={THEMES.map((value) => ({ value, label: LABELS[value], srLabel: `画面の明るさ: ${LABELS[value]}` }))}
    />
  );
}
