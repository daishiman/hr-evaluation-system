import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormAnswer, type AnswerQuestion, type AnswerValue } from "@/components/FormAnswer";
import { FormBuilder } from "@/components/FormBuilder";
import { createBlankQuestion } from "@/components/form-builder-model";
import { checkSubmission, normalizeAnswers } from "@/lib/submission-check";

// DOM 環境を追加せず、同じ部品の再描画で hook の状態を保持する。
// 実際の onChange を呼び、props 更新後の編集値と読み取り表示を検証する。
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, changed: false, save: vi.fn(),
  effects: new Map<number, { deps: unknown[]; cleanup?: () => void }>(),
  // useSaveAction を描画の中で呼んだ数。FormAnswer は 0 番目が提出、1 番目が下書きの保存
  actions: 0, pending: { submit: false, draft: false },
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
vi.mock("@/lib/use-refresh", () => ({
  useSaveAction: () => ({ save: hooks.save, saving: hooks.actions++ === 0 ? hooks.pending.submit : hooks.pending.draft }),
}));
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
    hooks.actions = 0;
    hooks.changed = false;
    const tree = component(props);
    if (!hooks.changed) return tree;
  }
  throw new Error("再描画が収束しません");
}

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.effects.clear();
  hooks.actions = 0; hooks.pending = { submit: false, draft: false };
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

