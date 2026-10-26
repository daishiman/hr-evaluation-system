/**
 * 行動指針の既定の割り当て（DD-026）と、いまの割り当ての説明。
 *
 * 既定は 等級1・等級2 に1つ目、等級3・等級4-1・等級4-2 に2つ目、等級5-1・等級5-2 は出さない。
 * 照合は等級の識別子（grades.code）で行い、等級名を変えた会社も同じに扱う。
 * 7つの識別子に無い、会社が足した等級は比べない。
 *
 * 説明は行動指針の画面の開いたときの注記に出す（固定の文はやめた。DD-026 の9）。
 * 使用を止めた等級は新しいアンケートに出ないので、文にも違う等級にも入れない（bandLine・bandSetLabel と同じ扱い）。
 * 同じ割り当てが続く等級を1まとまりにし（bandRuns）、出すまとまりを並びの順に、出さない等級を最後にまとめて書く。
 * 出すまとまりが4つ以上に分かれたら、1文を分けずに分けた数で要約する（まとまりごとの中身は画面の並びで見える）。
 */

import { bandRuns } from "./behavior-band-range";
import { compareGradeOrder, gradeLabel } from "./grade-label";

/** 等級の識別子 → 既定のまとまり（behavior_band_sets.code）。null は出さない */
export const DEFAULT_BEHAVIOR_BAND: Readonly<Record<string, string | null>> = {
  beginner: "g1_2",
  regular: "g1_2",
  chief: "g3_4",
  am1: "g3_4",
  am2: "g3_4",
  manager1: null,
  manager2: null,
};

export type BandAssignmentGrade = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  behaviorBand: string | null;
};

export type BandAssignmentSet = {
  code: string;
  name: string;
  isActive: boolean;
};

/** 既定と違う等級1つ分 */
export type BandAssignmentDifference = {
  code: string;
  name: string;
  /** 既定のまとまり（null は出さない） */
  expected: string | null;
  /** いまのまとまり（null は出さない） */
  actual: string | null;
};

export type BandAssignmentSummary = {
  /** いまの割り当ての説明の1文 */
  sentence: string;
  /** 7つの識別子の等級が全て既定と同じか */
  matchesDefault: boolean;
  /** 既定と違う等級（並びの順） */
  differences: BandAssignmentDifference[];
};

/** 出すまとまりをこの数まで1つずつ書く。超えたら分けた数で要約する */
const MAX_LISTED_RUNS = 3;

const names = (grades: readonly BandAssignmentGrade[]) => grades.map(gradeLabel).join("・");

/**
 * 説明の1文で使う、まとまりの呼び名。
 * sets は保存した名前のまま（bandSetLabel を通さずに）画面の並び順で渡す。
 * 名前があれば「名前」、空なら並びの位置で「1つ目」。会社の設定に無いコードは隠さず「コード」と出す。
 * 使用を止めたまとまりには、画面の一覧と同じ「（使用しない）」を添える。
 */
export function bandAssignmentName(sets: readonly BandAssignmentSet[], band: string | null): string {
  if (band === null) return "出さない";
  const at = sets.findIndex((set) => set.code === band);
  if (at < 0) return `「${band}」`;
  const set = sets[at];
  const saved = set.name.trim();
  const name = saved ? `「${saved}」` : `${at + 1}つ目`;
  return set.isActive ? name : `${name}（使用しない）`;
}

function sentenceOf(grades: readonly BandAssignmentGrade[], sets: readonly BandAssignmentSet[]): string {
  const runs = bandRuns(grades);
  if (runs.length === 0) return "使用中の等級がありません。";
  const shown = runs.filter((run) => run.band !== null);
  if (shown.length === 0) return "どの等級にも行動指針を出しません。";
  const hidden = runs.filter((run) => run.band === null).flatMap((run) => run.grades);
  const listed =
    shown.length > MAX_LISTED_RUNS
      ? `行動指針は${shown.length}つのまとまりに分けて`
      : `${shown.map((run) => `${names(run.grades)}に${bandAssignmentName(sets, run.band)}`).join("、")}を`;
  return hidden.length === 0 ? `${listed}出します。` : `${listed}出し、${names(hidden)}には出しません。`;
}

/**
 * いまの割り当てを1文で説明し、既定と比べる。
 * grades は会社の等級を全部（使用を止めた等級も）渡してよい。sets の渡し方は bandAssignmentName を参照。
 */
export function describeBandAssignment(
  grades: readonly BandAssignmentGrade[],
  sets: readonly BandAssignmentSet[],
): BandAssignmentSummary {
  const differences = grades
    .filter((g) => g.isActive && Object.hasOwn(DEFAULT_BEHAVIOR_BAND, g.code))
    .filter((g) => g.behaviorBand !== DEFAULT_BEHAVIOR_BAND[g.code])
    .sort(compareGradeOrder)
    .map((g) => ({ code: g.code, name: gradeLabel(g), expected: DEFAULT_BEHAVIOR_BAND[g.code], actual: g.behaviorBand }));
  return { sentence: sentenceOf(grades, sets), matchesDefault: differences.length === 0, differences };
}
