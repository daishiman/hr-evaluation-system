import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCycles, listEvaluations, listMembers } from "@/lib/queries";
import { listPendingRespondents } from "@/lib/evaluate";
import { detectStaleCycles } from "@/lib/impact";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, CardRow, ChipLink, DownloadButton, EmptyState, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { CYCLE_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 評価サイクルの進行状況。
 * 「誰が未提出か → 評価を作る → 一件ずつ確認して確定する」の順に並べる。
 */
export default async function ManagerCycles({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const viewer = await requireRole("MANAGER");
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

  const [allPending, allEvals, staleCycles, assignedMembers] = await Promise.all([
    listPendingRespondents(companyId, selected.id),
    listEvaluations(companyId, viewer.role, { cycleId: selected.id }),
    detectStaleCycles(companyId),
    viewer.role === "MANAGER" ? listMembers(companyId, { managerId: viewer.id }) : Promise.resolve([]),
  ]);
  const assignedIds =
    viewer.role === "MANAGER" ? new Set(assignedMembers.map((member) => member.id)) : null;
  const pending = assignedIds ? allPending.filter((row) => assignedIds.has(row.id)) : allPending;
  const evals = assignedIds ? allEvals.filter((row) => assignedIds.has(row.employeeId)) : allEvals;
  const stale = staleCycles.find((c) => c.cycleId === selected.id);
  const submitted = pending.filter((p) => p.status === "submitted");
  const notSubmitted = pending.filter((p) => p.status !== "submitted");
  const drafts = evals.filter((e) => e.status !== "finalized");

  return (
    <>
      <PageTitle
        title="評価・結果を確認する"
        lede="半期ごとに、提出されたアンケートから評価を作り、内容を確認して確定します。"
      />

      <SectionHeading>期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <ChipLink
            key={c.id}
            href={`/manager/cycles?cycle=${c.id}`} current={c.id === selected.id}
          >
            {c.name}
          </ChipLink>
        ))}
      </div>

      <Card className="card-pad hero-tint">
        <p className="m-0 text-note text-ink-muted">
          {formatPeriod(selected.periodStart, selected.periodEnd)} ／ {CYCLE_STATUS_LABEL[selected.status] ?? selected.status}
        </p>
        <p className="num-display m-0 text-hero-sp leading-tight text-accent">
          {submitted.length}
          <span className="unit"> / {pending.length} 人が提出済み</span>
        </p>
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
                  url="/api/evaluations/build"
                  body={{ cycleId: selected.id }}
                  label="いまの基準で集計し直す"
                  confirm={`確認中の${stale.recomputable}件を、いまの基準・配点で計算し直します。確定済みの評価は変わりません。よろしいですか？`}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      <SectionHeading>未提出の方</SectionHeading>
      {notSubmitted.length === 0 ? (
        <p className="footnote">全員の提出が終わっています。</p>
      ) : (
        <Card>
          {notSubmitted.map((p) => (
            <CardRow
              key={p.id}
              title={p.name}
              sub={p.status === "draft" ? "入力途中です。提出まで進んでいません。" : "まだ入力を始めていません。"}
              marks={<Badge tone="required">未提出</Badge>}
            />
          ))}
        </Card>
      )}

      <SectionHeading>評価を作る</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-sub">
          提出済みの{submitted.length}人分について、回答から評価を計算します。すでに確定した評価は作り直しません。
        </p>
        <div className="mt-3">
          <ActionButton
            url="/api/evaluations/build"
            body={{ cycleId: selected.id }}
            label="提出済みの回答から評価を作る"
            confirm={`提出済み${submitted.length}人分の評価を作り直します。確認中の評価があれば、最新の回答で上書きされます。よろしいですか？`}
          />
        </div>
        {submitted.length === 0 && (
          <div className="mt-3">
            <ReasonNote>提出済みの回答がないため、まだ評価を作れません。</ReasonNote>
          </div>
        )}
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
    raiseEligible: boolean | null;
    promotionEligible: boolean | null;
    totalScore: number | null;
    status: string;
  };
}) {
  return (
    <CardRow
      title={
        <Link href={`/manager/evaluations/${e.id}`} className="text-brand-deep">
          {e.employeeName}
        </Link>
      }
      sub={
        <>
          {e.gradeName} ／ {e.raiseEligible ? "昇給の要件を満たしています" : "昇給は見送り"}
          {e.promotionEligible ? " ／ 昇格の要件も満たしています" : ""}
        </>
      }
      value={
        <>
          <Num value={e.totalScore} display />
          <span className="unit">点</span>
        </>
      }
      marks={e.status === "finalized" ? <Badge tone="done">確定済み</Badge> : <Badge tone="active">確認中</Badge>}
    />
  );
}
