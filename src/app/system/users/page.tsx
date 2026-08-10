import Link from "next/link";
import { requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { listCompanies, listMembers } from "@/lib/queries";
import { Badge, Card, EmptyState, PageTitle, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * 全社の利用者一覧。
 * システム全体管理者は全社を見られるが、会社を選ばないと一覧は出さない
 * （誰の情報かが分からないまま大量に並ぶのを避けるため）。
 */
export default async function SystemUsers({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireRole("SUPER_ADMIN");
  const companies = await listCompanies();
  const sp = await searchParams;
  const company = companies.find((c) => c.id === sp.company) ?? companies[0] ?? null;

  if (!company) {
    return (
      <>
        <PageTitle title="利用者一覧" />
        <EmptyState title="会社が登録されていません" body="先に会社を追加してください。" />
      </>
    );
  }

  const members = await listMembers(company.id);
  const byRole = (r: string) => members.filter((m) => m.role === r);

  return (
    <>
      <PageTitle
        title="利用者一覧"
        lede="会社ごとの利用者を確認できます。アカウントの発行・変更は各社の管理者が行います。"
      />

      <SectionHeading>会社を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {companies.map((c) => (
          <Link key={c.id} href={`/system/users?company=${c.id}`} className="chip" aria-pressed={c.id === company.id}>
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="card-pad hero-tint">
        <p className="m-0 text-[12px] text-[var(--ink-muted)]">{company.name}</p>
        <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
          {members.filter((m) => m.isActive).length}
          <span className="unit"> / {members.length} 人が在籍中</span>
        </p>
        <p className="m-0 mt-2 text-[13px]">
          会社の管理者 {byRole("COMPANY_ADMIN").length}人 ／ マネージャー {byRole("MANAGER").length}人 ／ 評価される方{" "}
          {byRole("EMPLOYEE").length}人
        </p>
      </Card>

      <SectionHeading>利用者（{members.length}人）</SectionHeading>
      {members.length === 0 ? (
        <EmptyState title="利用者がまだいません" body="この会社の管理者がアカウントを発行すると、ここに並びます。" />
      ) : (
        <Card>
          {members.map((m) => (
            <div key={m.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">{m.name}</p>
                <p className="todo-row-sub m-0">
                  {m.email} ／ {m.gradeName ?? "等級 未設定"} ／ {m.department ?? "所属 未設定"}
                </p>
              </div>
              <Badge tone={m.isActive ? "done" : "closed"}>{ROLE_LABEL[m.role as Role] ?? m.role}</Badge>
            </div>
          ))}
        </Card>
      )}
      <p className="footnote mt-3">
        個人の評価内容は、その会社の管理者・マネージャーが確認します。この画面では評価の中身は表示しません。
      </p>
    </>
  );
}
