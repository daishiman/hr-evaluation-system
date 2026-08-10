/**
 * 元の配点表（移行前の「KPI基準定義_配点」シート）の引き当て。
 *
 * この表は参考値であり、評価の計算には使わない。
 * 評価セットの項目を差し替えたときに「元はこの等級で何点だったか」を画面に出すためだけに使う。
 */

export const RANK_ORDER = ["A", "B", "C", "D", "E"] as const;

export interface ReferencePointRow {
  kpiItemId: string;
  pointGroup: string;
  rank: string;
  points: number;
}

export interface ReferenceEntry {
  /** Aを取ったときの点数＝その項目の配点 */
  maxPoints: number;
  /** ランクごとの点数（元の表は項目ごとに刻みが違うため、比率では復元できない） */
  byRank: { rank: string; points: number }[];
}

/** 引き当て用の索引。キーは「項目ID + 等級区分」。 */
export function indexReferencePoints(rows: ReferencePointRow[]): Map<string, ReferenceEntry> {
  const buckets = new Map<string, { rank: string; points: number }[]>();
  for (const r of rows) {
    const key = referenceKey(r.kpiItemId, r.pointGroup);
    const list = buckets.get(key) ?? [];
    list.push({ rank: r.rank, points: r.points });
    buckets.set(key, list);
  }

  const index = new Map<string, ReferenceEntry>();
  for (const [key, list] of buckets) {
    const byRank = [...list].sort(
      (a, b) => rankIndex(a.rank) - rankIndex(b.rank),
    );
    const a = byRank.find((x) => x.rank === "A");
    // Aの行が無い項目は「配点がいくつだったか」を言えないので参考値として出さない
    if (!a) continue;
    index.set(key, { maxPoints: a.points, byRank });
  }
  return index;
}

export function referenceKey(kpiItemId: string, pointGroup: string): string {
  return `${kpiItemId}::${pointGroup}`;
}

/** その等級区分で対象外だった項目は null（元の表に行が無い）。 */
export function referenceFor(
  index: Map<string, ReferenceEntry>,
  kpiItemId: string,
  pointGroup: string,
): ReferenceEntry | null {
  return index.get(referenceKey(kpiItemId, pointGroup)) ?? null;
}

function rankIndex(rank: string): number {
  const i = (RANK_ORDER as readonly string[]).indexOf(rank);
  return i < 0 ? RANK_ORDER.length : i;
}

/** 「A20 ／ B15 ／ C8 ／ D5 ／ E0」の形に整える（画面の補足表示用）。 */
export function formatByRank(entry: ReferenceEntry): string {
  return entry.byRank.map((r) => `${r.rank}${trimNumber(r.points)}`).join(" ／ ");
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}
