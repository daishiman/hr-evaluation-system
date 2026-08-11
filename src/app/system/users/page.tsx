import Link from "next/link";
import { requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { listAllUsers, listCompanies } from "@/lib/queries";
import { Card, Disclosure, EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecordForm } from "@/components/RecordForm";

export const dynamic = "force-dynamic";

/**
 * 全社の利用者一覧。
 *
 * 「誰が・どの立場で・どの会社にいるか」だけを一覧に出し、
 * 中身（等級・上長・パスワード）はその人のページに置く。
 * 会社に属さないシステム全体管理者もここに出す（一覧から漏れると誰も直せなくなる）。
 */
export default async function SystemUsers({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireRole("SUPER_ADMIN");
  const [companies, all] = await Promise.all([listCompanies(), listAllUsers()]);
  const sp = await searchParams;

  const superAdmins = all.filter((u) => u.role === "SUPER_ADMIN");
  const scope = sp.company ?? "";
  const scoped =
    scope === "" ? all : scope === "none" ? all.filter((u) => !u.companyId) : all.filter((u) => u.companyId === scope);

  const byRole = (r: string) => scoped.filter((u) => u.role === r);
  const countLabel = (r: Role) => `${ROLE_LABEL[r]} ${byRole(r).length}`;

  return (
    <>
      <PageTitle title="利用者一覧" lede="全社の利用者をここで確認・変更できます。" />

      {/* 全体像は数字だけ。誰が何人いるかを一行で掴ませる */}
      <Card className="card-pad hero-tint">
        <p className="num-display m-0 text-hero-sp leading-tight text-[var(--accent)]">
          {scoped.filter((u) => u.isActive).length}
          <span className="unit"> / {scoped.length} 人が利用中</span>
        </p>
        <p className="m-0 mt-2 text-sub text-[var(--ink-muted)]">
          {countLabel("SUPER_ADMIN")}人 ／ {countLabel("COMPANY_ADMIN")}人 ／ {countLabel("MANAGER")}人 ／{" "}
          {countLabel("EMPLOYEE")}人
        </p>
      </Card>

      <SectionHeading>会社でしぼる</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/system/users" className="chip" aria-current={scope === "" ? "true" : undefined}>
          すべて（{all.length}）
        </Link>
        {companies.map((c) => (
          <Link key={c.id} href={`/system/users?company=${c.id}`} className="chip" aria-current={scope === c.id ? "true" : undefined}>
            {c.name}（{all.filter((u) => u.companyId === c.id).length}）
          </Link>
        ))}
        <Link href="/system/users?company=none" className="chip" aria-current={scope === "none" ? "true" : undefined}>
          会社に属さない（{all.filter((u) => !u.companyId).length}）
        </Link>
      </div>

      <SectionHeading aside={<span className="footnote">名前を押すと変更できます</span>}>
        利用者（{scoped.length}人）
      </SectionHeading>
      {scoped.length === 0 ? (
        <EmptyState title="この条件の利用者はいません" body="別の会社を選ぶか、下から追加してください。" />
      ) : (
        <Card>
          {scoped.map((u) => (
            <Link key={u.id} href={`/system/users/${u.id}`} className="user-row no-underline">
              <Avatar name={u.name} seed={u.id} size={36} />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-body font-semibold text-[var(--ink)]">
                  {u.name}
                  {!u.isActive && <span className="ml-2 badge badge-closed">利用停止</span>}
                </p>
                <p className="m-0 truncate text-note text-[var(--ink-muted)]">{u.email}</p>
              </div>
              <span className="user-row-tags">
                <span className="tag">
                  <Icon name="shield" size={13} />
                  {ROLE_LABEL[u.role as Role] ?? u.role}
                </span>
                <span className="tag">
                  <Icon name="building" size={13} />
                  {u.companyName ?? "所属なし"}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      )}

      <SectionHeading>利用者を追加する</SectionHeading>
      <Disclosure
        summary="新しい利用者を作る"
        meta="システム全体管理者もここから作れます"
        defaultOpen={superAdmins.filter((u) => u.isActive).length <= 1}
      >
        <RecordForm
          url="/api/system/users"
          method="POST"
          submitLabel="この内容でアカウントを作る"
          description="発行後、メールアドレスと仮パスワードをご本人にお伝えください。最初のログイン後に変更をお願いする表示が出ます。"
          resetAfterSubmit
          fields={[
            { name: "name", label: "氏名", type: "text", required: true },
            { name: "email", label: "メールアドレス（ログインID）", type: "email", required: true },
            {
              name: "password",
              label: "仮パスワード",
              type: "password",
              required: true,
              generate: true,
              help: "この場で作った値を出しています。写して本人に渡してください。",
            },
            {
              name: "role",
              label: "役割",
              type: "select",
              required: true,
              defaultValue: "COMPANY_ADMIN",
              options: (["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as Role[]).map((r) => ({
                value: r,
                label: ROLE_LABEL[r],
              })),
            },
            {
              name: "companyId",
              label: "所属会社",
              type: "select",
              help: "システム全体管理者だけは、会社を選ばなくても作れます。",
              options: companies.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })),
            },
          ]}
        />
      </Disclosure>

      <p className="footnote mt-3">
        個人の評価内容は、その会社の管理者・マネージャーが確認します。この画面では評価の中身は表示しません。
      </p>
    </>
  );
}
