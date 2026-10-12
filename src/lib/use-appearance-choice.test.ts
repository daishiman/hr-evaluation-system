import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
import { DEFAULT_PALETTE, PALETTE_STORAGE_KEY } from "@/lib/palette";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { setThemeChoiceSink, type ThemeChoice } from "@/lib/theme-usage";

// ブラウザ依存パッケージを増やさず、mount と再描画の境界だけを再現する。
// 検証対象は実際の選択ボタンの aria-pressed、適用済み DOM、保存値。
const renderState = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  mounting: false,
  effects: [] as (() => void)[],
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: <T>(initial: T | (() => T)) => {
    const index = renderState.cursor++;
    if (!(index in renderState.values)) {
      renderState.values[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    }
    return [renderState.values[index] as T, (next: T | ((previous: T) => T)) => {
      renderState.values[index] = typeof next === "function"
        ? (next as (previous: T) => T)(renderState.values[index] as T)
        : next;
    }];
  },
  useEffect: (effect: () => void) => {
    if (renderState.mounting) renderState.effects.push(effect);
  },
}));

type ButtonProps = { "aria-label"?: string; "aria-pressed"?: boolean; onClick?: () => void };

function buttons(node: ReactNode): ButtonProps[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (typeof node.type === "function") {
    const props = node.props;
    return buttons((node.type as (elementProps: typeof props) => ReactNode)(props));
  }
  if (node.type === "button") return [node.props as ButtonProps];
  return buttons(node.props.children);
}

function menu(...components: (() => ReactNode)[]) {
  function render() {
    renderState.cursor = 0;
    return components.flatMap((component) => buttons(component()));
  }
  renderState.values = [];
  renderState.effects = [];
  renderState.mounting = true;
  render();
  renderState.mounting = false;
  for (const effect of renderState.effects) effect();
  return {
    button(label: string) {
      const button = render().find((candidate) => candidate["aria-label"]?.startsWith(label));
      if (!button) throw new Error(`選択肢がありません: ${label}`);
      return button;
    },
    choose(label: string) { this.button(label).onClick?.(); },
  };
}

let dataset: { theme?: string; palette?: string };
let saved: Map<string, string>;
let choices: ThemeChoice[];
let restoreSink: () => void;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
  dataset = {};
  saved = new Map();
  choices = [];
  storage = {
    getItem: vi.fn((key: string) => saved.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { saved.set(key, value); }),
    removeItem: vi.fn((key: string) => { saved.delete(key); }),
  };
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("localStorage", storage);
  const previous = setThemeChoiceSink((choice) => choices.push(choice));
  restoreSink = () => { setThemeChoiceSink(previous); };
});

afterEach(() => {
  restoreSink();
  vi.unstubAllGlobals();
});

