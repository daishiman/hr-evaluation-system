import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appliedChoice,
  recordAppliedThemeChoice,
  setThemeChoiceSink,
  THEME_CHOICE_ENDPOINT,
  type ThemeChoice,
} from "@/lib/theme-usage";

const restore: (() => void)[] = [];
afterEach(() => {
  while (restore.length) restore.pop()?.();
  vi.unstubAllGlobals();
});

function captureChoices(): ThemeChoice[] {
  const seen: ThemeChoice[] = [];
  const previous = setThemeChoiceSink((choice) => seen.push(choice));
  restore.push(() => setThemeChoiceSink(previous));
  return seen;
}

describe("見た目の選択の記録", () => {
  it("html の属性が正本になり、属性が無いときは既定の組み合わせになる", () => {
    expect(appliedChoice({}, false)).toEqual({ palette: "graphite", mode: "auto", resolved: "light" });
    expect(appliedChoice({}, true)).toEqual({ palette: "graphite", mode: "auto", resolved: "dark" });
  });

  it("「自動」のときだけ、実際に表示された明るさを端末の設定から補う", () => {
    expect(appliedChoice({ theme: "light" }, true).resolved).toBe("light");
    expect(appliedChoice({ theme: "dark" }, false).resolved).toBe("dark");
    expect(appliedChoice({ theme: "auto" }, true).resolved).toBe("dark");
  });

  it("配色と明るさを独立して読み、知らない値は既定へ落とす", () => {
    expect(appliedChoice({ theme: "dark", palette: "azure" }, false)).toEqual({
      palette: "azure",
      mode: "dark",
      resolved: "dark",
    });
    expect(appliedChoice({ theme: "sepia", palette: "crimson" }, false)).toEqual({
      palette: "graphite",
      mode: "auto",
      resolved: "light",
    });
  });

  it("選んだ組み合わせを、差し替え可能な送信先へ1票だけ渡す", () => {
    const seen = captureChoices();
    vi.stubGlobal("document", { documentElement: { dataset: { theme: "dark", palette: "moss" } } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });

    recordAppliedThemeChoice();

    expect(seen).toEqual([{ palette: "moss", mode: "dark", resolved: "dark" }]);
  });

  it("端末の設定を読めない環境でも記録を止めない", () => {
    const seen = captureChoices();
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    vi.stubGlobal("window", {});

    recordAppliedThemeChoice();

    expect(seen).toEqual([{ palette: "graphite", mode: "auto", resolved: "light" }]);
  });

  it("ブラウザの外（サーバー側の描画）では何も送らない", () => {
    const seen = captureChoices();
    vi.stubGlobal("document", undefined);

    recordAppliedThemeChoice();

    expect(seen).toEqual([]);
  });

  it("既定の送信先は、応答を待たずに集計の入口へ送り、失敗しても投げない", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      sent = { url, init };
      return Promise.reject(new Error("offline"));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { documentElement: { dataset: { palette: "azure" } } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });

    expect(() => recordAppliedThemeChoice()).not.toThrow();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent!.url).toBe(THEME_CHOICE_ENDPOINT);
    expect(sent!.init.method).toBe("POST");
    expect(sent!.init.keepalive).toBe(true);
    expect(JSON.parse(String(sent!.init.body))).toEqual({
      palette: "azure",
      mode: "auto",
      resolved: "dark",
    });
  });
});
