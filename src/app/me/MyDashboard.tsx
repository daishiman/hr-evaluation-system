import Link from "next/link";
import { Badge, Bar, Card, CardHead, CardRow, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";

export interface MyActionForm {
  formId: string;
  title: string;
  cycleName: string | null;
  questionCount: number;
  responseStatus: string | null;
  deadlineLabel: string | null;
  daysUntilDeadline: number | null;
}

export interface MyResultSummary {
  id: string;
  cycleName: string | null;
  gradeName: string | null;
  requirementRate: number | null;
  requirementAchieved: number | null;
  requirementTotal: number | null;
  raiseEligible: boolean;
  promotionEligible: boolean;
}

function FormActionCard({ form, primary }: { form: MyActionForm; primary: boolean }) {
  return (
    <Card className={`card-pad${primary ? " hero-tint" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="todo-row-title m-0 text-strong">{form.title}</p>
        <Badge tone={form.responseStatus === "draft" ? "active" : "required"}>
          {form.responseStatus === "draft" ? "入力途中" : "未着手"}
        </Badge>
      </div>
      <p className="todo-row-sub m-0 mt-1">
        {form.cycleName ?? "評価期間"} ／ 全{form.questionCount}問
      </p>
      {form.deadlineLabel && (
        <p className="m-0 mt-3 text-note">
          回答締切：<strong>{form.deadlineLabel}</strong>
          {form.daysUntilDeadline !== null && (
            <span className="text-[var(--ink-muted)]">
              {form.daysUntilDeadline === 0 ? "（本日）" : `（あと${form.daysUntilDeadline}日）`}
            </span>
          )}
        </p>
      )}
      <div className="card-foot">
        <LinkButton href={`/me/forms/${form.formId}`} variant={primary ? "primary" : "secondary"}>
          {form.responseStatus === "draft" ? "続きから回答する" : "回答を始める"}
        </LinkButton>
      </div>
    </Card>
  );
}

function ResultBadges({ result }: { result: MyResultSummary }) {
  return (
    <div className="flex flex-wrap gap-2">
      {result.raiseEligible ? <Badge tone="active">昇給の要件を満たす</Badge> : <Badge tone="done">評価確定</Badge>}
      {result.promotionEligible && <Badge tone="active">昇格の要件を満たす</Badge>}
    </div>
  );
}

export function MyDashboard({
  viewerName,
  cycleName,
  actionableForms,
  latestSubmittedForm,
  results,
  gradeAssigned,
}: {
  viewerName: string;
  cycleName: string | null;
  actionableForms: MyActionForm[];
  latestSubmittedForm: { formId: string; title: string } | null;
  results: MyResultSummary[];
  gradeAssigned: boolean;
}) {
  const latest = results[0] ?? null;
  const previous = results.slice(1);

  return (
    <>
      <PageTitle
        title={`${viewerName} さんの評価ページ`}
        lede={cycleName ? `${cycleName}の回答と、自分に公開された評価結果を確認できます。` : "回答するアンケートと、自分に公開された評価結果を確認できます。"}
      />

      <SectionHeading>今やること</SectionHeading>
      {actionableForms.length > 0 ? (
        <div className="card-grid">
          {actionableForms.map((form, index) => (
            <FormActionCard key={form.formId} form={form} primary={index === 0} />
          ))}
        </div>
      ) : latestSubmittedForm ? (
        <Card className="card-pad hero-tint">
          <CardHead
            title={
              <>
                {latestSubmittedForm.title} <Badge tone="done">提出済み</Badge>
              </>
            }
            sub="提出は完了しています。評価が確定すると、この下に結果が表示されます。"
            actions={<LinkButton href={`/me/forms/${latestSubmittedForm.formId}`}>提出した内容を見る</LinkButton>}
          />
        </Card>
      ) : (
        <EmptyState
          title="いま回答するアンケートはありません"
          body={
            gradeAssigned
              ? "新しいアンケートが公開されると、ここに回答ボタンと締切が表示されます。"
              : "等級が設定されていないため、アンケートが割り当てられていません。会社の管理者に確認してください。"
          }
          action={<LinkButton href="/me/forms">アンケート一覧を見る</LinkButton>}
        />
      )}

      <SectionHeading aside={results.length > 0 && <Link href="/me/results" className="footnote">すべての結果を見る</Link>}>
        自分の結果
      </SectionHeading>
      {!latest ? (
        <EmptyState
          title="確定した評価はまだありません"
          body="上長の確認が済んで評価が確定すると、結果と理由をここから確認できます。"
        />
      ) : (
        <Card className="card-pad">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <p className="m-0 text-note text-[var(--ink-muted)]">最新の評価</p>
              <p className="todo-row-title m-0 mt-1 text-head">{latest.cycleName ?? "評価結果"}</p>
              <p className="todo-row-sub m-0">{latest.gradeName ?? "等級未設定"}</p>
              {latest.requirementRate !== null ? (
                <div className="mt-4 max-w-xl">
                  <Bar value={latest.requirementRate} max={100} label="等級要件の達成率（%）" />
                  <p className="m-0 mt-1 text-sub">
                    <Num value={latest.requirementAchieved} /> / <Num value={latest.requirementTotal} /> 項目を達成
                  </p>
                </div>
              ) : (
                <p className="footnote m-0 mt-3">等級要件の達成率は判定対象外です。</p>
              )}
              <div className="mt-3"><ResultBadges result={latest} /></div>
            </div>
            <LinkButton href={`/me/results/${latest.id}`} variant="primary">結果と理由を見る</LinkButton>
          </div>

          {previous.length > 0 && (
            <details className="disclosure mt-5">
              <summary>過去の結果を見る（{previous.length}件）</summary>
              <div className="disclosure-body p-0 text-[var(--ink)]">
                {previous.map((result) => (
                  <CardRow
                    key={result.id}
                    title={
                      <Link href={`/me/results/${result.id}`} className="text-[var(--brand-deep)]">
                        {result.cycleName ?? "評価結果"}
                      </Link>
                    }
                    sub={
                      <>
                        {result.gradeName ?? "等級未設定"} ／ 等級要件の達成率 <Num value={result.requirementRate} unit="%" />
                      </>
                    }
                    marks={<ResultBadges result={result} />}
                  />
                ))}
              </div>
            </details>
          )}
        </Card>
      )}

      <details className="disclosure mt-5">
        <summary>この画面に表示される内容</summary>
        <div className="disclosure-body">
          アンケートは入力途中でも自動保存されます。評価結果には結論だけでなく、判定の理由と自分が提出した回答も残ります。評価基準の配点や昇格に必要な点数は表示されません。
        </div>
      </details>
    </>
  );
}
