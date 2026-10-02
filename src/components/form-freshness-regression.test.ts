import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormAnswer, type AnswerQuestion, type AnswerValue } from "@/components/FormAnswer";
import { FormBuilder } from "@/components/FormBuilder";
import { createBlankQuestion } from "@/components/form-builder-model";

// DOM 環境を追加せず、同じ部品の再描画で hook の状態を保持する。
// 実際の onChange を呼び、props 更新後の編集値と読み取り表示を検証する。
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, save: vi.fn(),
  effects: new Map<number, { deps: unknown[]; cleanup?: () => void }>(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <S>(initial: S | (() => S)) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => S)() : initial;
      return [hooks.slots[index] as S, (next: S | ((previous: S) => S)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (previous: S) => S)(hooks.slots[index] as S) : next;
      }];
    },
    useRef: <T>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
    useMemo: <T>(make: () => T) => make(),
    useCallback: <T>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = hooks.cursor++;
      const previous = hooks.effects.get(index);
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
      previous?.cleanup?.();
      const cleanup = effect();
      hooks.effects.set(index, { deps, cleanup: cleanup || undefined });
    },
  };
});
vi.mock("@/lib/use-refresh", () => ({ useSaveAction: () => ({ save: hooks.save, saving: false }) }));
vi.mock("@/actions/forms", () => ({ saveFormQuestions: vi.fn() }));
vi.mock("@/actions/responses", () => ({ saveResponse: vi.fn() }));

type Node = ReactElement<Record<string, unknown>>;
function find(tree: unknown, predicate: (node: Node) => boolean): Node {
  const visit = (value: unknown): Node | undefined => {
    if (Array.isArray(value)) {
      for (const item of value) { const found = visit(item); if (found) return found; }
    } else if (isValidElement<Record<string, unknown>>(value)) {
      if (predicate(value)) return value;
      for (const prop of Object.values(value.props)) { const found = visit(prop); if (found) return found; }
    }
  };
  const found = visit(tree);
  if (!found) throw new Error("対象の表示・入力欄がありません");
  return found;
}
const named = (name: string) => (node: Node) => typeof node.type === "function" && node.type.name === name;
function render<T>(component: (props: T) => ReactNode, props: T) {
  hooks.cursor = 0;
  return component(props);
}

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.effects.clear();
  hooks.save.mockReset().mockResolvedValue({ ok: true, message: "保存しました。" });
  vi.useFakeTimers();
});
afterEach(() => {
  for (const { cleanup } of hooks.effects.values()) cleanup?.();
  vi.clearAllTimers(); vi.useRealTimers();
});

const question: AnswerQuestion = {
  id: "q1", section: "free", questionType: "text", title: "回答内容", helpText: null, unit: null,
  required: false, validationMin: null, validationMax: null, validationInteger: false,
  optionsJson: null, displayOrder: 0,
};
const answer = (text: string): AnswerValue => ({
  questionId: "q1", valueNumber: null, valueText: text, valueChoices: null,
});

