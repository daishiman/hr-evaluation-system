import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getTemplateSummary, listCompanies } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, CardHead, EmptyState, LinkButton, Num, PageTitle, SectionHeading, StatGrid } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 会社の追加と停止（システム全体管理者のみ）。 */
export default async function SystemCompanies() {
  await requireRole("SUPER_ADMIN");
  const [companies, template] = await Promise.all([listCompanies(), getTemplateSummary()]);

  return (
    <>
      <PageTitle
        title="会社一覧"
        lede="会社を追加すると、同時にその会社の管理者アカウントを1つ作り、標準の制度（等級・KPI・ランク基準・配点・昇給ルール）を写します。写したあとは会社ごとに自由に変更できます。"
      />

      {template && (
        <>
          <SectionHeading>会社を追加したときに写される標準の制度</SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-[13px] text-ink-muted">
              現行の運用（評価基準シート）から取り込んだ内容です。ここを直接使う会社はなく、新しい会社を作るときの下敷きになります。
            </p>
            {/* 同じ粒度の件数を並べるサマリー。組み方は StatGrid の1箇所に集約している。 */}
            <div className="mt-3">
              <StatGrid
                stats={[
                  { label: "等級", value: <Num value={template.grades} display /> },
                  { label: "等級要件の設問", value: <Num value={template.gradeRequirements} display /> },
                  { label: "昇格要件", value: <Num value={template.promotionRequirements} display /> },
                  { label: "KPI項目", value: <Num value={template.kpiItems} display /> },
                  { label: "ランク基準", value: <Num value={template.rankCriteria} display /> },
                  { label: "KPIの設問", value: <Num value={template.kpiQuestions} display /> },
                  { label: "昇給額（等級別）", value: <Num value={template.raiseSettings} display /> },
                  { label: "昇給の特例", value: <Num value={template.raiseExceptions} display /> },
                ]}
              />
            </div>
          </Card>
        </>
      )}

      <SectionHeading>会社を追加する</SectionHeading>
      <RecordForm
        url="/api/companies"
        method="POST"
        submitLabel="この内容で会社を追加する"
        description="会社IDは画面には出ませんが、あとから変更できません。英小文字・数字・ハイフンで入力してください。追加すると上の標準の制度が自動で写されます。"
        resetAfterSubmit
        fields={[
          { name: "name", label: "会社名", type: "text", required: true },
          { name: "slug", label: "会社ID（英小文字）", type: "text", required: true, placeholder: "example-corp" },
          { name: "businessType", label: "事業の種類", type: "text", placeholder: "給付事業" },
          { name: "adminName", label: "管理者の氏名", type: "text", required: true },
          { name: "adminEmail", label: "管理者のメールアドレス", type: "email", required: true },
          {
              name: "adminPassword",
              label: "管理者の最初のパスワード",
              type: "password",
              required: true,
              generate: true,
              help: "この場で作った値を出しています。写して管理者に渡してください。本人がログインすると、変更のお願いが出ます。",
            },
        ]}
      />

      <SectionHeading>登録されている会社（{companies.length}社）</SectionHeading>
      {companies.length === 0 ? (
        <EmptyState title="会社がまだありません" body="上のフォームから最初の会社を追加してください。" />
      ) : (
        <div className="stack">
          {companies.map((c) => (
            <Card key={c.id} className="card-pad" off={!c.isActive}>
              <CardHead
                title={
                  <>
                    {c.name} {c.isActive ? <Badge tone="active">利用中</Badge> : <Badge tone="closed">停止中</Badge>}
                  </>
                }
                sub={`会社ID：${c.slug} ／ ${c.businessType}`}
                actions={
                  <LinkButton href={`/system/users?company=${c.id}`} variant="tertiary">
                    利用者を見る
                  </LinkButton>
                }
              />

              <div className="card-grid mt-3">
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
