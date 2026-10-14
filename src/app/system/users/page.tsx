import Link from "next/link";
import { Fragment } from "react";
import { ROLE_LABEL, type Role, requireRoute } from "@/lib/session";
import { listAllUsers, listCompanies } from "@/lib/queries";
import { Card, ChipLink, Disclosure, EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecordForm } from "@/components/RecordForm";
import { RoleCapabilities } from "@/components/permissions/RoleCapabilities";
import { CredentialMemoButton } from "@/components/CredentialMemoButton";
import { createSystemUser } from "@/actions/system-users";
import { listMemoHolderIds } from "@/lib/credential-vault";
import { getDb } from "@/lib/db";
import { GRADE_UNSET_LABEL } from "@/lib/domain/grade-label";
import { canViewGradeScore, latestFinalizedScoresEveryCompany, membershipScoreKey } from "@/lib/score-visibility";
import { LatestScoreValue } from "@/components/LatestScore";

export const dynamic = "force-dynamic";

/**
 * 全社の利用者一覧。
 *
 * 「誰が・どの立場で・どの会社にいるか」と、その会社での等級・確定した最新の点数（S6）を一覧に出し、
 * 中身（上長・パスワード・評価の中身）はその人のページに置く。
 * 会社に属さないシステム全体管理者もここに出す（一覧から漏れると誰も直せなくなる）。
 *
 * 行は所属ごと（2社に所属する人は2行。行ごとにその会社での役割を出す）。
 * 人数は行の数ではなく人で数える。
 */
export default async function SystemUsers({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const viewer = await requireRoute("/system/users");
  const db = await getDb();
  const [companies, all, memoHolders, scores] = await Promise.all([
    listCompanies(),
    listAllUsers(),
    listMemoHolderIds(db, null),
    // 所属（会社と人の組）ごとの確定した最新の点数。全社ぶんを1回で取る
    latestFinalizedScoresEveryCompany(db, viewer),
  ]);
  const showGradeScore = canViewGradeScore(viewer);
  // 初期パスワードの控えがある人（中身は押したときにだけ開く）
  const hasMemo = new Set(memoHolders);
  const sp = await searchParams;

  const superAdmins = all.filter((u) => u.role === "SUPER_ADMIN");
  const scope = sp.company ?? "";
  const scoped =
    scope === "" ? all : scope === "none" ? all.filter((u) => !u.companyId) : all.filter((u) => u.companyId === scope);

  /** 行（所属）ではなく人で数える */
  const people = (rows: typeof all) => new Set(rows.map((u) => u.id)).size;
  const byRole = (r: string) => scoped.filter((u) => u.role === r);
  const countLabel = (r: Role) => `${ROLE_LABEL[r]} ${people(byRole(r))}`;
  // 控えのボタンは、その人の最初の行にだけ出す（同じ人の2行目に重ねない）
  const firstRowOf = new Map<string, string>();
  for (const u of scoped) if (!firstRowOf.has(u.id)) firstRowOf.set(u.id, u.membershipId ?? u.id);

  return (
    <>
      <PageTitle title="利用者一覧" lede="全社の利用者をここで確認・変更できます。" />

      {/* 全体像は数字だけ。誰が何人いるかを一行で掴ませる */}
      <Card className="card-pad hero-tint">
        <p className="num-display m-0 text-hero-sp leading-tight text-accent">
          {people(scoped.filter((u) => u.isActive))}
          <span className="unit"> / {people(scoped)} 人が利用中</span>
        </p>
        <p className="m-0 mt-2 text-sub text-ink-muted">
          {countLabel("SUPER_ADMIN")}人 ／ {countLabel("COMPANY_ADMIN")}人 ／ {countLabel("MANAGER")}人 ／{" "}
          {countLabel("EMPLOYEE")}人
        </p>
      </Card>

      {/* 最頻操作の一つ。一覧が会社数十社ぶんに伸びても、この入口は一覧の下まで
          スクロールしなくても届く位置に固定する。 */}
      <SectionHeading>利用者を追加する</SectionHeading>
      <Disclosure
        summary="新しい利用者を作る"
        meta="システム全体管理者もここから作れます"
        defaultOpen={superAdmins.filter((u) => u.isActive).length <= 1}
      >
        <RecordForm
          action={createSystemUser}
          resource="system-users"
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
      <div className="mt-3">
        <RoleCapabilities />
      </div>

      <SectionHeading>会社でしぼる</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        <ChipLink href="/system/users" current={scope === ""}>
          すべて（{people(all)}）
        </ChipLink>
        {companies.map((c) => (
          <ChipLink key={c.id} href={`/system/users?company=${c.id}`} current={scope === c.id}>
            {c.name}（{all.filter((u) => u.companyId === c.id).length}）
          </ChipLink>
        ))}
        <ChipLink href="/system/users?company=none" current={scope === "none"}>
          会社に属さない（{all.filter((u) => !u.companyId).length}）
        </ChipLink>
      </div>

      <SectionHeading aside={<span className="footnote">名前を押すと変更できます</span>}>
        利用者（{people(scoped)}人）
      </SectionHeading>
      {scoped.length === 0 ? (
        <EmptyState
          title="この条件の利用者はいません"
          body="別の会社を選ぶか、「新しい利用者を作る」から追加してください。"
        />
      ) : (
        <Card>
          {scoped.map((u) => {
            const rowKey = u.membershipId ?? u.id;
            const row = (
              <Link
                href={u.companyId ? `/system/users/${u.id}?company=${u.companyId}` : `/system/users/${u.id}`}
                className="user-row no-underline"
                /* 利用停止の方は、札だけでなく行の面と枠でも分かるようにする（全画面共通の作法） */
                data-off={u.isActive ? undefined : "true"}
              >
                <Avatar name={u.name} seed={u.id} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-body font-semibold text-ink">
                    {u.name}
                    {!u.isActive && <span className="ml-2 badge badge-closed">利用停止</span>}
                  </p>
                  <p className="m-0 truncate text-note text-ink-muted">{u.email}</p>
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
                  {showGradeScore && u.companyId && (
                    <span className="tag">
                      <Icon name="layers" size={13} />
                      {u.gradeName ?? GRADE_UNSET_LABEL}
                    </span>
                  )}
                </span>
                {showGradeScore && u.companyId && (
                  <LatestScoreValue score={scores.get(membershipScoreKey(u.companyId, u.id)) ?? null} />
                )}
              </Link>
            );
            // 控えがある行だけ、リンクの下に「控えを見る」を並べる（リンクの中には入れない）
            return hasMemo.has(u.id) && firstRowOf.get(u.id) === rowKey ? (
              <div key={rowKey} className="user-row-group">
                {row}
                <CredentialMemoButton userId={u.id} name={u.name} />
              </div>
            ) : (
              <Fragment key={rowKey}>{row}</Fragment>
            );
          })}
        </Card>
      )}

      <p className="footnote mt-3">
        点数は、その会社で確定した最新の評価の KPI評価点と等級要件の達成率です。評価の中身は、その会社の管理者・マネージャーが確認します。
      </p>
    </>
  );
}
