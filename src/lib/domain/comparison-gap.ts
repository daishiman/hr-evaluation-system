/**
 * 比べる警告（DD-012）。
 *
 * いまの制度の設定と、配ってあるアンケートが聞いている項目を比べ、違いがあれば、
 * どの2つのページを見比べればよいかと、直す操作1つを組で返す。
 * 比べるのは3種類。等級要件（版の系列で比べる）・行動指針・KPI項目（「使うKPIを選ぶ」で選んだ項目）。
 * 等級要件と行動指針の「聞くはずの項目」は comparison-items.ts が form-build.ts と同じ選び方で作る。
 *
 * 決めていることは5つ。
 *  1. 警告は必ず2つのページ（使うKPIを選ぶ・このアンケート）を持つ。名前は台帳の画面名から始まる階層つき
 *  2. 表の行は、足りない項目のあとに余分な項目。どちらも等級要件 → 行動指針 → KPI項目の順で、種類の中は選んだ順（余分は聞いた順）。
 *     各行は種類と、その項目を直す画面へのリンク（行の位置へ飛ぶ錨付き）を持つ。マスタから消えた項目は「消された項目」と出す
 *  3. 直す操作は上から順に1つだけ選ぶ（pickFix）。足りない項目に設問のひな形の無いもの（聞き方が未定）があれば、まずその聞き方を決めさせる
 *  4. リンクと直す操作は、見る人の役割で開ける・できるものだけ。開けない人には名前だけを残す
 *  5. 同じ評価期間・等級の一番新しい版が3種類とも一致していれば、古い版には出さない（直し終わっている）。
 *     ただし新しい版が下書きのうちは、公開中の版には出し続ける（配っているのは公開中の版で、まだ直っていない）
 *
 * 項目の差（diffFormKpiItems）を使ってよいのはこのファイルだけ。画面は ComparisonGapNotice を通す。
 */

import type { Role } from "@/lib/roles";
import { roleCan, roleCanOpen, routeOf } from "@/lib/route-access";
import { BEHAVIOR_LEDGER_PATH, REQUIREMENTS_LEDGER_PATH, behaviorGuidelinesPath, gradeRequirementsPath } from "./comparison-items";
import { diffFormKpiItems } from "./form-sync";
import { formRowTitle } from "./grade-label";
import { ASKING_PLACE_HINT, unaskableLead } from "./scheme";
import { kpiItemPath, schemeStepPath, stepTitle } from "./scheme-steps";

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

/**
 * 設問のひな形が無い項目の注記。作り直しの返事（actions/forms.ts）でも同じ文を使う。
 * ひな形は form-build.ts が設問を作る元なので、無い項目はどの版にも設問が出ない。
 * 画面ではひな形を「実績の聞き方」と呼ぶ（KPI項目の画面の欄の名前。DD-016）。
 * 書き出しは選んだ時点の警告と同じ unaskableLead（scheme.ts）で、続く文だけをここで足す
 */
export function noTemplateNote(names: readonly string[]): string {
  return `${unaskableLead(names)}決めるまでは、作り直しても新しい版でも、設問は出ず点も付きません。`;
}

/** 設問のひな形が無い項目の直し方。リンクを置けない作り直しの返事で使う */
export const NO_TEMPLATE_HINT = `${ASKING_PLACE_HINT}決めたあとに、もう一度作り直してください。`;

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

/** 比べる項目の種類 */
export type ComparisonItemKind = "requirement" | "behavior" | "kpi";

/** 表の種類の列の札（マスタの画面の名前に合わせる） */
export const COMPARISON_KIND_LABEL: Record<ComparisonItemKind, string> = {
  requirement: "等級要件",
  behavior: "行動指針",
  kpi: "KPI項目",
};

/** マスタから消えた項目の名前。設問は消した項目の id を持ったまま残るので、id を名前の代わりに見せない */
export const DELETED_ITEM_NAME = "消された項目";

export interface ComparisonRow {
  kind: ComparisonItemKind;
  /** 項目の id。等級要件は系列の起点の id（本文を直した新版も同じ項目） */
  itemId: string;
  name: string;
  /** その項目を直す画面。行の位置へ飛ぶ錨が付く（飛ぶ先の行が無いときは画面まで）。開けない役割には null */
  href: string | null;
  /** いまの制度で聞くはずか（KPI項目は、使うKPIを選ぶで選んでいるか） */
  inSelection: boolean;
  /** このアンケートで聞いているか */
  inForm: boolean;
  /** 実績を聞く設問のひな形が無いか。KPI項目の足りない行だけが true になる（聞き方を決めるまで、作り直しても新しい版でも直らない） */
  noTemplate: boolean;
}

