import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCycles, listEvaluations } from "@/lib/queries";
import { listPendingRespondents } from "@/lib/evaluate";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, EmptyState, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
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
        <PageTitle title="評価サイクル" />
        <EmptyState
          title="評価期間がまだありません"
          body="会社の管理者が評価期間を作ると、ここに回答状況と評価の作成ボタンが並びます。"
        />
      </>
    );
  }

  const sp = await searchParams;
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];

  const [pending, evals] = await Promise.all([
    listPendingRespondents(companyId, selected.id),
    listEvaluations(companyId, { cycleId: selected.id }),
  ]);
  const submitted = pending.filter((p) => p.status === "submitted");
  const notSubmitted = pending.filter((p) => p.status !== "submitted");
  const drafts = evals.filter((e) => e.status !== "finalized");

  return (
    <>
      <PageTitle
        title="評価サイクル"
        lede="半期ごとに、提出されたアンケートから評価を作り、内容を確認して確定します。"
      />

      <SectionHeading>期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <Link
            key={c.id}
            href={`/manager/cycles?cycle=${c.id}`}
            className={c.id === selected.id ? "chip" : "chip"}
            aria-pressed={c.id === selected.id}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="card-pad hero-tint">
        <p className="m-0 text-[12px] text-[var(--ink-muted)]">
          {formatPeriod(selected.periodStart, selected.periodEnd)} ／ {CYCLE_STATUS_LABEL[selected.status] ?? selected.status}
        </p>
        <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
          {submitted.length}
          <span className="unit"> / {pending.length} 人が提出済み</span>
        </p>
      </Card>

      <SectionHeading>未提出の方</SectionHeading>
      {notSubmitted.length === 0 ? (
        <p className="footnote">全員の提出が終わっています。</p>
      ) : (
        <Card>
          {notSubmitted.map((p) => (
            <div key={p.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">{p.name}</p>
                <p className="todo-row-sub m-0">
                  {p.status === "draft" ? "入力途中です。提出まで進んでいません。" : "まだ入力を始めていません。"}
                </p>
              </div>
              <Badge tone="required">未提出</Badge>
            </div>
          ))}
        </Card>
      )}

      <SectionHeading>評価を作る</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 text-[13px]">
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

      <SectionHeading aside={<span className="footnote">確認して確定すると本人に公開されます</span>}>
        この期の評価（{evals.length}件・うち確認中 {drafts.length}件）
      </SectionHeading>
      {evals.length === 0 ? (
        <EmptyState title="この期の評価はまだありません" body="上の「提出済みの回答から評価を作る」を押してください。" />
      ) : (
        <Card>
          {evals.map((e) => (
            <div key={e.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/manager/evaluations/${e.id}`} className="text-[var(--brand-deep)]">
                    {e.employeeName}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">
                  {e.gradeName} ／ {e.raiseEligible ? "昇給の要件を満たしています" : "昇給は見送り"}
                  {e.promotionEligible ? " ／ 昇格の要件も満たしています" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Num value={e.totalScore} display />
                <span className="unit">点</span>
              </div>
              {e.status === "finalized" ? <Badge tone="done">確定済み</Badge> : <Badge tone="active">確認中</Badge>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
