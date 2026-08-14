import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  EXPLICIT_PALETTES,
  explicitPalette,
  isPalette,
  PALETTE_INIT_SCRIPT,
  PALETTE_LABELS,
  PALETTE_NOTES,
  PALETTE_STORAGE_KEY,
  PALETTES,
  storedPalette,
} from "@/lib/palette";

function initializedPalette(saved: string | null, throws = false): string | undefined {
  const dataset: Record<string, string> = { palette: "stale" };
  runInNewContext(PALETTE_INIT_SCRIPT, {
    document: { documentElement: { dataset } },
    localStorage: {
      getItem(key: string) {
        expect(key).toBe(PALETTE_STORAGE_KEY);
        if (throws) throw new Error("storage unavailable");
        return saved;
      },
    },
  });
  return dataset.palette;
}

describe("配色の共有契約", () => {
  it("決めた5系統以外を受け入れない", () => {
    expect(PALETTES).toEqual(["graphite", "azure", "sand", "moss", "midnight"]);
    expect(PALETTES.map(isPalette)).toEqual([true, true, true, true, true]);
    expect(isPalette("crimson")).toBe(false);
    expect(isPalette(null)).toBe(false);
  });

  it("既定はグラファイトで、html へ書き出すのは残りの4系統だけ", () => {
    expect(DEFAULT_PALETTE).toBe("graphite");
    expect(EXPLICIT_PALETTES).toEqual(["azure", "sand", "moss", "midnight"]);
    expect(explicitPalette("graphite")).toBeNull();
    for (const palette of EXPLICIT_PALETTES) expect(explicitPalette(palette)).toBe(palette);
  });

  it("壊れた保存値は既定へ戻す", () => {
    expect(storedPalette("azure")).toBe("azure");
    expect(storedPalette("crimson")).toBe("graphite");
    expect(storedPalette(null)).toBe("graphite");
  });

  it("描画前初期化は、保存済みの明示配色だけを html へ反映する", () => {
    for (const palette of EXPLICIT_PALETTES) expect(initializedPalette(palette)).toBe(palette);
    expect(initializedPalette("graphite")).toBeUndefined();
    expect(initializedPalette("crimson")).toBeUndefined();
    expect(initializedPalette(null)).toBeUndefined();
  });

  it("ブラウザ保存が使えなくても初期表示を止めない", () => {
    expect(initializedPalette(null, true)).toBe("stale");
  });

  it("全系統に、選ぶ画面で使う名前と一言がある", () => {
    for (const palette of PALETTES) {
      expect(PALETTE_LABELS[palette], palette).toBeTruthy();
      expect(PALETTE_NOTES[palette], palette).toBeTruthy();
    }
    // 名前が重複していると、押しても何が変わるか分からない
    expect(new Set(Object.values(PALETTE_LABELS)).size).toBe(PALETTES.length);
  });

  it("明るさの保存先と混ざらない", () => {
    expect(PALETTE_STORAGE_KEY).toBe("hr-palette");
    expect(PALETTE_INIT_SCRIPT).not.toContain("hr-theme");
    expect(PALETTE_INIT_SCRIPT).not.toContain("dataset.theme");
  });
});
