import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("外観選択UIの契約", () => {
  it("配色チップに色見本と選択中の印を併記する", () => {
    const source = read("src/components/PaletteToggle.tsx");

    expect(source).toContain("palette-swatch");
    expect(source).toContain('name="check"');
    expect(source).toContain("palette-choice-status");
  });

  it("配色と明るさの同値再選択を記録処理へ流さない", () => {
    const palette = read("src/components/PaletteToggle.tsx");
    const theme = read("src/components/ThemeToggle.tsx");

    expect(palette).toContain("if (next === palette) return");
    expect(theme).toContain("if (next === theme) return");
  });

  it("外観の全選択肢を44px以上にし、色見本は5系統すべてに定義する", () => {
    const css = read("src/app/globals.css");

    expect(css).toMatch(/\.account-pop-theme\s+\.segmented-btn\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.palette-choices\s+\.chip\s*\{[^}]*min-height:\s*44px/s);
    for (const palette of ["graphite", "azure", "sand", "moss", "midnight"]) {
      expect(css).toContain(`.palette-swatch[data-palette="${palette}"]`);
    }
  });

  it("ログイン後の初回表示と、自動モード中の端末明暗変更を現在設定として記録する", () => {
    const source = read("src/components/AccountMenu.tsx");

    expect(source).toContain("recordAppliedThemeChoice()");
    expect(source).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(source).toContain('addEventListener("change"');
  });
});
