import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLE_LABEL, ROLES, type Role } from "@/lib/session";
import { getAnyUser, listAllUsers, listCompanies, listGrades } from "@/lib/queries";
import { Card, PageTitle, SectionHeading } from "@/components/ui";
import { PasswordReissue } from "@/components/PasswordReissue";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecordForm } from "@/components/RecordForm";
import { ActionButton } from "@/components/ActionButton";
import { formatDate } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 利用者1人の変更（システム全体管理者）。
 *
 * 会社の管理者向けの /admin/members は自社の社員しか触れないため、
 * システム全体管理者自身や、会社に属さない利用者はここでしか直せない。
 */
export default async function SystemUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("SUPER_ADMIN");
  const { id } = await params;

  const user = await getAnyUser(id);
  if (!user) notFound();

  const [companies, all] = await Promise.all([listCompanies(), listAllUsers()]);
  const grades = user.companyId ? await listGrades(user.companyId) : [];
  const managers = all.filter((u) => u.id !== id && u.companyId === user.companyId && u.role !== "EMPLOYEE" && u.isActive);
  const isSelf = user.id === viewer.id;
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
                {user.companyName ?? "会社に属さない"}
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

      <SectionHeading>登録内容を変える</SectionHeading>
      <RecordForm
        url="/api/system/users"
        method="PATCH"
        fixed={{ userId: user.id }}
        submitLabel="この内容で保存する"
        description="所属会社を変えると、等級と上長は付け直しになります。会社をまたいだ組み合わせは保存できません。"
        fields={[
          { name: "name", label: "氏名", type: "text", required: true, defaultValue: user.name },
          { name: "email", label: "メールアドレス（ログインID）", type: "email", required: true, defaultValue: user.email },
          {
            name: "role",
            label: "役割",
            type: "select",
            required: true,
            defaultValue: user.role,
            help: isSelf ? "自分の役割は下げられません。" : undefined,
            options: (ROLES as readonly Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] })),
          },
          {
            name: "companyId",
            label: "所属会社",
            type: "select",
            defaultValue: user.companyId ?? "",
            options: [
              { value: "", label: "会社に属さない（システム全体管理者向け）" },
              ...companies.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name}（停止中）` })),
            ],
          },
          {
            name: "gradeId",
            label: "等級",
            type: "select",
            defaultValue: user.gradeId ?? "",
            help: user.companyId ? undefined : "会社を選ぶと、その会社の等級から選べます。",
            options: grades.map((g) => ({ value: g.id, label: g.name })),
          },
          {
            name: "managerId",
            label: "上長",
            type: "select",
            defaultValue: user.managerId ?? "",
            options: managers.map((m) => ({ value: m.id, label: m.name })),
          },
          { name: "department", label: "所属", type: "text", defaultValue: user.department ?? "" },
          { name: "employeeCode", label: "社員番号", type: "text", defaultValue: user.employeeCode ?? "" },
          { name: "hiredAt", label: "入社日", type: "date", defaultValue: user.hiredAt ?? "" },
        ]}
      />

      <SectionHeading>パスワードの再発行</SectionHeading>
      <PasswordReissue url="/api/system/users" userId={user.id} name={user.name} />

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
              url="/api/system/users"
              method="PATCH"
              body={{ userId: user.id, isActive: false }}
              label="利用を停止する"
              confirm={`${user.name}さんはログインできなくなります。記録は残ります。よろしいですか？`}
            />
          ) : (
            <ActionButton
              url="/api/system/users"
              method="PATCH"
              body={{ userId: user.id, isActive: true }}
              label="利用を再開する"
            />
          )}
        </div>
      </Card>
    </>
  );
}
