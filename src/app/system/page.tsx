import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { listCompanies } from "@/lib/queries";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/** システム全体管理者のホーム。全社の状況を1枚で見る。 */
export default async function SystemHome() {
  await requireRole("SUPER_ADMIN");
  const db = await getDb();

  const companies = await listCompanies();
  const stats = await db
    .select({
      companyId: s.users.companyId,
      users: sql<number>`COUNT(*)`,
      actives: sql<number>`SUM(CASE WHEN ${s.users.isActive} THEN 1 ELSE 0 END)`,
    })
    .from(s.users)
    .groupBy(s.users.companyId);
  const cycleStats = await db
    .select({ companyId: s.evaluationCycles.companyId, cycles: sql<number>`COUNT(*)` })
    .from(s.evaluationCycles)
    .groupBy(s.evaluationCycles.companyId);
  const evalStats = await db
    .select({ companyId: s.evaluations.companyId, evals: sql<number>`COUNT(*)` })
    .from(s.evaluations)
    .where(eq(s.evaluations.status, "finalized"))
    .groupBy(s.evaluations.companyId);

  const totalUsers = stats.reduce((sum, x) => sum + Number(x.users), 0);
  const totalEvals = evalStats.reduce((sum, x) => sum + Number(x.evals), 0);

  return (
    <>
      <PageTitle
        title="システム全体の状況"
        lede="登録されている会社と利用状況を確認できます。会社ごとの制度の設定は、各社の管理者が行います。"
        actions={<LinkButton href="/system/companies" variant="primary">会社を追加する</LinkButton>}
      />

      <div className="card-grid card-grid-3">
        <Card className="card-pad hero-tint">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">登録されている会社</p>
          <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
            {companies.length}
            <span className="unit"> 社</span>
          </p>
        </Card>
        <Card className="card-pad">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">利用者の合計</p>
          <p className="m-0">
            <Num value={totalUsers} display unit="人" />
          </p>
        </Card>
        <Card className="card-pad">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">確定済みの評価</p>
          <p className="m-0">
            <Num value={totalEvals} display unit="件" />
          </p>
        </Card>
      </div>

      <SectionHeading>会社ごとの状況</SectionHeading>
      {companies.length === 0 ? (
        <EmptyState
          title="会社がまだ登録されていません"
          body="最初の会社と、その会社の管理者アカウントを作ってください。"
          action={<LinkButton href="/system/companies" variant="primary">会社を追加する</LinkButton>}
        />
      ) : (
        <Card>
          {companies.map((c) => {
            const st = stats.find((x) => x.companyId === c.id);
            return (
              <div key={c.id} className="card-row">
                <div className="row-main">
                  <p className="todo-row-title m-0">
                    <Link href={`/system/users?company=${c.id}`} className="text-[var(--brand-deep)]">
                      {c.name}
                    </Link>
                  </p>
                  <p className="todo-row-sub m-0">
                    {c.businessType} ／ 利用者 {Number(st?.users ?? 0)}人（在籍 {Number(st?.actives ?? 0)}人） ／ 評価期間{" "}
                    {Number(cycleStats.find((x) => x.companyId === c.id)?.cycles ?? 0)}件 ／ 確定済みの評価{" "}
                    {Number(evalStats.find((x) => x.companyId === c.id)?.evals ?? 0)}件
                  </p>
                </div>
                {c.isActive ? <Badge tone="active">利用中</Badge> : <Badge tone="closed">停止中</Badge>}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
