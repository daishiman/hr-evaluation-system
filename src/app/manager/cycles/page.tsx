import Link from "next/link";
import { requireRoute } from "@/lib/session";
import { listCycles, listEvaluations, listMembers } from "@/lib/queries";
import { listCycleSubmissionRows } from "@/lib/submission-queries";
import { SUBMISSION_STATE_LABEL, countSubmissions, parseSubmissionFilter } from "@/lib/domain/submission-status";
import { detectStaleCycles } from "@/lib/impact";
import { ActionButton } from "@/components/ActionButton";
import { DecisionBadge } from "@/components/DecisionBadge";
import { SubmissionStatusTable } from "@/components/SubmissionStatusTable";
import {
  Badge,
  Card,
  CardRow,
  ChipLink,
  DownloadButton,
  EmptyState,
  Num,
  PageTitle,
  ReasonNote,
  SectionHeading,
  SplitRow,
} from "@/components/ui";
import { CYCLE_STATUS_LABEL, formatPeriod } from "@/lib/view";
import { buildEvaluations } from "@/actions/evaluations";
import type { DecisionKind } from "@/lib/domain/final-decision";

export const dynamic = "force-dynamic";

/**
 * 評価サイクルの進行状況。
 * 「誰が未提出か → 評価を作る → 一件ずつ確認して確定する」の順に並べる。
 */