describe("外観選択の復元と変更", () => {
  it.each([
    { Component: ThemeToggle, key: THEME_STORAGE_KEY, attribute: "theme" as const, old: "light", next: "dark", oldLabel: "画面の明るさ: 明るい", nextLabel: "画面の明るさ: 暗い" },
    { Component: PaletteToggle, key: PALETTE_STORAGE_KEY, attribute: "palette" as const, old: "azure", next: "moss", oldLabel: "画面の配色: ブルー", nextLabel: "画面の配色: グリーン" },
  ])("$attribute: 保存できなくてもメニュー再表示後の選択が画面に一致し、前の見た目へ戻せる", ({ Component, key, attribute, old, next, oldLabel, nextLabel }) => {
    saved.set(key, old);
    dataset[attribute] = old;
    storage.setItem.mockImplementation(() => { throw new Error("storage unavailable"); });

    menu(Component).choose(nextLabel);
    expect(dataset[attribute]).toBe(next);
    expect(saved.get(key)).toBe(old);
    const reopened = menu(Component);
    expect(reopened.button(nextLabel)["aria-pressed"]).toBe(true);
    reopened.choose(oldLabel);
    expect(dataset[attribute]).toBe(old);
    expect(reopened.button(oldLabel)["aria-pressed"]).toBe(true);
    expect(choices).toHaveLength(2);
  });

  it("保存先が読めなくても、適用済みの明るさと配色から選択を復元する", () => {
    dataset.theme = "dark";
    dataset.palette = "graphite";
    storage.getItem.mockImplementation(() => { throw new Error("storage unavailable"); });

    const opened = menu(ThemeToggle, PaletteToggle);
    expect(opened.button("画面の明るさ: 暗い")["aria-pressed"]).toBe(true);
    expect(opened.button("画面の配色: グレー")["aria-pressed"]).toBe(true);
    expect(choices).toEqual([]);
  });

  it("属性がない場合と不明な値の場合は、自動・インディゴを選択する", () => {
    for (const attributes of [{}, { theme: "sepia", palette: "crimson" }]) {
      Object.assign(dataset, attributes);
      const opened = menu(ThemeToggle, PaletteToggle);
      expect(opened.button("画面の明るさ: 自動")["aria-pressed"]).toBe(true);
      expect(opened.button("画面の配色: インディゴ")["aria-pressed"]).toBe(true);
    }
    expect(DEFAULT_PALETTE).toBe("indigo");
  });

  it("選択中の札を押し直しても、保存や現在設定の記録を繰り返さない", () => {
    dataset.theme = "dark";
    dataset.palette = "moss";
    const opened = menu(ThemeToggle, PaletteToggle);

    opened.choose("画面の明るさ: 暗い");
    opened.choose("画面の配色: グリーン");

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(choices).toEqual([]);
    expect(dataset).toEqual({ theme: "dark", palette: "moss" });
  });

  it("明るさと配色を独立して変更・保存し、適用後の組み合わせを記録する", () => {
    dataset.theme = "light";
    dataset.palette = "azure";
    const opened = menu(ThemeToggle, PaletteToggle);

    opened.choose("画面の明るさ: 暗い");
    expect(dataset).toEqual({ theme: "dark", palette: "azure" });
    opened.choose("画面の配色: グリーン");
    expect(dataset).toEqual({ theme: "dark", palette: "moss" });
    expect(saved.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(saved.get(PALETTE_STORAGE_KEY)).toBe("moss");
    expect(choices).toEqual([
      { palette: "azure", mode: "dark", resolved: "dark" },
      { palette: "moss", mode: "dark", resolved: "dark" },
    ]);
  });

  it("自動・既定配色へ戻すと、それぞれの属性と保存値だけを取り除く", () => {
    dataset.theme = "dark";
    dataset.palette = "graphite";
    saved.set(THEME_STORAGE_KEY, "dark");
    saved.set(PALETTE_STORAGE_KEY, "graphite");
    const opened = menu(ThemeToggle, PaletteToggle);

    opened.choose("画面の明るさ: 自動");
    expect(dataset).toEqual({ palette: "graphite" });
    expect(saved.has(THEME_STORAGE_KEY)).toBe(false);
    expect(saved.get(PALETTE_STORAGE_KEY)).toBe("graphite");
    opened.choose("画面の配色: インディゴ");
    expect(dataset).toEqual({});
    expect(saved.has(PALETTE_STORAGE_KEY)).toBe(false);
    expect(choices.at(-1)).toEqual({ palette: DEFAULT_PALETTE, mode: "auto", resolved: "light" });
  });

  it("保存値を削除できなくても既定の見た目を適用し、再表示後も選択を維持する", () => {
    dataset.theme = "dark";
    dataset.palette = "graphite";
    saved.set(THEME_STORAGE_KEY, "dark");
    saved.set(PALETTE_STORAGE_KEY, "graphite");
    storage.removeItem.mockImplementation(() => { throw new Error("storage unavailable"); });
    const opened = menu(ThemeToggle, PaletteToggle);
    opened.choose("画面の明るさ: 自動");
    opened.choose("画面の配色: インディゴ");

    expect(dataset).toEqual({});
    const reopened = menu(ThemeToggle, PaletteToggle);
    expect(reopened.button("画面の明るさ: 自動")["aria-pressed"]).toBe(true);
    expect(reopened.button("画面の配色: インディゴ")["aria-pressed"]).toBe(true);
    expect(choices).toHaveLength(2);
  });
});
