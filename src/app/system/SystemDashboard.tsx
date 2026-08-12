import Link from "next/link";
import type { ReactNode } from "react";
import { StalledByCompanyNotice } from "@/components/StalledEvaluationsNotice";
import { Badge, Bar, Card, CardRow, Disclosure, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";

export interface SystemCompanySummary {
  id: string;
  name: string;
  businessType: string;
  isActive: boolean;
  users: number;
  activeUsers: number;
  companyAdmins: number;
  usersWithoutGrade: number;
  cycles: number;
  openCycles: number;
  finalizedEvaluations: number;
}

export function companySetupIssues(company: SystemCompanySummary): string[] {
  if (!company.isActive) return ["利用停止中"];
  const issues: string[] = [];
  if (company.companyAdmins === 0) issues.push("会社の管理者が未設定");
  if (company.activeUsers === 0) issues.push("利用者が未登録");
  if (company.usersWithoutGrade > 0) issues.push(`等級未設定 ${company.usersWithoutGrade}人`);
  if (company.cycles === 0) issues.push("評価期間が未設定");
  return issues;
}

function CompanyState({ company }: { company: SystemCompanySummary }) {
  const issues = companySetupIssues(company);
  if (!company.isActive) return <Badge tone="closed">利用停止中</Badge>;
  if (issues.length > 0) return <Badge tone="alert">設定を確認</Badge>;
  if (company.openCycles > 0) return <Badge tone="active">評価期間を運用中</Badge>;
  return <Badge tone="done">次の評価期間を待機中</Badge>;
}

export function SystemDashboard({
  companies,
  selectedCompanyId,
  scopeControl,
  stalledByCompany = [],
}: {
  companies: SystemCompanySummary[];
  selectedCompanyId: string | null;
  scopeControl: ReactNode;
  /** 会社ごとの「締め切った期間に残っている評価」の件数。個人名は載せない */
  stalledByCompany?: { companyId: string; companyName: string; total: number; worstDays: number | null; long: number }[];
}) {
  const selected = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const activeCompanies = companies.filter((company) => company.isActive);
  // 停止済みの会社は運用対象ではないため、「先に直す未設定」には混ぜない。
  const needsAttention = companies.filter((company) => company.isActive && companySetupIssues(company).length > 0);
  const totalActiveUsers = companies.reduce((sum, company) => sum + company.activeUsers, 0);
  const totalFinalized = companies.reduce((sum, company) => sum + company.finalizedEvaluations, 0);

  return (
    <>
      <PageTitle
        title="システム運用"
        lede="操作する会社を決め、運用を止めている未設定だけを先に確認します。"
        actions={
          <LinkButton href="/system/companies" variant="primary">
            会社を追加する
          </LinkButton>
        }
      />

      {/* 会社をまたいで見えるのはこの画面だけ。締め切った期間の置き去りは
          会社の中の誰も見ていないことがあるため、全体管理者にも件数だけ届ける。 */}
      {stalledByCompany.length > 0 && (
        <>
          <SectionHeading>締め切った期間に残っている評価</SectionHeading>
          <StalledByCompanyNotice companies={stalledByCompany} />
        </>
      )}

      <SectionHeading>操作する会社</SectionHeading>
      {companies.length === 0 ? (
        <EmptyState
          title="会社がまだ登録されていません"
          body="最初の会社と、その会社の管理者アカウントを作ってください。"
          action={
            <LinkButton href="/system/companies" variant="primary">
              会社を追加する
            </LinkButton>
          }
        />
      ) : (
        <Card className="card-pad hero-tint">
          <div className="grid gap-4 md:grid-cols-[minmax(14rem,20rem)_1fr] md:items-start">
            <div>{scopeControl}</div>
            {selected ? (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="todo-row-title m-0 text-strong">{selected.name}</p>
                  <CompanyState company={selected} />
                </div>
                {/* 事業の種類（既定は「給付事業」）は会社名と紛らわしいので、必ず見出しを付けて出す。
                    裸で並べると、選んだ会社と別の会社名が出ているように読める。 */}
                <p className="todo-row-sub m-0 mt-1">
                  事業の種類 {selected.businessType} ／ 在籍 {selected.activeUsers}人 ／ 評価期間 {selected.cycles}件
                </p>
                <div className="mt-3 max-w-xl">
                  <Bar value={selected.activeUsers} max={selected.users} label="利用中のアカウント" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkButton href={`/system/users?company=${selected.id}`}>利用者を確認する</LinkButton>
                  <LinkButton href="/admin/cycles">評価期間を確認する</LinkButton>
                  {selected.openCycles > 0 && <LinkButton href="/manager/cycles">運用状況を開く</LinkButton>}
                </div>
              </div>
            ) : (
              <p className="m-0 text-sub text-[var(--ink-muted)]">
                利用中の会社がありません。会社一覧で利用状態を確認してください。
              </p>
            )}
          </div>
        </Card>
      )}

      <SectionHeading>先に確認すること</SectionHeading>
      {needsAttention.length === 0 ? (
        <p className="footnote">運用を止めている未設定はありません。</p>
      ) : (
        <div className="card-grid">
          {needsAttention.map((company) => {
            const issues = companySetupIssues(company);
            return (
              <Card key={company.id} className="card-pad">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="todo-row-title m-0">{company.name}</p>
                  <CompanyState company={company} />
                </div>
                <p className="todo-row-sub m-0 mt-2">{issues.join(" ／ ")}</p>
                <p className="footnote card-foot m-0">
                  <Link href={`/system/users?company=${company.id}`} className="text-[var(--brand-deep)]">
                    利用者と設定状況を見る
                  </Link>
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="kpi-strip" aria-label="全社の集計">
        <div className="kpi">
          <div className="kpi-label">利用中の会社</div>
          <div className="kpi-value"><Num value={activeCompanies.length} unit="社" /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">利用中のアカウント</div>
          <div className="kpi-value"><Num value={totalActiveUsers} unit="人" /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">確定済みの評価</div>
          <div className="kpi-value"><Num value={totalFinalized} unit="件" /></div>
        </div>
      </div>

      {companies.length > 0 && (
        <div className="mt-5">
          <Disclosure summary="全社の運用状況を見る" meta={`${companies.length}社`}>
            <div className="p-0">
              {companies.map((company) => (
                <CardRow
                  key={company.id}
                  off={!company.isActive}
                  className="text-[var(--ink)]"
                  title={
                    <Link href={`/system/users?company=${company.id}`} className="text-[var(--brand-deep)]">
                      {company.name}
                    </Link>
                  }
                  sub={`在籍 ${company.activeUsers}/${company.users}人 ／ 評価期間 ${company.cycles}件 ／ 確定済み ${company.finalizedEvaluations}件`}
                  marks={<CompanyState company={company} />}
                />
              ))}
            </div>
          </Disclosure>
        </div>
      )}
    </>
  );
}
