import { Fragment, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BehaviorIntro } from "@/app/admin/behavior/BehaviorIntro";
import { SchemeHub, type SchemeHubGroup } from "@/app/admin/scheme/SchemeHub";
import { BehaviorBandAssignmentEditor } from "@/components/BehaviorBandAssignmentEditor";
import { BehaviorBandSetEditor } from "@/components/BehaviorBandSetEditor";
import { BehaviorGuidelineEditor, type BehaviorGuidelineRow } from "@/components/BehaviorGuidelineEditor";
import { FormAlignNotice } from "@/components/FormAlignNotice";
import { KpiItemEditor, type KpiItemRow } from "@/components/KpiItemEditor";
import { StaleCyclesNotice, type StaleCycle } from "@/components/StaleCyclesNotice";
import {
  DEFAULT_BEHAVIOR_BAND,
  describeBandAssignment,
  type BandAssignmentGrade,
} from "@/lib/domain/behavior-default-assignment";
import { bandSetLabel, DEFAULT_GRADE_NAMES, gradeLabel } from "@/lib/domain/grade-label";
import type { AskingQuestionView } from "@/lib/domain/kpi-asking";
import type { GroupProgress } from "@/lib/domain/scheme-steps";

/**
 * 行動指針と KPI・評価セットの画面を開いた直後に、読まされる量を固定する（O26-1・DD-027・§22）。
 *
 * 数えるのは「開いた直後に見える説明文」だけ。押すまで開かない注記（閉じた details）の中身と、
 * 確認の窓（閉じた dialog）・選択肢・読み上げ専用の文字は数えない。
 * 1文は40字以内、同じ文は1画面に2回出さない。
 */

/* 保存の入口はサーバーの処理を読み込むので、描くのに要らない部分だけ差し替える（KpiItemEditor.test.ts と同じ） */
vi.mock("@/lib/use-refresh", () => ({
  useSaveAction: () => ({ save: vi.fn(), saving: false }),
  useReadAction: () => ({ read: vi.fn(), reading: false }),
}));
vi.mock("@/actions/form-align", () => ({ previewFormAlignment: vi.fn(), applyFormAlignment: vi.fn() }));
vi.mock("@/components/master-request", () => ({
  masterRequest: vi.fn(),
  masterSave: (input: unknown) => input,
  masterDelete: (kind: unknown, id: unknown) => ({ kind, id }),
}));
vi.mock("@/actions/masters", () => ({ saveMaster: vi.fn(), deleteMasterItem: vi.fn() }));

const html = (el: ReactElement) => renderToStaticMarkup(el).replace(/<!-- -->/g, "");

/** 開いていない details は summary だけを残す（中身は押すまで見えない）。入れ子は内側からほどく */
function foldDetails(markup: string): string {
  const innermost = /<details\b([^>]*)>((?:(?!<details\b)[\s\S])*?)<\/details>/;
  let out = markup;
  for (let m = innermost.exec(out); m; m = innermost.exec(out)) {
    const [whole, attrs, body] = m;
    const kept = /\sopen\b/.test(attrs) ? body : (body.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/)?.[0] ?? "");
    out = `${out.slice(0, m.index)}<div>${kept}</div>${out.slice(m.index + whole.length)}`;
  }
  return out;
}

const BLOCK = /<\/?(?:p|div|li|dt|dd|h[1-6]|summary|ol|ul|dl|section|nav|button|label|br|table|tr|td|th|option)\b[^>]*>/g;

