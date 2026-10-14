import { and, eq, sql } from "drizzle-orm";
import { CompanyScopeSwitcher } from "@/components/CompanyScopeSwitcher";
import { SystemDashboard, type SystemCompanySummary } from "@/app/system/SystemDashboard";
import { getDb, schema as s } from "@/lib/db";
import { groupStalledByCompany } from "@/lib/domain/stalled-evaluations";
import { joinEveryMembership } from "@/lib/memberships";
import { listCompanies } from "@/lib/queries";
import { requireRoute } from "@/lib/session";
import { listStalledAcrossCompanies } from "@/lib/stalled";
import { readThemePreferenceUsage } from "@/lib/theme-preferences";

export const dynamic = "force-dynamic";

/** 会社ごとの値（役割・等級）の正本。users の同じ列は読まない（src/lib/memberships.ts） */
const mem = s.companyMemberships;

/** システム全体管理者のホーム。会社を選び、運用を止める未設定から確認する。 */
export default async function SystemHome() {
  const viewer = await requireRoute("/system");
  const db = await getDb();
  const companies = await listCompanies();

  const [userStats, cycleStats, evaluationStats, themeUsage, activeUserTotal] = await Promise.all([
    // 会社ごとの人数は所属で数える。2社に所属する人は両方の会社に1人ずつ入る。
    // 所属は（人, 会社）で1つだけなので、会社ごとの行の数がそのまま人数になる。
    // 全体管理者は所属を持たないので、どの会社にも入らない（以前も会社に属さず数えていなかった）。
    // 役割・等級は所属の値を読み、利用中かは利用者全体の値（users）を読む。
    db
      .select({
        companyId: mem.companyId,
        users: sql<number>`COUNT(*)`,
        activeUsers: sql<number>`SUM(CASE WHEN ${s.users.isActive} THEN 1 ELSE 0 END)`,
        companyAdmins: sql<number>`SUM(CASE WHEN ${s.users.isActive} AND ${mem.role} = 'COMPANY_ADMIN' THEN 1 ELSE 0 END)`,
        usersWithoutGrade: sql<number>`SUM(CASE WHEN ${s.users.isActive} AND ${mem.role} IN ('MANAGER', 'EMPLOYEE') AND ${mem.gradeId} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(s.users)
      .innerJoin(mem, joinEveryMembership())
      .groupBy(mem.companyId),
    db
      .select({
        companyId: s.evaluationCycles.companyId,
        cycles: sql<number>`COUNT(*)`,
        openCycles: sql<number>`SUM(CASE WHEN ${s.evaluationCycles.status} = 'open' THEN 1 ELSE 0 END)`,
      })
      .from(s.evaluationCycles)
      .groupBy(s.evaluationCycles.companyId),
    db
      .select({
        companyId: s.evaluations.companyId,
        finalizedEvaluations: sql<number>`SUM(CASE WHEN ${s.evaluations.status} = 'finalized' THEN 1 ELSE 0 END)`,
      })
      .from(s.evaluations)
      .groupBy(s.evaluations.companyId),
    readThemePreferenceUsage(db),
    // 全体の「利用中のアカウント」は人で数える（会社ごとの人数を足すと、2社に所属する人が2回入る）。
    // 会社ごとの集計と同じく、ひな形の会社の所属は数えない。
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${s.users.id})` })
      .from(s.users)
      .innerJoin(mem, joinEveryMembership())
      .innerJoin(s.companies, and(eq(s.companies.id, mem.companyId), eq(s.companies.isTemplate, false)))
      .where(eq(s.users.isActive, true)),
  ]);

  const summaries: SystemCompanySummary[] = companies.map((company) => {
    const users = userStats.find((row) => row.companyId === company.id);
    const cycles = cycleStats.find((row) => row.companyId === company.id);
    const evaluations = evaluationStats.find((row) => row.companyId === company.id);
    return {
      id: company.id,
      name: company.name,
      businessType: company.businessType,
      isActive: company.isActive,
      users: Number(users?.users ?? 0),
      activeUsers: Number(users?.activeUsers ?? 0),
      companyAdmins: Number(users?.companyAdmins ?? 0),
      usersWithoutGrade: Number(users?.usersWithoutGrade ?? 0),
      cycles: Number(cycles?.cycles ?? 0),
      openCycles: Number(cycles?.openCycles ?? 0),
      finalizedEvaluations: Number(evaluations?.finalizedEvaluations ?? 0),
    };
  });

  const switchable = companies.filter((company) => company.isActive).map((company) => ({ id: company.id, name: company.name }));

  // 締め切った期間に残っている評価を、会社をまたいで数える。
  // ここは SUPER_ADMIN しか通らない画面（requireRoute で確かめ済み）。
  const stalledRows = await listStalledAcrossCompanies();
  const stalledByCompany = groupStalledByCompany(stalledRows).map((group) => ({
    companyId: group.companyId,
    companyName: group.companyName,
    total: group.summary.total,
    worstDays: group.summary.worstDays,
    long: group.summary.long,
  }));

  return (
    <SystemDashboard
      companies={summaries}
      selectedCompanyId={viewer.companyId}
      scopeControl={<CompanyScopeSwitcher companies={switchable} currentId={viewer.companyId} />}
      stalledByCompany={stalledByCompany}
      themeUsage={themeUsage}
      totalActiveUsers={Number(activeUserTotal[0]?.n ?? 0)}
    />
  );
}