describe("FormAnswer の保存の状態と確認の欄", () => {
  const choice: AnswerQuestion = { ...question, id: "q2", questionType: "multi", title: "選ぶ設問" };
  const props = { formId: "f1", questions: [question, choice], submitted: false, lockedReason: null, note: null,
    initial: [answer("旧回答"), { questionId: "q2", valueNumber: null, valueText: null, valueChoices: ["甲"] }],
    deadlineNote: null as string | null };
  const onChangeOf = (id: string, current = props) =>
    find(render(FormAnswer, current), (node) => named("QuestionField")(node) && (node.props.q as AnswerQuestion).id === id)
      .props.onChange as (patch: Partial<AnswerValue>) => void;
  // 帯の状態の文（タグと、文字の並びの区切りを落とした文字だけ）
  const status = (current = props) => renderToStaticMarkup(
    find(render(FormAnswer, current), named("StickyActionBar")).props.status as ReactElement,
  ).replace(/<[^>]*>/g, "");
  const has = (tree: unknown, predicate: (node: Node) => boolean) => {
    try { find(tree, predicate); return true; } catch { return false; }
  };
  // 理由の知らせ（ReasonNote）の文を、木の中からすべて集める
  const notes = (tree: unknown) => {
    const found: string[] = [];
    has(tree, (node) => { if (named("ReasonNote")(node)) found.push(renderToStaticMarkup(node)); return false; });
    return found;
  };
  // detail は続けて押した回数（1 回目は 1、2 回目は 2。キーボードで押すと 0）
  const press = (tree: unknown, label: string, detail = 1) =>
    (find(tree, (node) => named("Button")(node) && node.props.children === label).props.onClick as (event: { detail: number }) => Promise<void> | void)({ detail });
  // 確認の欄の「提出する」。送っている間は文が変わるので、文ではなく種類で探す
  const submitButton = (tree: unknown) => find(tree, (node) => named("Button")(node) && node.props.variant === "primary");
  const sentAnswer = (call: number, id: string) =>
    (hooks.save.mock.calls[call][0].answers as AnswerValue[]).find((a) => a.questionId === id);

  it("保存済みのあと、同じ値の知らせでは保存済みを消さず、下書きも送り直さない", async () => {
    onChangeOf("q1")({ valueText: "新しい回答" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    expect(status()).toContain("保存済み");
    // 数値欄から離れたときと同じ形の知らせ（値は変わっていない）
    onChangeOf("q1")({ valueText: "新しい回答" });
    expect(status()).toContain("保存済み");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    // 値が変われば、保存済みは消す（保存できていないのに保存済みと見せない）
    onChangeOf("q1")({ valueText: "さらに直した回答" });
    expect(status()).not.toContain("保存済み");
  });

  it("選んだ選択肢は中身で比べる（同じ並びの選び直しは変更にしない）", async () => {
    onChangeOf("q2")({ valueChoices: ["甲"] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).not.toHaveBeenCalled();
    expect(status()).not.toContain("保存待ち");
    onChangeOf("q2")({ valueChoices: ["甲", "乙"] });
    expect(status()).toContain("保存待ち");
  });

  it("開いた直後は保存の状態を書かず、変えたら「保存待ち」、保存できなければそう書く", async () => {
    const initial = status();
    expect(initial).toContain("入力できた項目");
    // 「入力すると自動で保存されます」のような案内は帯に置かない（本文の先頭に置く）
    expect(initial).not.toContain("保存");
    expect(initial).not.toContain("|");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "送れませんでした。" });
    onChangeOf("q1")({ valueText: "直した回答" });
    expect(status()).toContain("保存待ち");
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toContain("保存できていません");
  });

  it("締切の案内は、保存の状態が無いときも区切りの「／」なしで出す", () => {
    const withDeadline = { ...props, deadlineNote: "期限の案内" };
    expect(status(withDeadline)).toMatch(/\|期限の案内$/);
    onChangeOf("q1", withDeadline)({ valueText: "直した回答" });
    expect(status(withDeadline)).toMatch(/保存待ち／ 期限の案内$/);
  });

  it("確認の欄を開いている間は、断られた理由をその欄の中に1回だけ出す", async () => {
    const message = "回答期限を過ぎたため、保存できません。";
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message });
    await press(render(FormAnswer, props), "提出する");
    const tree = render(FormAnswer, props);
    const card = find(tree, (node) => named("Card")(node) && has(node.props.children, (child) => child.props.children === "この内容で提出します"));
    expect(notes(card).filter((html) => html.includes(message))).toHaveLength(1);
    expect(notes(tree).filter((html) => html.includes(message))).toHaveLength(1);
    // 見出しへ読み上げの位置を移せる（確認の欄に入ったとき）
    expect(find(card, (node) => node.props.children === "この内容で提出します").props.tabIndex).toBe(-1);
    // 入力に戻ったら、理由は本文の先頭に出す
    press(tree, "入力に戻る");
    const back = render(FormAnswer, props);
    expect(has(back, (node) => node.props.children === "この内容で提出します")).toBe(false);
    expect(notes(back).filter((html) => html.includes(message))).toHaveLength(1);
  });

  it("未入力で断られたときは、同じ文を2つ出さず、最初の未入力の欄へ移る手段を添える", async () => {
    const required = { ...props, questions: [question, { ...choice, required: true }], initial: [answer("旧回答")] };
    const missing = "未入力の項目が1件あります（例：選ぶ設問）。入力してから提出してください。";
    press(render(FormAnswer, required), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: missing });
    await press(render(FormAnswer, required), "提出する");
    const tree = render(FormAnswer, required);
    expect(notes(tree).filter((html) => html.includes(missing))).toHaveLength(1);
    expect(has(tree, (node) => named("Button")(node) && node.props.children === "最初の未入力の欄へ移る")).toBe(true);
  });

  it("未入力の例は、画面の上から最初の未入力の欄にする（設問を保存した順ではない）", () => {
    // 保存した順は 自由記入 → 実績 だが、画面では 実績の数値 の節が 自由記入 より上に来る
    const free: AnswerQuestion = { ...question, id: "q3", title: "自由に書く設問", required: true };
    const kpi: AnswerQuestion = { ...question, id: "q4", section: "kpi", questionType: "number", title: "実績の設問", required: true };
    const order = { ...props, questions: [free, kpi], initial: [] };
    press(render(FormAnswer, order), "内容を確認して提出する");
    expect(notes(render(FormAnswer, order)).join("")).toContain("（例：実績の設問）");
  });

  it("提出を断られたあとに値を変えたら「保存待ち」と書く（保存に失敗したとは書かない）", async () => {
    onChangeOf("q1")({ valueText: "直した回答" });
    await vi.advanceTimersByTimeAsync(1000);
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "回答期限を過ぎたため、保存できません。" });
    await press(render(FormAnswer, props), "提出する");
    onChangeOf("q1")({ valueText: "さらに直した回答" });
    expect(status()).toContain("保存待ち");
    expect(status()).not.toContain("保存できていません");
  });

  it("下書きの保存に失敗したあとも、値を変えたら次の保存までは「保存待ち」と書く", async () => {
    hooks.save.mockResolvedValueOnce({ ok: false, message: "送れませんでした。" });
    onChangeOf("q1")({ valueText: "直した回答" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toContain("保存できていません");
    onChangeOf("q1")({ valueText: "さらに直した回答" });
    expect(status()).toContain("保存待ち");
    expect(status()).not.toContain("保存できていません");
  });

  it("下書きを保存している間も「提出する」を押せる（提出は保存の後ろに並ぶ）", () => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.pending.draft = true;
    const tree = render(FormAnswer, props);
    expect(submitButton(tree).props.disabled).toBe(false);
    expect(find(tree, named("FieldGroup")).props.disabled).toBe(false);
  });

  it("提出の返事を待つ間は押せず、描き直す前に続けて押しても1回しか送らない", async () => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    let finish!: (result: { ok: boolean; message: string }) => void;
    hooks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const before = render(FormAnswer, props);
    const first = press(before, "提出する");
    // 描き直す前の木（押せる見た目のまま）をもう一度押す
    const second = press(before, "提出する");
    await vi.advanceTimersByTimeAsync(0);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    const waiting = render(FormAnswer, props);
    expect(submitButton(waiting).props.disabled).toBe(true);
    expect(submitButton(waiting).props.children).toBe("提出しています…");
    expect(find(waiting, named("FieldGroup")).props.disabled).toBe(true);
    expect(status()).toContain("提出しています…");
    finish({ ok: false, message: "回答期限を過ぎたため、保存できません。" });
    await Promise.all([first, second]);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    // 断られたら、また押せる
    expect(submitButton(render(FormAnswer, props)).props.disabled).toBe(false);
  });

  it("続けて押した2回目（確認を開いたボタンと同じ場所に出る）では提出しない", async () => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    await press(render(FormAnswer, props), "提出する", 2);
    expect(hooks.save).not.toHaveBeenCalled();
  });

  it.each([1, 0])("1回だけ押したとき（detail=%i。0 はキーボード）は提出する", async (detail) => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    await press(render(FormAnswer, props), "提出する", detail);
    expect(hooks.save).toHaveBeenCalledTimes(1);
    expect(hooks.save.mock.calls[0][0]).toMatchObject({ status: "submitted" });
  });

  it("提出を断られたら、押す前に予約を取り消した変更を下書きに保存し直す", async () => {
    onChangeOf("q1")({ valueText: "直した回答" });
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "回答期限を過ぎたため、保存できません。" });
    await press(render(FormAnswer, props), "提出する");
    expect(hooks.save).toHaveBeenCalledTimes(1);
    expect(status()).toContain("保存待ち");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(2);
    expect(hooks.save.mock.calls[1][0]).toMatchObject({ status: "draft" });
    expect(sentAnswer(1, "q1")?.valueText).toBe("直した回答");
    expect(status()).toContain("保存済み");
  });

  it("提出を断られた理由は、取り消した変更を下書きに保存し直したあとも確認の欄に残る", async () => {
    // 下書きは範囲を問わずに通るので、保存し直しが成功しても提出の断りは片づいていない
    const reason = "回答内容は100文字以内で入力してください。";
    onChangeOf("q1")({ valueText: "直した回答" });
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: reason });
    await press(render(FormAnswer, props), "提出する");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save.mock.calls[1][0]).toMatchObject({ status: "draft" });
    const card = find(render(FormAnswer, props), (node) => named("Card")(node) && has(node.props.children, (child) => child.props.children === "この内容で提出します"));
    expect(notes(card).filter((html) => html.includes(reason))).toHaveLength(1);
  });

  it("確認の欄を開いている間の下書きの失敗は、欄の中に提出の断りとして出さない", async () => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "送れませんでした。" });
    onChangeOf("q1")({ valueText: "確認中に直した回答" });
    await vi.advanceTimersByTimeAsync(1000);
    const tree = render(FormAnswer, props);
    const card = find(tree, (node) => named("Card")(node) && has(node.props.children, (child) => child.props.children === "この内容で提出します"));
    expect(notes(card).join("")).not.toContain("送れませんでした。");
    // 下書きの失敗は、帯の「保存できていません」と本文の先頭の知らせに出す
    expect(notes(tree).filter((html) => html.includes("送れませんでした。"))).toHaveLength(1);
    expect(status()).toContain("保存できていません");
  });

  it("提出と下書きの保存し直しが同じ理由で断られても、その文は画面に1回だけ出す", async () => {
    const reason = "回答期限を過ぎたため、保存できません。";
    onChangeOf("q1")({ valueText: "直した回答" });
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: reason }).mockResolvedValueOnce({ ok: false, message: reason });
    await press(render(FormAnswer, props), "提出する");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hooks.save).toHaveBeenCalledTimes(2);
    expect(notes(render(FormAnswer, props)).filter((html) => html.includes(reason))).toHaveLength(1);
    press(render(FormAnswer, props), "入力に戻る");
    expect(notes(render(FormAnswer, props)).filter((html) => html.includes(reason))).toHaveLength(1);
  });

  it("保存済みのまま提出を断られたときは、下書きを送り直さない", async () => {
    onChangeOf("q1")({ valueText: "直した回答" });
    await vi.advanceTimersByTimeAsync(1000);
    press(render(FormAnswer, props), "内容を確認して提出する");
    hooks.save.mockResolvedValueOnce({ ok: false, message: "回答期限を過ぎたため、保存できません。" });
    await press(render(FormAnswer, props), "提出する");
    await vi.advanceTimersByTimeAsync(2000);
    expect(hooks.save).toHaveBeenCalledTimes(2);
    expect(status()).toContain("保存済み");
  });

  it("描き直す前の木の「提出する」を押しても、いちばん新しい入力を送る", async () => {
    press(render(FormAnswer, props), "内容を確認して提出する");
    const before = render(FormAnswer, props);
    onChangeOf("q1")({ valueText: "押す直前に直した回答" });
    await press(before, "提出する");
    expect(hooks.save.mock.calls[0][0]).toMatchObject({ status: "submitted" });
    expect(sentAnswer(0, "q1")?.valueText).toBe("押す直前に直した回答");
  });

  describe("管理者の試しの回答（trial）", () => {
    const count: AnswerQuestion = { ...question, id: "q5", section: "kpi", questionType: "number", title: "件数の設問",
      required: true, validationMin: 0, validationInteger: true, unit: "件" };
    const trialProps = { ...props, questions: [question, choice, count], initial: [], trial: true };
    // 要素の子に直接書かれた文を、木の中からすべて集める
    const textOf = (tree: unknown) => {
      const found: string[] = [];
      has(tree, (node) => {
        const children = ([] as unknown[]).concat(node.props.children);
        found.push(...children.filter((c): c is string => typeof c === "string"));
        return false;
      });
      return found.join("\n");
    };
    const confirmCard = (tree: unknown) =>
      find(tree, (node) => named("Card")(node) && has(node.props.children, (child) => child.props.children === "この内容で試しに提出します"));
    const passed = (tree: unknown) =>
      has(tree, (node) => named("RefreshStatus")(node) && String(node.props.message).startsWith("試しの提出は通りました"));
    const tryToSubmit = async () => {
      press(render(FormAnswer, trialProps), "内容を確認して提出する");
      await press(render(FormAnswer, trialProps), "試しに提出する");
      return render(FormAnswer, trialProps);
    };

    it("値を変えても下書きを送らず、帯と本文の先頭で「保存されない」と伝える", async () => {
      expect(status(trialProps)).toContain("試しの回答（保存されません）");
      onChangeOf("q1", trialProps)({ valueText: "試しの文" });
      onChangeOf("q5", trialProps)({ valueNumber: 3 });
      await vi.advanceTimersByTimeAsync(1500);
      expect(hooks.save).not.toHaveBeenCalled();
      expect(status(trialProps)).toContain("試しの回答（保存されません）");
      expect(status(trialProps)).not.toContain("保存待ち");
      const text = textOf(render(FormAnswer, trialProps));
      expect(text).toContain("入力した内容は保存されず");
      expect(text).not.toContain("自動で下書きに保存");
    });

    it("空のまま試しに提出すると、未入力の知らせを1回だけ出し、何も送らない", async () => {
      const tree = await tryToSubmit();
      const missing = "未入力の項目が1件あります（例：件数の設問）。入力してから提出してください。";
      expect(notes(confirmCard(tree)).filter((html) => html.includes(missing))).toHaveLength(1);
      expect(notes(tree).filter((html) => html.includes(missing))).toHaveLength(1);
      expect(passed(tree)).toBe(false);
      expect(hooks.save).not.toHaveBeenCalled();
    });

    it("範囲を外れた数は、本物の提出（checkSubmission）と同じ文で断る", async () => {
      onChangeOf("q5", trialProps)({ valueNumber: 1.5 });
      const tree = await tryToSubmit();
      const expected = checkSubmission(trialProps.questions, normalizeAnswers(trialProps.questions, [{ questionId: "q5", valueNumber: 1.5 }]));
      const message = expected.ok ? "" : expected.message;
      expect(message).toContain("「件数の設問」");
      expect(notes(confirmCard(tree)).filter((html) => html.includes(message))).toHaveLength(1);
      expect(passed(tree)).toBe(false);
      expect(hooks.save).not.toHaveBeenCalled();
    });

    it("範囲を外れた数と未入力が同時にあるときは、確認の欄に範囲の断りと未入力の知らせを1回ずつ出す", async () => {
      // 検査は本物の提出と同じく範囲を先に見るので、断りは範囲の文。未入力は確認の欄の知らせが別に言う
      const both = { ...trialProps, questions: [question, { ...choice, required: true }, count] };
      onChangeOf("q5", both)({ valueNumber: 1.5 });
      press(render(FormAnswer, both), "内容を確認して提出する");
      await press(render(FormAnswer, both), "試しに提出する");
      const tree = render(FormAnswer, both);
      const expected = checkSubmission(both.questions, normalizeAnswers(both.questions, [{ questionId: "q5", valueNumber: 1.5 }]));
      const range = expected.ok ? "" : expected.message;
      const missing = "未入力の項目が1件あります（例：選ぶ設問）。入力してから提出してください。";
      expect(range).toContain("「件数の設問」");
      expect(notes(confirmCard(tree)).filter((html) => html.includes(range))).toHaveLength(1);
      expect(notes(confirmCard(tree)).filter((html) => html.includes(missing))).toHaveLength(1);
      // 確認の欄の外には出さない（同じ文を2か所に出さない）
      expect(notes(tree)).toHaveLength(2);
      expect(has(confirmCard(tree), (node) => named("Button")(node) && node.props.children === "最初の未入力の欄へ移る")).toBe(true);
      expect(passed(tree)).toBe(false);
      expect(hooks.save).not.toHaveBeenCalled();
    });

    it("通ったら確認の欄の中で知らせ、値を変えるか開き直すまでその知らせを残す", async () => {
      onChangeOf("q5", trialProps)({ valueNumber: 3 });
      let tree: unknown = await tryToSubmit();
      expect(passed(confirmCard(tree))).toBe(true);
      expect(notes(tree)).toEqual([]);
      // 値を変えたら、前の結果は出さない（変えたあとの値はまだ試していない）
      onChangeOf("q5", trialProps)({ valueNumber: 4 });
      expect(passed(render(FormAnswer, trialProps))).toBe(false);
      // 通ったあとに入力へ戻り、確認を開き直しても、押し直すまでは出さない
      await press(render(FormAnswer, trialProps), "試しに提出する");
      expect(passed(render(FormAnswer, trialProps))).toBe(true);
      press(render(FormAnswer, trialProps), "入力に戻る");
      press(render(FormAnswer, trialProps), "内容を確認して提出する");
      tree = render(FormAnswer, trialProps);
      expect(passed(tree)).toBe(false);
      expect(hooks.save).not.toHaveBeenCalled();
    });
  });
});

