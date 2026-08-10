import Link from "next/link";
import { requireRole, ROLE_LABEL } from "@/lib/session";
import { listGrades, listMembers } from "@/lib/queries";
import { Badge, Card, EmptyState, PageTitle, SectionHeading } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { MembersCsvImport } from "@/components/MembersCsvImport";

export const dynamic = "force-dynamic";

/**
 * 社員の一覧と新規登録。
 * 一覧には「名前・等級・役割・状態」だけを出し、細かい情報は個人のページに置く。
 */
export default async function AdminMembers() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [members, grades] = await Promise.all([listMembers(companyId), listGrades(companyId)]);
  const managers = members.filter((m) => m.role !== "EMPLOYEE" && m.isActive);
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);

  return (
    <>
      <PageTitle
        title="社員"
        lede="アカウントの発行と、等級・上長の設定を行います。退職した方は削除せず「利用停止」にしてください（過去の評価が残ります）。"
      />

      <SectionHeading>アカウントを発行する</SectionHeading>
      <RecordForm
        url="/api/members"
        method="POST"
        submitLabel="この内容でアカウントを作る"
        description="発行後、メールアドレスと最初のパスワードをご本人にお伝えください。"
        resetAfterSubmit
        fields={[
          { name: "name", label: "氏名", type: "text", required: true },
          { name: "email", label: "メールアドレス（ログインID）", type: "email", required: true },
          { name: "password", label: "最初のパスワード", type: "password", required: true, help: "8文字以上。あとから本人が変更できます。" },
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

      <SectionHeading
        aside={
          <a href="/api/export?type=members" className="btn btn-tertiary">
            社員一覧を書き出す
          </a>
        }
      >
        名簿をまとめて取り込む
      </SectionHeading>
      <MembersCsvImport />

      <SectionHeading aside={<span className="footnote">名前を押すと詳細を確認できます</span>}>
        在籍中（{active.length}人）
      </SectionHeading>
      {active.length === 0 ? (
        <EmptyState title="社員がまだ登録されていません" body="上のフォームからアカウントを発行してください。" />
      ) : (
        <Card>
          {active.map((m) => (
            <div key={m.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/admin/members/${m.id}`} className="text-[var(--brand-deep)]">
                    {m.name}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">
                  {m.gradeName ?? "等級 未設定"} ／ {m.department ?? "所属 未設定"} ／ {m.email}
                </p>
              </div>
              <Badge tone={m.role === "EMPLOYEE" ? "done" : "active"}>
                {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {inactive.length > 0 && (
        <>
          <SectionHeading>利用停止中（{inactive.length}人）</SectionHeading>
          <Card>
            {inactive.map((m) => (
              <div key={m.id} className="card-row">
                <div className="row-main">
                  <p className="todo-row-title m-0">
                    <Link href={`/admin/members/${m.id}`} className="text-[var(--brand-deep)]">
                      {m.name}
                    </Link>
                  </p>
                  <p className="todo-row-sub m-0">ログインできません。過去の評価は残っています。</p>
                </div>
                <Badge tone="closed">利用停止</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
