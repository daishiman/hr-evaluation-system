import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  COMPARISON_LEAD,
  comparisonGapOf,
  type ComparisonForm,
  type ComparisonGap,
  type ComparisonGapInput,
} from "@/lib/domain/comparison-gap";
import { ComparisonGapNotice } from "./ComparisonGapNotice";

/*
 * 比べる警告の部品（DD-012 の4・受入 AC2・AC6）。
 * 閉じた状態は1つの段、開くと2つのリンクと表と直す操作1つ。説明の段落は置かない。
 * 実際の送信はしないので、ボタンは送り先と入力を属性に出す置き物にする。
 */
vi.mock("@/components/ActionButton", async () => {
  const { createElement: h } = await import("react");
  return {
    ActionButton: (p: { action: { name: string }; input: unknown; label: string; confirm?: string }) =>
      h("button", { type: "button", "data-action": p.action.name, "data-input": JSON.stringify(p.input), "data-confirm": p.confirm ?? "" }, p.label),
  };
});
vi.mock("@/actions/forms", () => ({
  createForms: function createForms() { return null; },
  rebuildFormQuestions: function rebuildFormQuestions() { return null; },
}));

const NAMES: Record<string, string> = { kpi_a: "稼働率", kpi_b: "残業率", kpi_c: "粗利率", kpi_d: "定着率" };

function form(over: Partial<ComparisonForm> = {}): ComparisonForm {
  return {
    id: "frm_1", title: null, cycleName: "2026年度上期", gradeName: "等級２：Regular", cycleId: "cyc_1", gradeId: "grd_1",
    status: "published", version: 1, responseCount: 0, cycleStatus: "open", ...over,
  };
}

/** 足りない2件（残業率・粗利率）と余分1件（定着率） */
function gap(over: Partial<ComparisonGapInput> = {}): ComparisonGap {
  const g = comparisonGapOf({
    form: form(), pointGroup: "Regular", groupLabel: "等級２：Regular",
    selected: ["kpi_a", "kpi_b", "kpi_c"], asked: ["kpi_d", "kpi_a"], unaskable: [], nameOf: (id) => NAMES[id] ?? id,
    newer: null, schemeGap: null, current: null, role: "COMPANY_ADMIN", ...over,
  });
  if (!g) throw new Error("ズレがあるのに null が返った");
  return g;
}

const render = (gaps: readonly ComparisonGap[]) => renderToStaticMarkup(createElement(ComparisonGapNotice, { gaps }));

/** <details> の中を除いた、閉じた状態で目に入る部分 */
function closedPart(html: string): string {
  return html.replace(/<details[\s\S]*<\/details>/, "<details></details>");
}

