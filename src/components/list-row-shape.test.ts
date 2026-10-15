import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListAddRow, ListRowBody, ListRowNumber } from "@/components/ListRow";
import { stripComments } from "@/test-support/source-code";

/**
 * 一覧の行の形を、画面をまたいでそろえる（spec §28-14・DD-014）。
 *
 * 等級要件・昇格の条件・アンケートの設問と選択肢・KPI 項目・KPI カテゴリ・行動指針の観点と段階・基準セットの
 * どれを開いても、番号 → 本文 → 札 → 補足の順に読み、行の操作は本文の右（狭いときは下）、
 * 1件足すボタンは一覧の下の左端にある。画面ごとに書き起こすと、どれか1つだけ順や位置がずれる
 * （実際に、アンケートの設問だけ「編集」の文言と、一覧の上の追加ボタンが残っていた）。
 */

const SRC = join(process.cwd(), "src", "components");
const code = (name: string) => stripComments(readFileSync(join(SRC, name), "utf8"));
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<!-- -->/g, "");

/** 一覧を持つ編集の画面。1行の中身は ListRowBody、足すボタンは ListAddRow で描く */
const LIST_EDITORS = [
  "GradeRequirementEditor.tsx",
  "PromotionRequirementEditor.tsx",
  "FormBuilder.tsx",
  "KpiItemEditor.tsx",
  "KpiCategoryEditor.tsx",
  "BehaviorGuidelineEditor.tsx",
  "BehaviorBandSetEditor.tsx",
];

