/**
 * 等級の呼び名（S1・A1・A2）。
 *
 * 画面・CSV の書き出し・アンケートの自動作成に出す等級の呼び名は、会社の等級名から表示のたびに作る。
 * 区分（pointGroup）の英語名やカタカナの呼び名は、どの関数からも出さない。区分の値は照合の鍵としてだけ使う。
 */

/** 等級の code ごとの既定の名前。seed・会社の作成・移行（0034）が同じ値を使う */
export const DEFAULT_GRADE_NAMES = {
  beginner: "等級1",
  regular: "等級2",
  chief: "等級3",
  am1: "等級4-1",
  am2: "等級4-2",
  manager1: "等級5-1",
  manager2: "等級5-2",
} as const;

export const GRADE_UNSET_LABEL = "等級未設定";
export const ALL_GRADES_LABEL = "全等級";

type Named = { name: string | null } | null | undefined;

/** 呼び名を作るのに使う等級の形（DB の行の一部） */
export type GradeLike = {
  name: string;
  pointGroup: string;
  displayOrder: number;
  behaviorBand?: string | null;
};

/** 等級名。等級が無い・名前が空なら「等級未設定」に1つにまとめる */
export function gradeLabel(grade: Named): string {
  const name = grade?.name?.trim();
  return name ? name : GRADE_UNSET_LABEL;
}

function byOrder<T extends { displayOrder: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
}

function joinNames(grades: readonly GradeLike[]): string {
  return grades.length === 0 ? GRADE_UNSET_LABEL : byOrder(grades).map(gradeLabel).join("・");
}

/** 区分の呼び名。その区分の等級を表示の順に「・」でつなぐ（例「等級4-1・等級4-2」） */
export function pointGroupLabel(pointGroup: string, grades: readonly GradeLike[]): string {
  return joinNames(grades.filter((g) => g.pointGroup === pointGroup));
}

/** 行動指針の基準セットの呼び名。割り当てた等級があれば「等級1・等級2向け」 */
export function bandSetLabel(
  set: { code: string; name: string | null; displayOrder: number },
  grades: readonly GradeLike[],
): string {
  const assigned = grades.filter((g) => g.behaviorBand === set.code);
  if (assigned.length > 0) return `${joinNames(assigned)}向け`;
  const saved = set.name?.trim();
  return saved ? saved : `基準セット${set.displayOrder}`;
}

/** 昇格の段階の呼び名（「等級1→等級2」） */
export function promotionStepLabel(from: Named, to: Named): string {
  return `${gradeLabel(from)}→${gradeLabel(to)}`;
}

type StepGrade = { id: string; name: string | null; displayOrder: number };

/**
 * その等級から上がる昇格の段階の呼び名。上がる先が無い（最上位・等級が見つからない）なら null。
 *
 * 上がる先は、点数の線引き（from→to）があればその行き先、無ければ表示の順で1つ上の等級。
 * 保存してある段階の文字列（線引きの label・昇格要件の transition_label）は等級名を変えても
 * 追従しないので、画面にはこちらだけを出す。
 */
export function promotionStepFrom(
  gradeId: string,
  grades: readonly StepGrade[],
  thresholds: readonly { fromGradeId: string; toGradeId: string }[] = [],
): string | null {
  const from = grades.find((g) => g.id === gradeId);
  if (!from) return null;
  const th = thresholds.find((t) => t.fromGradeId === gradeId);
  const to =
    (th && grades.find((g) => g.id === th.toGradeId)) ??
    byOrder(grades).find((g) => g.displayOrder > from.displayOrder);
  return to ? promotionStepLabel(from, to) : null;
}

/**
 * 対象の等級（「Chief／AM」のような区分の並び）の呼び名。照合は生の値で行い、表示だけを等級名にする。
 * 区分の名前・等級名のどちらで書かれていても受け付ける。空・「全等級」は「全等級」。
 */
export function targetGradesLabel(targetGrades: string | null | undefined, grades: readonly GradeLike[]): string {
  const raw = targetGrades?.trim() ?? "";
  if (raw === "" || raw === ALL_GRADES_LABEL) return ALL_GRADES_LABEL;
  const tokens = raw
    .split(/[／/、,・\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const hit = byOrder(grades).filter((g) =>
    tokens.some((t) => g.pointGroup.toLowerCase() === t || g.name.trim().toLowerCase() === t),
  );
  return hit.length === 0 ? raw : hit.map(gradeLabel).join("・");
}

/** アンケートの題名。空（既定の題名）なら「{評価期間} {等級名} 実績アンケート」 */
export function formDisplayTitle(form: { title: string | null }, cycle: Named, grade: Named): string {
  const title = form.title?.trim();
  if (title) return title;
  return `${cycle?.name?.trim() ?? ""} ${gradeLabel(grade)} 実績アンケート`.trim();
}

/** 一覧・詳細の行（題名と、結合した評価期間名・等級名を持つ行）からアンケートの題名を作る */
export function formRowTitle(row: { title: string | null; cycleName?: string | null; gradeName?: string | null }): string {
  return formDisplayTitle(row, { name: row.cycleName ?? null }, { name: row.gradeName ?? null });
}
