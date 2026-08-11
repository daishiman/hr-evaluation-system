import Link from "next/link";
import { canSeeCriteria, requireViewer } from "@/lib/session";
import { listEvaluations } from "@/lib/queries";
import { Badge, Card, CardRow, EmptyState, Num, PageTitle, SectionHeading } from "@/components/ui";
import { TrendChart } from "@/components/LazyCharts";
import { formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/** 自分の評価の履歴と推移。過去のサイクルは消さずに全部残す。 */
export default async function MyResults() {
  const viewer = await requireViewer();
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="会社の管理者にご確認ください。" />;

  const all = (await listEvaluations(viewer.companyId, viewer.role, { employeeId: viewer.id })).filter((e) => e.status === "finalized");

  // 行動指針の点数は「昇格に必要な点数」が逆算できるため、一般の方には返していない。
  // 返ってこない系列をグラフに置くと空の折れ線と凡例だけが残るので、見える人にだけ足す。
  const canSeePoints = canSeeCriteria(viewer.role);
  const trend = [...all]
    .reverse()
    .map((e) => ({
      cycle: e.cycleName ?? "",
      等級要件の達成率: e.requirementRate ?? null,
      ...(canSeePoints ? { 行動指針の点数: e.behaviorTotal ?? null } : {}),
    }));
  const trendSeries = [
    { key: "等級要件の達成率", label: "等級要件の達成率（%）" },
    ...(canSeePoints ? [{ key: "行動指針の点数", label: "行動指針の点数（点）" }] : []),
  ];

  return (
    <>
      <PageTitle title="評価の結果を見る" lede="半期ごとの評価をすべて残しています。過去と比べて変化を確認できます。" />

      {all.length === 0 ? (
        <EmptyState title="確定した評価はまだありません" body="評価期間が終わり、上長の確認が済むとここに結果が並びます。" />
      ) : (
        <>
          <SectionHeading>これまでの推移</SectionHeading>
          <Card className="card-pad">
            <TrendChart data={trend} series={trendSeries} />
          </Card>

          <SectionHeading>評価期間ごとの結果</SectionHeading>
          <Card>
            {all.map((e) => (
              <CardRow
                key={e.id}
                title={<Link href={`/me/results/${e.id}`} className="text-[var(--brand-deep)]">{e.cycleName}</Link>}
                sub={`${formatPeriod(e.periodStart, e.periodEnd)} ／ ${e.gradeName}`}
                value={
                  <>
                    <Num value={e.requirementRate} unit="%" />
                    <p className="m-0 text-[12px] text-[var(--ink-muted)]">等級要件の達成率</p>
                  </>
                }
                marks={e.raiseEligible ? <Badge tone="active">昇給の要件を満たす</Badge> : <Badge tone="done">継続</Badge>}
              />
            ))}
          </Card>
        </>
      )}
    </>
  );
}