export default async function ManagerCycles({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; status?: string }>;
}) {
  const viewer = await requireRoute("/manager/cycles");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const cycles = await listCycles(companyId);
  if (cycles.length === 0) {
    return (
      <>
        <PageTitle title="評価・結果を確認する" />
        <EmptyState
          title="評価期間がまだありません"
          body="会社の管理者が評価期間を作ると、ここに回答状況と評価の作成ボタンが並びます。"
        />
      </>
    );
  }

  const sp = await searchParams;
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];

  const [submission, allEvals, staleCycles, assignedMembers] = await Promise.all([
    listCycleSubmissionRows(companyId, selected.id),
    listEvaluations(companyId, viewer.role, { cycleId: selected.id }),
    detectStaleCycles(companyId),
    viewer.role === "MANAGER" ? listMembers(companyId, { managerId: viewer.id }) : Promise.resolve([]),
  ]);
  const assignedIds =
    viewer.role === "MANAGER" ? new Set(assignedMembers.map((member) => member.id)) : null;
  // マネージャーは担当の部下の行だけを出し、件数もその範囲で数え直す
  const respondents = assignedIds
    ? submission.rows.filter((row) => assignedIds.has(row.employeeId))
    : submission.rows;
  const counts = countSubmissions(respondents);
  const filter = parseSubmissionFilter(sp.status);
  const evals = assignedIds ? allEvals.filter((row) => assignedIds.has(row.employeeId)) : allEvals;
  const stale = staleCycles.find((c) => c.cycleId === selected.id);
  const submitted = respondents.filter((p) => p.state === "submitted");
  const drafts = evals.filter((e) => e.status !== "finalized");

  return (
    <>
      <PageTitle
        title="評価・結果を確認する"
        lede="半期ごとに、提出されたアンケートから評価を作り、内容を確認して確定します。"
      />

      {/* 期間の札は見出しの右に並べる。見出しの下に1行で置くと、札の右側が空いたまま残る（§28-9） */}
      <SectionHeading
        aside={
          <div className="flex flex-wrap justify-end gap-2" role="group" aria-label="期間を選ぶ">
            {cycles.map((c) => (
              <ChipLink key={c.id} href={`/manager/cycles?cycle=${c.id}`} current={c.id === selected.id}>
                {c.name}
              </ChipLink>
            ))}
          </div>
        }
      >
        期間を選ぶ
      </SectionHeading>

      {/* 左に「提出済みの人数」、右にまだ出ていない人の内訳。大きな数字だけを左に置くと右半分が空く */}
      <Card className="card-pad hero-tint">
        <SplitRow
          aside={
            counts.total > 0 && (
              <p className="m-0 text-sub">
                {SUBMISSION_STATE_LABEL.draft} <Num value={counts.draft} unit="人" /> ／ {SUBMISSION_STATE_LABEL.none}{" "}
                <Num value={counts.none} unit="人" />
              </p>
            )
          }
        >
          <p className="m-0 text-note text-ink-muted">
            {formatPeriod(selected.periodStart, selected.periodEnd)} ／ {CYCLE_STATUS_LABEL[selected.status] ?? selected.status}
          </p>
          <p className="num-display m-0 text-hero-sp leading-tight text-accent">
            {counts.submitted}
            <span className="unit"> / {counts.total} 人が提出済み</span>
          </p>
        </SplitRow>
      </Card>

      {stale && (
        <div className="mt-4">
          <Card className="card-pad">
            <p className="m-0 text-sub font-bold">この期の評価は、いまの基準より古い可能性があります</p>
            <p className="m-0 mt-1 text-sub">
              最後に集計したあとに、次のものが変わりました：{stale.changed.slice(0, 3).map((c) => c.label).join("／")}
              {stale.changed.length > 3 ? ` ほか${stale.changed.length - 3}件` : ""}。
            </p>
            <p className="footnote m-0 mt-1">
              集計し直せるのは確認中の{stale.recomputable}件です。
              {stale.finalized > 0 && `確定済みの${stale.finalized}件は、判定した当時の基準のまま据え置きます。`}
            </p>
            {stale.recomputable > 0 && (
              <div className="mt-3">
                <ActionButton
                  action={buildEvaluations}
                  resource="evaluations"
                  input={{ cycleId: selected.id }}
                  label="いまの基準で集計し直す"
                  confirm={`確認中の${stale.recomputable}件を、いまの基準・配点で計算し直します。確定済みの評価は変わりません。よろしいですか？`}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 未提出の人だけでなく対象者全員を並べ、状態（?status=）で絞る。
          評価期間の選択（?cycle=）は絞り込みのリンクにも残す。 */}
      <SectionHeading>提出の状況</SectionHeading>
      {counts.total === 0 ? (
        <p className="footnote">この期間のアンケートの対象になる方がいません。</p>
      ) : (
        <SubmissionStatusTable
          caption="対象者と提出の状況"
          rows={respondents}
          counts={counts}
          filter={filter}
          filterHref={(f) => `/manager/cycles?cycle=${selected.id}${f === "all" ? "" : `&status=${f}`}`}
          columns={[{ key: "grade", header: "等級", cell: (r) => r.gradeName ?? "—" }]}
        />
      )}

      <SectionHeading>評価を作る</SectionHeading>
      <Card className="card-pad">
        {/* 説明と止まっている理由を左、押すものを右に置く（ボタンを説明の下に積むと右が空く） */}
        <SplitRow
          aside={
            <ActionButton
              action={buildEvaluations}
              resource="evaluations"
              input={{ cycleId: selected.id }}
              label="提出済みの回答から評価を作る"
              confirm={`提出済み${submitted.length}人分の評価を作り直します。確認中の評価があれば、最新の回答で上書きされます。よろしいですか？`}
            />
          }
        >
          <p className="m-0 text-sub">
            提出済みの{submitted.length}人分について、回答から評価を計算します。すでに確定した評価は作り直しません。
          </p>
          {submitted.length === 0 && (
            <div className="mt-3">
              <ReasonNote>提出済みの回答がないため、まだ評価を作れません。</ReasonNote>
            </div>
          )}
        </SplitRow>
      </Card>

      <SectionHeading
        aside={
          evals.length > 0 ? (
            <span className="flex flex-wrap gap-2">
              <DownloadButton href={`/api/export?type=results&cycleId=${selected.id}`} variant="tertiary">
                評価結果をCSVに書き出す
              </DownloadButton>
              <DownloadButton href={`/api/export?type=kpi&cycleId=${selected.id}`} variant="tertiary">
                KPI明細をCSVに書き出す
              </DownloadButton>
            </span>
          ) : (
            <span className="footnote">確認して確定すると本人に公開されます</span>
          )
        }
      >
        この期の評価（{evals.length}件）
      </SectionHeading>
      {evals.length === 0 ? (
        <EmptyState title="この期の評価はまだありません" body="上の「提出済みの回答から評価を作る」を押してください。" />
      ) : (
        <>
          {/* 確認中を先に、確定済みをあとに分ける。混ぜて並べると、
              件数が増えたときにどれがまだ手つかずか一覧から探す羽目になる。 */}
          {drafts.length > 0 && (
            <>
              <p className="footnote m-0 mb-2">確認中（{drafts.length}件）</p>
              <Card className="mb-4">
                {drafts.map((e) => (
                  <EvaluationRow key={e.id} evaluation={e} />
                ))}
              </Card>
            </>
          )}
          {evals.length > drafts.length && (
            <>
              <p className="footnote m-0 mb-2">確定済み（{evals.length - drafts.length}件）</p>
              <Card>
                {evals
                  .filter((e) => e.status === "finalized")
                  .map((e) => (
                    <EvaluationRow key={e.id} evaluation={e} />
                  ))}
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}

function EvaluationRow({
  evaluation: e,
}: {
  evaluation: {
    id: string;
    employeeName: string | null;
    gradeName: string | null;
    raiseEligible: boolean;
    promotionEligible: boolean;
    raiseDecision: DecisionKind | null;
    raiseDecisionReason: string | null;
    promotionDecision: DecisionKind | null;
    promotionDecisionReason: string | null;
    totalScore: number | null;
    status: string;
  };
}) {
  const finalized = e.status === "finalized";
  return (
    <CardRow
      title={
        <Link href={`/manager/evaluations/${e.id}`} className="text-brand-deep">
          {e.employeeName}
        </Link>
      }
      sub={
        // 等級と2つの結論は横に並べ、狭いときだけ折り返す（縦に積むと左の列だけが伸び、右が空く。A12）
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {e.gradeName && <span>{e.gradeName}</span>}
          {/* 結論は final-decision.ts だけで出す（DD-024）。一覧では理由を畳み、詳細で読む */}
          <DecisionBadge
            subject="raise"
            scoreJudgement={e.raiseEligible}
            decision={e.raiseDecision}
            reason={e.raiseDecisionReason}
            finalized={finalized}
            compact
          />
          <DecisionBadge
            subject="promotion"
            scoreJudgement={e.promotionEligible}
            decision={e.promotionDecision}
            reason={e.promotionDecisionReason}
            finalized={finalized}
            compact
          />
        </span>
      }
      // 状態の札は点数の下に積む。点数と札を横に並べた1段では、名前と結論の2行のうち真ん中しか覆えず、上下の右が空く（A12）
      value={
        <>
          <Num value={e.totalScore} display />
          <span className="unit">点</span>
          <span className="mt-1 block">
            {finalized ? <Badge tone="done">確定済み</Badge> : <Badge tone="active">確認中</Badge>}
          </span>
        </>
      }
    />
  );
}
