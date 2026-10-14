import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLE_LABEL, ROLES, type Role, requireRoute } from "@/lib/session";
import { getAnyUser, listAllUsers, listCompanies, listGrades, listMembers } from "@/lib/queries";
import { Card, PageTitle, RecordList, SectionHeading } from "@/components/ui";
import { PasswordReissue } from "@/components/PasswordReissue";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecordForm } from "@/components/RecordForm";
import { ActionButton } from "@/components/ActionButton";
import { formatDate } from "@/lib/view";
import { updateSystemUser } from "@/actions/system-users";
import { addMembership } from "@/actions/memberships";

export const dynamic = "force-dynamic";

/**
 * 利用者1人の変更（システム全体管理者）。
 *
 * 会社の管理者向けの /admin/members は自社の社員しか触れないため、
 * システム全体管理者自身や、会社に属さない利用者はここでしか直せない。
 *
 * 1人が複数の会社に所属できる（S7）。会社ごとの値（役割・等級・上長・社員番号など）は
 * 所属ごとに持つので、変える所属を ?company= で選ぶ（既定は元の所属）。
 * 所属が2つ以上ある人は、ここでは会社を移さない（所属を足す・外すで扱う）。
 */
export default async function SystemUserDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const viewer = await requireRoute("/system/users/[id]");
  const { id } = await params;
  const sp = await searchParams;

  const user = await getAnyUser(id);
  if (!user) notFound();

  // 変える所属。選んだ会社の所属が無ければ元の所属（一番上の欄と同じ）
  const selected = user.memberships.find((x) => x.companyId === sp.company) ?? null;
  const current = selected ?? {
    companyId: user.companyId,
    role: user.role,
    gradeId: user.gradeId,
    managerId: user.managerId,
    department: user.department,
    employeeCode: user.employeeCode,
    hiredAt: user.hiredAt,
  };
  const multiple = user.memberships.length > 1;

  const [companies, all, grades, members] = await Promise.all([
    listCompanies(),
    listAllUsers(),
    current.companyId ? listGrades(current.companyId) : Promise.resolve([]),
    current.companyId ? listMembers(current.companyId) : Promise.resolve([]),
  ]);
  // 上長に選べるのは、その会社に所属する利用中のマネージャー以上の人
  const managers = members.filter((u) => u.id !== id && u.role !== "EMPLOYEE" && u.isActive);
  const isSelf = user.id === viewer.id;
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  // 所属を足せる会社: 有効な会社のうち、まだ所属していない会社
  const joinable = companies.filter((c) => c.isActive && !user.memberships.some((x) => x.companyId === c.id));
  const otherActiveSuperAdmins = all.filter((u) => u.role === "SUPER_ADMIN" && u.isActive && u.id !== user.id).length;
  const isLastSuperAdmin = user.role === "SUPER_ADMIN" && user.isActive && otherActiveSuperAdmins === 0;

  return (
    <>
      <PageTitle
        title={`${user.name} さん`}
      />

      {/* いまの姿を先に1枚で見せる。細かい入力欄はその下 */}
      <Card className="card-pad hero-tint" off={!user.isActive}>
        <div className="identity-head">
          <Avatar name={user.name} seed={user.id} size={56} />
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-1 truncate text-sub text-ink-muted">
              <Icon name="mail" size={13} />
              {user.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="tag">
                <Icon name="shield" size={13} />
                {ROLE_LABEL[user.role as Role] ?? user.role}
              </span>
              <span className="tag">
                <Icon name="building" size={13} />
                {user.companyName
                  ? multiple
                    ? `${user.companyName} ほか${user.memberships.length - 1}社`
                    : user.companyName
                  : "会社に属さない"}
              </span>
              {user.gradeName && (
                <span className="tag">
                  <Icon name="layers" size={13} />
                  {user.gradeName}
                </span>
              )}
              <span className="tag">
                <Icon name="power" size={13} />
                {user.isActive ? "利用中" : "利用停止"}
              </span>
              {user.hiredAt && (
                <span className="tag">
                  <Icon name="calendar" size={13} />
                  {formatDate(user.hiredAt)} 入社
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {(isSelf || isLastSuperAdmin) && (
        <p className="footnote mt-3">
          {isSelf
            ? "これはあなた自身のアカウントです。自分の役割を下げたり、自分を利用停止にすることはできません。"
            : "この方は、いま有効な唯一のシステム全体管理者です。役割を下げる前に、別の方をシステム全体管理者にしてください。"}
        </p>
      )}

      {user.memberships.length > 0 && (
        <>
          <SectionHeading
            aside={<span className="footnote">会社を押すと、その会社での登録内容を変えられます</span>}
          >
            所属している会社（{user.memberships.length}社）
          </SectionHeading>
          <RecordList
            items={user.memberships.map((x) => ({
              key: x.membershipId,
              off: !x.companyActive,
              title: (
                <Link href={`/system/users/${user.id}?company=${x.companyId}`} className="font-semibold">
                  {x.companyName}
                </Link>
              ),
              marks: (
                <span className="flex flex-wrap gap-2">
                  {x.companyId === current.companyId && <span className="tag">いま変えている所属</span>}
                  {!x.companyActive && <span className="badge badge-closed">会社は停止中</span>}
                </span>
              ),
              rows: [
                { label: "役割", value: ROLE_LABEL[x.role as Role] ?? x.role },
                { label: "等級", value: x.gradeName ?? "未設定" },
                { label: "社員番号", value: x.employeeCode ?? "未設定" },
              ],
            }))}
          />
          {multiple && (
            <p className="footnote mt-3">
              所属を外すときは、その会社に切り替えてから「社員」の画面で外します。氏名・メールアドレス・パスワード・利用の停止は、すべての会社に効きます。
            </p>
          )}
        </>
      )}

      <SectionHeading>
        {multiple && current.companyId
          ? `登録内容を変える（${user.memberships.find((x) => x.companyId === current.companyId)?.companyName ?? ""}での値）`
          : "登録内容を変える"}
      </SectionHeading>
      <RecordForm
        key={current.companyId ?? "none"}
        action={updateSystemUser}
        resource="system-users"
        fixed={multiple ? { userId: user.id, companyId: current.companyId } : { userId: user.id }}
        submitLabel="この内容で保存する"
        description={
          multiple
            ? "役割・等級・上長・部署・社員番号・入社日は、この会社での値です。ほかの会社の値は変わりません。"
            : "所属会社を変えると、等級と上長は付け直しになります。会社をまたいだ組み合わせは保存できません。"
        }
        fields={[
          { name: "name", label: "氏名", type: "text", required: true, defaultValue: user.name },
          { name: "email", label: "メールアドレス（ログインID）", type: "email", required: true, defaultValue: user.email },
          {
            name: "role",
            label: "役割",
            type: "select",
            required: true,
            defaultValue: current.role,
            help: isSelf ? "自分の役割は下げられません。" : undefined,
            options: (ROLES as readonly Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] })),
          },
          ...(multiple
            ? []
            : [
                {
                  name: "companyId",
                  label: "所属会社",
                  type: "select" as const,
                  defaultValue: current.companyId ?? "",
                  options: [
                    { value: "", label: "会社に属さない（システム全体管理者向け）" },
                    ...companies.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name}（停止中）` })),
                  ],
                },
              ]),
          {
            name: "gradeId",
            label: "等級",
            type: "select",
            defaultValue: current.gradeId ?? "",
            help: current.companyId ? undefined : "会社を選ぶと、その会社の等級から選べます。",
            options: grades.map((g) => ({ value: g.id, label: g.name })),
          },
          {
            name: "managerId",
            label: "上長",
            type: "select",
            defaultValue: current.managerId ?? "",
            options: managers.map((m) => ({ value: m.id, label: m.name })),
          },
          { name: "department", label: "所属", type: "text", defaultValue: current.department ?? "" },
          { name: "employeeCode", label: "社員番号", type: "text", defaultValue: current.employeeCode ?? "" },
          { name: "hiredAt", label: "入社日", type: "date", defaultValue: current.hiredAt ?? "" },
        ]}
      />

      {!isSuperAdmin && (
        <>
          <SectionHeading>ほかの会社にも所属させる</SectionHeading>
          {joinable.length === 0 ? (
            <p className="footnote m-0">
              所属を足せる会社がありません（有効な会社のすべてに所属しています）。会社は「会社の管理」から作れます。
            </p>
          ) : (
            <RecordForm
              action={addMembership}
              resource="system-users"
              fixed={{ userId: user.id }}
              submitLabel="この会社に所属させる"
              resetAfterSubmit
              description="今のパスワードのまま、足した会社にも切り替えて入れます。等級と上長は、足したあとに上の一覧でその会社を選んで付けてください。"
              fields={[
                {
                  name: "companyId",
                  label: "足す会社",
                  type: "select",
                  required: true,
                  options: joinable.map((c) => ({ value: c.id, label: c.name })),
                },
                {
                  name: "role",
                  label: "その会社での役割",
                  type: "select",
                  required: true,
                  defaultValue: "EMPLOYEE",
                  options: (["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as Role[]).map((r) => ({
                    value: r,
                    label: ROLE_LABEL[r],
                  })),
                },
                { name: "department", label: "所属", type: "text" },
                { name: "employeeCode", label: "社員番号", type: "text" },
                { name: "hiredAt", label: "入社日", type: "date" },
              ]}
            />
          )}
        </>
      )}

      <SectionHeading>パスワードの再発行</SectionHeading>
      <PasswordReissue action={updateSystemUser} resource="system-users" userId={user.id} name={user.name} />

      <SectionHeading>利用の停止と再開</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-sub">
          {user.isActive
            ? "利用停止にすると、ログインできなくなります。これまでの回答と評価はそのまま残ります。"
            : "この方はいま利用停止中です。再開するとログインできるようになります。"}
        </p>
        <div className="mt-3">
          {user.isActive ? (
            <ActionButton
              action={updateSystemUser}
              resource="system-users"
              input={{ userId: user.id, isActive: false }}
              label="利用を停止する"
              confirm={`${user.name}さんはログインできなくなります。記録は残ります。よろしいですか？`}
            />
          ) : (
            <ActionButton
              action={updateSystemUser}
              resource="system-users"
              input={{ userId: user.id, isActive: true }}
              label="利用を再開する"
            />
          )}
        </div>
      </Card>
    </>
  );
}
