/**
 * 行動指針の基準セットは、等級の並びで続いた範囲にだけ出す（spec.md §7-6・DD-010）。
 *
 * 基準セットは「その層の人に問う行動」なので、層は等級の並びで切れ目なく続く。
 * 初期は 等級1・等級2 に1つ目、等級3・等級4-1・等級4-2 に2つ目、等級5-1・等級5-2 は出さない。
 * 等級2 を挟んで 等級1 と 等級3 に同じセットを出すような、飛び飛びの割り当ては保存させない。
 *
 * 使用を止めた等級は新しいアンケートに出ないので、並びから外して判定する。
 * 「出さない」（null）はセットではないので、飛び飛びでもよい。
 */

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

/** 判定に使う並び。使用中の等級だけを、表示の順に */
export function bandLine<T extends BandGrade>(grades: readonly T[]): T[] {
  return grades.filter((g) => g.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
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
 * 1つの等級の割り当て（と使用中かどうか）を変えたとき、新しく飛び飛びになるセット。
 *
 * 保存を止めるのは「前は続いていたのに飛び飛びになるセット」と「割り当てた先のセットが飛び飛びのまま」の2つ。
 * すでに飛び飛びになっている会社（本番で手で動かした等）でも、直す向きの1手は通す。
 */
export function bandChangeBlockers(
  grades: readonly BandGrade[],
  change: { gradeId: string; behaviorBand?: string | null; isActive?: boolean },
): BandSplit[] {
  const after = grades.map((g) =>
    g.id === change.gradeId
      ? {
          ...g,
          ...(change.behaviorBand !== undefined && { behaviorBand: change.behaviorBand }),
          ...(change.isActive !== undefined && { isActive: change.isActive }),
        }
      : g,
  );
  const before = new Set(bandSplits(grades).map((s) => s.band));
  const target = after.find((g) => g.id === change.gradeId);
  const assigned = target?.isActive ? target.behaviorBand : null;
  return bandSplits(after).filter((s) => !before.has(s.band) || s.band === assigned);
}

const names = (grades: readonly BandGrade[]) => grades.map((g) => g.name).join("・");

/** 保存を止めたときの理由（画面とサーバーで同じ文） */
export function bandSplitMessage(split: BandSplit): string {
  return `${names(split.members)}に同じ行動指針を出すと、あいだの${names(split.gaps)}だけが別になります。同じ行動指針は、等級の並びで続いた等級にだけ出せます。`;
}

/** 選択肢に添える、選べない理由（短く） */
export function bandChoiceNote(blockers: readonly BandSplit[]): string | null {
  const gaps = blockers.flatMap((s) => s.gaps);
  return gaps.length === 0 ? null : `${names(gaps)}を挟むので選べません`;
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
