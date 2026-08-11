import { sql } from "drizzle-orm";
import { CompanyScopeSwitcher } from "@/components/CompanyScopeSwitcher";
import { SystemDashboard, type SystemCompanySummary } from "@/app/system/SystemDashboard";
import { getDb, schema as s } from "@/lib/db";
import { listCompanies } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** システム全体管理者のホーム。会社を選び、運用を止める未設定から確認する。 */
export default async function SystemHome() {
  const viewer = await requireRole("SUPER_ADMIN");
  const db = await getDb();
  const companies = await listCompanies();

  const [userStats, cycleStats, evaluationStats] = await Promise.all([
    db
      .select({
        companyId: s.users.companyId,
        users: sql<number>`COUNT(*)`,
        activeUsers: sql<number>`SUM(CASE WHEN ${s.users.isActive} THEN 1 ELSE 0 END)`,
        companyAdmins: sql<number>`SUM(CASE WHEN ${s.users.isActive} AND ${s.users.role} = 'COMPANY_ADMIN' THEN 1 ELSE 0 END)`,
        usersWithoutGrade: sql<number>`SUM(CASE WHEN ${s.users.isActive} AND ${s.users.role} IN ('MANAGER', 'EMPLOYEE') AND ${s.users.gradeId} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(s.users)
      .groupBy(s.users.companyId),
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

  return (
    <SystemDashboard
      companies={summaries}
      selectedCompanyId={viewer.companyId}
      scopeControl={<CompanyScopeSwitcher companies={switchable} currentId={viewer.companyId} />}
    />
  );
}