/** 開いた直後に見える文字。段落の切れ目は改行にする */
function visibleText(markup: string): string {
  const shown = markup
    .replace(/<dialog\b(?![^>]*\sopen)[^>]*>[\s\S]*?<\/dialog>/g, "")
    .replace(/<(select|textarea)\b[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, "");
  return foldDetails(shown)
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const squash = (text: string) => text.replace(/\s/g, "");

/* §22-1 と同じ数え方（ui-rules.test.ts の JP_CHAR・40字・。を除いた長さ） */
const JP_CHAR = /[ぁ-ゟ゠-ヿ一-鿿]/;
const MAX_SENTENCE = 40;
/** 。で終わらない1行も、述語で終われば文として数える（行の補足「◯◯に出します」など）。末尾のかっこ書きは外して見る */
const PREDICATE = /(ます|ません|です|でした|ください)$/;

function sentences(markup: string): string[] {
  return visibleText(markup)
    .split("\n")
    .flatMap((line) => squash(line).split(/(?<=。)/))
    .filter((s) => JP_CHAR.test(s) && (s.endsWith("。") || PREDICATE.test(s.replace(/（[^（）]*）$/, ""))));
}

const lengthOf = (s: string) => s.replace(/。/g, "").length;

/** 1文40字以内で、同じ文を2回出さない */
function expectReadable(found: string[]) {
  expect(found.filter((s) => lengthOf(s) > MAX_SENTENCE)).toEqual([]);
  expect(found.filter((s, i) => found.indexOf(s) !== i)).toEqual([]);
}

/* ───────────────────────── 行動指針 ───────────────────────── */

const CODES = Object.keys(DEFAULT_GRADE_NAMES) as (keyof typeof DEFAULT_GRADE_NAMES)[];

/** 画面に渡る等級は DB の行なので、行動指針の呼び名（bandSetLabel）が求める点数の区分も持つ */
type ScreenGrade = BandAssignmentGrade & { pointGroup: string };

/** 既定の7等級。overrides で一部の等級の割り当てだけを変える */
function gradesWith(overrides: Partial<Record<string, string | null>>): ScreenGrade[] {
  return CODES.map((code, i) => ({
    id: `gr_${code}`,
    code,
    name: DEFAULT_GRADE_NAMES[code],
    pointGroup: code,
    displayOrder: i + 1,
    isActive: true,
    behaviorBand: code in overrides ? (overrides[code] ?? null) : DEFAULT_BEHAVIOR_BAND[code],
  }));
}

/** 会社の基準セット（保存した名前は空。既定のまま） */
const SETS = [
  { id: "bs_1", code: "g1_2", name: "", displayOrder: 1, isActive: true },
  { id: "bs_2", code: "g3_4", name: "", displayOrder: 2, isActive: true },
];

const LEVELS = [
  [3, "模範"],
  [2, "信頼"],
  [1, "安定"],
  [0, "不安定"],
  [-1, "悪影響"],
] as const;

const guideline = (band: string, seq: number, aspectName: string): BehaviorGuidelineRow => ({
  id: `bg_${band}_${seq}`,
  band,
  aspect: `aspect_${seq}`,
  aspectName,
  seq,
  isActive: true,
  levels: LEVELS.map(([score, label]) => ({ id: `bl_${band}_${seq}_${score}`, score, label, text: `${aspectName}で${label}にあたる姿` })),
});

const GUIDELINES = SETS.flatMap((set) => [guideline(set.code, 1, "挨拶について"), guideline(set.code, 2, "報告について")]);

/** 画面と同じ組み立て（src/app/admin/behavior/page.tsx）で、冒頭と3つの編集部品を描く。選んでいる等級は等級1 */
function renderBehavior(grades: ScreenGrade[]) {
  const labeledSets = SETS.map((set) => ({ ...set, name: bandSetLabel(set, grades) }));
  const lineGrades = grades.map((g) => ({
    id: g.id,
    name: gradeLabel(g),
    displayOrder: g.displayOrder,
    isActive: g.isActive,
    behaviorBand: g.behaviorBand,
  }));
  const selected = grades[0];
  const intro = createElement(BehaviorIntro, {
    tags: createElement("span", { className: "tag" }, `編集中の等級 ${selected.name}`),
    grades,
    sets: SETS.map((set) => ({ code: set.code, name: set.name, isActive: set.isActive })),
  });
  const screen = createElement(
    Fragment,
    null,
    intro,
    createElement(BehaviorBandAssignmentEditor, {
      grade: { id: selected.id, name: selected.name, behaviorBand: selected.behaviorBand },
      lineGrades,
      bandSets: labeledSets,
      availableBands: SETS.map((set) => set.code),
    }),
    createElement(BehaviorBandSetEditor, {
      sets: labeledSets.map((set) => ({
        id: set.id,
        code: set.code,
        name: set.name,
        isActive: set.isActive,
        aspectCount: 2,
        usedByGradeNames: grades.filter((g) => g.behaviorBand === set.code).map((g) => g.name),
        usedBy: [],
        totalAspectCount: 2,
      })),
      currentBand: "g1_2",
    }),
    createElement(BehaviorGuidelineEditor, { band: "g1_2", bandSets: labeledSets, rows: GUIDELINES, usage: {} }),
  );
  return { intro: html(intro), screen: html(screen) };
}

const DEFAULT_SENTENCE = describeBandAssignment(gradesWith({}), SETS).sentence;

describe("行動指針の画面を開いた直後（O26-1）", () => {
  it("冒頭は1文と、まとまりの状態（数・飛び飛びの有無）の札だけ", () => {
    const { intro } = renderBehavior(gradesWith({}));
    expect(sentences(intro)).toHaveLength(1);
    const text = squash(visibleText(intro));
    expect(text).toContain("まとまり2つ");
    expect(text).toContain("飛び飛びなし");
    // 選んでいる等級の札は今のまま残す
    expect(text).toContain("編集中の等級等級1");
  });

  it("見える説明文は9文まで。1文40字以内で、同じ文を2回出さない", () => {
    const { screen } = renderBehavior(gradesWith({}));
    const found = sentences(screen);
    expect(found.length).toBeLessThanOrEqual(9);
    expectReadable(found);
  });

  it("理由・初期設定・点数の注記は、冒頭の開く注記の中にだけ置く", () => {
    const { screen } = renderBehavior(gradesWith({}));
    const visible = squash(visibleText(screen));
    for (const part of [
      "設問に関わる変更は、回答の無い下書きに反映します。",
      "点数（模範3・信頼2・安定1・不安定0・悪影響-1）は変えられません。",
      DEFAULT_SENTENCE,
    ]) {
      expect(screen).toContain(part);
      expect(visible).not.toContain(part);
    }
    expect(screen).toContain('href="/admin/masters/promotion"');
    // 割り当て・まとまり・観点の部品に繰り返していた説明は、開く注記の1か所にまとめる
    expect(screen.match(/設問に関わる変更は、回答の無い下書きに反映します。/g)).toHaveLength(1);
    expect(screen).toContain("回答のある公開中のアンケートには、次の版の下書きを作ります。");
    expect(screen).toContain("既存の評価は集計し直しません。");
    expect(screen).not.toContain("変更は次に作るアンケートから");
    expect(visible).not.toContain("公開済みのアンケート");
    expect(visible).not.toContain("この呼び名がそのまま設問になります");
  });

  it("既定どおりなら開く注記の頭にそう示し、違いの一覧は出さない", () => {
    const { intro } = renderBehavior(gradesWith({}));
    expect(squash(visibleText(intro))).toContain("既定どおり");
    expect(intro).not.toContain("既定は");
    expect(intro.match(new RegExp(DEFAULT_SENTENCE, "g"))).toHaveLength(1);
  });

  it("既定と違う割り当ては、閉じたままでも数が見え、開くと等級ごとの違いと既定の分け方が出る", () => {
    const { intro } = renderBehavior(gradesWith({ regular: "g3_4" }));
    const visible = squash(visibleText(intro));
    expect(visible).toContain("既定と違う等級1つ");
    expect(visible).not.toContain("既定どおり");
    expect(visible).toContain("飛び飛びなし");
    expect(intro).toContain("等級2：既定は1つ目、いまは2つ目");
    expect(intro).toContain(DEFAULT_SENTENCE);
    expect(intro).toContain("等級1に1つ目、等級2・等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。");
    // 違いは開いたときに読む（閉じた注記の中）
    expect(visible).not.toContain("既定は1つ目");
  });

  it("飛び飛びの割り当ては、冒頭の札で分かる", () => {
    const { intro } = renderBehavior(gradesWith({ beginner: "g3_4" }));
    const visible = squash(visibleText(intro));
    expect(visible).toContain("飛び飛びあり");
    expect(visible).toContain("まとまり3つ");
  });
});

/* ───────────────────────── KPI・評価セットの入口 ───────────────────────── */

const progress = (pointGroup: string, extra: Partial<GroupProgress> = {}): GroupProgress => ({
  pointGroup,
  selectedCount: 5,
  expectedCount: 5,
  totalPoints: 100,
  maxPoints: 100,
  selectionDone: true,
  criteriaDone: true,
  done: true,
  unratedCount: 0,
  nextAction: "設定は終わっています。内容を見直すこともできます。",
  nextStep: null,
  ...extra,
});

/** 設定済み・使うKPIを選ぶ途中・基準が未設定、の3つの状態 */
const GROUPS: SchemeHubGroup[] = [
  { pointGroup: "Beginner", label: "等級1・等級2", gradeNames: ["等級1", "等級2"], progress: progress("Beginner") },
  {
    pointGroup: "Chief",
    label: "等級3",
    gradeNames: ["等級3"],
    progress: progress("Chief", {
      selectedCount: 2,
      totalPoints: 40,
      selectionDone: false,
      criteriaDone: false,
      done: false,
      unratedCount: 2,
      nextAction: "使うKPIをあと3件選んでください。",
      nextStep: "select",
    }),
  },
  {
    pointGroup: "AM",
    label: "等級4-1・等級4-2",
    gradeNames: ["等級4-1", "等級4-2"],
    progress: progress("AM", {
      criteriaDone: false,
      done: false,
      unratedCount: 2,
      nextAction: "選んだ項目のうち2件の基準（A〜E）が未設定です。",
      nextStep: "criteria",
    }),
  },
];

const renderHub = (notices?: ReactElement) =>
  html(
    createElement(SchemeHub, {
      groups: GROUPS,
      raiseRequiresAllA: true,
      items: { active: 20, total: 24 },
      categoryCount: 6,
      notices,
    }),
  );

/** 見出しが label のカード1枚の中身 */
function cardOf(markup: string, label: string): string {
  // 部品のクラス（ui-card など）が後ろに足されても切れるよう、頭の2つだけで切る
  const card = markup.split('<div class="card card-pad').find((part) => part.includes(`>${label}</`));
  expect(card, `${label} のカード`).toBeDefined();
  return card ?? "";
}

describe("KPI・評価セットの入口を開いた直後（O26-1）", () => {
  it("等級区分ごとのカードと、ほかの3つの作業への入口だけを置く（入力欄や追加のボタンは置かない）", () => {
    const hub = renderHub();
    for (const href of [
      "/admin/scheme/Beginner",
      "/admin/scheme/Chief",
      "/admin/scheme/AM/criteria",
      "/admin/scheme/common",
      "/admin/scheme/items",
      "/admin/scheme/categories",
    ]) {
      expect(hub).toContain(`href="${href}"`);
    }
    expect(hub).not.toContain("＋ KPI項目を追加");
    expect(hub).not.toMatch(/<(input|select|textarea)\b/);
  });

  it("カードに等級の並び・項目数・配点の合計・状態・次にやることを出す", () => {
    const hub = renderHub();
    const done = squash(visibleText(cardOf(hub, "等級1・等級2")));
    for (const part of ["等級1", "等級2", "5件/5件", "100点/100点", "設定済み"]) expect(done).toContain(part);
    // 終わっている区分には次にやることを出さない（札で足りる）
    expect(done).not.toContain("次にやること");

    const selecting = squash(visibleText(cardOf(hub, "等級3")));
    for (const part of ["2件/5件", "40点/100点", "KPIを選ぶ途中", "使うKPIをあと3件選んでください。"]) {
      expect(selecting).toContain(part);
    }

    const rating = squash(visibleText(cardOf(hub, "等級4-1・等級4-2")));
    for (const part of ["等級4-1", "等級4-2", "基準が未設定", "選んだ項目のうち2件の基準（A〜E）が未設定です。"]) {
      expect(rating).toContain(part);
    }
  });

  it("見える説明文は「1文・全体の進み・終わっていない区分の次にやること」まで。1文40字以内で、同じ文を2回出さない", () => {
    const found = sentences(renderHub());
    const notDone = GROUPS.filter((g) => !g.progress.done).length;
    expect(found.length).toBeLessThanOrEqual(3 + notDone);
    expectReadable(found);
  });

  it("変更が反映される範囲は、開く注記の中にだけ置く", () => {
    const hub = renderHub();
    expect(hub).toContain("確定済みの評価");
    expect(visibleText(hub)).not.toContain("確定済みの評価");
  });
});

/*
 * 入口の上に出る知らせ（page.tsx が notices に渡す2つ）。直すものがあるときだけ出る。
 * 期間名は差し込みの値なので、§22-1 と同じく長さに数えないよう短い名前にする。
 */
const STALE: StaleCycle[] = [
  { cycleId: "cy_1", cycleName: "上期", recomputable: 3, finalized: 2 },
  { cycleId: "cy_2", cycleName: "下期", recomputable: 1, finalized: 0 },
  { cycleId: "cy_3", cycleName: "前期", recomputable: 0, finalized: 4 },
];

describe("KPI・評価セットの入口に知らせが出たとき（O26-1）", () => {
  const stale = createElement(StaleCyclesNotice, { cycles: STALE });
  const align = createElement(FormAlignNotice, { count: 2 });

  it("入口の文はそのままで、知らせの文は知らせごとに決まった数まで", () => {
    const own = sentences(renderHub()).length;
    const staleCount = sentences(html(stale)).length;
    const alignCount = sentences(html(align)).length;
    expect(sentences(renderHub(createElement(Fragment, null, stale, align)))).toHaveLength(own + staleCount + alignCount);

    // 集計し直していない評価: 見出し・直し方（1回）・集計し直せる期間ごとの「何が」（見せるのは3件まで）・確定済みだけの期間ごとの1文
    const recomputable = STALE.filter((c) => c.recomputable > 0).length;
    const settled = STALE.length - recomputable;
    expect(staleCount).toBeLessThanOrEqual(2 + Math.min(recomputable, 3) + settled);
    // 設定とずれた下書き: 見出しと、そろえられるもの・触れないものの2文。件数で増えない
    expect(alignCount).toBeLessThanOrEqual(3);
  });

  it("知らせが出ても、1文40字以内で、同じ文を2回出さない", () => {
    expectReadable(sentences(renderHub(createElement(Fragment, null, stale, align))));
  });
});

/* ───────────────────────── KPI 項目 ───────────────────────── */

const question = (key: string, text: string): AskingQuestionView => ({
  key,
  text,
  unit: "時間",
  validation: "0以上の整数",
  role: "",
});

const kpiRow = (id: string, no: number, name: string, extra: Partial<KpiItemRow> = {}): KpiItemRow => ({
  id,
  no,
  name,
  categoryId: null,
  categoryName: null,
  measureType: "個人実績",
  unit: "%",
  direction: "higher",
  formula: null,
  formulaNote: null,
  remarks: null,
  isMonetary: false,
  isProvisional: false,
  isActive: true,
  isFixedSlot: false,
  asking: { questions: [], formula: "", readonlyReason: null },
  keySetLockedBy: null,
  ...extra,
});

const ITEMS = [
  kpiRow("kpi_fixed", 1, "等級要件達成率", {
    isFixedSlot: true,
    categoryName: "共通",
    asking: { questions: [], formula: "満たした要件の数÷要件の数", readonlyReason: "固定枠" },
  }),
  kpiRow("kpi_rate", 2, "稼働率", {
    categoryId: "cat_1",
    categoryName: "生産性",
    asking: { questions: [question("a", "稼働した時間"), question("b", "所定の時間")], formula: "A÷B×100", readonlyReason: null },
  }),
  kpiRow("kpi_over", 3, "残業率", { direction: "lower" }),
  kpiRow("kpi_leave", 4, "離職率", { categoryId: "cat_2", categoryName: "定着" }),
];

const renderItems = () => html(createElement(KpiItemEditor, { items: ITEMS, categories: [], usage: {} }));

/** id の行の中身（次の行の手前まで） */
function rowOf(markup: string, id: string): string {
  const start = markup.indexOf(`id="kpi-item-${id}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = markup.indexOf('id="kpi-item-', start + 1);
  return markup.slice(start, next < 0 ? undefined : next);
}

describe("KPI 項目の画面を開いた直後（O26-1）", () => {
  it("名前と分類を頭にし、聞くこと A・B… を1行ずつ並べる", () => {
    const row = rowOf(renderItems(), "kpi_rate");
    const visible = visibleText(row);
    expect(visible).toContain("稼働率");
    expect(visible).toContain("生産性");
    const list = row.match(/<ol aria-label="稼働率の聞くこと"[^>]*>([\s\S]*?)<\/ol>/);
    expect(list).not.toBeNull();
    const lines = [...(list?.[1] ?? "").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, body]) => squash(body.replace(/<[^>]+>/g, "")));
    expect(lines).toEqual(["A稼働した時間", "B所定の時間"]);
    // 分類の無い項目は、無いことを書く
    expect(visibleText(rowOf(renderItems(), "kpi_over"))).toContain("分類未設定");
  });

  it("計算式・実績区分・単位・向きは、開いたときにだけ出す", () => {
    const items = renderItems();
    const row = rowOf(items, "kpi_rate");
    expect(row).toMatch(/<details class="inline-detail\b(?![^>]*\sopen)/);
    for (const part of ["A÷B×100", "個人実績", "高いほど良い"]) expect(row).toContain(part);
    const visible = visibleText(items);
    for (const part of ["A÷B×100", "満たした要件の数÷要件の数", "個人実績", "高いほど良い", "低いほど良い"]) {
      expect(visible).not.toContain(part);
    }
  });

  it("聞くことが未定の項目は札で示し、その意味は一覧の頭に1回だけ書く", () => {
    const items = renderItems();
    for (const id of ["kpi_over", "kpi_leave"]) expect(rowOf(items, id)).toContain(">聞くことが未定<");
    // 固定枠は制度の決まりで聞き方を持たないので、札を付けない
    for (const id of ["kpi_fixed", "kpi_rate"]) expect(rowOf(items, id)).not.toContain("聞くことが未定");
    const found = sentences(items);
    expect(found.filter((s) => s.includes("アンケートに出ず"))).toHaveLength(1);
    expectReadable(found);
  });
});
