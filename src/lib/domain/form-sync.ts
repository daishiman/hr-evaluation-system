/**
 * 「いま選んでいるKPI項目」と「配ってあるアンケートが聞いている項目」のズレを見つける。
 *
 * アンケートは作った時点の評価セットを焼き付けたもの（src/lib/form-build.ts）。
 * 回答済みのアンケートの設問を後から書き換えないための設計なので、これ自体は正しい。
 * ただし副作用として、評価セットで項目を選び直しても、配布済みのアンケートは追従しない。
 *
 * このズレは放っておくと気づかれないまま進行する。実害は2種類:
 *   欠落 … 選んだのに実績を聞いていない。回答が無いので判定外になり、配点はそのまま
 *          分母に残る（scoring.ts の方針）。つまり満点に届かなくなる。
 *   余分 … 聞いているのに使わない。回答者の手間だけが増える。害は小さいが、
 *          「なぜこれを聞かれたのか」の説明がつかなくなる。
 *
 * どちらも、設問のひな形（kpi_questions）のある項目ならアンケートを作り直せば直る。
 * ひな形の無い項目は作り直しても設問が出ないので、comparison-gap.ts が先に KPI項目の画面で聞き方を決めるよう案内する（DD-016）。
 * 設定を保存すると、回答の無い下書きは作り直し、回答のある公開中のアンケートには次の版の下書きを作る（DD-028 の4）。
 * 締め切ったアンケートと、公開を待つ間にまだ残るズレは、ここで見つけて警告にする。
 * 画面に出す警告（2つのページと直す操作1つの組）は comparison-gap.ts が作る（DD-012）。ここで文は作らない。
 */

import { extractVariables } from "./formula";
import { questionsForPointGroup } from "./grade-points";
import { GRADE_FORMULA_VARIABLES } from "./kpi-asking";

export interface FormKpiDiff {
  /** 評価セットにあるのに、アンケートが聞いていない項目 */
  missing: string[];
  /** アンケートが聞いているのに、評価セットに無い項目 */
  extra: string[];
}

export function diffFormKpiItems(schemeItemIds: Iterable<string>, formKpiItemIds: Iterable<string>): FormKpiDiff {
  const wanted = new Set(schemeItemIds);
  const asked = new Set(formKpiItemIds);
  return {
    missing: [...wanted].filter((id) => !asked.has(id)),
    extra: [...asked].filter((id) => !wanted.has(id)),
  };
}

/**
 * 「このアンケートが実績を聞いている項目」を、集計の実態に合わせて数え直す。
 *
 * 固定枠（等級要件達成率）だけは、KPI設問ではなく支援・運営の「はい／いいえ」から
 * 達成率を出す（evaluate.ts）。同じことを2回聞かないため、アンケートには
 * 固定枠のKPI設問を載せない。その状態を「聞いていない＝欠落」と数えると、
 * 実際には点が付く項目に警告を出し続けることになるので、ここで補う。
 */
export function effectiveAskedItems(
  askedKpiItemIds: Iterable<string>,
  opts: { fixedSlotItemIds: Iterable<string>; hasRequirementQuestions: boolean },
): string[] {
  const asked = new Set(askedKpiItemIds);
  if (opts.hasRequirementQuestions) for (const id of opts.fixedSlotItemIds) asked.add(id);
  return [...asked];
}

/** 版の設問が、いまの計算式の変数をそろえていない項目（公開の前に止める。DD-016） */
export interface StaleAsking {
  kpiItemId: string;
  name: string;
  /** いまのひな形から作り直せば変数がそろうか。そろわなければ、KPI項目の画面で聞き方か式を直す */
  rebuildFixes: boolean;
}

/**
 * 版の設問の key が、いまの計算式の変数をそろえていない項目を見つける。
 *
 * 版は作った時点のひな形を焼き付けたもの。DD-016 で、回答を集めていない項目は聞くことを足し・消しでき、
 * 式の key も変わる。作り直していない下書きをそのまま公開すると、式の key が版に無く、点が付かない（判定外）。
 * 比べる警告（DD-012）は項目の有無しか見ないので、この食い違いは出ない。公開すると項目の組が固まり、もう直せない。
 *
 * 見るのは、この版が聞いていて、評価セットのこの区分で点を付ける項目だけ。固定枠は式を使わない（evaluate.ts）。
 * 式の変数は点の計算と同じく版全体の key と等級から決まる値で探す（evaluate.ts は1つの平らな表で式を解く）。
 * 回答を集めた項目の組は変えられない（kpiItemCollectingForms）ので、この食い違いは下書きでしか起きない。
 */
