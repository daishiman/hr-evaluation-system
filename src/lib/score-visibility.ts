import { and, eq, sql } from "drizzle-orm";
import { schema as s, type DB } from "@/lib/db";
import { gradeLabel } from "@/lib/domain/grade-label";
import { can, roleCanOpen } from "@/lib/route-access";
import type { Viewer } from "@/lib/session";

/**
 * 一覧の等級と点数（S6・A5）。
 *
 * 利用者一覧・社員の一覧・担当チームのメンバー一覧に、今の等級名と、確定した最新の評価の点数を並べる。
 * - 点数は確定済み（finalized）の評価だけから読み、評価期間の開始日が最も新しい1件を使う。写しの列は作らない。
 * - 一覧の全員分を1回の問い合わせで取る（人ごとに最新の1件へ SQL の中で絞る）。
 * - 見せてよいかは台帳の操作 members.viewGradeScore（MANAGER 以上）で決め、見せない役割には
 *   等級と点数のキーそのものを返さない（画面で隠すのではなく、サーバーで落とす）。
 */

export interface LatestScore {
  /** KPI評価点の合計 */
  totalScore: number;
  maxScore: number;
  /** 等級要件の達成率（%）。集計していなければ null */
  requirementRate: number | null;
  /** どの評価期間の値か */
  cycleName: string;
}

type ScoreViewer = Pick<Viewer, "role" | "companyId">;

/** 見せない役割の行から落とすキー。一覧の問い合わせが持つ等級・点数の列をまとめて落とす */
const GRADE_SCORE_KEYS = [
  "gradeId",
  "gradeName",
  "gradeOrder",
  "latestScore",
  "totalScore",
  "maxScore",
  "requirementRate",
] as const;

const ev = s.evaluations;
const cy = s.evaluationCycles;

/**
 * 会社と人の組ごとに、確定済みの評価のうち評価期間の開始日が最も新しい1件。
 * companyId が null なら全ての会社（全体管理者の利用者一覧）。
 * 開始日が同じ評価期間が並んだときは、終わりの遅いほう、さらに評価の id の大きいほうを取る（毎回同じ結果にする）。
 */
async function latestFinalizedRows(db: DB, companyId: string | null) {
  const ranked = db
    .select({
      companyId: ev.companyId,
      employeeId: ev.employeeId,
      totalScore: ev.totalScore,
      maxScore: ev.maxScore,
      requirementRate: ev.requirementRate,
      cycleName: sql<string>`${cy.name}`.as("cycle_name"),
      rank: sql<number>`row_number() over (
        partition by ${ev.companyId}, ${ev.employeeId}
        order by ${cy.periodStart} desc, ${cy.periodEnd} desc, ${ev.id} desc
      )`.as("rank"),
    })
    .from(ev)
    // 評価期間は評価と同じ会社のものだけを結合する
    .innerJoin(cy, and(eq(cy.id, ev.cycleId), eq(cy.companyId, ev.companyId)))
    .where(and(eq(ev.status, "finalized"), companyId === null ? undefined : eq(ev.companyId, companyId)))
    .as("ranked");
  return db.select().from(ranked).where(eq(ranked.rank, 1));
}

function toScore(row: Awaited<ReturnType<typeof latestFinalizedRows>>[number]): LatestScore {
  return {
    totalScore: row.totalScore,
    maxScore: row.maxScore,
    requirementRate: row.requirementRate,
    cycleName: row.cycleName,
  };
}

/** その人が一覧で等級と点数を見てよいか（台帳の members.viewGradeScore） */
export function canViewGradeScore(viewer: Pick<Viewer, "role">): boolean {
  // 操作 id は字面で書く（権限の契約の試験が、台帳の操作がコードから引かれていることを字面で確かめる）
  return can(viewer, "members.viewGradeScore");
}

/**
 * 見ている人の会社で、対象の人ごとの確定した最新の点数。確定済みの評価が無い人は含めない。
 * 会社は引数で受けず viewer.companyId に限る（別の会社の評価を読む口を作らない）。
 */
export async function latestFinalizedScores(
  db: DB,
  viewer: ScoreViewer,
  employeeIds: readonly string[],
): Promise<Map<string, LatestScore>> {
  const out = new Map<string, LatestScore>();
  if (employeeIds.length === 0 || !viewer.companyId || !canViewGradeScore(viewer)) return out;
  // 対象の id を条件に並べると D1 の変数の上限に当たるので、会社で絞って手元で選ぶ（1人あたり1行しか返らない）
  const wanted = new Set(employeeIds);
  for (const row of await latestFinalizedRows(db, viewer.companyId)) {
    if (wanted.has(row.employeeId)) out.set(row.employeeId, toScore(row));
  }
  return out;
}

/** 全ての会社の所属ごとの点数を引くときの鍵。所属は会社と人の組で1つ */
export function membershipScoreKey(companyId: string, userId: string): string {
  return `${companyId}:${userId}`;
}

/**
 * 全ての会社の、所属ごとの確定した最新の点数（全体管理者の利用者一覧）。鍵は membershipScoreKey。
 * 会社をまたいで読むので、利用者一覧（/system/users）を開ける役割に限る。
 */
export async function latestFinalizedScoresEveryCompany(db: DB, viewer: ScoreViewer): Promise<Map<string, LatestScore>> {
  const out = new Map<string, LatestScore>();
  if (!canViewGradeScore(viewer) || !roleCanOpen(viewer.role, "/system/users")) return out;
  for (const row of await latestFinalizedRows(db, null)) {
    out.set(membershipScoreKey(row.companyId, row.employeeId), toScore(row));
  }
  return out;
}

export type WithGradeAndScore<R> = Omit<R, (typeof GRADE_SCORE_KEYS)[number]> & {
  /** 見てよい役割にだけ付く。等級が無ければ「等級未設定」 */
  gradeName?: string;
  /** 見てよい役割にだけ付く。等級の並び（小さいほど下の等級）。等級が無ければ null */
  gradeOrder?: number | null;
  /** 見てよい役割にだけ付く。確定した評価が無ければ null */
  latestScore?: LatestScore | null;
};

/**
 * 一覧の行に等級名と最新の点数を付ける。見てよくない役割には、等級と点数のキー（等級の id も）を落として返す。
 * 等級名は見ている人の会社の等級から引く（所属の等級は会社ごと）。
 */
export async function withGradeAndScore<R extends { id: string; gradeId?: string | null }>(
  db: DB,
  viewer: ScoreViewer,
  rows: readonly R[],
): Promise<WithGradeAndScore<R>[]> {
  const stripped = rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const key of GRADE_SCORE_KEYS) delete copy[key];
    return copy as WithGradeAndScore<R>;
  });
  if (!canViewGradeScore(viewer) || !viewer.companyId || rows.length === 0) return stripped;

  const [grades, scores] = await Promise.all([
    db
      .select({ id: s.grades.id, name: s.grades.name, displayOrder: s.grades.displayOrder })
      .from(s.grades)
      .where(eq(s.grades.companyId, viewer.companyId)),
    latestFinalizedScores(
      db,
      viewer,
      rows.map((r) => r.id),
    ),
  ]);
  const gradeById = new Map(grades.map((g) => [g.id, g]));
  return stripped.map((row, i) => {
    const grade = rows[i].gradeId ? gradeById.get(rows[i].gradeId) : undefined;
    return {
      ...row,
      gradeName: gradeLabel(grade ?? null),
      gradeOrder: grade?.displayOrder ?? null,
      latestScore: scores.get(rows[i].id) ?? null,
    };
  });
}
