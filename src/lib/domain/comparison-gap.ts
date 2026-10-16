/**
 * 比べる警告（DD-012）。
 *
 * 「使うKPIを選ぶ」で選んだ項目と、配ってあるアンケートが実績を聞いている項目を比べ、
 * 違いがあれば、どの2つのページを見比べればよいかと、直す操作1つを組で返す。
 *
 * 決めていることは5つ。
 *  1. 警告は必ず2つのページ（使うKPIを選ぶ・このアンケート）を持つ。名前は台帳の画面名から始まる階層つき
 *  2. 表の行は、足りない項目（選んだ順）のあとに余分な項目（聞いた順）
 *  3. 直す操作は上から順に1つだけ選ぶ（pickFix）。足りないのが設問のひな形の無い項目だけで余分も無いなら、選び直しへ案内する
 *  4. リンクと直す操作は、見る人の役割で開ける・できるものだけ。開けない人には名前だけを残す
 *  5. 同じ評価期間・等級の一番新しい版が選んだ項目と一致していれば、古い版には出さない（直し終わっている）
 *
 * 項目の差（diffFormKpiItems）を使ってよいのはこのファイルだけ。画面は ComparisonGapNotice を通す。
 */

import type { Role } from "@/lib/roles";
import { roleCan, roleCanOpen, routeOf } from "@/lib/route-access";
import { diffFormKpiItems } from "./form-sync";
import { formRowTitle } from "./grade-label";
import { schemeStepPath, stepTitle } from "./scheme-steps";

/** 使うKPIを選ぶの画面（台帳の書き方） */
export const SELECTION_LEDGER_PATH = "/admin/scheme/[group]";
/** アンケート1本の画面（台帳の書き方） */
export const FORM_LEDGER_PATH = "/admin/forms/[id]";

const SCHEME_LEDGER_PATH = "/admin/scheme";
/** 階層の先頭に置く画面名。台帳の名前をそのまま使い、画面ごとに書き起こさない */
const SCHEME_LABEL = routeOf(SCHEME_LEDGER_PATH)!.label;
const FORMS_LABEL = routeOf("/admin/forms")!.label;

/** 開いた中の1行目 */
export const COMPARISON_LEAD = "下記の内容を変更・修正してください";
/** 閉じた段の札 */
export const COMPARISON_OPEN_LABEL = "直すところを見る";

const PUBLISHED_NOTE = "公開後や回答のあるアンケートは設問を差し替えません";
const CLOSED_NOTE = "締め切った評価期間には新しい版を作れません";

/** 表の項目名に添える札（使うKPIを選ぶの候補の札と同じ字面。定義は scheme.ts） */
export { NO_TEMPLATE_BADGE } from "./scheme";

/**
 * 設問のひな形が無い項目の注記。作り直しの返事（actions/forms.ts）でも同じ文を使う。
 * ひな形は form-build.ts が設問を作る元なので、無い項目はどの版にも設問が出ない
 */
export function noTemplateNote(names: readonly string[]): string {
  return `${names.map((name) => `「${name}」`).join("・")}には設問のひな形がありません。作り直しても新しい版でも、設問は出ず点も付きません。`;
}

/** 設問のひな形が無い項目の直し方。リンクを置けない作り直しの返事で使う */
export const NO_TEMPLATE_HINT = `${stepTitle("select")}で、ひな形のある項目に選び直してください。`;

export type ComparisonPageKey = "selection" | "form";

export interface ComparisonPage {
  key: ComparisonPageKey;
  /** 階層つきの名前（例: KPI・評価セット › 等級２：Regular：使うKPIを選ぶ） */
  label: string;
  /** 開けない役割には null（名前だけを出す） */
  href: string | null;
  /** 台帳の書き方のパス */
  ledgerPath: string;
  /** いま開いているページか */
  current: boolean;
}

export interface ComparisonRow {
  itemId: string;
  name: string;
  /** 使うKPIを選ぶで選んでいるか */
  inSelection: boolean;
  /** このアンケートで聞いているか */
  inForm: boolean;
  /** 実績を聞く設問のひな形が無いか。足りない行だけが true になる（作り直しても新しい版でも直らない） */
  noTemplate: boolean;
}

export type ComparisonFix =
  | { kind: "rebuild"; formId: string }
  | { kind: "newVersion"; cycleId: string; gradeId: string }
  | { kind: "openNewer"; formId: string; href: string; version: number; draft: boolean }
  | { kind: "finishScheme"; href: string; linkLabel: string }
  | { kind: "reselect"; href: string };

/** 比べるアンケート（一覧・詳細の読み出しの行の一部） */
export interface ComparisonForm {
  id: string;
  title: string | null;
  cycleName: string | null;
  gradeName: string | null;
  cycleId: string;
  gradeId: string;
  status: string;
  version: number;
  responseCount: number;
  cycleStatus: string | null;
}