describe("一覧の行の形（全画面共通）", () => {
  it("1行は 番号 → 本文 → 札 → 補足 → 中身 の順に描く", () => {
    const out = html(
      createElement(
        ListRowBody,
        {
          number: 2,
          text: "本文",
          badges: createElement("span", { className: "badge" }, "札"),
          note: "補足",
        },
        createElement("p", null, "中身"),
      ),
    );
    const order = ['<span class="num', "本文", '<span class="badge">札</span>', '<div class="footnote m-0 mt-1">補足</div>', "<p>中身</p>"];
    const at = order.map((part) => out.indexOf(part));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    // 札は本文と同じ段落の中、空白を1つ挟んだ直後に置く（押すボタンの列には置かない）
    expect(out).toContain('<p class="m-0 text-sub">本文 <span class="badge">札</span></p>');
  });

  it("番号の列の幅は、No. の付く一覧だけ広げる（どの行でも本文の頭がそろう）", () => {
    expect(html(createElement(ListRowNumber, { children: 1 }))).toContain("w-6");
    expect(html(createElement(ListRowNumber, { wide: true, children: "No.12" }))).toContain("w-12");
    // 本文を省いて入力欄を渡す（直している間の行）ときも、番号の列は同じ
    const editing = html(createElement(ListRowBody, { number: 3 }, createElement("input", { className: "input" })));
    expect(editing).toContain('<span class="num mt-[2px] w-6 shrink-0 text-sub text-ink-muted">3</span>');
    expect(editing).not.toContain('<p class="m-0 text-sub">');
  });

  it("入力欄から始まる行は、番号を入力欄の中の1行目にそろえる（選択肢・直している間の要件）", () => {
    // 番号の mt-[2px] は本文の段落の1行目に合わせた値。入力欄は枠と余白の下に文字が来るので、そのままだと番号が浮く
    expect(html(createElement(ListRowBody, { number: 1 }))).toContain('<div class="list-row-body flex items-start gap-3">');
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(css).toContain(".list-row-body:has(> .row-main > .input:first-child) > .num { margin-top: 7.5px; }");
  });

  it("足すボタンは左端、注記は行の右端（狭いときはボタンの下）", () => {
    const out = html(createElement(ListAddRow, { note: "注記", children: createElement("button", null, "＋ 項目を追加") }));
    expect(out.indexOf("＋ 項目を追加")).toBeLessThan(out.indexOf("注記"));
    // 注記は補足なので SplitRow の右の列へ（左に積むと右側だけが空く。§28-9）
    expect(out).toContain('<div class="split-host list-add-row">');
    expect(out).toContain('<div class="split-aside"><p class="footnote m-0">注記</p></div>');
    // 注記が無ければ右の列を作らない（足せる上限に達したときだけ理由を出す等級要件など）
    expect(html(createElement(ListAddRow, { note: false, children: createElement("button", null, "＋") }))).not.toContain("split-aside");
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(css).toContain(".list-add-row > .split-row { align-items: center; }");
  });

  it("一覧が空であることは、足すボタンと同じ行の右端に、注記の上へ書く（別の段にしない）", () => {
    const out = html(createElement(ListAddRow, { empty: "まだありません", note: "注記", children: createElement("button", null, "＋ 項目を追加") }));
    expect(out).toContain('<div class="split-aside"><p class="footnote m-0">まだありません</p><p class="footnote m-0">注記</p></div>');
    // 空でも注記が無ければ、空であることだけを右の列に書く（等級要件は足せるあいだ注記が無い）
    expect(html(createElement(ListAddRow, { empty: "まだありません", children: createElement("button", null, "＋") }))).toContain(
      '<div class="split-aside"><p class="footnote m-0">まだありません</p></div>',
    );
    // 空になりうる一覧はどれも、一覧の下の ListAddRow に empty を渡し、「まだありません」だけの段を作らない。
    // 行動指針の観点は空だと設問が出ないので、別の扱い（一覧の上の警告）にする
    for (const name of LIST_EDITORS.filter((n) => n !== "BehaviorGuidelineEditor.tsx" && n !== "BehaviorBandSetEditor.tsx")) {
      const source = code(name);
      const adds = [...source.matchAll(/<ListAddRow\b[\s\S]*?<\/ListAddRow>/g)];
      expect({ name, empty: adds.at(-1)?.[0].includes("empty=") }).toEqual({ name, empty: true });
      expect({ name, separate: /<p className="footnote m-0">[^<]*まだ/.test(source) }).toEqual({ name, separate: false });
    }
  });

  it("足すボタンには、押すと何が起きるかを添える（等級要件はカードの頭に残りの件数があるので、足せないときだけ）", () => {
    for (const name of LIST_EDITORS.filter((n) => n !== "GradeRequirementEditor.tsx")) {
      const tags = [...code(name).matchAll(/<ListAddRow\b[^>]*>/g)].map(([tag]) => tag);
      // アンケートの「＋ 選択肢を追加」は開いた設問の中の短い一覧なので添えない。最後の「＋ 設問を追加」には添える
      const checked = name === "FormBuilder.tsx" ? tags.slice(-1) : tags;
      expect({ name, ok: checked.length > 0 && checked.every((tag) => tag.includes("note=")) }).toEqual({ name, ok: true });
    }
  });

  it.each(LIST_EDITORS)("%s は行を ListRowBody、足すボタンを一覧の下の ListAddRow で描く", (name) => {
    const source = code(name);
    // 1行の中身は共通の部品（番号・本文・札の並べ方を画面で書き起こさない）
    expect(source).toMatch(/<ListRowBody\b|RevisableRequirementBody\b/);
    // 足すボタンは「＋ ○○を追加」で、一覧の後ろに置く
    const adds = [...source.matchAll(/<ListAddRow\b[\s\S]*?<\/ListAddRow>/g)];
    expect(adds.length).toBeGreaterThan(0);
    for (const [block] of adds) expect(block).toMatch(/＋ [^<\n]+を追加/);
    const list = source.search(/<ReorderList\b|className="list-rows/);
    expect(list).toBeGreaterThanOrEqual(0);
    expect(adds[adds.length - 1].index).toBeGreaterThan(list);
  });

  it("行の操作は 直す → 今後使わない／もう一度使う → 完全に消す の順に並べる", () => {
    const files = [
      "RevisableRequirementRow.tsx",
      "KpiItemEditor.tsx",
      "BehaviorGuidelineEditor.tsx",
      "BehaviorBandSetEditor.tsx",
    ];
    for (const name of files) {
      const source = code(name);
      const fix = source.search(/(内容|呼び名|中身)を直す/);
      const stop = source.indexOf('label="今後使わない"');
      const remove = source.indexOf("label={DELETE_LABEL}");
      expect({ name, fix: fix >= 0, stop: stop >= 0 }).toEqual({ name, fix: true, stop: true });
      expect({ name, ok: fix < stop }).toEqual({ name, ok: true });
      if (remove >= 0) expect({ name, ok: stop < remove }).toEqual({ name, ok: true });
    }
  });

  it("「直す」の文言は画面をまたいで同じ（アンケートの設問だけ「編集」にしない）", () => {
    for (const name of [...LIST_EDITORS, "RevisableRequirementRow.tsx"]) {
      // ボタンの文言としての「編集」（地の文の 編集・>編集<・"編集"）を残さない
      expect({ name, found: /^\s*編集\s*$|>編集<|"編集"/m.test(code(name)) }).toEqual({ name, found: false });
    }
    expect(code("FormBuilder.tsx")).toMatch(/^\s*内容を直す\s*$/m);
  });

  it("アンケートの選択肢の「削除」は、本文ではなく行の操作の列（renderActions）に置く", () => {
    const source = code("FormBuilder.tsx");
    const actions = source.indexOf("renderActions={(option)");
    const removeButton = source.indexOf("選択肢「${option.label}」を削除");
    expect(actions).toBeGreaterThanOrEqual(0);
    expect(removeButton).toBeGreaterThan(actions);
    // 1段に並べる選択肢の一覧は reorder-inline（30rem 以上で、入力欄の右に操作とつまみを並べる）
    expect(source).toContain('className="reorder-inline"');
  });

  it("設問と要件の一覧は、カードの中に行を並べる（reorder-in-card）", () => {
    for (const name of ["GradeRequirementEditor.tsx", "PromotionRequirementEditor.tsx", "FormBuilder.tsx"]) {
      expect({ name, ok: code(name).includes('className="reorder-in-card"') }).toEqual({ name, ok: true });
    }
  });

  it("reorder-inline の1段の並びは、幅を測った後と測る前の両方に書く", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    const measured = ':where(.reorder-list.reorder-inline[data-reorder-w~="30"]) > .reorder-row:has(> .reorder-actions)';
    const fallback = ":where(.reorder-list.reorder-inline:not([data-reorder-w])) > .reorder-row:has(> .reorder-actions)";
    expect(css).toContain(measured);
    expect(css).toContain(fallback);
    // 測る前の規則は @container の中だけに置く（測った後に容器の幅で二重に効かせない）
    const container = css.indexOf("@container reorder (min-width: 30rem)");
    expect(container).toBeGreaterThanOrEqual(0);
    expect(css.indexOf(fallback)).toBeGreaterThan(container);
    // 開いた設問の固定する頭は、閉じた行と番号の列をそろえる
    expect(css).toContain(".reorder-body > .card-head-sticky { padding-inline: 0; border-radius: 0; }");
  });
});
