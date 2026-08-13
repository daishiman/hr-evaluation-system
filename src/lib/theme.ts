/**
 * 画面テーマの共有契約。
 *
 * このファイルは DOM や React に依存させない。
 * Server Component の layout と Client Component の切り替えUIが、
 * 同じ値・保存キー・初期化だけを安全に共有するための正本とする。
 */
export const THEMES = ["auto", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];
export type ExplicitTheme = Exclude<Theme, "auto">;

export const THEME_STORAGE_KEY = "hr-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

export function storedTheme(value: unknown): Theme {
  return isTheme(value) ? value : "auto";
}

export function explicitTheme(theme: Theme): ExplicitTheme | null {
  return theme === "auto" ? null : theme;
}

/** 保存済みの明示テーマを、Reactの描画より先に html へ反映する。 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}else{delete document.documentElement.dataset.theme}}catch(e){}`;
