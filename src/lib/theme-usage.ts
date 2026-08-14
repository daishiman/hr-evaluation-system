/**
 * 「どの見た目が現在使われているか」を保存する、薄い記録の層。
 *
 * なぜ独立させるか
 *   見た目を変える処理（ThemeToggle / PaletteToggle）に記録を書き込むと、
 *   送信先を変えたいときに切り替えの実装を触ることになり、
 *   記録が失敗したときに画面の色が変わらない、という壊れ方を招く。
 *   ここを1枚挟んでおけば、送信先（いまは自前のAPI、将来は集計基盤でも）を
 *   差し替えても、切り替えの実装は1行も変わらない。
 *
 * 守ること
 *   ・利用者IDは本文に入れない。APIが検証済みセッションから取得する。
 *   ・記録に失敗しても、画面の操作は止めない（送りっぱなしにする）。
 *   ・初回ログイン後と変更時に送る。サーバー側は1人1行のupsertなので重複票にならない。
 */
import { DEFAULT_PALETTE, storedPalette, type Palette } from "@/lib/palette";
import { storedTheme, type ExplicitTheme, type Theme } from "@/lib/theme";

/** 1回の選択。系統 × 選んだ明るさ × 実際に表示された明るさ。 */
export type ThemeChoice = {
  palette: Palette;
  /** 利用者が選んだもの。「自動」を含む。 */
  mode: Theme;
  /** 「自動」のときに実際どちらで表示されたか。人気の内訳を読むために持つ。 */
  resolved: ExplicitTheme;
};

/** 送信先。テストと将来の差し替えのために、ここだけを入れ替えられるようにする。 */
export type ThemeChoiceSink = (choice: ThemeChoice) => void;

export const THEME_CHOICE_ENDPOINT = "/api/theme-choice";

/** 既定の送信先。応答は使わないので待たない。失敗は黙って捨てる。 */
function postThemeChoice(choice: ThemeChoice): void {
  void fetch(THEME_CHOICE_ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(choice),
    // 画面を閉じる直前に選んだときでも送り切る
    keepalive: true,
  }).catch(() => {
    /* 数えられなかっただけ。利用者に見せることは何もない */
  });
}

let sink: ThemeChoiceSink = postThemeChoice;

/** 送信先を差し替える。差し替え前のものを返すので、テストで元へ戻せる。 */
export function setThemeChoiceSink(next: ThemeChoiceSink): ThemeChoiceSink {
  const previous = sink;
  sink = next;
  return previous;
}

/**
 * いま画面に当たっている組み合わせを読む。
 *
 * html の属性が唯一の正本。切り替えUIの内部状態から組み立てないのは、
 * 明るさと配色が別々の部品にあり、片方は相手の状態を知らないため。
 * 属性を読めば、どちらから呼んでも同じ答えになる。
 */
export function appliedChoice(
  dataset: { theme?: string; palette?: string },
  prefersDark: boolean,
): ThemeChoice {
  const mode = storedTheme(dataset.theme ?? "auto");
  return {
    palette: storedPalette(dataset.palette ?? DEFAULT_PALETTE),
    mode,
    resolved: mode === "auto" ? (prefersDark ? "dark" : "light") : mode,
  };
}

/** いまの組み合わせを1票として送る。ブラウザの外（テスト・SSR）では何もしない。 */
export function recordAppliedThemeChoice(): void {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  sink(appliedChoice(document.documentElement.dataset, prefersDark));
}
