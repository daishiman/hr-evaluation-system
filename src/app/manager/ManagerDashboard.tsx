import Link from "next/link";
import { StalledEvaluationsNotice } from "@/components/StalledEvaluationsNotice";
import { Badge, Bar, Card, CardRow, Disclosure, EmptyState, LinkButton, PageTitle, SectionHeading } from "@/components/ui";
import type { StalledRow } from "@/lib/domain/stalled-evaluations";
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
    label: "評価・結果を確認する",
  };
}

export function ManagerDashboard({
  viewerName,
  cycle,
  stalled = [],
  draftEvaluations,
  readyToBuild,
  team,
}: {
  viewerName: string;
  cycle: ManagerCycleSummary | null;
  /** 締め切った期間に残っている、確定されていない評価（自分が上長のメンバーの分だけ） */
  stalled?: StalledRow[];
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
      {/* 期の名前と日付を1文に詰めない。
          文は「何を表示しているか」だけにして、どの期か・いつからいつまでかは
          見出しの脇の札（tags）に出す。情報は減らさず、読む単位を分ける。 */}
      <PageTitle
        title={`${viewerName} さんの管理ページ`}
        lede={
          cycle
            ? "いま進行中の評価期間で、次にやることを表示しています。"
            : "進行中の評価期間が始まると、確認する作業がここに表示されます。"
        }
        tags={
          cycle ? (
            <>
              <span className="tag">{cycle.name}</span>
              <span className="tag">{formatPeriod(cycle.periodStart, cycle.periodEnd)}</span>
            </>
          ) : undefined
        }
      />

      {/* 締め切った期間の置き去りは、下の「次にやること」（開いている期間だけを見る）には
          絶対に出てこない。気づける唯一の場所なので、いちばん上に置く。 */}
      {stalled.length > 0 && (
        <>
          <SectionHeading>締め切った期間に残っている評価</SectionHeading>
          <StalledEvaluationsNotice rows={stalled} moreHref="/manager/cycles" />
        </>
      )}

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
              <p className="todo-row-title m-0 text-head">{next.title}</p>
              <p className="todo-row-sub m-0 mt-1">{next.body}</p>
              <p className="m-0 mt-3 text-note">
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
            <CardRow
              key={evaluation.id}
              title={
                <Link href={`/manager/evaluations/${evaluation.id}`} className="text-[var(--brand-deep)]">
                  {evaluation.employeeName ?? "氏名未設定"}
                </Link>
              }
              sub={evaluation.gradeName ?? "等級未設定"}
              marks={<Badge tone="required">確認・確定が必要</Badge>}
            />
          ))}
          {draftEvaluations.length > 5 && (
            <div className="card-row">
              <p className="footnote m-0">ほか {draftEvaluations.length - 5}件は「評価・結果を確認する」で確認できます。</p>
            </div>
          )}
        </Card>
      )}

      <SectionHeading aside={<Link href="/manager/members" className="footnote">メンバー</Link>}>
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

          <div className="mt-4">
            <Disclosure summary="メンバー別の状況を見る" meta={`${team.length}人`}>
              <div className="p-0 text-[var(--ink)]">
                {team.map((member) => (
                  <CardRow
                    key={member.id}
                    title={
                      <Link href={`/manager/members/${member.id}`} className="text-[var(--brand-deep)]">
                        {member.name}
                      </Link>
                    }
                    sub={`${member.gradeName ?? "等級未設定"} ／ ${member.department ?? "所属未設定"}`}
                    marks={
                      member.responseStatus === "submitted" ? (
                        <Badge tone="done">提出済み</Badge>
                      ) : member.responseStatus === "draft" ? (
                        <Badge tone="active">入力途中</Badge>
                      ) : member.responseStatus === "none" ? (
                        <Badge tone="required">未着手</Badge>
                      ) : (
                        <Badge tone="closed">対象アンケートなし</Badge>
                      )
                    }
                  />
                ))}
              </div>
            </Disclosure>
          </div>
        </Card>
      )}

      <div className="mt-5">
        <Disclosure summary="マネージャーができること">
          <p className="m-0">回答から評価を作成し、内容を確認して確定できます。</p>
          <p className="m-0 mt-1">等級要件・配点・昇格条件の変更は会社の管理者が行います。</p>
        </Disclosure>
      </div>
    </>
  );
}
