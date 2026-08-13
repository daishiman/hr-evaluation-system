/**
 * 評価の推移を読むための整形。
 *
 * 推移のグラフは「点が並んでいる」だけでは読めない。同じ人でも在籍中に等級が変わり、
 * 等級が変われば評価の基準そのものが変わるため、等級の切れ目を示さずに数値を並べると
 * 「下がった」と誤読される。ここでは等級の区間と、期間の絞り込みだけを扱う。
 *
 * 等級の上下（昇格か降格か）はここでは判定しない。`grades.displayOrder` の向きは
 * 会社ごとの登録順であり、上位が小さいとは限らない。誤って「昇格」と出すと
 * 人事の判断を誤らせるため、変わった事実だけを示す。
 */

export interface TrendSource {
  /** 評価期間の名前。グラフの横軸の値になる */
  cycle: string;
  periodStart: string | null;
  gradeName: string | null;
}

export interface GradeBand {
  /** この等級で評価した最初の期 */
  from: string;
  /** この等級で評価した最後の期 */
  to: string;
  label: string;
  /** 隣り合う区間を見分けるための交互の印。色相は増やさず濃さだけを変える */
  alt: boolean;
  /** この区間に入っている期の数 */
  size: number;
}

export interface GradeChange {
  /** 等級が変わった最初の期 */
  at: string;
  /** グラフに書き添える等級名。狭い区間では空にする（重なって読めなくなるため） */
  label: string;
}

/* 等級名を書き添えてよい区間の狭さの下限。全体の1割を切ると、隣の等級名と
   文字が重なって団子になる（20年・40期で等級が何度も変わる人で実際に起きた）。
   線だけは残すので「ここで変わった」ことは読める。 */
const LABEL_MIN_SHARE = 0.1;

const GRADE_UNKNOWN = "等級未設定";

/** 1日のミリ秒。うるう年を平均して1年を数える（境目が1日ずれても読み方は変わらない） */
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** 期間の絞り込みで選べる年数。 */
export const RANGE_YEARS = [1, 3, 5] as const;

function startTime(p: TrendSource): number | null {
  if (!p.periodStart) return null;
  const t = new Date(p.periodStart).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * 古い順に並んだ評価を、等級ごとの区間にまとめる。
 * 同じ等級が続くかぎり1つの区間として伸ばす。
 */
export function buildGradeBands(points: TrendSource[]): GradeBand[] {
  const bands: GradeBand[] = [];
  for (const p of points) {
    const label = p.gradeName ?? GRADE_UNKNOWN;
    const last = bands.at(-1);
    if (last && last.label === label) {
      last.to = p.cycle;
      last.size += 1;
      continue;
    }
    bands.push({ from: p.cycle, to: p.cycle, label, alt: bands.length % 2 === 1, size: 1 });
  }
  return bands;
}

/** 等級が変わった期。最初の区間は「変わった」ではないので含めない。 */
export function gradeChanges(bands: GradeBand[]): GradeChange[] {
  const total = bands.reduce((n, b) => n + b.size, 0);
  return bands.slice(1).map((b) => ({
    at: b.from,
    label: b.size / total >= LABEL_MIN_SHARE ? `${b.label}へ` : "",
  }));
}

/**
 * 直近◯年に絞る。
 *
 * 評価期間の開始日が入っていない評価は落とさない。絞り込みで消すと
 * 「データが減った」と読めてしまい、期間の話ではなく欠損の話になる。
 */
export function filterByRange<T extends TrendSource>(points: T[], years: number | null, now: number): T[] {
  if (years === null) return points;
  const from = now - years * YEAR_MS;
  return points.filter((p) => {
    const t = startTime(p);
    return t === null || t >= from;
  });
}

/**
 * 出してよい絞り込みの選択肢。
 * データの幅より広い選択肢は、押しても何も変わらないので出さない。
 */
export function availableRanges(points: TrendSource[], now: number): number[] {
  const times = points.map(startTime).filter((t): t is number => t !== null);
  if (times.length === 0) return [];
  const span = now - Math.min(...times);
  return RANGE_YEARS.filter((y) => span > y * YEAR_MS);
}

/**
 * 点の数に応じた横軸の描き方。
 *
 * 月次で10年なら120点になる。全部にラベルと丸を描くと文字が重なって潰れるので、
 * ラベルは間引き、丸は消して線だけにする（押したときの反応は残す）。
 */
export function chartDensity(count: number): { tickInterval: number; showDots: boolean } {
  return { tickInterval: Math.max(0, Math.ceil(count / 8) - 1), showDots: count <= 24 };
}
