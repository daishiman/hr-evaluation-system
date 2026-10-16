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
 * 作り直すかどうかは回答状況を見て人が決めることなので、
 * ここでは判定だけを行い、自動では何もしない。
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
