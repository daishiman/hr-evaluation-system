import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { getMember, listEvaluations, listGrades, listMembers, listProfileFieldPolicies } from "@/lib/queries";
import { CONFIGURABLE_FIELDS, resolveSelfEditMap } from "@/lib/domain/profile-fields";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PasswordReissue } from "@/components/PasswordReissue";
import { Card, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";
import { formatDate } from "@/lib/view";

export const dynamic = "force-dynamic";

/** 社員1人の情報変更（会社の管理者）。等級・上長・役割はここでだけ変えられる。 */
export default async function AdminMemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  const { id } = await params;
  if (!viewer.companyId) notFound();
  const companyId = viewer.companyId;

  const member = await getMember(companyId, id);
  if (!member) notFound();

  const [grades, members, evals, policies] = await Promise.all([
    listGrades(companyId),
    listMembers(companyId),
    listEvaluations(companyId, viewer.role, { employeeId: id }),
    listProfileFieldPolicies(companyId),
  ]);
  const managers = members.filter((m) => m.id !== id && m.role !== "EMPLOYEE" && m.isActive);
  const selfEdit = resolveSelfEditMap(policies);
  const managerName = members.find((m) => m.id === member.managerId)?.name ?? null;
  const finalizedCount = evals.filter((e) => e.status === "finalized").length;

  /** 入力欄に「本人も直せる項目かどうか」を添える（管理者が直した内容を本人が戻せる場合がある）。 */
  const selfEditHint = (key: keyof typeof selfEdit) =>
    selfEdit[key] ? "本人も自分の画面から変更できます。" : undefined;

  return (
    <>
      <PageTitle
        title={`${member.name} さん`}
        lede={`${ROLE_LABEL[member.role as Role] ?? member.role} ／ ${member.email}`}
        actions={
          <LinkButton href={`/manager/members/${member.id}`} variant="secondary">
            評価の履歴を見る
          </LinkButton>
        }
      />

      {/* いまの姿は札で1枚に。読む文章を増やさず、目で拾えるようにする */}
      <Card className="card-pad hero-tint" off={!member.isActive}>
        <div className="identity-head">
          <Avatar name={member.name} seed={member.id} size={56} />
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-1 truncate text-sub text-[var(--ink-muted)]">
              <Icon name="mail" size={13} />
              {member.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="tag">
                <Icon name="layers" size={13} />
                {member.gradeName ?? "等級 未設定"}
              </span>
              <span className="tag">
                <Icon name="building" size={13} />
                {member.department ?? "所属 未設定"}
              </span>
              <span className="tag">
                <Icon name="users" size={13} />
                上長 {managerName ?? "未設定"}
              </span>
              <span className="tag">
                <Icon name="calendar" size={13} />
                {member.hiredAt ? `${formatDate(member.hiredAt)} 入社` : "入社日 未設定"}
              </span>
              <span className="tag">
                <Icon name="hash" size={13} />
                {member.employeeCode ?? "社員番号 未設定"}
              </span>
              <span className="tag" data-tone={member.isActive ? undefined : "muted"}>
                <Icon name="power" size={13} />
                {member.isActive ? "在籍" : "利用停止"}
              </span>
            </div>
            <p className="m-0 mt-2 text-note text-[var(--ink-muted)]">
              確定済みの評価 <Num value={finalizedCount} unit="件" />
            </p>
          </div>
        </div>
      </Card>

      <SectionHeading
        aside={
          <LinkButton href="/admin/members/policy" variant="tertiary">
            本人が変更できる範囲
          </LinkButton>
        }
      >
        登録内容を変える
      </SectionHeading>
      <RecordForm
        url="/api/members"
        method="PATCH"
        fixed={{ userId: member.id }}
        submitLabel="この内容で保存する"
        description="等級を変えると、次に作るアンケートと評価の計算に反映されます。確定済みの評価は変わりません。"
        fields={[
          { name: "name", label: "氏名", type: "text", required: true, defaultValue: member.name, help: selfEditHint("name") },
          {
            name: "role",
            label: "役割",
            type: "select",
            required: true,
            defaultValue: member.role,
            options: [
              { value: "EMPLOYEE", label: ROLE_LABEL.EMPLOYEE },
              { value: "MANAGER", label: ROLE_LABEL.MANAGER },
              { value: "COMPANY_ADMIN", label: ROLE_LABEL.COMPANY_ADMIN },
            ],
          },
          {
            name: "gradeId",
            label: "等級",
            type: "select",
            defaultValue: member.gradeId ?? "",
            options: grades.map((g) => ({ value: g.id, label: g.name })),
          },
          {
            name: "managerId",
            label: "上長",
            type: "select",
            defaultValue: member.managerId ?? "",
            options: managers.map((m) => ({ value: m.id, label: m.name })),
          },
          { name: "department", label: "所属", type: "text", defaultValue: member.department ?? "", help: selfEditHint("department") },
          { name: "employeeCode", label: "社員番号", type: "text", defaultValue: member.employeeCode ?? "", help: selfEditHint("employeeCode") },
          { name: "hiredAt", label: "入社日", type: "date", defaultValue: member.hiredAt ?? "", help: selfEditHint("hiredAt") },
          { name: "profileNote", label: "メモ（本人には表示されません）", type: "textarea", defaultValue: member.profileNote ?? "" },
        ]}
      />

      <SectionHeading>パスワードの再発行</SectionHeading>
      <PasswordReissue url="/api/members" userId={member.id} name={member.name} />

      <SectionHeading>利用の停止と再開</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-sub">
          {member.isActive
            ? "退職された方は「利用停止」にしてください。ログインできなくなりますが、これまでの回答と評価はそのまま残ります。"
            : "この方はいま利用停止中です。再開するとログインできるようになります。"}
        </p>
        <div className="mt-3">
          {member.isActive ? (
            <ActionButton
              url="/api/members"
              method="PATCH"
              body={{ userId: member.id, isActive: false }}
              label="利用を停止する"
              confirm={`${member.name}さんはログインできなくなります。これまでの回答と評価の記録は残ります。よろしいですか？`}
            />
          ) : (
            <ActionButton
              url="/api/members"
              method="PATCH"
              body={{ userId: member.id, isActive: true }}
              label="利用を再開する"
            />
          )}
        </div>
      </Card>
    </>
  );
}