/** 等級要件・行動指針の比べる材料（comparison-items.ts で作る） */
export interface ComparisonItems {
  /** いまの制度で、この等級のアンケートが聞くはずの項目（form-build.ts が設問を作るのと同じ選び方） */
  expected: readonly string[];
  /** このアンケートが聞いている項目 */
  asked: readonly string[];
  /** 項目の名前。マスタから消えた項目は undefined */
  nameOf: (id: string) => string | undefined;
}

export type ComparisonFix =
  | { kind: "rebuild"; formId: string }
  | { kind: "newVersion"; cycleId: string; gradeId: string }
  | { kind: "openNewer"; formId: string; href: string; version: number; draft: boolean }
  | { kind: "finishScheme"; href: string; linkLabel: string }
  /** href は先頭の項目の入力欄を開いた KPI項目の画面。names は聞き方の決まっていない項目（表に出した順） */
  | { kind: "defineAsking"; href: string; names: readonly string[] };

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
  /** KPI項目の名前。マスタから消えた項目は undefined */
  nameOf: (id: string) => string | undefined;
  /** 等級要件。id は系列の起点（lineageRootId）で数える */
  requirements: ComparisonItems;
  /** 行動指針。bandOf はその観点の基準（行動指針の画面の band）、band はこの等級の基準 */
  behaviors: ComparisonItems & { bandOf: (id: string) => string | undefined; band: string | null };
  /**
   * 同じ評価期間・等級で、版がより大きいアンケートの最大のもの。
   * asked・askedRequirements・askedBehaviors はその版が聞いている項目（数え方は、この版の asked・requirements・behaviors と同じ）
   */
  newer: {
    id: string;
    version: number;
    status: string;
    asked: readonly string[];
    askedRequirements: readonly string[];
    askedBehaviors: readonly string[];
  } | null;
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
  defineAsking: (role) => roleCanOpen(role, SCHEME_LEDGER_PATH),
};