export interface ComparisonGapInput {
  form: ComparisonForm;
  pointGroup: string;
  /** 区分の呼び名（pointGroupLabel で等級名から作ったもの） */
  groupLabel: string;
  /** 使うKPIを選ぶで選んだ項目 */
  selected: readonly string[];
  /** このアンケートが実績を聞いている項目（effectiveAskedItems で数え直したもの） */
  asked: readonly string[];
  /** 選んだ項目のうち、実績を聞く設問のひな形が無いもの（固定枠を除く。queries.ts の listAskableKpiItemIds で判定） */
  unaskable: readonly string[];
  nameOf: (id: string) => string;
  /** 同じ評価期間・等級で、版がより大きいアンケートの最大のもの。asked はその版が実績を聞いている項目（数え方は asked と同じ） */
  newer: { id: string; version: number; status: string; asked: readonly string[] } | null;
  /** 評価セットの準備が残っていれば、その手順へのリンク */
  schemeGap: { href: string; linkLabel: string } | null;
  current: ComparisonPageKey | null;
  role: Role;
}

export interface ComparisonGap {
  formId: string;
  formTitle: string;
  pointGroup: string;
  current: ComparisonPageKey | null;
  pages: readonly [ComparisonPage, ComparisonPage];
  rows: readonly ComparisonRow[];
  missingCount: number;
  extraCount: number;
  fix: ComparisonFix | null;
  note: string | null;
}

const formPath = (formId: string) => `/admin/forms/${encodeURIComponent(formId)}`;

/** 下書きで回答が1件も無い（設問をその場で作り直してよい）アンケート */
const isUntouchedDraft = (form: ComparisonForm) => form.status === "draft" && form.responseCount === 0;

/** 直す操作ごとに、見る人の役割でできるかを台帳で確かめる */
const FIX_GUARD: Record<ComparisonFix["kind"], (role: Role) => boolean> = {
  openNewer: (role) => roleCanOpen(role, FORM_LEDGER_PATH),
  rebuild: (role) => roleCan(role, "forms.rebuildQuestions"),
  finishScheme: (role) => roleCanOpen(role, SCHEME_LEDGER_PATH),
  newVersion: (role) => roleCan(role, "forms.create"),
  reselect: (role) => roleCanOpen(role, SELECTION_LEDGER_PATH),
};

/** 直す操作を上から順に1つだけ選ぶ（DD-012 の5）。役割での絞り込みは呼び出し側で行う */
function pickFix(input: ComparisonGapInput, rows: readonly ComparisonRow[]): ComparisonFix | null {
  const { form, newer } = input;
  // 足りないのが設問のひな形の無い項目だけで余分も無いなら（余分の行は noTemplate が false なので every で外れる）、
  // アンケート側のどの操作でも直らない。
  // 作り直しや新しい版を出すと、押しても直らず版だけが増えるので、選び直しへ案内する。
  // 締め切った期は選び直してもその期のアンケートは変わらず、使うKPIを選ぶの画面では今いるページなので出さない
  if (rows.every((row) => row.noTemplate)) {
    if (form.cycleStatus === "closed" || input.current === "selection") return null;
    return { kind: "reselect", href: schemeStepPath(input.pointGroup, "select") };
  }
  // 残りの順は DD-012 の5（新しい版→作り直し→締切→準備の残り→新しい版を作る）。
  // 新しい版があれば、まずそれを開かせて版を重ねて作らせない（ここに来るのは、その版もまだ一致していないとき）。
  // 下書きはその場で直すのが一番安い。
  // 締め切った期では新しい版を作れない。準備が残ったまま新しい版を作ると、その版もまたズレる。
  if (newer) {
    return { kind: "openNewer", formId: newer.id, href: formPath(newer.id), version: newer.version, draft: newer.status === "draft" };
  }
  // アンケート1本の画面には枠の外に同じ作り直しのボタンがあるので、部品には出さない
  if (isUntouchedDraft(form)) return input.current === "form" ? null : { kind: "rebuild", formId: form.id };
  if (form.cycleStatus === "closed") return null;
  if (input.schemeGap) return { kind: "finishScheme", ...input.schemeGap };
  return { kind: "newVersion", cycleId: form.cycleId, gradeId: form.gradeId };
}

function stateNoteOf(input: ComparisonGapInput): string | null {
  if (isUntouchedDraft(input.form)) return null;
  if (input.form.cycleStatus === "closed" && !input.newer) return CLOSED_NOTE;
  return PUBLISHED_NOTE;
}

