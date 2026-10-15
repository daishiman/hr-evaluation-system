import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormAnswer, type AnswerQuestion, type AnswerValue } from "@/components/FormAnswer";
import { FormBuilder } from "@/components/FormBuilder";
import { createBlankQuestion } from "@/components/form-builder-model";

// DOM 環境を追加せず、同じ部品の再描画で hook の状態を保持する。
// 実際の onChange を呼び、props 更新後の編集値と読み取り表示を検証する。
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, changed: false, save: vi.fn(),
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
    useMemo: <T>(make: () => T) => make(),
    useCallback: <T>(callback: T) => callback,
    useLayoutEffect: (effect: () => void) => effect(),
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
      // 並べ替えの一覧（ReorderList）は行の中身を renderItem、行の操作を renderActions で描く。その中も探す
      const { items, renderItem, renderActions } = value.props;
      if (Array.isArray(items) && typeof renderItem === "function") {
        type Draw = (item: unknown, index: number) => unknown;
        return visit(items.map((item, index) => [
          (renderItem as Draw)(item, index),
          typeof renderActions === "function" ? (renderActions as Draw)(item, index) : null,
        ]));
      }
    }
  };
  const found = visit(tree);
  if (!found) throw new Error("対象の表示・入力欄がありません");
  return found;
}
const named = (name: string) => (node: Node) => typeof node.type === "function" && node.type.name === name;
function render<T>(component: (props: T) => ReactNode, props: T) {
  for (let attempt = 0; attempt < 20; attempt++) {
    hooks.cursor = 0;
    hooks.changed = false;
    const tree = component(props);
    if (!hooks.changed) return tree;
  }
  throw new Error("再描画が収束しません");
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
  it("保存待ちの外部更新と保存失敗では未保存の入力を消さない", async () => {
    const props = { formId: "f1", initial, editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    (find(render(FormBuilder, props), (node) => node.type === "input" && node.props.value === "旧設問").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "保持する未保存入力" } });
    let finish!: (result: { ok: boolean; message: string }) => void;
    hooks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const save = find(render(FormBuilder, props), (node) => node.props.children === "設問を保存する");
    const pending = (save.props.onClick as () => Promise<void>)();
    const latest = { ...props, initial: [{ ...initial[0], title: "別タブの保存" }] };
    const waiting = render(FormBuilder, latest);
    expect(find(waiting, (node) => node.type === "input" && node.props.value === "保持する未保存入力")).toBeDefined();
    finish({ ok: false, message: "保存できませんでした。" });
    await pending;
    const failed = render(FormBuilder, latest);
    expect(find(failed, (node) => node.type === "input" && node.props.value === "保持する未保存入力")).toBeDefined();
    expect(find(failed, (node) => node.props.children === "設問を保存する").props.disabled).toBe(true);
  });

  it("成功しても最新propsが送った内容と違えば外部更新を自分の保存結果と誤認しない", async () => {
    const props = { formId: "f1", initial, editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    (find(render(FormBuilder, props), (node) => node.type === "input" && node.props.value === "旧設問").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "今回送る内容" } });
    const latest = { ...props, initial: [{ ...initial[0], title: "別タブの更新" }] };
    hooks.save.mockImplementationOnce(async () => {
      render(FormBuilder, latest);
      return { ok: true, message: "保存しました。" };
    });
    const save = find(render(FormBuilder, props), (node) => node.props.children === "設問を保存する");
    await (save.props.onClick as () => Promise<void>)();
    const tree = render(FormBuilder, latest);
    expect(find(tree, (node) => node.type === "input" && node.props.value === "今回送る内容")).toBeDefined();
    expect(find(tree, (node) => node.props.children === "設問を保存する").props.disabled).toBe(true);
  });

  it.each(["number", "text"])("singleから%sへ変えた設問には選択肢を残さない", async (questionType) => {
    const props = { formId: "f1", initial: [{ ...initial[0], questionType: "single", options: [{ value: "1", label: "甲" }, { value: "2", label: "乙" }] }], editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    const type = find(render(FormBuilder, props), (node) => node.type === "select" && node.props.value === "single");
    (type.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: questionType } });
    const save = find(render(FormBuilder, props), (node) => node.props.children === "設問を保存する");
    await (save.props.onClick as () => Promise<void>)();
    expect(hooks.save.mock.calls[0][0].questions[0]).toMatchObject({ questionType, options: undefined });
  });
  it("未編集なら、設問の作り直しで新しい設問の本文とIDを使う", async () => {
    const props = { formId: "f1", initial, editable: true };
    render(FormBuilder, props);
    const latest = [{ ...initial[0], id: "rebuilt", title: "作り直した設問" }];
    const tree = render(FormBuilder, { ...props, initial: latest });
    const list = find(tree, named("ReorderList"));
    expect((list.props.items as { label: string }[]).map((item) => item.label)).toEqual(["作り直した設問"]);
    const save = find(tree, (node) => node.props.children === "設問を保存する");
    await (save.props.onClick as () => Promise<void>)();
    expect(hooks.save.mock.calls[0][0].questions[0]).toMatchObject({ id: "rebuilt", title: "作り直した設問" });
  });

  it("自分の保存後は、追加設問の採番済みIDを次の保存に引き継ぐ", async () => {
    const props = { formId: "f1", initial, editable: true };
    const first = render(FormBuilder, props);
    (find(first, (node) => node.props.children === "文章で書く").props.onClick as () => void)();
    const added = render(FormBuilder, props);
    (find(added, (node) => node.type === "input" && node.props.value === "").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "追加設問" } });
    const latest = [...initial, { ...initial[0], id: "assigned", title: "追加設問" }];
    hooks.save.mockImplementationOnce(async () => {
      render(FormBuilder, { ...props, initial: latest });
      return { ok: true, message: "保存しました。" };
    });
    const save = (tree: unknown) => find(tree, (node) => node.props.children === "設問を保存する").props.onClick as () => Promise<void>;
    await save(render(FormBuilder, props))();
    await save(render(FormBuilder, { ...props, initial: latest }))();
    expect(hooks.save.mock.calls[1][0].questions[1]).toMatchObject({ id: "assigned", title: "追加設問" });
  });
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
    const edit = find(tree, (node) => node.props.children === "内容を直す");
    (edit.props.onClick as () => void)();
    const opened = render(FormBuilder, props);
    const input = find(opened, (node) => node.type === "input" && node.props.value === "旧設問");
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "未保存設問" } });
    const refreshed = render(FormBuilder, { ...props, initial: [{ ...initial[0], title: "別タブ設問" }] });
    expect(find(refreshed, (node) => node.type === "input" && node.props.value === "未保存設問")).toBeDefined();
    const save = find(refreshed, (node) => node.props.children === "設問を保存する");
    expect(save.props.disabled).toBe(true);
    expect(renderToStaticMarkup(find(refreshed, named("ReasonNote")))).toContain("未保存の入力は残しています");
  });
});
