/**
 * 配色（テーマの系統）の共有契約。
 *
 * 明るさ（自動・明るい・暗い＝ src/lib/theme.ts）とは別の軸として、
 * 色の系統だけを持つ。2つを1つの値にまとめないのは、
 * 「暗いまま系統だけ変える」「系統はそのままで明るさだけ変える」を
 * それぞれ独立して選べるようにするため（組み合わせは 5 × 3 通り）。
 *
 * theme.ts と同じく、このファイルは DOM や React に依存させない。
 * 実際の色は globals.css の html[data-palette] が持ち、
 * ここが持つのは「どの名前が有効か・どこへ保存するか・描画前にどう反映するか」だけ。
 */
export const PALETTES = ["graphite", "azure", "sand", "moss", "midnight"] as const;

export type Palette = (typeof PALETTES)[number];
/** 既定（グラファイト）以外。html へ属性として書き出すのはこれだけ。 */
export type ExplicitPalette = Exclude<Palette, "graphite">;

// リテラル型のまま持つ（Palette へ広げない）。広げると「既定と一致しない側＝明示配色」
// という絞り込みが効かず、explicitPalette の戻り値が型で保証できなくなる。
export const DEFAULT_PALETTE = "graphite" satisfies Palette;

/** 既定は属性を付けない状態にする（＝これまでと1バイトも変わらない見た目にする）。 */
export const EXPLICIT_PALETTES: readonly ExplicitPalette[] = PALETTES.filter(
  (palette): palette is ExplicitPalette => palette !== DEFAULT_PALETTE,
);

export const PALETTE_STORAGE_KEY = "hr-palette";

/** 選ぶ画面に出す名前。色そのものではなく「印象」で呼べる短い語にする。 */
export const PALETTE_LABELS: Record<Palette, string> = {
  graphite: "グレー",
  azure: "ブルー",
  sand: "ベージュ",
  moss: "グリーン",
  midnight: "ネイビー",
};

/** 読み上げと吹き出しに渡す一言。色の名前だけでは何が変わるか分からないため。 */
export const PALETTE_NOTES: Record<Palette, string> = {
  graphite: "色みのない標準の配色",
  azure: "青みのある涼しい配色",
  sand: "黄みのある暖かい配色",
  moss: "緑みのある落ち着いた配色",
  midnight: "紺色の引き締まった配色",
};

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && PALETTES.includes(value as Palette);
}

export function storedPalette(value: unknown): Palette {
  return isPalette(value) ? value : DEFAULT_PALETTE;
}

export function explicitPalette(palette: Palette): ExplicitPalette | null {
  return palette === DEFAULT_PALETTE ? null : palette;
}

/**
 * 保存済みの配色を、Reactの描画より先に html へ反映する。
 *
 * theme.ts の THEME_INIT_SCRIPT と分けてあるのは、片方が壊れても
 * もう片方が動くようにするため（明るさが読めない端末でも配色は残る）。
 */
export const PALETTE_INIT_SCRIPT = `try{var p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});if(${JSON.stringify([...EXPLICIT_PALETTES])}.indexOf(p)>=0){document.documentElement.dataset.palette=p}else{delete document.documentElement.dataset.palette}}catch(e){}`;
