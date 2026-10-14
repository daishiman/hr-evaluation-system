import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevisableRequirementBody, revisableRequirementActions } from "@/components/RevisableRequirementRow";
import type { DraftMap } from "@/components/use-draft-map";

/* 等級要件と昇格要件の並びの1行。文言・クラス・読み上げ名・ボタンの順は、2画面で別々に書いていたときのままにする */

const noop = () => {};
const editingOf = (drafts: Record<string, string>): DraftMap<string> => ({
  drafts,
  start: noop,
  change: noop,
  stop: noop,
  isEditing: (id) => drafts[id] !== undefined,
});
const rowOf = (drafts: Record<string, string> = {}, usedBy: string[] = []) => ({
  id: "r1",
  text: "支援計画を期限内に作成できる",
  usedBy,
  editing: editingOf(drafts),
  busy: false,
});
const body = (row: ReturnType<typeof rowOf>, extra: { badge?: ReactNode } = {}) =>
  renderToStaticMarkup(
    createElement(RevisableRequirementBody, { ...row, index: 2, groupLabel: "支援について", onSave: async () => true, ...extra }),
  ).replace(/<!-- -->/g, "");
const actions = (row: ReturnType<typeof rowOf>, extraAction?: ReactNode) =>
  revisableRequirementActions({ ...row, extraAction, onStop: noop, onDelete: noop });

describe("版を持つ要件の行（等級要件・昇格要件で共通）", () => {
  it("読むときは番号と本文を出し、札は本文の直後に空白を挟んで置く", () => {
    const plain = body(rowOf());
    expect(plain).toContain('<span class="num mt-[2px] w-6 shrink-0 text-sub text-ink-muted">3</span>');
    expect(plain).toContain('<div class="row-main"><p class="m-0 text-sub">支援計画を期限内に作成できる</p></div>');

    const withBadge = body(rowOf(), { badge: createElement("span", { className: "badge badge-alert" }, "必須") });
    expect(withBadge).toContain('<p class="m-0 text-sub">支援計画を期限内に作成できる <span class="badge badge-alert">必須</span></p>');
  });

  it("使われている行には「使用中（◯件）」を出し、完全に消すは出さない", () => {
    const used = rowOf({}, ["2026年度上期のアンケート"]);
    expect(body(used)).toContain("使用中（1件）");
    const html = renderToStaticMarkup(createElement(Fragment, null, actions(used)));
    expect(html).toContain("今後使わない");
    expect(html).not.toContain("完全に消す");
  });

  it("直している行は入力欄・注記・新版として保存・やめるの順に出し、操作の列を作らない", () => {
    const editing = rowOf({ r1: "直している文" });
    const html = body(editing);
    expect(html).toContain('aria-label="支援について 3件目の内容"');
    expect(html).toContain('class="input w-full"');
    const order = ["直している文", "以前の内容は変更履歴に残ります。", "新版として保存", "やめる"].map((w) => html.indexOf(w));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // ReorderList は null の行にだけ操作の列を作らない（何も描かない部品では空の列が残る）
    expect(actions(editing)).toBeNull();
  });

  it("行の操作は、内容を直す・画面ごとの操作・今後使わない・完全に消すの順に並べる", () => {
    const html = renderToStaticMarkup(
      createElement(Fragment, null, actions(rowOf(), createElement("button", null, "必須の新版にする"))),
    );
    const order = ["内容を直す", "必須の新版にする", "今後使わない", "完全に消す"].map((w) => html.indexOf(w));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 上書きと誤解する語（直す）は使わない
    expect(html).not.toContain(">直す<");
  });
});
