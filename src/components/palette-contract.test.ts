import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPLICIT_PALETTES, PALETTES } from "@/lib/palette";

/**
 * 配色（系統）の契約。
 *
 * theme-contract.test.ts が「明るさ」の軸を固定しているのに対して、
 * ここは「色の系統」の軸を固定する。守らせるのは3つ。
 *  1. どの系統も、骨格の18個をきっかり上書きする（多くても少なくても失格）。
 *  2. 暗いほうの値は、明示（data-theme="dark"）と端末追従の2箇所で完全に一致する。
 *  3. 全系統・全モードで、文字4.5:1・境界線3:1（WCAG AA）を満たす。
 */
const ROOT = process.cwd();
const CSS_PATH = join(ROOT, "src", "app", "globals.css");
const SPEC_PATH = join(ROOT, "docs", "product", "spec.md");
const GALLERY_PATH = join(ROOT, "docs", "product", "theme-gallery.md");

/** 系統ごとに入れ替える「骨格」。ここに無いものは既定（グラファイト）から受け継ぐ。 */
const STRUCTURAL_TOKENS = [
  "brand",
  "brand-deep",
  "brand-soft",
  "page-bg",
  "surface",
  "accent",
  "cta-bg",
  "cta-bg-hover",
  "cta-fg",
  "ink",
  "ink-muted",
  "line",
  "subtle",
  "off-surface",
  "off-surface-soft",
  "off-line",
  "chart-line-soft",
  "chart-band",
] as const;

/** 意味が系統に依存しないので、系統側で上書きしてはいけないもの。 */
const INHERITED_TOKENS = [
  "danger",
  "danger-soft",
  "danger-fg",
  "caution-soft",
  "caution-border",
  "status-progress",
  ...[1, 2, 3, 4, 5].flatMap((tone) => [`avatar-${tone}-fg`, `avatar-${tone}-bg`]),
] as const;