/** 注記。設問のひな形が無い項目があれば先に置く（直す操作を押しても残る理由なので） */
function noteOf(input: ComparisonGapInput, rows: readonly ComparisonRow[]): string | null {
  const noTemplate = rows.filter((row) => row.noTemplate).map((row) => row.name);
  const notes = [noTemplate.length > 0 ? noTemplateNote(noTemplate) : null, stateNoteOf(input)].filter((x) => x !== null);
  return notes.length > 0 ? notes.join("") : null;
}

/** 選んだ項目と聞いている項目が、並び順を除いて同じか */
function inSync(selected: readonly string[], asked: readonly string[]): boolean {
  const diff = diffFormKpiItems(selected, asked);
  return diff.missing.length === 0 && diff.extra.length === 0;
}

/**
 * 選んだ項目と聞いている項目に違いがあれば警告を作る。並び順の違いだけなら null。
 * 一番新しい版が一致していれば、この版に違いがあっても null（決めていることの5）
 */
export function comparisonGapOf(input: ComparisonGapInput): ComparisonGap | null {
  const { form, role } = input;
  const diff = diffFormKpiItems(input.selected, input.asked);
  const unaskable = new Set(input.unaskable);
  const rows: ComparisonRow[] = [
    ...diff.missing.map((itemId) => ({
      itemId,
      name: input.nameOf(itemId),
      inSelection: true,
      inForm: false,
      noTemplate: unaskable.has(itemId),
    })),
    ...diff.extra.map((itemId) => ({ itemId, name: input.nameOf(itemId), inSelection: false, inForm: true, noTemplate: false })),
  ];
  if (rows.length === 0) return null;
  // 直した結果は新しい版に出ることがある（公開済み・締め切り済みの版は変えられない）。DD-012 の5。
  // 古い版は直す対象ではない。下書きでも、pickFix はまず新しい版を開かせ、古い版を作り直させない。
  // だから新しい版が一致していれば、古い版の警告は直し終えたのに直っていないように見せるだけになる。
  // 一致していない新しい版があるときは、従来どおり警告を出してその版を開かせる（pickFix の openNewer）
  if (input.newer && inSync(input.selected, input.newer.asked)) return null;

  const formTitle = formRowTitle(form);
  const selection: ComparisonPage = {
    key: "selection",
    label: `${SCHEME_LABEL} › ${input.groupLabel}：${stepTitle("select")}`,
    href: roleCanOpen(role, SELECTION_LEDGER_PATH) ? schemeStepPath(input.pointGroup, "select") : null,
    ledgerPath: SELECTION_LEDGER_PATH,
    current: input.current === "selection",
  };
  const formPage: ComparisonPage = {
    key: "form",
    label: `${FORMS_LABEL} › ${formTitle}（第${form.version}版）`,
    href: roleCanOpen(role, FORM_LEDGER_PATH) ? formPath(form.id) : null,
    ledgerPath: FORM_LEDGER_PATH,
    current: input.current === "form",
  };
  const picked = pickFix(input, rows);

  return {
    formId: form.id,
    formTitle,
    pointGroup: input.pointGroup,
    current: input.current,
    pages: [selection, formPage],
    rows,
    missingCount: diff.missing.length,
    extraCount: diff.extra.length,
    fix: picked && FIX_GUARD[picked.kind](role) ? picked : null,
    note: noteOf(input, rows),
  };
}

/** 閉じた段の1行。件数はアンケート×項目の組で数える */
export function comparisonSummary(gaps: readonly ComparisonGap[]): string {
  const missing = gaps.reduce((sum, gap) => sum + gap.missingCount, 0);
  const extra = gaps.reduce((sum, gap) => sum + gap.extraCount, 0);
  return `評価項目とのズレ ${missing + extra}件（足りない${missing}・余分${extra}）`;
}

/** 直す操作の札 */
export function fixLabel(fix: ComparisonFix): string {
  switch (fix.kind) {
    case "rebuild":
      return "設問を作り直す";
    case "newVersion":
      return "この等級だけ新しい版の下書きを作る";
    case "openNewer":
      return fix.draft ? `第${fix.version}版の下書きを開く` : `第${fix.version}版を開く`;
    case "finishScheme":
      return fix.linkLabel;
    case "reselect":
      return `${stepTitle("select")}で選び直す`;
  }
}

/** 押す前の確認。書き込む操作（作り直し・新しい版）だけに付け、リンクには付けない */
export function fixConfirm(fix: ComparisonFix, formTitle: string): string | undefined {
  if (fix.kind === "rebuild") {
    return (
      `「${formTitle}」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。` +
      "手で足した設問は消えます。まだ公開前で、回答は1件もありません。よろしいですか？"
    );
  }
  if (fix.kind === "newVersion") {
    return `「${formTitle}」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。よろしいですか？`;
  }
  return undefined;
}
