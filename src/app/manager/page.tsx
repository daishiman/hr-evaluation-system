import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getOpenCycle, listCycles, listEvaluations, listMembers } from "@/lib/queries";
import { listPendingRespondents } from "@/lib/evaluate";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";
import { formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * マネージャーのホーム。
 * 並びは「いま要対応 → 次のアクション → 最近の動き → キー数字」。
 * マネージャーは制度の設定（等級要件・配点）を変更できない。閲覧だけ。
 */
export default async function ManagerHome() {
  const viewer = await requireRole("MANAGER");
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="システム全体管理者にご連絡ください。" />;
  }
  const companyId = viewer.companyId;

  const [openCycle, cycles, members] = await Promise.all([
    getOpenCycle(companyId),
    listCycles(companyId),
    listMembers(companyId),
  ]);
  const latestClosed = cycles.find((c) => c.status === "closed") ?? null;

  const pending = openCycle ? await listPendingRespondents(companyId, openCycle.id) : [];
  const notSubmitted = pending.filter((p) => p.status !== "submitted");

  const evals = openCycle ? await listEvaluations(companyId, { cycleId: openCycle.id }) : [];
  const drafts = evals.filter((e) => e.status !== "finalized");

  const lastEvals = latestClosed ? await listEvaluations(companyId, { cycleId: latestClosed.id }) : [];
  const raise = lastEvals.filter((e) => e.raiseEligible).length;
  const promo = lastEvals.filter((e) => e.promotionEligible).length;

  return (
    <>
      <PageTitle
        title={`${viewer.name} さんの管理ページ`}
        lede={
          openCycle
            ? `進行中の評価期間は「${openCycle.name}」（${formatPeriod(openCycle.periodStart, openCycle.periodEnd)}）です。`
            : "いま進行中の評価期間はありません。"
        }
      />

      <SectionHeading>いま対応すること</SectionHeading>
      {!openCycle ? (
        <EmptyState
          title="進行中の評価期間がありません"
          body="会社の管理者が新しい評価期間を開始すると、ここに回答状況が並びます。"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-pad">
            <p className="todo-row-title m-0">アンケートが未提出の方</p>
            <p className="hero-number num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
              {notSubmitted.length}
              <span className="unit">人</span>
            </p>
            <p className="todo-row-sub m-0 mt-1">
              {notSubmitted.length === 0
                ? "全員の提出が終わっています。評価を作成できます。"
                : notSubmitted
                    .slice(0, 4)
                    .map((p) => p.name)
                    .join("、") + (notSubmitted.length > 4 ? " ほか" : "")}
            </p>
          </Card>
          <Card className="card-pad">
            <p className="todo-row-title m-0">確認待ちの評価</p>
            <p className="hero-number num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
              {drafts.length}
              <span className="unit">件</span>
            </p>
            <p className="todo-row-sub m-0 mt-1">
              内容を確認して確定すると、本人の画面に結果が表示されます。
            </p>
            <div className="mt-3">
              <LinkButton href="/manager/cycles" variant="primary">
                評価を作成・確認する
              </LinkButton>
            </div>
          </Card>
        </div>
      )}

      <SectionHeading aside={<Link href="/manager/members" className="footnote">すべて見る</Link>}>
        メンバー
      </SectionHeading>
      {members.length === 0 ? (
        <EmptyState title="メンバーが登録されていません" body="会社の管理者に社員の登録を依頼してください。" />
      ) : (
        <Card>
          {members.slice(0, 6).map((m) => (
            <div key={m.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/manager/members/${m.id}`} className="text-[var(--brand-deep)]">
                    {m.name}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">
                  {m.gradeName ?? "等級未設定"} ／ {m.department ?? "所属未設定"}
                </p>
              </div>
              {!m.isActive && <Badge tone="closed">利用停止</Badge>}
            </div>
          ))}
        </Card>
      )}

      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label">担当メンバー</div>
          <div className="kpi-value">
            <Num value={members.filter((m) => m.role === "EMPLOYEE").length} unit="人" />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">前期に昇給要件を満たした方</div>
          <div className="kpi-value">
            <Num value={raise} unit="人" />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">前期に昇格要件を満たした方</div>
          <div className="kpi-value">
            <Num value={promo} unit="人" />
          </div>
        </div>
      </div>
      <p className="footnote mt-3">
        等級要件・配点・昇格に必要な点数の変更は、会社の管理者のみが行えます。マネージャーは「評価基準を確認する」から内容を確認できます。
      </p>
    </>
  );
}
