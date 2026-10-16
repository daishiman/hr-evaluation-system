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
