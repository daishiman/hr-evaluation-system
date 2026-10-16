import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { NumberField } from "@/components/NumberField";

// DOM 環境を足さず、同じ部品を描き直して hook の状態を持ち越す（form-freshness-regression.test.ts と同じ作り）。
// 欄の onChange・onPaste・onBlur を直に呼び、親へ値を渡した回数を数える。
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, changed: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <S>(initial: S | (() => S)) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => S)() : initial;
      return [hooks.slots[index] as S, (next: S | ((previous: S) => S)) => {
        const value = typeof next === "function" ? (next as (previous: S) => S)(hooks.slots[index] as S) : next;
        if (!Object.is(value, hooks.slots[index])) hooks.changed = true;
        hooks.slots[index] = value;
      }];
    },
    useRef: <T>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
  };
});

type Node = ReactElement<Record<string, unknown>>;
type Props = Parameters<typeof NumberField>[0];

function find(tree: unknown, predicate: (node: Node) => boolean): Node | undefined {
  if (Array.isArray(tree)) {
    for (const item of tree) { const found = find(item, predicate); if (found) return found; }
  } else if (isValidElement<Record<string, unknown>>(tree)) {
    if (predicate(tree)) return tree;
    for (const prop of Object.values(tree.props)) { const found = find(prop, predicate); if (found) return found; }
  }
}
function render(props: Props) {
  for (let attempt = 0; attempt < 20; attempt++) {
    hooks.cursor = 0;
    hooks.changed = false;
    const tree = NumberField(props);
    if (!hooks.changed) return tree;
  }
  throw new Error("再描画が収束しません");
}
const input = (props: Props) => {
  const found = find(render(props), (node) => node.type === "input");
  if (!found) throw new Error("入力欄がありません");
  return found;
};
const type = (props: Props, value: string) =>
  (input(props).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
const blur = (props: Props) => (input(props).props.onBlur as () => void)();
/** 欄の文字をすべて選んだ状態で貼り付ける */
const paste = (props: Props, text: string) => {
  const current = input(props).props.value as string;
  (input(props).props.onPaste as (event: unknown) => void)({
    clipboardData: { getData: () => text },
    preventDefault: () => {},
    currentTarget: { value: current, selectionStart: 0, selectionEnd: current.length, setSelectionRange: () => {} },
  });
};

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0;
  // 貼り付けのあとのカーソル合わせ（requestAnimationFrame）は、この試験では見ない
  vi.stubGlobal("requestAnimationFrame", () => 0);
});
afterEach(() => vi.unstubAllGlobals());

describe("NumberField は、値が変わったときだけ親へ知らせる", () => {
  it("同じ値のまま欄を離れても、親へ知らせない", () => {
    // 回答画面では、この知らせで「保存済み」が消え、押そうとしていた提出ボタンが動いた
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 3, onValueChange };
    blur(props);
    blur(props);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("値を変えて離れたら1回だけ知らせ、続けて離れても2回目は知らせない", () => {
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 3, onValueChange };
    type(props, "5");
    expect(onValueChange).not.toHaveBeenCalled();
    blur(props);
    blur(props);
    expect(onValueChange.mock.calls).toEqual([[5]]);
  });

  it("打っている間も渡す欄では、読んだ値が変わったときだけ知らせる", () => {
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 3, onValueChange, reportWhileTyping: true };
    // 全角で打ち直した同じ数・打ちかけの「3.」は、どちらも 3 と読むので知らせない
    type(props, "３");
    type(props, "3.");
    expect(onValueChange).not.toHaveBeenCalled();
    type(props, "3.5");
    blur(props);
    // 空欄は null として1回だけ知らせる（0 にはしない）
    type(props, "");
    blur(props);
    expect(onValueChange.mock.calls).toEqual([[3.5], [null]]);
  });

  it("貼り付けで同じ数になったときも知らせず、違う数なら知らせる", () => {
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 1200, onValueChange, reportWhileTyping: true };
    paste(props, "1,200");
    expect(input(props).props.value).toBe("1200");
    expect(onValueChange).not.toHaveBeenCalled();
    paste(props, "1,500");
    expect(onValueChange.mock.calls).toEqual([[1500]]);
  });

  it("欄の決まりに合わない数が入っていた欄を空にして離れたら、空（null）を知らせる", () => {
    // 整数だけの欄に、決まりを変える前の 1.5 が残っている。親（回答画面）は 1.5 を持っている。
    // 欄の文字から「知らせ済みの値」を読むと null になり、空にしても知らせず 1.5 が保存され続けた
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 1.5, policy: { allowDecimal: false }, onValueChange };
    type(props, "");
    blur(props);
    expect(onValueChange.mock.calls).toEqual([[null]]);
  });

  it("読めない値のまま離れたら、null を1回だけ知らせ、誤りの文は離れるたびに出す", () => {
    const onValueChange = vi.fn();
    const props: Props = { name: "n", defaultValue: 3, onValueChange };
    type(props, "3a");
    blur(props);
    blur(props);
    expect(onValueChange.mock.calls).toEqual([[null]]);
    const tree = render(props);
    expect(input(props).props["aria-invalid"]).toBe(true);
    expect(find(tree, (node) => node.props.className === "footnote text-danger")?.props.children).toBe(
      "数字で入力してください。",
    );
  });
});
