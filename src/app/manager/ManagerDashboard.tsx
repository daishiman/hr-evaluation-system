import Link from "next/link";
import { Badge, Bar, Card, EmptyState, LinkButton, PageTitle, SectionHeading } from "@/components/ui";
import { formatPeriod } from "@/lib/view";

export interface ManagerCycleSummary {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  deadlineLabel: string;
  daysUntilDeadline: number | null;
}

export interface ManagerEvaluationSummary {
  id: string;
  employeeName: string | null;
  gradeName: string | null;
}

export interface TeamMemberSummary {
  id: string;
  name: string;
  gradeName: string | null;
  department: string | null;
  responseStatus: string | null;
}

export function managerNextAction(input: {
  draftEvaluations: number;
  readyToBuild: number;
  teamNotSubmitted: number;
}): { title: string; body: string; label: string } {
  if (input.draftEvaluations > 0) {
    return {
      title: `未確定の評価が${input.draftEvaluations}件あります`,
      body: "内容を確認して確定すると、本人に結果が表示されます。",
      label: "未確定の評価を確認する",
    };
  }
  if (input.readyToBuild > 0) {
    return {
      title: `${input.readyToBuild}人分の評価を作成できます`,
      body: "提出済みの回答から評価を作り、内容の確認へ進んでください。",
      label: "評価を作成する",
    };
  }
  if (input.teamNotSubmitted > 0) {
    return {
      title: `チームの未提出が${input.teamNotSubmitted}人です`,
      body: "締切を確認し、必要な方に提出を案内してください。",
      label: "回答状況を確認する",
    };
  }
  return {
    title: "いま急いで対応する作業はありません",
    body: "新しい提出や確認待ちの評価が入ると、ここに次の作業が表示されます。",
    label: "評価サイクルを見る",
  };
}

export function ManagerDashboard({
  viewerName,
  cycle,
  draftEvaluations,
  readyToBuild,
  team,
}: {
  viewerName: string;
  cycle: ManagerCycleSummary | null;
  draftEvaluations: ManagerEvaluationSummary[];
  readyToBuild: number;
  team: TeamMemberSummary[];
}) {
  const teamWithForm = team.filter((member) => member.responseStatus !== null);
  const submitted = teamWithForm.filter((member) => member.responseStatus === "submitted").length;
  const notSubmitted = teamWithForm.length - submitted;
  const missingGrade = team.filter((member) => !member.gradeName).length;
  const next = managerNextAction({
    draftEvaluations: draftEvaluations.length,
    readyToBuild,
    teamNotSubmitted: notSubmitted,
  });
  const cycleHref = cycle ? `/manager/cycles?cycle=${cycle.id}` : "/manager/cycles";

  return (
    <>
      <PageTitle
        title={`${viewerName} さんの管理ページ`}
        lede={
          cycle
            ? `${cycle.name}（${formatPeriod(cycle.periodStart, cycle.periodEnd)}）の次の作業を表示しています。`
            : "進行中の評価期間が始まると、確認する作業がここに表示されます。"
        }
      />

      <SectionHeading>次にやること</SectionHeading>
      {!cycle ? (
        <EmptyState
          title="進行中の評価期間がありません"
          body="会社の管理者が新しい評価期間を開始すると、回答状況と評価の確認が始まります。"
        />
      ) : (
        <Card className="card-pad hero-tint">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="todo-row-title m-0 text-[16px]">{next.title}</p>
              <p className="todo-row-sub m-0 mt-1">{next.body}</p>
              <p className="m-0 mt-3 text-[12px]">
                回答締切：<strong>{cycle.deadlineLabel}</strong>
                {cycle.daysUntilDeadline !== null && (
                  <span className="text-[var(--ink-muted)]">
                    {cycle.daysUntilDeadline === 0 ? "（本日）" : `（あと${cycle.daysUntilDeadline}日）`}
                  </span>
                )}
              </p>
            </div>
            <LinkButton href={cycleHref} variant="primary">{next.label}</LinkButton>
          </div>
        </Card>
      )}

      <SectionHeading aside={cycle && <Link href={cycleHref} className="footnote">サイクル全体を見る</Link>}>
        未確定の評価
      </SectionHeading>
      {draftEvaluations.length === 0 ? (
        <p className="footnote">現在、確認待ちの評価はありません。</p>
      ) : (
        <Card>
          {draftEvaluations.slice(0, 5).map((evaluation) => (
            <div key={evaluation.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/manager/evaluations/${evaluation.id}`} className="text-[var(--brand-deep)]">
                    {evaluation.employeeName ?? "氏名未設定"}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">{evaluation.gradeName ?? "等級未設定"}</p>
              </div>
              <Badge tone="required">確認・確定が必要</Badge>
            </div>
          ))}
          {draftEvaluations.length > 5 && (
            <div className="card-row">
              <p className="footnote m-0">ほか {draftEvaluations.length - 5}件は評価サイクルで確認できます。</p>
            </div>
          )}
        </Card>
      )}

      <SectionHeading aside={<Link href="/manager/members" className="footnote">メンバーを見る</Link>}>
        チームの状況
      </SectionHeading>
      {team.length === 0 ? (
        <EmptyState
          title="担当メンバーが設定されていません"
          body="会社の管理者に、メンバーの上長設定を確認してもらってください。"
        />
      ) : (
        <Card className="card-pad">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <p className="todo-row-title m-0">アンケートの提出状況</p>
              <div className="mt-3">
                <Bar value={submitted} max={teamWithForm.length} label="チームの提出" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {notSubmitted > 0 ? <Badge tone="required">未提出 {notSubmitted}人</Badge> : <Badge tone="done">全員提出済み</Badge>}
              {missingGrade > 0 && <Badge tone="alert">等級未設定 {missingGrade}人</Badge>}
            </div>
          </div>

          <details className="disclosure mt-4">
            <summary>メンバー別の状況を見る（{team.length}人）</summary>
            <div className="disclosure-body p-0 text-[var(--ink)]">
              {team.map((member) => (
                <div key={member.id} className="card-row">
                  <div className="row-main">
                    <p className="todo-row-title m-0">
                      <Link href={`/manager/members/${member.id}`} className="text-[var(--brand-deep)]">
                        {member.name}
                      </Link>
                    </p>
                    <p className="todo-row-sub m-0">
                      {member.gradeName ?? "等級未設定"} ／ {member.department ?? "所属未設定"}
                    </p>
                  </div>
                  {member.responseStatus === "submitted" ? (
                    <Badge tone="done">提出済み</Badge>
                  ) : member.responseStatus === "draft" ? (
                    <Badge tone="active">入力途中</Badge>
                  ) : member.responseStatus === "none" ? (
                    <Badge tone="required">未着手</Badge>
                  ) : (
                    <Badge tone="closed">対象アンケートなし</Badge>
                  )}
                </div>
              ))}
            </div>
          </details>
        </Card>
      )}

      <details className="disclosure mt-5">
        <summary>マネージャーができること</summary>
        <div className="disclosure-body">
          回答から評価を作成し、内容を確認して確定できます。等級要件・配点・昇格条件の変更は会社の管理者が行います。
        </div>
      </details>
    </>
  );
}
