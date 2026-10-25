import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/DataTable";
import { DecisionBadge } from "@/components/DecisionBadge";
import {
  Badge,
  Bar,
  Button,
  Card,
  CardHead,
  CardRow,
  ChipLink,
  ChipTag,
  ChoiceChip,
  Disclosure,
  DownloadButton,
  EmptyState,
  HintToggle,
  InlineDetail,
  LinkButton,
  NoteBlock,
  Num,
  OptionCard,
  OptionCheck,
  PageTitle,
  ProvisionalMark,
  RankMark,
  ReasonNote,
  RecordList,
  RevealToggle,
  SectionHeading,
  Segmented,
  StatGrid,
  StepBlock,
  StepFlow,
  StepMark,
} from "@/components/ui";
import { splitSource, stripComments } from "@/test-support/source-code";

/*
 * 共通部品の部品クラス（DD-030・O29-1）。
 *
 * 共通部品は今のクラス（btn・chip・card など）に、接頭辞 ui- の部品クラスを重ねる。
 * 色の強弱・押した／選んだ／開いたの手応えは globals.css の ui- の規則だけが持ち、
 * TSX には色のクラス（text-brand-deep・bg-subtle など）を書かない。
 * ここで固定するのは3つ。
 *  1. DD-030 の対応表の全ての部品が、決まった部品クラスを描く（描いた HTML で見る）。
 *  2. 色を部品クラスへ移した6つ（RankMark・ActionButton・ComparisonGapNotice・DecisionBadge・Num・Bar）の
 *     TSX に、色のクラスが残っていない（字面で見る）。
 *  3. 部品クラスは新しい --* を足さず、既存のトークンを var() で使う。
 *
 * 比の計算（全ての系統と明暗）は gradient-contrast.test.ts、実際のブラウザでの状態は
 * e2e/component-states.spec.ts が受け持つ。
 */

