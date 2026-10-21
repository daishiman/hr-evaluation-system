import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { canSeeCriteria, type Role } from "@/lib/session";
import type { EvaluationView } from "@/lib/domain/evaluation-authority";
import { getEvaluationDetail, listEvaluations } from "@/lib/queries";
import {
  buildEvaluationReport,
  compareByPeriod,
  type EvaluationReport,
  type ReportPeerInput,
} from "@/lib/domain/report";

/**
 * 評価レポート（/reports/[id]）の読み込み（DD-024）。
 *
 * 保存した写しは持たず、開くたびに確定した評価から buildEvaluationReport で作る。
 * 誰がどの形で見てよいかは呼び出し側が canViewEvaluationOf で先に決め、ここには結果（view）だけを渡す。
 *
 * - 本人向け（self）は、役割にかかわらず一般の方として読む。マネージャーが自分のレポートを開いても、
 *   点数を削った行（listEvaluations・getEvaluationDetail の本人向けの形）からしか作らない
 * - 同じ等級の平均に使う他の人の点数は、評価者向けのときだけ読む（本人向けでは問い合わせもしない）
 * - 評価・回答・同じ等級の点数の問い合わせは会社で絞る。判断を記録した人の名前は、会社で絞って読んだ評価の行に
 *   残っている id だけを引く（loadRecorderNames は id で引くだけで、会社の条件を重ねない）
 */
export async function loadEvaluationReport(opts: {
  companyId: string;
  employeeId: string;
  view: EvaluationView;
  viewerRole: Role;
  now?: Date;
}): Promise<EvaluationReport> {
  const { companyId, employeeId, view } = opts;
  const role: Role = view === "self" ? "EMPLOYEE" : opts.viewerRole;
  const full = canSeeCriteria(role);
  const db = await getDb();

  const [evaluations, person] = await Promise.all([
    listEvaluations(companyId, role, { employeeId }),
    db
      .select({ name: s.users.name, gradeName: s.grades.name, officeName: s.offices.name })
      .from(s.companyMemberships)
      .innerJoin(s.users, eq(s.users.id, s.companyMemberships.userId))
      .leftJoin(
        s.grades,
        and(eq(s.grades.id, s.companyMemberships.gradeId), eq(s.grades.companyId, s.companyMemberships.companyId)),
      )
      .leftJoin(
        s.offices,
        and(eq(s.offices.id, s.companyMemberships.officeId), eq(s.offices.companyId, s.companyMemberships.companyId)),
      )
      .where(and(eq(s.companyMemberships.companyId, companyId), eq(s.companyMemberships.userId, employeeId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const finalized = evaluations.filter((e) => e.status === "finalized").sort(compareByPeriod);
  const latestRow = finalized.at(-1);
  const previousRow = finalized.at(-2);

  const [detail, previousItems, peers, recorderNames] = await Promise.all([
    latestRow ? getEvaluationDetail(companyId, latestRow.id, role) : null,
    previousRow
      ? db
          .select({
            itemName: s.evaluationItems.itemName,
            rank: s.evaluationItems.rank,
            points: s.evaluationItems.points,
            maxPoints: s.evaluationItems.maxPoints,
          })
          .from(s.evaluationItems)
          .where(and(eq(s.evaluationItems.companyId, companyId), eq(s.evaluationItems.evaluationId, previousRow.id)))
          .orderBy(asc(s.evaluationItems.displayOrder))
          // 本人向けでは配点と獲得点を持ち出さない（レーダー図も判定から描く）
          .then((rows) => rows.map((r) => (full ? r : { ...r, points: null, maxPoints: null })))
      : null,
    view === "reviewer" ? loadPeers(companyId) : [],
    loadRecorderNames(latestRow?.decisionRecordedBy ? [latestRow.decisionRecordedBy] : []),
  ]);

  const base = {
    employeeName: person?.name ?? "—",
    currentGradeName: person?.gradeName ?? null,
    officeName: person?.officeName ?? null,
    generatedAt: opts.now ?? new Date(),
    evaluations,
    latest: detail
      ? {
          items: detail.items,
          behaviors: detail.behaviors,
          raiseReason: detail.head.raiseReason,
          promotionBlockedReason: detail.head.promotionBlockedReason,
        }
      : null,
    previousItems,
    recorderNames,
  };
  return view === "reviewer"
    ? buildEvaluationReport({ ...base, view, peers })
    : buildEvaluationReport({ ...base, view });
}

/** 同じ会社の確定した評価の点数（同じ等級の平均と幅に使う）。評価者向けのときだけ呼ぶ */
async function loadPeers(companyId: string): Promise<ReportPeerInput[]> {
  const db = await getDb();
  const rows = await db
    .select({
      employeeId: s.evaluations.employeeId,
      cycleId: s.evaluations.cycleId,
      gradeId: s.evaluations.gradeId,
      totalScore: s.evaluations.totalScore,
      maxScore: s.evaluations.maxScore,
    })
    .from(s.evaluations)
    .where(
      and(
        eq(s.evaluations.companyId, companyId),
        eq(s.evaluations.status, "finalized"),
        isNotNull(s.evaluations.totalScore),
        isNotNull(s.evaluations.maxScore),
      ),
    );
  return rows.flatMap((r) =>
    r.totalScore === null || r.maxScore === null ? [] : [{ ...r, totalScore: r.totalScore, maxScore: r.maxScore }],
  );
}

/** 判断を記録した人の名前 */
async function loadRecorderNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const db = await getDb();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, ids));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
