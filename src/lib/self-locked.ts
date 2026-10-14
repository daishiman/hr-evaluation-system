import { and, eq, ne } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { selectSelfLocked, type SelfLockedRow } from "@/lib/domain/self-locked-evaluations";
import { joinMembership } from "@/lib/memberships";

/** 会社ごとの値（役割・上長）の正本。users の同じ列は読まない（src/lib/memberships.ts） */
const mem = s.companyMemberships;

/**
 * 「頼める上長がいないまま確定できていない評価」をDBから読む。
 *
 * 判定そのものは持たない（`src/lib/domain/self-locked-evaluations.ts` の純関数に任せる）。
 * ここは読む範囲を決めるだけで、**会社の絞り込みは必ずここで行う**。
 * 進行中・締め切り済みを問わず、確定していない分をすべて対象にする
 * （`src/lib/stalled.ts` と違い、締め切りを待つ理由が無いため）。
 *
 * 読むだけで、確定も削除も再集計も一切しない。
 *
 * 役割と上長は、評価の会社での所属の値で見る（会社ごとに役割も上長も違う）。
 * その会社の所属が無い人（所属を外れた人）は、その会社で確定を受け持つ役割に無いので対象にならない。
 * 純関数（selectSelfLocked）でも役割で外れる行なので、inner join で読む前に外しておく。
 */
export async function listSelfLockedEvaluations(companyId: string): Promise<SelfLockedRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      evaluationId: s.evaluations.id,
      cycleId: s.evaluations.cycleId,
      cycleName: s.evaluationCycles.name,
      employeeId: s.evaluations.employeeId,
      employeeName: s.users.name,
      gradeName: s.grades.name,
      employeeRole: mem.role,
      managerId: mem.managerId,
    })
    .from(s.evaluations)
    .innerJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .innerJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .innerJoin(mem, joinMembership(s.evaluations.companyId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .where(and(eq(s.evaluations.companyId, companyId), ne(s.evaluations.status, "finalized")));

  return selectSelfLocked(rows);
}