/** 直す操作を上から順に1つだけ選ぶ（DD-012 の5）。役割での絞り込みは呼び出し側で行う */
function pickFix(input: ComparisonGapInput, rows: readonly ComparisonRow[]): ComparisonFix | null {
  const { form, newer } = input;
  // 足りない項目に聞き方（設問のひな形）の決まっていないものがあれば、ほかの操作より先にそれを決めさせる（DD-016）。
  // 聞き方の無い項目は、作り直しても新しい版でも設問が出ない。先に作り直すと足りないままの版ができ、決めたあとにもう一度
  // 作り直すことになる。先に決めれば、続く1回の作り直し（または新しい版）で余分も足りないも一度に直る。
  // 選び直しへは案内しない。評価に使う項目そのものを替えさせることになり、直し方として回り道になる。
  // 締め切った期で決めたあとに直せるのは、この版が回答の無い下書きか、新しい版が下書きのときだけ。それ以外は出さない
  const noAsking = rows.filter((row) => row.noTemplate);
  if (noAsking.length > 0) {
    const rebuildable = isUntouchedDraft(form) || newer?.status === "draft";
    if (form.cycleStatus === "closed" && !rebuildable) return null;
    return { kind: "defineAsking", href: kpiItemPath(noAsking[0].itemId), names: noAsking.map((row) => row.name) };
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

/** 一致している新しい版が、まだ下書きのとき（公開中のこの版に警告を出し続ける理由）の1文 */
function newerDraftReadyNote(version: number): string {
  return `第${version}版の下書きは、いまの設定と一致しています。公開すると、この版は自動で締め切られます。`;
}

/** 注記。設問のひな形が無い項目があれば先に置く（直す操作を押しても残る理由なので） */
function noteOf(input: ComparisonGapInput, rows: readonly ComparisonRow[]): string | null {
  const noTemplate = rows.filter((row) => row.noTemplate).map((row) => row.name);
  const notes = [
    noTemplate.length > 0 ? noTemplateNote(noTemplate) : null,
    input.newer && newerInSync(input) ? newerDraftReadyNote(input.newer.version) : null,
    stateNoteOf(input),
  ].filter((x) => x !== null);
  return notes.length > 0 ? notes.join("") : null;
}

/** 選んだ項目と聞いている項目が、並び順を除いて同じか */
function inSync(selected: readonly string[], asked: readonly string[]): boolean {
  const diff = diffFormKpiItems(selected, asked);
  return diff.missing.length === 0 && diff.extra.length === 0;
}

/** 新しい版が3種類とも、いまの設定と一致しているか */
function newerInSync(input: ComparisonGapInput): boolean {
  const { newer } = input;
  return (
    newer !== null &&
    inSync(input.selected, newer.asked) &&
    inSync(input.requirements.expected, newer.askedRequirements) &&
    inSync(input.behaviors.expected, newer.askedBehaviors)
  );
}

/** 行の項目を直す画面。開けない役割には null */
function itemHrefOf(input: ComparisonGapInput, kind: ComparisonItemKind, itemId: string, missing: boolean): string | null {
  const { form, role } = input;
  switch (kind) {
    case "requirement":
      // 足りない系列は、いま使っている項目の一覧に行がある。余分な系列（今後使わないにした項目）は版の履歴の段にあり
      // 行の錨を持たないので、等級を開いた画面までにする
      return roleCanOpen(role, REQUIREMENTS_LEDGER_PATH) ? gradeRequirementsPath(form.gradeId, missing ? itemId : undefined) : null;
    case "behavior": {
      // 行動指針の画面は、使わない観点のカードも出す。その観点の基準で開けば、余分な行も位置へ飛べる
      const band = input.behaviors.bandOf(itemId);
      if (!roleCanOpen(role, BEHAVIOR_LEDGER_PATH)) return null;
      return band ? behaviorGuidelinesPath(form.gradeId, band, itemId) : behaviorGuidelinesPath(form.gradeId, input.behaviors.band);
    }
    case "kpi":
      // 消された項目は KPI項目の一覧に行が無いので、一覧の画面までにする
      if (!roleCanOpen(role, SCHEME_LEDGER_PATH)) return null;
      return input.nameOf(itemId) === undefined ? SCHEME_LEDGER_PATH : kpiItemPath(itemId);
  }
}

/** 種類ごとの、足りない行と余分な行 */
function rowsOfKind(
  input: ComparisonGapInput,
  kind: ComparisonItemKind,
  expected: readonly string[],
  asked: readonly string[],
  nameOf: (id: string) => string | undefined,
): { missing: ComparisonRow[]; extra: ComparisonRow[] } {
  const diff = diffFormKpiItems(expected, asked);
  const unaskable = new Set(kind === "kpi" ? input.unaskable : []);
  const row = (itemId: string, missing: boolean): ComparisonRow => ({
    kind,
    itemId,
    name: nameOf(itemId) ?? DELETED_ITEM_NAME,
    href: itemHrefOf(input, kind, itemId, missing),
    inSelection: missing,
    inForm: !missing,
    noTemplate: missing && unaskable.has(itemId),
  });
  return { missing: diff.missing.map((id) => row(id, true)), extra: diff.extra.map((id) => row(id, false)) };
}

/**
 * いまの設定と聞いている項目に違いがあれば警告を作る。並び順の違いだけなら null。
 * 一番新しい版が一致していれば、この版に違いがあっても null（決めていることの5）
 */
export function comparisonGapOf(input: ComparisonGapInput): ComparisonGap | null {
  const { form, role } = input;
  const kinds = [
    rowsOfKind(input, "requirement", input.requirements.expected, input.requirements.asked, input.requirements.nameOf),
    rowsOfKind(input, "behavior", input.behaviors.expected, input.behaviors.asked, input.behaviors.nameOf),
    rowsOfKind(input, "kpi", input.selected, input.asked, input.nameOf),
  ];
  const missing = kinds.flatMap((k) => k.missing);
  const extra = kinds.flatMap((k) => k.extra);
  const rows: ComparisonRow[] = [...missing, ...extra];
  if (rows.length === 0) return null;
  // 直した結果は新しい版に出ることがある（公開済み・締め切り済みの版は変えられない）。DD-012 の5。
  // 古い版は直す対象ではない。下書きでも、pickFix はまず新しい版を開かせ、古い版を作り直させない。
  // だから新しい版が一致していれば、古い版の警告は直し終えたのに直っていないように見せるだけになる。
  // ただし新しい版が下書きのうちは、配っているのは公開中のこの版で、回答はまだ古い設問で集まる。
  // ここで消すと「直し終えた」と読めてしまうので、公開中の版には出し続け、下書きを開かせる（注記で一致していることを添える）。
  // 一致していない新しい版があるときは、従来どおり警告を出してその版を開かせる（pickFix の openNewer）
  if (newerInSync(input) && !(input.newer!.status === "draft" && form.status === "published")) return null;

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
    missingCount: missing.length,
    extraCount: extra.length,
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

/**
 * 作り直しの札。アンケート1本の画面の枠の外のボタンと、一覧の警告の中のボタンで同じ字面にする。
 * 作り直しは KPI だけでなく、等級要件・昇格要件・行動指針の設問も作り直すので、「評価項目に合わせて」とは書かない。
 * 押せばズレが直ると約束する字面にもしない（聞き方の決まっていない項目は作り直しても足りないまま。rebuildWontFixNote）
 */
export const REBUILD_LABEL = "いまの制度の設定から設問を作り直す";

/** 警告の行のうち、設問のひな形が無い項目の名前（表に出した順） */
export function noTemplateNamesOf(gap: ComparisonGap | null): string[] {
  return gap ? gap.rows.filter((row) => row.noTemplate).map((row) => row.name) : [];
}

/**
 * 作り直す前の確認。アンケート1本の画面のボタンと、警告の中の作り直しで同じ文を使う。
 * ひな形の無い項目があれば、作り直しても設問が出ないことを押す前に伝える
 */
export function rebuildConfirm(formTitle: string, noTemplateNames: readonly string[]): string {
  return (
    `「${formTitle}」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。` +
    (noTemplateNames.length > 0 ? noTemplateNote(noTemplateNames) : "") +
    "まだ公開前で、回答は1件もありません。よろしいですか？"
  );
}

/**
 * アンケート1本の画面で、警告とボタンの間に置く1行。作り直しを押しても警告が消えないときだけ出す。
 * 足りないのが設問のひな形の無い項目だけで、余分も無いときがそれにあたる（余分は作り直せば消える）。
 * 警告は閉じた段の件数だけが見えていて、その真下のボタンを押せば直ると読めるため、押す前に伝える
 */
export function rebuildWontFixNote(gap: ComparisonGap | null): string | null {
  if (!gap || gap.extraCount > 0 || !gap.rows.every((row) => row.noTemplate)) return null;
  const lead = "下のボタンで作り直しても、上のズレは直りません。足りない項目の聞き方がまだ決まっていないためです。";
  return gap.fix ? `${lead}直し方は「${COMPARISON_OPEN_LABEL}」を開いてください。` : lead;
}

/** 直す操作の札 */
export function fixLabel(fix: ComparisonFix): string {
  switch (fix.kind) {
    case "rebuild":
      return REBUILD_LABEL;
    case "newVersion":
      return "この等級だけ新しい版の下書きを作る";
    case "openNewer":
      return fix.draft ? `第${fix.version}版の下書きを開く` : `第${fix.version}版を開く`;
    case "finishScheme":
      return fix.linkLabel;
    case "defineAsking":
      return fix.names.length === 1
        ? `「${fix.names[0]}」の聞き方を決める`
        : `「${fix.names[0]}」ほか${fix.names.length - 1}項目の聞き方を決める`;
  }
}

/**
 * 押す前の確認。書き込む操作（作り直し・新しい版）だけに付け、リンクには付けない。
 * どちらも、ひな形の無い項目は入らないので、その項目を名指しする
 */
export function fixConfirm(fix: ComparisonFix, gap: ComparisonGap): string | undefined {
  const noTemplate = noTemplateNamesOf(gap);
  if (fix.kind === "rebuild") return rebuildConfirm(gap.formTitle, noTemplate);
  if (fix.kind === "newVersion") {
    return (
      `「${gap.formTitle}」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。` +
      (noTemplate.length > 0 ? noTemplateNote(noTemplate) : "") +
      "よろしいですか？"
    );
  }
  return undefined;
}