describe("FormAnswer の再取得", () => {
  const draftProps = { formId: "f1", questions: [question], initial: [answer("旧回答")], submitted: false,
    lockedReason: null, deadlineNote: null, note: null };
  const changeMemo = (text: string) => {
    const tree = render(FormAnswer, draftProps);
    const memo = find(tree, (node) => node.type === "textarea");
    (memo.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: text } });
  };
  const saveStatus = () => renderToStaticMarkup(
    find(render(FormAnswer, draftProps), named("StickyActionBar")).props.status as ReactElement,
  );

  it.each([true, false])("次の下書きは前の保存（成功=%s）を待ち、最新入力の完了まで保存済みと表示しない", async (firstOk) => {
    let finish!: (result: { ok: boolean; message: string }) => void;
    let finishLatest!: (result: { ok: boolean; message: string }) => void;
    hooks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    hooks.save.mockReturnValueOnce(new Promise((resolve) => { finishLatest = resolve; }));
    changeMemo("前半");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    changeMemo("前半／後半");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    expect(saveStatus()).not.toContain("保存済み");
    finish({ ok: firstOk, message: firstOk ? "保存しました。" : "送れませんでした。" });
    await vi.advanceTimersByTimeAsync(0);
    expect(hooks.save).toHaveBeenCalledTimes(2);
    expect(hooks.save.mock.calls.map(([payload]) => payload.note)).toEqual(["前半", "前半／後半"]);
    expect(saveStatus()).not.toContain("保存済み");
    finishLatest({ ok: true, message: "保存しました。" });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveStatus()).toContain("保存済み");
  });

  it("保存済みの後の追加入力と保存失敗では、保存済み表示を残さない", async () => {
    changeMemo("保存できた内容");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveStatus()).toContain("保存済み");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "送れませんでした。" });
    changeMemo("未保存の続き");
    expect(saveStatus()).not.toContain("保存済み");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveStatus()).not.toContain("保存済み");
    const tree = render(FormAnswer, draftProps);
    expect(find(tree, (node) => node.type === "textarea").props.value).toBe("未保存の続き");
    expect(renderToStaticMarkup(find(tree, named("ReasonNote")))).toContain("送れませんでした。");
  });

  it("提出済みへ切り替わると予約中と待ち行列の下書きを送らない", async () => {
    let finish!: (result: { ok: boolean; message: string }) => void;
    hooks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    changeMemo("送信中");
    await vi.advanceTimersByTimeAsync(1000);
    changeMemo("待ち行列");
    await vi.advanceTimersByTimeAsync(1000);
    changeMemo("予約中");
    render(FormAnswer, { ...draftProps, submitted: true });
    finish({ ok: true, message: "保存しました。" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(hooks.save).toHaveBeenCalledTimes(1);
  });

  it.each(["submitted", "locked"])("%s になった読み取り表示には最新の保存値を使う", (mode) => {
    const props = { formId: "f1", questions: [question], initial: [answer("旧回答")], submitted: false,
      lockedReason: null as string | null, deadlineNote: null, note: null };
    render(FormAnswer, props);
    const tree = render(FormAnswer, { ...props, initial: [answer("最新回答")],
      submitted: mode === "submitted", lockedReason: mode === "locked" ? "締切済み" : null });
    const html = renderToStaticMarkup(find(tree, named("AnswerReadOnly")));
    expect(html).toContain("最新回答");
    expect(html).not.toContain("旧回答");
  });

  it("編集可能なまま再取得しても未保存の回答と補足を保持する", () => {
    const props = { formId: "f1", questions: [question], initial: [answer("旧回答")], submitted: false,
      lockedReason: null, deadlineNote: null, note: "旧補足" };
    const tree = render(FormAnswer, props);
    const field = find(tree, named("QuestionField"));
    (field.props.onChange as (patch: Partial<AnswerValue>) => void)({ valueText: "未保存回答" });
    const memo = find(tree, (node) => node.type === "textarea");
    (memo.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "未保存補足" } });
    const refreshed = render(FormAnswer, { ...props, initial: [answer("別タブ回答")], note: "別タブ補足" });
    expect((find(refreshed, named("QuestionField")).props.value as AnswerValue).valueText).toBe("未保存回答");
    expect(find(refreshed, (node) => node.type === "textarea").props.value).toBe("未保存補足");
  });
});

describe("FormBuilder の再取得", () => {
  const initial = [{ ...createBlankQuestion("free", "text", "unused"), id: "q1", title: "旧設問" }];
  it("公開後の設問本文と件数は最新の保存値を使う", () => {
    const props = { formId: "f1", initial, editable: true };
    render(FormBuilder, props);
    const updated = [{ ...initial[0], title: "最新設問" }, { ...initial[0], id: "q2", title: "追加設問" }];
    const tree = render(FormBuilder, { ...props, initial: updated, editable: false });
    const list = find(tree, named("QuestionList"));
    expect(list.props.rows).toHaveLength(2);
    const html = renderToStaticMarkup(list);
    expect(html).toContain("最新設問");
    expect(html).toContain("追加設問");
    expect(html).not.toContain("旧設問");
  });

  it("編集可能なまま再取得しても未保存の設問文と開いている欄を保持する", () => {
    const props = { formId: "f1", initial, editable: true };
    const tree = render(FormBuilder, props);
    const edit = find(tree, (node) => node.props.children === "編集");
    (edit.props.onClick as () => void)();
    const opened = render(FormBuilder, props);
    const input = find(opened, (node) => node.type === "input" && node.props.value === "旧設問");
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "未保存設問" } });
    const refreshed = render(FormBuilder, { ...props, initial: [{ ...initial[0], title: "別タブ設問" }] });
    expect(find(refreshed, (node) => node.type === "input" && node.props.value === "未保存設問")).toBeDefined();
  });
});
