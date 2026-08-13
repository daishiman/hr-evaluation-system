import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  explicitTheme,
  isTheme,
  storedTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
} from "@/lib/theme";

function initializedTheme(saved: string | null, throws = false): string | undefined {
  const dataset: Record<string, string> = { theme: "stale" };
  runInNewContext(THEME_INIT_SCRIPT, {
    document: { documentElement: { dataset } },
    localStorage: {
      getItem(key: string) {
        expect(key).toBe(THEME_STORAGE_KEY);
        if (throws) throw new Error("storage unavailable");
        return saved;
      },
    },
  });
  return dataset.theme;
}

describe("テーマの共有契約", () => {
  it("自動・明るい・暗い以外を受け入れない", () => {
    expect(THEMES).toEqual(["auto", "light", "dark"]);
    expect(THEMES.map(isTheme)).toEqual([true, true, true]);
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("壊れた保存値は自動へ戻し、明示テーマだけ属性値にする", () => {
    expect(storedTheme("dark")).toBe("dark");
    expect(storedTheme("sepia")).toBe("auto");
    expect(storedTheme(null)).toBe("auto");
    expect(explicitTheme("auto")).toBeNull();
    expect(explicitTheme("light")).toBe("light");
    expect(explicitTheme("dark")).toBe("dark");
  });

  it("描画前初期化は保存済みの明示テーマだけをhtmlへ反映する", () => {
    expect(initializedTheme("light")).toBe("light");
    expect(initializedTheme("dark")).toBe("dark");
    expect(initializedTheme("auto")).toBeUndefined();
    expect(initializedTheme("sepia")).toBeUndefined();
    expect(initializedTheme(null)).toBeUndefined();
  });

  it("ブラウザ保存が使えなくても初期表示を止めない", () => {
    expect(initializedTheme(null, true)).toBe("stale");
  });
});
