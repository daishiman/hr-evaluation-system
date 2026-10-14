import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { InfoTip } from "./InfoTip";
import { RecordForm } from "./RecordForm";

// 実際のイベントハンドラを順に呼ぶ。ブラウザのfocus/click順序はE2Eでも確かめる。
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <S>(initial: S | (() => S)) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => S)() : initial;
      return [hooks.slots[index] as S, (next: S | ((prev: S) => S)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (prev: S) => S)(hooks.slots[index] as S) : next;
      }];
    },
    useRef: <T>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
    useId: () => "interaction-test",
    useCallback: <T>(callback: T) => callback,
    useEffect: () => {},
    useLayoutEffect: () => {},
  };
});
vi.mock("react-dom", () => ({ createPortal: (children: unknown) => children }));
vi.mock("@/lib/use-refresh", () => ({ useSaveAction: () => ({ save: vi.fn(), saving: false }) }));

type Node = ReactElement<Record<string, unknown>>;
function find(value: unknown, predicate: (node: Node) => boolean): Node | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = find(item, predicate); if (found) return found; }
  } else if (isValidElement<Record<string, unknown>>(value)) {
    if (predicate(value)) return value;
    return find(value.props.children, predicate);
  }
}

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0;
  vi.stubGlobal("window", { clearTimeout: vi.fn() });
  vi.stubGlobal("document", { body: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("InfoTip の入力手段", () => {
  const draw = () => {
    hooks.cursor = 0;
    return InfoTip({ label: "閲覧の条件", children: "所属会社だけを閲覧できます。" });
  };
  const button = (tree: unknown) => find(tree, (node) => node.type === "button")!;
  const visible = (tree: unknown) => !!find(tree, (node) => node.props.role === "tooltip");
  it("初回タップはfocusのあとも説明を残し、次のタップで閉じる", () => {
    let tree = draw();
    (button(tree).props.onPointerDown as (event: { pointerType: string }) => void)({ pointerType: "touch" });
    (button(tree).props.onFocus as () => void)();
    tree = draw();
    (button(tree).props.onClick as (event: { detail: number }) => void)({ detail: 1 });
    tree = draw();
    expect(visible(tree)).toBe(true);
    (button(tree).props.onPointerDown as (event: { pointerType: string }) => void)({ pointerType: "touch" });
    (button(tree).props.onClick as (event: { detail: number }) => void)({ detail: 1 });
    expect(visible(draw())).toBe(false);
  });
  it("キーボードのfocusだけでも条件を表示する", () => {
    const tree = draw();
    (button(tree).props.onFocus as () => void)();
    expect(visible(draw())).toBe(true);
  });
});

describe("RecordForm のEnter", () => {
  const draw = () => RecordForm({ action: vi.fn(), resource: "forms", fields: [], submitLabel: "保存する" });
  it("保存・写すボタンではEnterの標準動作を妨げない", () => {
    const form = find(draw(), (node) => node.type === "form")!;
    const preventDefault = vi.fn();
    (form.props.onKeyDown as (event: unknown) => void)({ key: "Enter", target: { tagName: "BUTTON", closest: () => ({}) }, nativeEvent: {}, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });
  it("日本語変換中のEnterは引き続き妨げない", () => {
    const form = find(draw(), (node) => node.type === "form")!;
    const preventDefault = vi.fn();
    (form.props.onKeyDown as (event: unknown) => void)({ key: "Enter", target: { tagName: "INPUT", closest: () => null }, nativeEvent: { isComposing: true }, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
