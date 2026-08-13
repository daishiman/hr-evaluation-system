import { canSeeCriteria, requireViewer } from "@/lib/session";
import { listEvaluations } from "@/lib/queries";
import { EmptyState, PageTitle } from "@/components/ui";
import { EvaluationTrend, type TrendItem } from "@/components/EvaluationTrend";
import { MyPendingResultsNotice } from "@/components/MyPendingResultsNotice";
import { listMyPendingCycles } from "@/lib/stalled";
import { formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/** 自分の評価の履歴と推移。過去のサイクルは消さずに全部残す。 */
export default async function MyResults() {
  const viewer = await requireViewer();
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="会社の管理者にご確認ください。" />;

  /* 確定した結果と並べて、「まだ確定していない期」も出す。
     ここが本人にとって結果を見に来る場所なので、無いものの説明も同じ画面に置く。
     絞り込みは listMyPendingCycles の中（サーバー側）で viewer.id により行う。 */
  const [evaluations, pending] = await Promise.all([
    listEvaluations(viewer.companyId, viewer.role, { employeeId: viewer.id }),
    listMyPendingCycles(viewer.companyId, viewer.id),
  ]);
  const all = evaluations.filter((e) => e.status === "finalized");

  // 行動指針の点数は「昇格に必要な点数」が逆算できるため、一般の方には返していない。
  // 返ってこない系列をグラフに置くと空の折れ線と凡例だけが残るので、見える人にだけ足す。
  const canSeePoints = canSeeCriteria(viewer.role);
  const trendSeries = [
    { key: "等級要件の達成率", label: "等級要件の達成率（%）" },
    ...(canSeePoints ? [{ key: "行動指針の点数", label: "行動指針の点数（点）" }] : []),
  ];
  /* 等級は「その期の等級」（evaluations.gradeId）を使う。いまの等級で塗ると、
     昇格前の結果まで新しい等級のものとして並んでしまう。 */
  const trendItems: TrendItem[] = all.map((e) => ({
    id: e.id,
    href: `/me/results/${e.id}`,
    cycle: e.cycleName ?? "—",
    period: formatPeriod(e.periodStart, e.periodEnd),
    periodStart: e.periodStart ?? null,
    gradeName: e.gradeName ?? null,
    finalized: true,
    values: {
      等級要件の達成率: e.requirementRate ?? null,
      ...(canSeePoints ? { 行動指針の点数: e.behaviorTotal ?? null } : {}),
    },
    /* 等級は行の右のバッジに出るので、ここでは繰り返さず達成の内訳を出す。 */
    sub: `等級要件の達成 ${e.requirementAchieved ?? "—"}/${e.requirementTotal ?? "—"} 項目`,
    headline: { value: e.requirementRate ?? null, unit: "%", caption: "等級要件の達成率" },
    rows: [
      { label: "等級要件の達成率", value: e.requirementRate ?? null, unit: "%" },
      {
        label: "等級要件の達成",
        text: `${e.requirementAchieved ?? "—"} / ${e.requirementTotal ?? "—"} 項目`,
      },
      ...(canSeePoints ? [{ label: "行動指針の点数", value: e.behaviorTotal ?? null, unit: "点" }] : []),
      { label: "昇給の要件", text: e.raiseEligible ? "満たしています" : "継続" },
    ],
  }));

  return (
    <>
      <PageTitle title="評価の結果を見る" lede="半期ごとの評価をすべて残しています。過去と比べて変化を確認できます。" />

      <MyPendingResultsNotice cycles={pending} />

      {all.length === 0 ? (
        /* まだ確定していない期がある場合は、上の知らせが「なぜ空か」を言っている。
           同じことを2回言わない（空の説明が重なると、どちらが自分の話か分からなくなる）。 */
        pending.length === 0 && (
          <EmptyState title="確定した評価はまだありません" body="評価期間が終わり、上長の確認が済むとここに結果が並びます。" />
        )
      ) : (
        <EvaluationTrend
          items={trendItems}
          series={trendSeries}
          emptyBody="評価期間が終わり、上長の確認が済むとここに結果が並びます。"
        />
      )}
    </>
  );
}
