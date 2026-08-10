import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCompanies } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, EmptyState, PageTitle, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 会社の追加と停止（システム全体管理者のみ）。 */
export default async function SystemCompanies() {
  await requireRole("SUPER_ADMIN");
  const companies = await listCompanies();

  return (
    <>
      <PageTitle
        title="会社一覧"
        lede="会社を追加すると、同時にその会社の管理者アカウントを1つ作ります。等級やKPIなどの制度は、その管理者が制度マスタの画面から登録します。"
      />

      <SectionHeading>会社を追加する</SectionHeading>
      <RecordForm
        url="/api/companies"
        method="POST"
        submitLabel="この内容で会社を追加する"
        description="会社IDは画面には出ませんが、あとから変更できません。英小文字・数字・ハイフンで入力してください。"
        resetAfterSubmit
        fields={[
          { name: "name", label: "会社名", type: "text", required: true },
          { name: "slug", label: "会社ID（英小文字）", type: "text", required: true, placeholder: "example-corp" },
          { name: "businessType", label: "事業の種類", type: "text", placeholder: "給付事業" },
          { name: "adminName", label: "管理者の氏名", type: "text", required: true },
          { name: "adminEmail", label: "管理者のメールアドレス", type: "email", required: true },
          { name: "adminPassword", label: "管理者の最初のパスワード", type: "password", required: true, help: "8文字以上" },
        ]}
      />

      <SectionHeading>登録されている会社（{companies.length}社）</SectionHeading>
      {companies.length === 0 ? (
        <EmptyState title="会社がまだありません" body="上のフォームから最初の会社を追加してください。" />
      ) : (
        <div className="grid gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="todo-row-title m-0">
                    {c.name} {c.isActive ? <Badge tone="active">利用中</Badge> : <Badge tone="closed">停止中</Badge>}
                  </p>
                  <p className="todo-row-sub m-0">
                    会社ID：{c.slug} ／ {c.businessType}
                  </p>
                </div>
                <Link href={`/system/users?company=${c.id}`} className="btn btn-tertiary">
                  利用者を見る
                </Link>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <RecordForm
                  url="/api/companies"
                  method="PATCH"
                  fixed={{ companyId: c.id }}
                  submitLabel="会社の情報を保存する"
                  fields={[
                    { name: "name", label: "会社名", type: "text", required: true, defaultValue: c.name },
                    { name: "businessType", label: "事業の種類", type: "text", defaultValue: c.businessType },
                  ]}
                />
                <Card className="card-pad">
                  <p className="m-0 text-[13px]">
                    {c.isActive
                      ? "利用を停止すると、この会社の方は全員ログインできなくなります。データは消えません。"
                      : "この会社はいま停止中です。再開しても、社員の利用再開は1人ずつ行う必要があります。"}
                  </p>
                  <div className="mt-3">
                    {c.isActive ? (
                      <ActionButton
                        url="/api/companies"
                        method="PATCH"
                        body={{ companyId: c.id, isActive: false }}
                        label="利用を停止する"
                        variant="secondary"
                        confirm={`${c.name}の方は全員ログインできなくなります。回答・評価のデータはすべて残ります。よろしいですか？`}
                      />
                    ) : (
                      <ActionButton
                        url="/api/companies"
                        method="PATCH"
                        body={{ companyId: c.id, isActive: true }}
                        label="利用を再開する"
                      />
                    )}
                  </div>
                </Card>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