export function staleAskingItems(input: {
  pointGroup: string;
  /** 評価セットのこの区分で選んだ項目 */
  schemeItems: readonly { kpiItemId: string; isFixedSlot: boolean }[];
  /** この版の設問 */
  formQuestions: readonly { kpiItemId: string | null; kpiQuestionKey: string | null }[];
  kpiItems: readonly { id: string; name: string; formula: string | null }[];
  /** 会社の設問のひな形（kpi_questions） */
  templates: readonly { kpiItemId: string | null; questionKey: string; targetGrades: string | null }[];
}): StaleAsking[] {
  const scored = input.schemeItems.filter((item) => !item.isFixedSlot).map((item) => item.kpiItemId);
  const asked = new Set(input.formQuestions.flatMap((q) => (q.kpiItemId ? [q.kpiItemId] : [])));
  const formKeys = new Set(input.formQuestions.flatMap((q) => (q.kpiQuestionKey ? [q.kpiQuestionKey] : [])));
  // 作り直した版の key。form-build.ts と同じく、選んだ項目ごとにこの区分向けのひな形を載せる
  const rebuiltKeys = new Set(
    scored.flatMap((id) =>
      questionsForPointGroup(input.templates.filter((t) => t.kpiItemId === id), input.pointGroup).map((t) => t.questionKey),
    ),
  );
  const gradeValues = new Set<string>(GRADE_FORMULA_VARIABLES);

  return scored.flatMap((id): StaleAsking[] => {
    const item = input.kpiItems.find((k) => k.id === id);
    if (!item || !asked.has(id)) return [];
    const needed = extractVariables(item.formula ?? "").filter((v) => !gradeValues.has(v));
    if (needed.every((v) => formKeys.has(v))) return [];
    return [{ kpiItemId: id, name: item.name, rebuildFixes: needed.every((v) => rebuiltKeys.has(v)) }];
  });
}

/** 作り直しで残すかを決めるのに要る、設問の紐づけ */
export interface RebuildQuestion {
  id: string;
  displayOrder: number;
  kpiItemId: string | null;
  behaviorGuidelineId: string | null;
  gradeRequirementId: string | null;
  promotionRequirementId: string | null;
  isGate: boolean;
}

/**
 * 設定の保存で下書きを作り直すとき、作り直した設問の後ろに残す設問（DD-028 の4）。
 *
 * 設定とつながった設問と入口の問い（isGate）は、いまの設定から作り直すので残さない。
 * それ以外は人が組み立て画面で足した設問なので、同じ id のまま元の並びで残す。
 * 番号は、作り直した設問（startOrder の手前まで）と前に残した設問より後ろなら元のまま、重なるときだけ次の空きへ送る。
 */
export function questionsKeptOnRebuild<T extends RebuildQuestion>(questions: readonly T[], startOrder: number): T[] {
  let next = startOrder;
  return questions
    .filter((q) => !q.kpiItemId && !q.behaviorGuidelineId && !q.gradeRequirementId && !q.promotionRequirementId && !q.isGate)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((q) => {
      const displayOrder = Math.max(q.displayOrder, next);
      next = displayOrder + 1;
      return { ...q, displayOrder };
    });
}

/** 設定から作る設問の中身。id・並び・日時は比べない（作り直すと変わるため） */
export interface LinkedQuestionContent {
  section: string;
  questionType: string;
  title: string;
  helpText?: string | null;
  unit?: string | null;
  required?: boolean | null;
  validationMin?: number | null;
  validationMax?: number | null;
  validationInteger?: boolean | null;
  optionsJson?: string | null;
  gradeRequirementId?: string | null;
  promotionRequirementId?: string | null;
  behaviorGuidelineId?: string | null;
  kpiItemId?: string | null;
  kpiQuestionKey?: string | null;
  isGate?: boolean | null;
}

/** 1問の中身を1つの文字列にする。DB の既定（必須・整数でない・入口の問いでない）に合わせて欠けた値を埋める */
function linkedQuestionKey(q: LinkedQuestionContent): string {
  return JSON.stringify([
    q.section,
    q.questionType,
    q.title,
    q.helpText ?? null,
    q.unit ?? null,
    q.required ?? true,
    q.validationMin ?? null,
    q.validationMax ?? null,
    q.validationInteger ?? false,
    q.optionsJson ?? null,
    q.gradeRequirementId ?? null,
    q.promotionRequirementId ?? null,
    q.behaviorGuidelineId ?? null,
    q.kpiItemId ?? null,
    q.kpiQuestionKey ?? null,
    q.isGate ?? false,
  ]);
}

/**
 * 版の設問のうち設定から作った部分が、いまの設定から作り直した設問と同じか（DD-028 の4）。
 *
 * 同じなら、設定を保存しても下書きを作り直さず、回答のあるアンケートに次の版も作らない。
 * 保存のたびに中身の同じ版が増えると、公開を待つ版がどれか分からなくなるため。
 * 比べるのは作り直しで置き換わる設問（questionsKeptOnRebuild が残さない側）だけで、手で足した設問は見ない。
 * 並びは見ない。同じ中身の設問が2問あれば2問として数える。
 */
export function linkedQuestionsMatch(
  current: readonly (LinkedQuestionContent & RebuildQuestion)[],
  rebuilt: readonly LinkedQuestionContent[],
): boolean {
  const kept = new Set(questionsKeptOnRebuild(current, 0).map((q) => q.id));
  const before = current.filter((q) => !kept.has(q.id)).map(linkedQuestionKey).sort();
  const after = rebuilt.map(linkedQuestionKey).sort();
  return before.length === after.length && before.every((key, i) => key === after[i]);
}