/** 画面を開いたときのアンケートの更新時刻（ミリ秒）。保存はこれをそのまま送る */
const OPENED_AT = 1_760_000_000_000;

describe("FormBuilder の再取得", () => {
  const initial =[{ ...createBlankQuestion("free", "text", "unused"), id: "q1", title: "旧設問" }];
  it("保存待ちの外部更新と保存失敗では未保存の入力を消さない", async () => {
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
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
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
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
    const props = { formId: "f1", updatedAt: OPENED_AT, initial: [{ ...initial[0], questionType: "single", options: [{ value: "1", label: "甲" }, { value: "2", label: "乙" }] }], editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    const type = find(render(FormBuilder, props), (node) => node.type === "select" && node.props.value === "single");
    (type.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: questionType } });
    const save = find(render(FormBuilder, props), (node) => node.props.children === "設問を保存する");
    await (save.props.onClick as () => Promise<void>)();
    expect(hooks.save.mock.calls[0][0].questions[0]).toMatchObject({ questionType, options: undefined });
  });
  it("未編集なら、設問の作り直しで新しい設問の本文とIDを使う", async () => {
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
    render(FormBuilder, props);
    const latest = [{ ...initial[0], id: "rebuilt", title: "作り直した設問" }];
    const tree = render(FormBuilder, { ...props, initial: latest });
    const list = find(tree, named("ReorderList"));
    expect((list.props.items as { label: string }[]).map((item) => item.label)).toEqual(["作り直した設問"]);
    const save = find(tree, (node) => node.props.children === "設問を保存する");
    await (save.props.onClick as () => Promise<void>)();
    expect(hooks.save.mock.calls[0][0].questions[0]).toMatchObject({ id: "rebuilt", title: "作り直した設問" });
    // 照合に使う時刻は、描いた画面の props の値をそのまま送る（RELIABILITY-008）
    expect(hooks.save.mock.calls[0][0].expectedUpdatedAt).toBe(OPENED_AT);
  });

  it("自分の保存後は、追加設問の採番済みIDを次の保存に引き継ぐ", async () => {
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
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
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
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
    const props = { formId: "f1", updatedAt: OPENED_AT, initial, editable: true };
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

  it("下限の欄は、外から設問を読み直したときだけ作り直す（手元で打った値では作り直さない）", () => {
    // NumberField は打った文字を自分で持つ。読み直した値を渡すだけでは、欄に古い下限が残る。
    // 逆に、打った値で作り直すと「3a」のような読めない文字と誤りの文が消える
    const numbered = [{ ...createBlankQuestion("free", "number", "unused"), id: "q1", title: "数の設問", validationMin: 1 }];
    const props = { formId: "f1", updatedAt: OPENED_AT, initial: numbered, editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    const minField = (tree: unknown) => find(tree, (node) => named("NumberField")(node) && node.props.name === "validationMin_0");
    const before = minField(render(FormBuilder, props));

    const reloaded = { ...props, initial: [{ ...numbered[0], validationMin: 5 }] };
    const after = minField(render(FormBuilder, reloaded));
    expect(after.props.defaultValue).toBe(5);
    expect(after.key).not.toBe(before.key);

    (after.props.onValueChange as (value: number | null) => void)(null);
    expect(minField(render(FormBuilder, reloaded)).key).toBe(after.key);
  });
});

describe("FormBuilder の集計に使う設問（DD-015）", () => {
  const selects = (linked: boolean) => {
    const row = {
      ...createBlankQuestion(linked ? "kpi" : "free", linked ? "number" : "text", "unused"),
      id: "q1",
      title: "設問",
      ...(linked ? { kpiItemId: "kpi_a", kpiQuestionKey: "q1_1", linkLabel: "稼働率（q1_1）" } : {}),
    };
    const props = { formId: "f1", updatedAt: OPENED_AT, initial: [row], editable: true };
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    const opened = render(FormBuilder, props);
    const section = find(opened, (node) => node.type === "select" && node.props.value === row.section);
    const type = find(opened, (node) => node.type === "select" && node.props.value === row.questionType);
    return { opened, disabled: [section.props.disabled, type.props.disabled] };
  };

  it("紐づけのある設問は、まとまりと答え方を選べず、理由を添える", () => {
    const { opened, disabled } = selects(true);
    expect(disabled).toEqual([true, true]);
    expect(renderToStaticMarkup(opened as ReactElement)).toContain("まとまりと答え方は、点数の計算が読む形なので変えられません");
  });

  it("自由設問は、まとまりも答え方も選べる", () => {
    const { opened, disabled } = selects(false);
    expect(disabled).toEqual([false, false]);
    expect(renderToStaticMarkup(opened as ReactElement)).not.toContain("点数の計算が読む形");
  });
});

describe("FormBuilder の節の名前", () => {
  // 自由設問（「＋ 聞くことを追加」で足す設問）の節は free。回答画面・見本と同じく「自由記入」と書き、英字のまま出さない
  const row = { ...createBlankQuestion("free", "text", "unused"), id: "q1", title: "自由の設問" };

  it("編集できるときは、閉じた行の補足・開いた頭・「まとまり」の選び欄のどれも「自由記入」と書く", () => {
    const props = { formId: "f1", updatedAt: OPENED_AT, initial: [row], editable: true };
    const closed = find(render(FormBuilder, props), named("ListRowBody"));
    expect(renderToStaticMarkup(closed.props.note as ReactElement)).toContain("自由記入 ／ 文章で書く");
    (find(render(FormBuilder, props), (node) => node.props.children === "内容を直す").props.onClick as () => void)();
    const opened = render(FormBuilder, props);
    expect(renderToStaticMarkup(find(opened, named("CardHead")).props.sub as ReactElement)).toContain("自由記入 ／ 文章で書く");
    expect(find(opened, (node) => node.type === "option" && node.props.value === "free").props.children).toBe("自由記入");
  });

  it("編集できないときの一覧も、節を「自由記入」と書く", () => {
    const list = find(render(FormBuilder, { formId: "f1", updatedAt: OPENED_AT, initial: [row], editable: false }), named("QuestionList"));
    const rows = (list.type as (props: unknown) => ReactNode)(list.props);
    expect(find(rows, named("CardRow")).props.sub).toBe("自由記入");
  });
});
