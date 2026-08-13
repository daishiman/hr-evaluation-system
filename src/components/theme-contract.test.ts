import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CSS_PATH = join(SRC, "app", "globals.css");
const CHARTS_PATH = join(SRC, "components", "Charts.tsx");
const LAYOUT_PATH = join(SRC, "app", "layout.tsx");
const TOGGLE_PATH = join(SRC, "components", "ThemeToggle.tsx");
const CONTRACT_PATH = join(SRC, "lib", "theme.ts");
const SPEC_PATH = join(ROOT, "docs", "product", "spec.md");
const BACKLOG_PATH = join(ROOT, "docs", "product", "backlog.md");
const HISTORY_PATH = join(ROOT, "docs", "product", "backlog-history-2026-08-13.md");

const THEME_COLOR_TOKENS = [
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
  "off-line",
  "off-surface",
  "off-surface-soft",
  "danger",
  "danger-soft",
  "danger-fg",
  "caution-soft",
  "caution-border",
  "status-progress",
  "chart-line-soft",
  "chart-band",
  "avatar-1-fg",
  "avatar-1-bg",
  "avatar-2-fg",
  "avatar-2-bg",
  "avatar-3-fg",
  "avatar-3-bg",
  "avatar-4-fg",
  "avatar-4-bg",
  "avatar-5-fg",
  "avatar-5-bg",
] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

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

function themeColors(block: string): Record<(typeof THEME_COLOR_TOKENS)[number], string> {
  const values = declarations(block);
  return Object.fromEntries(
    THEME_COLOR_TOKENS.map((token) => {
      const value = values.get(token);
      expect(value, `--${token} がテーマにない`).toBeTruthy();
      return [token, value];
    }),
  ) as Record<(typeof THEME_COLOR_TOKENS)[number], string>;
}

function rgb(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
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

describe("全画面のテーマ契約", () => {
  it("矛盾なし: テーマの値・保存・初期化は純粋モジュールを正本にし、画面へ色を直書きしない", () => {
    const contract = readFileSync(CONTRACT_PATH, "utf8");
    const layout = readFileSync(LAYOUT_PATH, "utf8");
    const toggle = readFileSync(TOGGLE_PATH, "utf8");
    expect(contract).toContain('export const THEME_STORAGE_KEY = "hr-theme"');
    expect(contract).toContain('export const THEMES = ["auto", "light", "dark"] as const');
    expect(contract).toContain("export const THEME_INIT_SCRIPT");
    expect(layout).toContain('from "@/lib/theme"');
    expect(layout).not.toContain('from "@/components/ThemeToggle"');
    expect(toggle).toContain('from "@/lib/theme"');

    const screenFiles = walk(SRC).filter(
      (path) => (path.endsWith(".ts") || path.endsWith(".tsx")) && !path.includes(".test."),
    );
    const hardCoded = screenFiles.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return source.match(/\bbg-(?:white|black)\b|#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(/gi)?.map((value) => ({ path, value })) ?? [];
    });
    expect(hardCoded.map(({ path, value }) => `${path.replace(`${SRC}/`, "")}: ${value}`)).toEqual([]);
  });

  it("漏れなし: ライト・自動ダーク・明示ダーク・印刷が同じ意味トークンを持つ", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const lightBlock = blockAfter(css, ":root");
    const light = themeColors(lightBlock);
    const autoDark = themeColors(blockAfter(css, 'html:not([data-theme="light"])'));
    const explicitDark = themeColors(blockAfter(css, 'html[data-theme="dark"]'));
    const print = blockAfter(css, "@media print");
    const printLight = themeColors(blockAfter(print, "html:root"));

    expect(autoDark).toEqual(explicitDark);
    expect(printLight).toEqual(light);
    expect(lightBlock).toContain("color-scheme: light");
    expect(print).toContain("color-scheme: light");
  });

  it("整合性あり: 小さい状態文字は4.5:1、情報を示す線は3:1を両テーマで満たす", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const themes = {
      light: themeColors(blockAfter(css, ":root")),
      dark: themeColors(blockAfter(css, 'html[data-theme="dark"]')),
    };
    for (const [name, colors] of Object.entries(themes)) {
      expect(contrast(colors.danger, colors["danger-soft"]), `${name}: danger`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors["status-progress"], colors["caution-soft"]), `${name}: progress`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.line, colors.surface), `${name}: boundary line`).toBeGreaterThanOrEqual(3);
      expect(contrast(colors["off-line"], colors["off-surface"]), `${name}: off-state line`).toBeGreaterThanOrEqual(3);
      expect(contrast(colors["caution-border"], colors["caution-soft"]), `${name}: caution line`).toBeGreaterThanOrEqual(3);
      expect(contrast(colors["chart-line-soft"], colors.surface), `${name}: chart comparison line`).toBeGreaterThanOrEqual(3);
      expect(contrast(colors["cta-fg"], colors["cta-bg"]), `${name}: primary action`).toBeGreaterThanOrEqual(4.5);
      for (const tone of [1, 2, 3, 4, 5]) {
        const foreground = colors[`avatar-${tone}-fg` as keyof typeof colors];
        const background = colors[`avatar-${tone}-bg` as keyof typeof colors];
        expect(contrast(foreground, background), `${name}: avatar ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("依存関係整合: グラフはCSS変数を直接使い、JSでテーマを二重同期しない", () => {
    const charts = readFileSync(CHARTS_PATH, "utf8");
    for (const token of ["brand", "chart-line-soft", "line", "ink-muted", "chart-band", "surface", "ink"]) {
      expect(charts).toContain(`var(--${token})`);
    }
    expect(charts).not.toMatch(/FALLBACK_COLORS|getComputedStyle|MutationObserver|matchMedia|useChartColors/);
  });

  it("正本仕様と残課題は、実装済みのテーマ契約と一致する", () => {
    const spec = readFileSync(SPEC_PATH, "utf8");
    const backlog = readFileSync(BACKLOG_PATH, "utf8");
    const history = readFileSync(HISTORY_PATH, "utf8");
    expect(spec).toContain("テーマ契約（全画面共通）");
    expect(spec).toContain("意味トークン");
    expect(spec).not.toContain("`--accent-on-white-bg`（#c74e0b）");
    expect(backlog).not.toContain("| UX-016 |");
    expect(history).toContain("UX-016");
    expect(history).toContain("解消済み");
  });
});