// 見出しの絵（PageHeadIcon）が今の画面の道を読む
vi.mock("next/navigation", () => ({
  usePathname: () => "/system",
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const SRC = join(process.cwd(), "src");
const COMPONENTS = join(SRC, "components");
const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const read = (name: string) => readFileSync(join(COMPONENTS, name), "utf8");

const html = (element: ReactElement) => renderToStaticMarkup(element).replace(/<!-- -->/g, "");

/** 描いた HTML の要素を、出てきた順に（タグ名とクラスの並び）で返す。 */
function elements(markup: string): { tag: string; classes: string[] }[] {
  return [...markup.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)].map(([, tag, attrs]) => ({
    tag,
    classes: (/\sclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/).filter(Boolean),
  }));
}

/** 最初に出てくる、そのタグの要素のクラス。 */
function classesOf(markup: string, tag: string): string[] {
  const found = elements(markup).find((e) => e.tag === tag);
  expect(found, `<${tag}> が描かれていない: ${markup}`).toBeDefined();
  return found!.classes;
}

/** 部品の外側（最初の要素）のクラス。 */
const rootClasses = (markup: string) => elements(markup)[0]?.classes ?? [];

describe("DD-030 の対応表: 共通部品は部品クラスを重ねて描く", () => {
  it("押すもの: Button・LinkButton・DownloadButton は ui-press。主は ui-press-main、副は ui-press-sub", () => {
    const primary = classesOf(html(createElement(Button, { variant: "primary" }, "保存する")), "button");
    expect(primary).toEqual(expect.arrayContaining(["btn", "btn-primary", "ui-press", "ui-press-main"]));
    expect(primary).not.toContain("ui-press-sub");
    for (const variant of ["secondary", "tertiary", "danger-outline"] as const) {
      const classes = classesOf(html(createElement(Button, { variant }, "押す")), "button");
      expect(classes, variant).toEqual(expect.arrayContaining(["btn", `btn-${variant}`, "ui-press", "ui-press-sub"]));
      expect(classes, variant).not.toContain("ui-press-main");
    }
    // 既定（secondary）も副
    expect(classesOf(html(createElement(Button, null, "押す")), "button")).toContain("ui-press-sub");

    const link = classesOf(html(createElement(LinkButton, { href: "/system/companies", variant: "primary" }, "追加")), "a");
    expect(link).toEqual(expect.arrayContaining(["btn", "btn-primary", "ui-press", "ui-press-main"]));
    const download = classesOf(html(createElement(DownloadButton, { href: "/x.csv" }, "書き出す")), "a");
    expect(download).toEqual(expect.arrayContaining(["btn", "btn-tertiary", "ui-press", "ui-press-sub"]));
  });

  it("ActionButton・ConfirmButton は Button を通る（btn を書き起こさないので ui-press が付く）", () => {
    for (const name of ["ActionButton.tsx", "ConfirmButton.tsx"]) {
      const code = stripComments(read(name));
      expect(code, name).toMatch(/<Button\b/);
      expect(code, name).not.toMatch(/className=(["{`])(?:\{?`)?btn[\s"`]/);
    }
  });

  it("面: Card・CardHead・CardRow は ui-card・ui-card-head・ui-card-row", () => {
    expect(rootClasses(html(createElement(Card, null, "中身")))).toEqual(expect.arrayContaining(["card", "ui-card"]));
    expect(rootClasses(html(createElement(Card, { off: true, children: "中身" })))).toEqual(expect.arrayContaining(["card", "ui-card"]));
    expect(rootClasses(html(createElement(CardHead, { title: "会社A" })))).toContain("ui-card-head");
    const row = rootClasses(html(createElement(CardRow, { title: "会社A", alignTop: true })));
    expect(row).toEqual(expect.arrayContaining(["card-row", "items-start", "ui-card-row"]));
  });

  it("見出し: PageTitle の h1 は ui-title、SectionHeading の h2 は ui-heading", () => {
    expect(classesOf(html(createElement(PageTitle, { title: "システム運用" })), "h1")).toEqual(
      expect.arrayContaining(["page-title", "ui-title"]),
    );
    expect(classesOf(html(createElement(SectionHeading, null, "操作する会社")), "h2")).toEqual(
      expect.arrayContaining(["section-heading", "ui-heading"]),
    );
  });

  it("選ぶもの: ChoiceChip・ChipLink は ui-pick、OptionCard・OptionCheck は ui-pick ui-pick-card", () => {
    expect(rootClasses(html(createElement(ChoiceChip, { selected: true }, "はい")))).toEqual(
      expect.arrayContaining(["chip", "ui-pick"]),
    );
    expect(rootClasses(html(createElement(ChipLink, { href: "/system/usage?days=7", current: true }, "7日")))).toEqual(
      expect.arrayContaining(["chip", "ui-pick"]),
    );
    expect(rootClasses(html(createElement(OptionCard, { title: "稼働率", sub: "月ごと", selected: true })))).toEqual(
      expect.arrayContaining(["option-card", "ui-pick", "ui-pick-card"]),
    );
    expect(
      rootClasses(html(createElement(OptionCheck, { label: "残業率", checked: true, onToggle: () => {} }))),
    ).toEqual(expect.arrayContaining(["option-card", "option-card-check", "ui-pick", "ui-pick-card"]));
  });

  it("Segmented の各ボタンは segmented-btn のまま描き、ui-pick と同じ規則が当たる", () => {
    /* ui-rules が className="segmented-btn" の直後の aria-pressed を固定しているので、
       クラスの字面は変えず、CSS 側で .segmented-btn を ui-pick の規則に入れる（DD-030 の2の表）。 */
    const markup = html(
      createElement(Segmented<"a" | "b">, {
        label: "表示",
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        value: "a",
        onChange: () => {},
      }),
    );
    const buttons = elements(markup).filter((e) => e.tag === "button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.classes).toContain("segmented-btn");
    const pickRules = uiRules().filter((r) => /\.ui-pick\b/.test(r.selector));
    expect(pickRules.length).toBeGreaterThan(0);
    expect(pickRules.some((r) => /\.segmented-btn\b/.test(r.selector) && /background-image:/.test(r.body))).toBe(true);
  });

  it("読むだけの札: ChipTag は ui-tag で、押せる見た目（ui-pick）を付けない", () => {
    const tag = rootClasses(html(createElement(ChipTag, null, "下書き")));
    expect(tag).toEqual(expect.arrayContaining(["chip", "ui-tag"]));
    expect(tag).not.toContain("ui-pick");
  });

  it("印: Badge・ProvisionalMark・DecisionBadge・RankMark は ui-mark。強めるもの（進行中・要対応・A）は ui-mark-strong", () => {
    for (const tone of ["active", "done", "closed", "dropped", "alert", "required"] as const) {
      const classes = rootClasses(html(createElement(Badge, { tone, children: "札" })));
      expect(classes, tone).toEqual(expect.arrayContaining(["badge", `badge-${tone}`, "ui-mark"]));
      expect(classes.includes("ui-mark-strong"), tone).toBe(tone === "active" || tone === "alert");
    }
    expect(rootClasses(html(createElement(ProvisionalMark, {})))).toEqual(
      expect.arrayContaining(["badge", "badge-dropped", "ui-mark"]),
    );
    const decision = html(
      createElement(DecisionBadge, {
        subject: "raise",
        scoreJudgement: true,
        decision: "override",
        reason: "理由の文",
        finalized: true,
      }),
    );
    expect(rootClasses(decision)).toEqual(expect.arrayContaining(["decision-badge", "ui-mark"]));
    const strong = rootClasses(html(createElement(RankMark, { rank: "A" })));
    expect(strong).toEqual(expect.arrayContaining(["ui-mark", "ui-mark-strong"]));
    const plain = rootClasses(html(createElement(RankMark, { rank: "B" })));
    expect(plain).toContain("ui-mark");
    expect(plain).not.toContain("ui-mark-strong");
    expect(rootClasses(html(createElement(RankMark, { rank: null })))).toContain("ui-mark");
  });

  it("順番のある説明: StepFlow・StepMark・StepBlock は ui-step-flow・ui-step-mark・ui-step", () => {
    expect(rootClasses(html(createElement(StepFlow, null, "段")))).toEqual(expect.arrayContaining(["step-flow", "ui-step-flow"]));
    expect(rootClasses(html(createElement(StepMark, null, "1")))).toEqual(expect.arrayContaining(["step-mark", "ui-step-mark"]));
    const block = html(createElement(StepBlock, { step: "1", title: "聞く", children: "本文" }));
    expect(rootClasses(block)).toEqual(expect.arrayContaining(["step-block", "ui-step"]));
    expect(elements(block).some((e) => e.classes.includes("ui-step-mark"))).toBe(true);
  });

  it("数値: Bar・StatGrid・Num は ui-meter・ui-stats・ui-num（値が無い「—」も ui-num）", () => {
    expect(rootClasses(html(createElement(Bar, { value: 3, max: 10, label: "件" })))).toContain("ui-meter");
    expect(rootClasses(html(createElement(StatGrid, { stats: [{ label: "対象", value: 3 }] })))).toEqual(
      expect.arrayContaining(["stat-grid", "ui-stats"]),
    );
    expect(rootClasses(html(createElement(Num, { value: 1234 })))).toEqual(expect.arrayContaining(["num", "ui-num"]));
    expect(rootClasses(html(createElement(Num, { value: 12, display: true })))).toEqual(
      expect.arrayContaining(["num-display", "ui-num"]),
    );
    const empty = html(createElement(Num, { value: null }));
    expect(rootClasses(empty)).toContain("ui-num");
    expect(empty).toContain('data-empty="true"');
  });

  it("注記: NoteBlock・EmptyState・ReasonNote は ui-notice。注意（ReasonNote）は ui-notice-caution", () => {
    expect(rootClasses(html(createElement(NoteBlock, { label: "備考", children: "本文" })))).toEqual(
      expect.arrayContaining(["note-block", "ui-notice"]),
    );
    expect(rootClasses(html(createElement(EmptyState, { title: "まだありません", body: "追加してください" })))).toEqual(
      expect.arrayContaining(["empty-state", "ui-notice"]),
    );
    expect(rootClasses(html(createElement(ReasonNote, null, "保存できませんでした")))).toEqual(
      expect.arrayContaining(["caution-panel", "ui-notice", "ui-notice-caution"]),
    );
  });

  it.each(["ComparisonGapNotice.tsx", "FormAlignNotice.tsx"])("%s の枠は ui-notice ui-notice-caution", (name) => {
    const { literals } = splitSource(stripComments(read(name)));
    const root = literals.find((l) => l.split(/\s+/).includes("caution-panel"));
    expect(root, "caution-panel の枠").toBeDefined();
    expect(root!.split(/\s+/)).toEqual(expect.arrayContaining(["ui-notice", "ui-notice-caution"]));
  });

  it("畳んで置く: Disclosure・InlineDetail・HintToggle・RevealToggle は ui-reveal", () => {
    expect(rootClasses(html(createElement(Disclosure, { summary: "詳しく", children: "中身" })))).toEqual(
      expect.arrayContaining(["disclosure", "ui-reveal"]),
    );
    expect(rootClasses(html(createElement(InlineDetail, { summary: "直すところを見る", children: "中身" })))).toEqual(
      expect.arrayContaining(["inline-detail", "ui-reveal"]),
    );
    expect(rootClasses(html(createElement(HintToggle, { open: true }, "氏名")))).toEqual(
      expect.arrayContaining(["profile-row-label", "ui-reveal"]),
    );
    expect(
      rootClasses(html(createElement(RevealToggle, { label: "今のパスワード", controls: "pw", visible: false, onToggle: () => {} }))),
    ).toEqual(expect.arrayContaining(["field-toggle", "ui-reveal"]));
  });

  it("表: DataTable の table は ui-table", () => {
    const markup = html(
      createElement(DataTable<{ id: string; name: string }>, {
        columns: [{ key: "name", header: "名前", cell: (r) => r.name, role: "title" }],
        rows: [{ id: "a", name: "会社A" }],
        rowKey: (r) => r.id,
      }),
    );
    expect(classesOf(markup, "table")).toContain("ui-table");
  });

  it("現在地: AppSidebar・HeaderNav の aria-current を持つ要素は ui-here", () => {
    for (const name of ["AppSidebar.tsx", "HeaderNav.tsx"]) {
      const code = stripComments(read(name));
      const tags = [...code.matchAll(/<(?:Link|a|span)\b[^>]*?aria-current=[^>]*>/g)].map(([tag]) => tag);
      expect(tags.length, name).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, name).toMatch(/className="[^"]*\bui-here\b[^"]*"/);
    }
  });

  it("一覧のカード（RecordList）は今の字面のまま。部品クラスの影は CSS 側で同じものを当てる", () => {
    // ui-rules が class="card record-list" を固定しているので、クラスは足さない
    const markup = html(createElement(RecordList, { items: [{ key: "a", title: "記録" }] }));
    expect(markup).toContain('class="card record-list"');
    expect(uiRules().some((r) => /\.record-list\b/.test(r.selector) && /\.ui-card\b/.test(r.selector))).toBe(true);
  });

  it("TSX に書いた ui- のクラスには、どれも globals.css に規則がある（付けただけで効かないクラスを作らない）", () => {
    const files = ["ui.tsx", "DecisionBadge.tsx", "ComparisonGapNotice.tsx", "FormAlignNotice.tsx", "ActionButton.tsx", "DataTable.tsx", "AppSidebar.tsx", "HeaderNav.tsx"];
    const used = new Set<string>();
    for (const name of files) {
      for (const literal of splitSource(stripComments(read(name))).literals) {
        for (const m of literal.matchAll(/(?<![\w-])ui-[a-z][a-z-]*/g)) used.add(m[0]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const defined = new Set(uiRules().flatMap((r) => [...r.selector.matchAll(/\.(ui-[a-z][a-z-]*)/g)].map((m) => m[1])));
    expect([...used].filter((c) => !defined.has(c)).sort()).toEqual([]);
  });
});

/* ═════════════════════ TSX に色を書かない ═════════════════════ */

/** Tailwind の色の名前（@theme inline の --color-*）と、Tailwind の既定の色。 */
const COLOR_NAMES = [
  ...[...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]),
  "white",
  "black",
];
const PALETTE_SCALES = "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}";
const COLOR_CLASS = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*(?:text|bg|border(?:-[trblxyse])?|ring|outline|fill|stroke|from|via|to|decoration|divide|accent|caret|shadow|placeholder)-(?:${[...COLOR_NAMES].sort((a, b) => b.length - a.length).join("|")}|${PALETTE_SCALES})(?:\\/\\d+)?(?![\\w-])`,
  "g",
);

/** ui.tsx から、その関数の本体だけを切り出す（次の export まで）。 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function colorClassesIn(source: string): string[] {
  return splitSource(stripComments(source)).literals.flatMap((l) => [...l.matchAll(COLOR_CLASS)].map((m) => m[0]));
}

describe("色を部品クラスへ移した6つの部品は、TSX に色のクラスを書かない", () => {
  it("色の名前を @theme inline から読めている（読めないと検査が素通りになる）", () => {
    expect(COLOR_NAMES).toEqual(expect.arrayContaining(["brand", "brand-deep", "ink", "ink-muted", "line", "subtle"]));
    expect("text-brand-deep border-line bg-subtle/50 hover:text-ink".match(COLOR_CLASS)).toHaveLength(4);
    // 文字の大きさ（text-note・text-sub）や枠の太さ（border）は色ではない
    expect("text-note text-sub border font-bold".match(COLOR_CLASS)).toBeNull();
  });

  const ui = read("ui.tsx");
  const cases: [string, string][] = [
    ["RankMark", functionBody(ui, "RankMark")],
    ["Num", functionBody(ui, "Num")],
    ["Bar", functionBody(ui, "Bar")],
    ["ActionButton", read("ActionButton.tsx")],
    ["ComparisonGapNotice", read("ComparisonGapNotice.tsx")],
    ["DecisionBadge", read("DecisionBadge.tsx")],
  ];
  for (const [name, source] of cases) {
    it(`${name}: 色のクラスが無い`, () => {
      expect(colorClassesIn(source)).toEqual([]);
    });
  }
});

/* ═════════════════════ 新しい --* を足さない ═════════════════════ */

interface Rule {
  selector: string;
  body: string;
  /** 外側の @media などを外から順に */
  at: string[];
}

/** globals.css の規則を、入れ子の @media ごとに平らに並べる（注釈は除く）。 */
function rulesOf(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const walk = (chunk: string, at: string[]) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf("{", i);
      if (open < 0) return;
      const head = chunk.slice(i, open);
      const selector = head.slice(head.lastIndexOf(";") + 1).trim();
      let depth = 0;
      let close = open;
      for (; close < chunk.length; close += 1) {
        if (chunk[close] === "{") depth += 1;
        else if (chunk[close] === "}" && --depth === 0) break;
      }
      const body = chunk.slice(open + 1, close);
      if (selector.startsWith("@")) walk(body, [...at, selector]);
      else out.push({ selector: selector.replace(/\s+/g, " "), body, at });
      i = close + 1;
    }
  };
  walk(text, []);
  return out;
}

const RULES = rulesOf(css);
function uiRules(): Rule[] {
  return RULES.filter((r) => /\.ui-[a-z]/.test(r.selector));
}

describe("部品クラスは既存のトークンを var() で使い、新しい --* を足さない", () => {
  it("ui- の規則は 1 つ以上ある", () => {
    expect(uiRules().length).toBeGreaterThan(0);
  });

  it("ui- の規則の中でカスタムプロパティを宣言しない", () => {
    const declaring = uiRules().filter((r) => /(?:^|[;{\s])--[a-z0-9-]+\s*:/.test(r.body));
    expect(declaring.map((r) => r.selector)).toEqual([]);
  });

  it("ui- を名前に持つカスタムプロパティがどこにも無い", () => {
    expect(css.match(/--ui-[a-z0-9-]*\s*:/g) ?? []).toEqual([]);
  });

  it("ui- の規則が読む var(--*) は、どれも :root に元からあるトークン", () => {
    const root = RULES.find((r) => r.selector === ":root" && r.at.length === 0);
    expect(root).toBeDefined();
    const tokens = new Set([...root!.body.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set(uiRules().flatMap((r) => [...r.body.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1])));
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((t) => !tokens.has(t)).sort()).toEqual([]);
  });
});