/** 面と文字・境界線の要求。[前景, 背景, 最低比] */
const CONTRAST_RULES: [string, string, number][] = [
  ["ink", "surface", 4.5],
  ["ink", "page-bg", 4.5],
  ["ink", "subtle", 4.5],
  ["ink", "brand-soft", 4.5],
  ["ink", "off-surface", 4.5],
  ["ink", "off-surface-soft", 4.5],
  ["ink-muted", "surface", 4.5],
  ["ink-muted", "page-bg", 4.5],
  ["ink-muted", "off-surface", 4.5],
  ["cta-fg", "cta-bg", 4.5],
  ["cta-fg", "cta-bg-hover", 4.5],
  ["brand-deep", "brand-soft", 4.5],
  ["brand-deep", "surface", 4.5],
  ["accent", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-soft", 4.5],
  ["danger-fg", "danger", 4.5],
  ["status-progress", "caution-soft", 4.5],
  ["brand", "surface", 3],
  ["brand", "page-bg", 3],
  ["line", "surface", 3],
  ["line", "page-bg", 3],
  ["off-line", "off-surface", 3],
  ["chart-line-soft", "surface", 3],
  ["caution-border", "caution-soft", 3],
  ...[1, 2, 3, 4, 5].map(
    (tone) => [`avatar-${tone}-fg`, `avatar-${tone}-bg`, 4.5] as [string, string, number],
  ),
];

function blockAfter(source: string, marker: string): string {
  const markerAt = source.indexOf(marker);
  expect(markerAt, `${marker} が見つからない`).toBeGreaterThanOrEqual(0);
  const openAt = source.indexOf("{", markerAt);
  expect(openAt, `${marker} の開始括弧が見つからない`).toBeGreaterThan(markerAt);
  let depth = 0;
  for (let i = openAt; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(openAt + 1, i);
  }
  throw new Error(`${marker} の終了括弧が見つからない`);
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
}

function rgb(hex: string): [number, number, number] {
  expect(hex, `${hex} は #rrggbb ではない`).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const css = readFileSync(CSS_PATH, "utf8");
const graphite = {
  light: declarations(blockAfter(css, ":root")),
  dark: declarations(blockAfter(css, 'html[data-theme="dark"]')),
};

/** 系統の値を、受け継ぐ側（グラファイト）へ重ねた「実際に当たる色」を作る。 */
function effective(base: Map<string, string>, override: Map<string, string>): Map<string, string> {
  return new Map([...base, ...override]);
}

function paletteBlocks(palette: string) {
  const light = declarations(blockAfter(css, `html[data-palette="${palette}"]`));
  const dark = declarations(blockAfter(css, `html[data-palette="${palette}"][data-theme="dark"]`));
  const autoDark = declarations(
    blockAfter(css, `html[data-palette="${palette}"]:not([data-theme="light"])`),
  );
  return { light, dark, autoDark };
}

describe("配色（テーマの系統）の契約", () => {
  it("既定はグラファイトのままで、属性を足したときだけ系統が変わる", () => {
    // 既定の系統は :root と html[data-theme="dark"] が持つ（＝これまでと同じ）
    expect(PALETTES[0]).toBe("graphite");
    expect(css).not.toContain('html[data-palette="graphite"]');
    for (const token of STRUCTURAL_TOKENS) {
      expect(graphite.light.get(token), `light --${token}`).toBeTruthy();
      expect(graphite.dark.get(token), `dark --${token}`).toBeTruthy();
    }
  });

  it("漏れなし・余りなし: どの系統も骨格の18個だけを入れ替える", () => {
    for (const palette of EXPLICIT_PALETTES) {
      const blocks = paletteBlocks(palette);
      for (const [name, tokens] of Object.entries(blocks)) {
        expect([...tokens.keys()].sort(), `${palette}/${name}`).toEqual([...STRUCTURAL_TOKENS].sort());
        for (const token of INHERITED_TOKENS) {
          expect(tokens.has(token), `${palette}/${name}: --${token} は系統で変えない`).toBe(false);
        }
      }
    }
  });

  it("矛盾なし: 暗いほうは、明示指定と端末追従で同じ値になる", () => {
    for (const palette of EXPLICIT_PALETTES) {
      const { dark, autoDark } = paletteBlocks(palette);
      expect(Object.fromEntries(autoDark), palette).toEqual(Object.fromEntries(dark));
    }
  });

  it("整合性あり: 全系統・明暗ともに WCAG AA（本文4.5:1 / 境界線3:1）を満たす", () => {
    const themes: [string, Map<string, string>][] = [
      ["graphite/light", graphite.light],
      ["graphite/dark", graphite.dark],
    ];
    for (const palette of EXPLICIT_PALETTES) {
      const { light, dark } = paletteBlocks(palette);
      themes.push([`${palette}/light`, effective(graphite.light, light)]);
      themes.push([`${palette}/dark`, effective(graphite.dark, dark)]);
    }

    for (const [name, colors] of themes) {
      for (const [foreground, background, minimum] of CONTRAST_RULES) {
        const front = colors.get(foreground);
        const back = colors.get(background);
        expect(front, `${name}: --${foreground}`).toBeTruthy();
        expect(back, `${name}: --${background}`).toBeTruthy();
        expect(
          contrast(front as string, back as string),
          `${name}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("系統どうしが見分けられる（同じ色を別名で置いていない）", () => {
    const signatures = new Set<string>();
    for (const mode of ["light", "dark"] as const) {
      signatures.clear();
      const all: [string, Map<string, string>][] = [["graphite", graphite[mode]]];
      for (const palette of EXPLICIT_PALETTES) all.push([palette, paletteBlocks(palette)[mode]]);
      for (const [palette, colors] of all) {
        const signature = ["page-bg", "surface", "brand", "cta-bg"]
          .map((token) => colors.get(token))
          .join("/");
        expect(signatures.has(signature), `${mode}: ${palette} が他の系統と同じ色`).toBe(false);
        signatures.add(signature);
      }
    }
  });

  it("紙は系統を選んでいても常に明るいまま出る", () => {
    const print = blockAfter(css, "@media print");
    // 系統の暗い指定（詳細度 0-2-1）に負けないよう、同じ強さの指定を並べてある
    expect(print).toContain("html:root[data-palette]");
    const printLight = declarations(blockAfter(print, "html:root"));
    for (const token of STRUCTURAL_TOKENS) {
      expect(printLight.get(token), `print --${token}`).toBe(graphite.light.get(token));
    }
  });

  it("正本仕様と見本の一覧が、実装済みの系統と一致する", () => {
    const spec = readFileSync(SPEC_PATH, "utf8");
    const gallery = readFileSync(GALLERY_PATH, "utf8");
    expect(spec).toContain("配色（テーマの系統）");
    for (const palette of PALETTES) {
      expect(spec, `spec: ${palette}`).toContain(palette);
      // 見本は 系統 × 明暗 の全通りをそろえる（片方だけの系統を作らない）
      expect(gallery, `gallery: ${palette}-light`).toContain(`${palette}-light.png`);
      expect(gallery, `gallery: ${palette}-dark`).toContain(`${palette}-dark.png`);
    }
  });
});