/** 開いた中（<details> の本文） */
function openedPart(html: string): string {
  return html.match(/<details[\s\S]*<\/details>/)?.[0] ?? "";
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("ComparisonGapNotice: 閉じた状態（AC2）", () => {
  it("ズレが無ければ何も描かない", () => {
    expect(render([])).toBe("");
  });

  it("注意の枠の1つの段に、件数の文と『直すところを見る』の札だけを置く（既定で閉じている）", () => {
    const html = render([gap()]);
    expect(html).toContain("caution-panel");
    expect(html).toMatch(/<details class="inline-detail">/);
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    expect(html).toContain("<summary>直すところを見る");
    const closed = closedPart(html);
    expect(closed).toContain("評価項目とのズレ 3件（足りない2・余分1）");
    expect(closed).not.toContain("<a ");
    expect(closed).not.toContain("<table");
    expect(closed).not.toContain("<button");
    expect(closed).not.toContain(COMPARISON_LEAD);
  });

  it("枠ごと文節で折り、最後の行に1〜2文字だけ落とさない（375px で「くださ／い」と割れた）", () => {
    const html = render([gap()]);
    expect(html).toContain('<div class="caution-panel text-pretty [word-break:auto-phrase]">');
  });
});

describe("ComparisonGapNotice: アンケートの一覧・1本で開いた中（AC2）", () => {
  it("1行目・2つのページのリンク・表の順に並べる", () => {
    const opened = openedPart(render([gap()]));
    expect(opened).toContain(COMPARISON_LEAD);
    expect(opened).toContain('href="/admin/scheme/Regular"');
    expect(opened).toContain("KPI・評価セット › 等級２：Regular：使うKPIを選ぶ");
    expect(opened).toContain('href="/admin/forms/frm_1"');
    expect(opened).toContain("アンケート › 2026年度上期 等級２：Regular 実績アンケート（第1版）");
    const order = [COMPARISON_LEAD, 'href="/admin/scheme/Regular"', 'href="/admin/forms/frm_1"', "<table"].map((s) => opened.indexOf(s));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("一覧ではどちらのページにも「（このページ）」を付けない", () => {
    const html = render([gap()]);
    expect(html).not.toContain("（このページ）");
    expect(html).not.toContain("aria-current");
  });

  it("アンケート1本の画面では、このアンケートのリンクに印を付ける", () => {
    const html = render([gap({ current: "form" })]);
    expect(count(html, 'aria-current="page"')).toBe(1);
    expect(html).toMatch(/<a [^>]*href="\/admin\/forms\/frm_1"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="\/admin\/forms\/frm_1"/);
    expect(count(html, "（このページ）")).toBe(1);
    expect(html.indexOf("（このページ）")).toBeGreaterThan(html.indexOf('href="/admin/forms/frm_1"'));
  });

  it("表は項目・使うKPIを選ぶ・このアンケートの3列で、見出しに scope を付ける（AC6）", () => {
    const opened = openedPart(render([gap()]));
    expect(count(opened, 'scope="col"')).toBe(3);
    for (const header of ["項目", "使うKPIを選ぶ", "このアンケート"]) expect(opened).toContain(`>${header}</th>`);
    for (const name of ["残業率", "粗利率", "定着率"]) expect(opened).toContain(name);
    expect(opened).not.toContain("稼働率");
  });

  it("○ と — は読み上げの文字を添え、記号は読み上げない（AC6）", () => {
    const opened = openedPart(render([gap()]));
    // 足りない2行（○・—）と余分1行（—・○）
    expect(count(opened, '<span aria-hidden="true">○</span><span class="sr-only">ある</span>')).toBe(3);
    expect(count(opened, '<span aria-hidden="true">—</span><span class="sr-only">ない</span>')).toBe(3);
  });

  it("表は狭い幅でもカードに組み替えず、横に流す枠に入れる（AC6）", () => {
    const opened = openedPart(render([gap()]));
    expect(opened).toContain("table-scroll");
    expect(opened).toContain("overflow-x-auto");
    expect(opened).toContain("[--table-head-top:0px]");
    expect(opened).not.toContain("list-cards");
    expect(opened).not.toContain("list-host");
  });

  it("横に流す枠は relative にし、読み上げの文字を枠の外へ出さない（320px で画面が広がった）", () => {
    const opened = openedPart(render([gap()]));
    expect(opened).toMatch(/class="[^"]*\btable-scroll relative overflow-x-auto\b/);
  });
});

describe("ComparisonGapNotice: 直す操作（1つだけ）", () => {
  it("下書きで回答0件なら、一覧に確認つきの『設問を作り直す』を出す", () => {
    const opened = openedPart(render([gap({ form: form({ status: "draft" }) })]));
    expect(count(opened, "<button")).toBe(1);
    expect(opened).toContain('data-action="rebuildFormQuestions"');
    expect(opened).toContain(`data-input="${escapeAttr(JSON.stringify({ formId: "frm_1" }))}"`);
    expect(opened).toContain(">設問を作り直す</button>");
    expect(opened).toContain("まだ公開前で、回答は1件もありません。");
    expect(opened).not.toContain("設問を差し替えません");
  });

  it("アンケート1本の画面では、作り直しを部品に出さない（枠の外に同じボタンがある）", () => {
    const html = render([gap({ form: form({ status: "draft" }), current: "form" })]);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("rebuildFormQuestions");
  });

  it("公開後は確認つきの『この等級だけ新しい版の下書きを作る』と、注記1行", () => {
    const opened = openedPart(render([gap({ current: "form" })]));
    expect(count(opened, "<button")).toBe(1);
    expect(opened).toContain('data-action="createForms"');
    expect(opened).toContain(`data-input="${escapeAttr(JSON.stringify({ cycleId: "cyc_1", gradeIds: ["grd_1"] }))}"`);
    expect(opened).toContain(">この等級だけ新しい版の下書きを作る</button>");
    expect(opened).toContain("いまの版はそのまま残ります。");
    expect(opened).toContain("公開後や回答のあるアンケートは設問を差し替えません");
  });

  it("長い札は狭い幅で折り返す（375px で開いた本文からはみ出した）", () => {
    const opened = openedPart(render([gap({ current: "form" })]));
    expect(opened).toContain('<div class="[&amp;_.btn]:whitespace-normal!">');
  });

  it("より新しい版があれば、ボタンの代わりにその版を開くリンク", () => {
    // 新しい版もまだ一致していない（一致していれば古い版には警告を出さない。DD-012 の5）
    const opened = openedPart(render([gap({ newer: { id: "frm_2", version: 2, status: "draft", asked: ["kpi_a"] } })]));
    expect(opened).not.toContain("<button");
    expect(opened).toContain('href="/admin/forms/frm_2"');
    expect(opened).toContain("第2版の下書きを開く");
  });

  it("評価セットの準備中は、残っている手順へのリンク", () => {
    const opened = openedPart(render([gap({ schemeGap: { href: "/admin/scheme/Regular/criteria", linkLabel: "基準を決める" } })]));
    expect(opened).not.toContain("<button");
    expect(opened).toContain('href="/admin/scheme/Regular/criteria"');
    expect(opened).toContain("基準を決める");
  });

  it("締め切った評価期間では操作を出さず、理由を1行出す", () => {
    const opened = openedPart(render([gap({ form: form({ cycleStatus: "closed" }) })]));
    expect(opened).not.toContain("<button");
    expect(count(opened, "<a ")).toBe(2);
    expect(opened).toContain("締め切った評価期間には新しい版を作れません");
  });

  it("開けない役割には、リンクとボタンを出さず名前だけを出す", () => {
    const opened = openedPart(render([gap({ role: "MANAGER" })]));
    expect(opened).not.toContain("<a ");
    expect(opened).not.toContain("<button");
    expect(opened).toContain("KPI・評価セット › 等級２：Regular：使うKPIを選ぶ");
    expect(opened).toContain("アンケート › 2026年度上期 等級２：Regular 実績アンケート（第1版）");
  });
});

describe("ComparisonGapNotice: 設問のひな形が無い項目", () => {
  /** 足りないのは残業率・粗利率で、どちらにもひな形が無い */
  const ONLY_UNASKABLE: Partial<ComparisonGapInput> = { asked: ["kpi_a"], unaskable: ["kpi_b", "kpi_c"] };

  it("表の項目名に「設問なし」の札を付ける（ひな形のある項目と余分な項目には付けない）", () => {
    const opened = openedPart(render([gap({ unaskable: ["kpi_c"] })]));
    expect(count(opened, '<span class="badge badge-required">設問なし</span>')).toBe(1);
    expect(opened).toContain('粗利率 <span class="badge badge-required">設問なし</span>');
    expect(opened).not.toContain('残業率 <span class="badge');
    expect(opened).not.toContain('定着率 <span class="badge');
  });

  it("足りないのがひな形の無い項目だけなら、作り直しではなく使うKPIを選ぶへのリンク", () => {
    for (const status of ["draft", "published"] as const) {
      const opened = openedPart(render([gap({ ...ONLY_UNASKABLE, form: form({ status }) })]));
      expect(opened).not.toContain("<button");
      expect(opened).not.toContain("rebuildFormQuestions");
      // 2つのページのリンクに加えて、直す操作のリンクが1つ
      expect(count(opened, 'href="/admin/scheme/Regular"')).toBe(2);
      expect(opened).toContain("使うKPIを選ぶで選び直す");
      expect(opened).toContain("「残業率」・「粗利率」には設問のひな形がありません。");
    }
  });

  it("使うKPIを選ぶの画面では、聞いていない項目に（設問なし）を添える", () => {
    const opened = openedPart(render([gap({ ...ONLY_UNASKABLE, current: "selection" })]));
    expect(opened).toContain("残業率（設問なし）・粗利率（設問なし）");
    expect(opened).not.toContain("<button");
    expect(count(opened, 'href="/admin/scheme/Regular"')).toBe(1);
  });

  it("使うKPIを選ぶの画面で、ひな形のある足りない項目には（設問なし）を添えない", () => {
    const opened = openedPart(render([gap({ unaskable: ["kpi_c"], current: "selection" })]));
    expect(opened).toContain("残業率・粗利率（設問なし）");
    expect(opened).not.toContain("残業率（設問なし）");
  });
});

describe("ComparisonGapNotice: 使うKPIを選ぶの画面（AC2）", () => {
  const first = () => gap({ current: "selection" });
  const second = () =>
    gap({ current: "selection", form: form({ id: "frm_2", version: 2, status: "draft" }), asked: ["kpi_a", "kpi_b"] });

  it("件数はアンケート×項目の組で数え、閉じた段は1つにまとめる", () => {
    const html = render([first(), second()]);
    expect(count(html, "<details")).toBe(1);
    expect(closedPart(html)).toContain("評価項目とのズレ 4件（足りない3・余分1）");
  });

  it("このページのリンク1行と、アンケートごとに1行の表を出す", () => {
    const opened = openedPart(render([first(), second()]));
    expect(opened).toContain(COMPARISON_LEAD);
    expect(count(opened, 'href="/admin/scheme/Regular"')).toBe(1);
    expect(count(opened, 'aria-current="page"')).toBe(1);
    expect(count(opened, "（このページ）")).toBe(1);
    expect(count(opened, 'scope="col"')).toBe(3);
    for (const header of ["アンケート", "聞いていない項目", "余分に聞いている項目"]) expect(opened).toContain(`>${header}</th>`);
    expect(opened).toContain('href="/admin/forms/frm_1"');
    expect(opened).toContain("アンケート › 2026年度上期 等級２：Regular 実績アンケート（第1版）");
    expect(opened).toContain('href="/admin/forms/frm_2"');
    expect(opened).toContain("アンケート › 2026年度上期 等級２：Regular 実績アンケート（第2版）");
    expect(opened).toContain("残業率・粗利率");
    expect(opened).toContain("定着率");
    // 2本目は余分が無い
    expect(count(opened, '<span aria-hidden="true">—</span><span class="sr-only">ない</span>')).toBe(1);
  });

  it("直す操作はアンケート側で行うので、ボタンを置かない。表は横に流す枠", () => {
    const opened = openedPart(render([first(), second()]));
    expect(opened).not.toContain("<button");
    expect(opened).toContain("overflow-x-auto");
    expect(opened).not.toContain("list-cards");
  });
});

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
