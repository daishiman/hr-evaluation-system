import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLE_LABEL, type Role } from "@/lib/session";
import { getMember, listEvaluations, listGrades, listMembers } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, DefList, Num, PageTitle, SectionHeading } from "@/components/ui";
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

  const [grades, members, evals] = await Promise.all([
    listGrades(companyId),
    listMembers(companyId),
    listEvaluations(companyId, viewer.role, { employeeId: id }),
  ]);
  const managers = members.filter((m) => m.id !== id && m.role !== "EMPLOYEE" && m.isActive);

  return (
    <>
      <PageTitle
        title={`${member.name} さん`}
        lede={`${ROLE_LABEL[member.role as Role] ?? member.role} ／ ${member.email}`}
        actions={
          <>
            <Link href={`/manager/members/${member.id}`} className="btn btn-tertiary">
              評価の履歴を見る
            </Link>
            <Link href="/admin/members" className="btn btn-tertiary">
              一覧に戻る
            </Link>
          </>
        }
      />

      <SectionHeading>いまの登録内容</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            { label: "等級", value: member.gradeName ?? "未設定" },
            { label: "所属", value: member.department ?? "—" },
            { label: "社員番号", value: member.employeeCode ?? "—" },
            { label: "入社日", value: formatDate(member.hiredAt) },
            { label: "上長", value: members.find((m) => m.id === member.managerId)?.name ?? "未設定" },
            {
              label: "状態",
              value: member.isActive ? <Badge tone="active">在籍</Badge> : <Badge tone="closed">利用停止</Badge>,
            },
            { label: "確定済みの評価", value: <Num value={evals.filter((e) => e.status === "finalized").length} unit="件" /> },
          ]}
        />
      </Card>

      <SectionHeading>登録内容を変える</SectionHeading>
      <RecordForm
        url="/api/members"
        method="PATCH"
        fixed={{ userId: member.id }}
        submitLabel="この内容で保存する"
        description="等級を変えると、次に作るアンケートと評価の計算に反映されます。確定済みの評価は変わりません。"
        fields={[
          { name: "name", label: "氏名", type: "text", required: true, defaultValue: member.name },
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
          { name: "department", label: "所属", type: "text", defaultValue: member.department ?? "" },
          { name: "employeeCode", label: "社員番号", type: "text", defaultValue: member.employeeCode ?? "" },
          { name: "hiredAt", label: "入社日", type: "date", defaultValue: member.hiredAt ?? "" },
          { name: "profileNote", label: "メモ（本人には表示されません）", type: "textarea", defaultValue: member.profileNote ?? "" },
        ]}
      />

      <SectionHeading>パスワードの再発行</SectionHeading>
      <RecordForm
        url="/api/members"
        method="PATCH"
        fixed={{ userId: member.id }}
        submitLabel="パスワードを再発行する"
        description="ログインできなくなったときに使います。新しいパスワードをご本人にお伝えください。"
        resetAfterSubmit
        fields={[{ name: "password", label: "新しいパスワード", type: "password", required: true, help: "8文字以上" }]}
      />

      <SectionHeading>利用の停止と再開</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-[13px]">
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
