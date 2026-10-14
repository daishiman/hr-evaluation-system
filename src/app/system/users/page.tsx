import { ROLE_LABEL, type Role, requireRoute } from "@/lib/session";
import { listAllUsers, listCompanies } from "@/lib/queries";
import { Card, Disclosure, EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { RoleCapabilities } from "@/components/permissions/RoleCapabilities";
import { PeopleList, PeopleScopeChips } from "@/components/PeopleList";
import { createSystemUser } from "@/actions/system-users";
import { listMemoHolderIds } from "@/lib/credential-vault";
import { getDb } from "@/lib/db";
import { GRADE_UNSET_LABEL } from "@/lib/domain/grade-label";
import { availableSortKeys, parsePeopleView, type PeopleSearchParams } from "@/lib/domain/people-list";
import { canViewGradeScore, latestFinalizedScoresEveryCompany, membershipScoreKey } from "@/lib/score-visibility";

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
 * 名前などで探し、名前・会社・役割・点数・等級で並べ替えられる（spec.md §28-13）。
 */
export default async function SystemUsers({
  searchParams,
}: {
  searchParams: Promise<PeopleSearchParams & { company?: string }>;
}) {
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
  const scope = typeof sp.company === "string" ? sp.company : "";
  const scoped =
    scope === "" ? all : scope === "none" ? all.filter((u) => !u.companyId) : all.filter((u) => u.companyId === scope);

  /** 行（所属）ではなく人で数える */
  const people = (rows: typeof all) => new Set(rows.map((u) => u.id)).size;
  const byRole = (r: string) => scoped.filter((u) => u.role === r);
  const countLabel = (r: Role) => `${ROLE_LABEL[r]} ${people(byRole(r))}`;
  // 全社の一覧なので会社でも並べられる。点数と等級は見てよい役割だけ
  const sortKeys = availableSortKeys({ acrossCompanies: true, gradeAndScore: showGradeScore });
  const view = parsePeopleView(sp, sortKeys);

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
      {/* 会社を切り替えても、選んでいる並びと検索語は引き継ぐ */}
      <PeopleScopeChips
        basePath="/system/users"
        param="company"
        current={scope}
        items={[
          { value: "", label: `すべて（${people(all)}）` },
          ...companies.map((c) => ({ value: c.id, label: `${c.name}（${all.filter((u) => u.companyId === c.id).length}）` })),
          { value: "none", label: `会社に属さない（${all.filter((u) => !u.companyId).length}）` },
        ]}
      />

      <SectionHeading aside={<span className="footnote">名前を押すと変更できます</span>}>
        利用者（{people(scoped)}人）
      </SectionHeading>
      {scoped.length === 0 ? (
        <EmptyState
          title="この条件の利用者はいません"
          body="別の会社を選ぶか、「新しい利用者を作る」から追加してください。"
        />
      ) : (
        <PeopleList
          sortKeys={sortKeys}
          initial={view}
          rows={scoped.map((u) => {
            // 等級と点数は、会社に属する行で、見てよい役割にだけ渡す（S6）
            const gradedIn = showGradeScore ? u.companyId : null;
            return {
              key: u.membershipId ?? u.id,
              id: u.id,
              href: u.companyId ? `/system/users/${u.id}?company=${u.companyId}` : `/system/users/${u.id}`,
              isActive: u.isActive,
              name: u.name,
              email: u.email,
              role: u.role,
              companyName: u.companyName,
              ...(gradedIn && {
                gradeName: u.gradeName ?? GRADE_UNSET_LABEL,
                gradeOrder: u.gradeOrder,
                latestScore: scores.get(membershipScoreKey(gradedIn, u.id)) ?? null,
              }),
              hasMemo: hasMemo.has(u.id),
            };
          })}
        />
      )}

      <p className="footnote mt-3">
        点数は、その会社で確定した最新の評価の KPI評価点と等級要件の達成率です。評価の中身は、その会社の管理者・マネージャーが確認します。
      </p>
    </>
  );
}
