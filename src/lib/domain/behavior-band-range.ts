/**
 * 行動指針の基準セットは、等級の並びで続いた範囲にだけ出す（spec.md §28-12・DD-010）。
 *
 * 基準セットは「その層の人に問う行動」なので、層は等級の並びで切れ目なく続く。
 * 初期は 等級1・等級2 に1つ目、等級3・等級4-1・等級4-2 に2つ目、等級5-1・等級5-2 は出さない。
 * 等級2 を挟んで 等級1 と 等級3 に同じセットを出すような、飛び飛びの割り当ては保存させない。
 *
 * 「挟まる等級」は、使用中の等級の並びで、あるセットの最初と最後の等級のあいだにある、
 * 別のセットか「出さない」の等級（BandSplit の gaps）。1手で断るのは、どれかのセットで挟まる等級が増える手と、
 * 割り当てた先のセットが飛び飛びのまま挟まる等級が減らない手の2つ。変えない保存と、挟まる等級が減る手
 * （すでに飛び飛びの会社を直す向きの1手）は、飛び飛びが残っていても通す。
 *
 * 使用を止めた等級は新しいアンケートに出ないので、並びから外して判定する。
 * 「出さない」（null）はセットではないので、飛び飛びでもよい。
 * 並び順（displayOrder）は重なりうる（一意の制約が無い）ので、同着は id の順にし、画面とサーバーで同じ並びにする。
 */

import { compareGradeOrder, gradeLabel } from "./grade-label";

export type BandGrade = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  behaviorBand: string | null;
};

/** 同じセットのあいだに、別の割り当ての等級が挟まっている状態 */
export type BandSplit = {
  band: string;
  /** そのセットを割り当てた等級（並びの順） */
  members: BandGrade[];
  /** あいだに挟まった、別の割り当ての等級（並びの順） */
  gaps: BandGrade[];
};

/** 判定に使う並び。使用中の等級だけを、表示の順に（同着は id の順） */
export function bandLine<T extends BandGrade>(grades: readonly T[]): T[] {
  return grades
    .filter((g) => g.isActive)
    .sort(compareGradeOrder);
}

/** 飛び飛びになっているセットを、並びで最初に現れる順に返す */
export function bandSplits(grades: readonly BandGrade[]): BandSplit[] {
  const line = bandLine(grades);
  const splits: BandSplit[] = [];
  const seen = new Set<string>();
  for (const grade of line) {
    const band = grade.behaviorBand;
    if (!band || seen.has(band)) continue;
    seen.add(band);
    const at = line.flatMap((g, i) => (g.behaviorBand === band ? [i] : []));
    const span = line.slice(at[0], at[at.length - 1] + 1);
    const gaps = span.filter((g) => g.behaviorBand !== band);
    if (gaps.length > 0) splits.push({ band, members: span.filter((g) => g.behaviorBand === band), gaps });
  }
  return splits;
}

/**
 * 1つの等級の割り当て（と使用中かどうか）を変えたときに、保存を断る理由になるセット（変更後の飛び飛び）。
 *
 * 断るのは「どれかのセットで挟まる等級が増える手」（新しく飛び飛びになる手を含む）と、
 * 「割り当てた先のセットが変更後も飛び飛びで、挟まる等級が減らない手」の2つ。
 * 変えない保存（今と同じ値の送り直し）と、挟まる等級が減る手は、飛び飛びが残っていても通す。
 * 使用を止める手は並びから外すだけで、挟まる等級は増えないので止めない。
 */
export function bandChangeBlockers(
  grades: readonly BandGrade[],
  change: { gradeId: string; behaviorBand?: string | null; isActive?: boolean },
): BandSplit[] {
  const target = grades.find((g) => g.id === change.gradeId);
  if (!target) return [];
  const next: BandGrade = {
    ...target,
    ...(change.behaviorBand !== undefined && { behaviorBand: change.behaviorBand }),
    ...(change.isActive !== undefined && { isActive: change.isActive }),
  };
  if (next.behaviorBand === target.behaviorBand && next.isActive === target.isActive) return [];
  const gapsBefore = new Map(bandSplits(grades).map((s) => [s.band, s.gaps.length]));
  const assigned = next.isActive ? next.behaviorBand : null;
  return bandSplits(grades.map((g) => (g.id === target.id ? next : g))).filter((s) => {
    const before = gapsBefore.get(s.band) ?? 0;
    return s.gaps.length > before || (s.band === assigned && s.gaps.length >= before);
  });
}

const names = (grades: readonly BandGrade[]) => grades.map(gradeLabel).join("・");

/** 保存を止めたときの理由（画面とサーバーで同じ文） */
export function bandSplitMessage(split: BandSplit): string {
  return `${names(split.members)}に同じ行動指針を出すと、あいだの${names(split.gaps)}だけが別になります。同じ行動指針は、等級の並びで続いた等級にだけ出せます。`;
}

/**
 * 選択肢に添える、選べない理由（短く）。
 * その選択肢を選ぶ等級（gradeId）自身が挟まる側になる手（層の途中を外す・切れ目を広げる）なら、途切れるセットの等級を出す。
 * そうでなければ断る理由は割り当てた先のセット1つだけなので、そのあいだに挟まる等級を出す。
 */
export function bandChoiceNote(blockers: readonly BandSplit[], gradeId: string): string | null {
  if (blockers.length === 0) return null;
  const cut = blockers.filter((s) => s.gaps.some((g) => g.id === gradeId));
  return cut.length > 0
    ? `${names(bandLine(cut.flatMap((s) => s.members)))}の行動指針が途切れるので選べません`
    : `${names(blockers.flatMap((s) => s.gaps))}を挟むので選べません`;
}

/** いまの分け方。並びの順に、同じ割り当てが続く等級を1まとまりにする */
export function bandRuns<T extends BandGrade>(grades: readonly T[]): { band: string | null; grades: T[] }[] {
  const runs: { band: string | null; grades: T[] }[] = [];
  for (const grade of bandLine(grades)) {
    const last = runs.at(-1);
    if (last && last.band === grade.behaviorBand) last.grades.push(grade);
    else runs.push({ band: grade.behaviorBand, grades: [grade] });
  }
  return runs;
}
