import { ROLE_LABEL, requireRoute } from "@/lib/session";
import { listGrades, listMembers, listProfileFieldPolicies } from "@/lib/queries";
import { resolveSelfEditMap, CONFIGURABLE_FIELDS } from "@/lib/domain/profile-fields";
import { Card, Disclosure, DownloadButton, EmptyState, LinkButton, PageTitle, SectionHeading } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { RecordForm } from "@/components/RecordForm";
import { RoleCapabilities } from "@/components/permissions/RoleCapabilities";
import { MembersCsvImport } from "@/components/MembersCsvImport";
import { PeopleList } from "@/components/PeopleList";
import { createMember } from "@/actions/members";
import { listMemoHolderIds } from "@/lib/credential-vault";
import { getDb } from "@/lib/db";
import { canViewGradeScore, withGradeAndScore } from "@/lib/score-visibility";
import { availableSortKeys, parsePeopleView, type PeopleSearchParams } from "@/lib/domain/people-list";

export const dynamic = "force-dynamic";

/**
 * 社員の一覧と新規登録。
 *
 * 最初に見えるのは名簿そのもの（誰がいるか）。
 * アカウントの発行と名簿の取り込みは、必要になったときだけ開く。
 * 一覧には「名前・等級・役割・状態」だけを出し、細かい情報は個人のページに置く。
 */
export default async function AdminMembers({ searchParams }: { searchParams: Promise<PeopleSearchParams> }) {
  const viewer = await requireRoute("/admin/members");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const db = await getDb();
  const [members, grades, policies, memoHolders] = await Promise.all([
    listMembers(companyId),
    listGrades(companyId),
    listProfileFieldPolicies(companyId),
    listMemoHolderIds(db, companyId),
  ]);
  // 初期パスワードの控えがある人（中身は押したときにだけ開く）
  const hasMemo = new Set(memoHolders);
  const managers = members.filter((m) => m.role !== "EMPLOYEE" && m.isActive);
  const activeCount = members.filter((m) => m.isActive).length;
  // 利用停止の人も同じ一覧に入れる（退職した人の情報をあとから確かめるため。§28-13）。
  // 一覧に出す等級と確定した最新の点数は、見てよい役割にだけサーバーで付ける（S6）
  const listed = await withGradeAndScore(db, viewer, members);
  // 自社の一覧なので会社では並べない。点数と等級は見てよい役割だけが並べられる
  const sortKeys = availableSortKeys({ acrossCompanies: false, gradeAndScore: canViewGradeScore(viewer) });
  const view = parsePeopleView(await searchParams, sortKeys);
  const selfEdit = resolveSelfEditMap(policies);
  const selfEditableLabels = CONFIGURABLE_FIELDS.filter((f) => selfEdit[f.key as keyof typeof selfEdit]).map(
    (f) => f.label,
  );

  return (
    <>
      <PageTitle
        title="社員"
        lede="アカウントの発行と、等級・上長の設定を行います。退職した方は削除せず「利用停止」にしてください（過去の評価が残ります）。"
      />

      {/* 名簿の全体像と、いま本人に開放している項目。文で書かず、数と札で見せる */}
      <Card className="card-pad hero-tint">
        <p className="num-display m-0 text-hero-sp leading-tight text-accent">
          {activeCount}
          <span className="unit"> / {members.length} 人が在籍中</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-note text-ink-muted">本人が自分で変えられる項目</span>
          {selfEditableLabels.length === 0 ? (
            <span className="tag">
              <Icon name="lock" size={13} />
              なし（すべて会社の管理者のみ）
            </span>
          ) : (
            selfEditableLabels.map((label) => (
              <span key={label} className="tag">
                <Icon name="pencil" size={13} />
                {label}
              </span>
            ))
          )}
          <LinkButton href="/admin/members/policy" variant="tertiary">
            変更できる範囲を決める
          </LinkButton>
        </div>
      </Card>

      <SectionHeading aside={<span className="footnote">名前を押すと詳細を確認できます（利用停止の方も載せています）</span>}>
        名簿（{members.length}人）
      </SectionHeading>
      {members.length === 0 ? (
        <EmptyState title="社員がまだ登録されていません" body="下の「アカウントを発行する」から追加してください。" />
      ) : (
        <PeopleList
          sortKeys={sortKeys}
          initial={view}
          rows={listed.map((m) => ({
            key: m.id,
            id: m.id,
            href: `/admin/members/${m.id}`,
            isActive: m.isActive,
            name: m.name,
            email: m.email,
            role: m.role,
            gradeName: m.gradeName,
            gradeOrder: m.gradeOrder,
            latestScore: m.latestScore,
            department: m.department,
            employeeCode: m.employeeCode,
            hasMemo: hasMemo.has(m.id),
          }))}
        />
      )}

      <SectionHeading
        aside={
          <DownloadButton href="/api/export?type=members" variant="tertiary">
            社員一覧を書き出す
          </DownloadButton>
        }
      >
        人を増やす・まとめて取り込む
      </SectionHeading>
      <Disclosure summary="アカウントを発行する" meta="1人ずつ登録します">
      <RecordForm
        action={createMember}
        resource="members"
        submitLabel="この内容でアカウントを作る"
        description="発行後、メールアドレスと最初のパスワードをご本人にお伝えください。"
        resetAfterSubmit
        fields={[
          { name: "name", label: "氏名", type: "text", required: true },
          { name: "email", label: "メールアドレス（ログインID）", type: "email", required: true },
          {
            name: "password",
            label: "最初のパスワード",
            type: "password",
            required: true,
            generate: true,
            help: "この場で作った値を出しています。写して本人に渡してください。あとから本人が変更できます。",
          },
          {
            name: "role",
            label: "役割",
            type: "select",
            required: true,
            defaultValue: "EMPLOYEE",
            options: [
              { value: "EMPLOYEE", label: ROLE_LABEL.EMPLOYEE },
              { value: "MANAGER", label: ROLE_LABEL.MANAGER },
              { value: "COMPANY_ADMIN", label: ROLE_LABEL.COMPANY_ADMIN },
            ],
          },
          { name: "gradeId", label: "等級", type: "select", options: grades.map((g) => ({ value: g.id, label: g.name })) },
          { name: "managerId", label: "上長", type: "select", options: managers.map((m) => ({ value: m.id, label: m.name })) },
          { name: "department", label: "所属", type: "text" },
          { name: "employeeCode", label: "社員番号", type: "text" },
          { name: "hiredAt", label: "入社日", type: "date" },
        ]}
      />
      </Disclosure>

      <div className="mt-3">
        {/* 会社の管理者は全体管理者を作れないので、選べる3つの役割だけを並べる */}
        <RoleCapabilities roles={["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]} />
      </div>

      <div className="mt-3">
        <Disclosure summary="名簿をまとめて取り込む" meta="CSVから一括で登録します">
          <MembersCsvImport />
        </Disclosure>
      </div>
    </>
  );
}
