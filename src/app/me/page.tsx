import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getOpenCycle, listCycles, listEvaluations, listForms, getResponse } from "@/lib/queries";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";
import { formatPeriod, RESPONSE_STATUS_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 評価される方のホーム。
 * 並びは「いま要対応 → 次のアクション → 最近の動き → キー数字」。
 */
export default async function MyHome() {
  const viewer = await requireViewer();
  if (!viewer.companyId) {
    return (
      <EmptyState
        title="所属している会社がありません"
        body="会社の管理者に、所属会社の設定を依頼してください。"
      />
    );
  }

  const [openCycle, evaluations, cycles] = await Promise.all([
    getOpenCycle(viewer.companyId),
    listEvaluations(viewer.companyId, viewer.role, { employeeId: viewer.id }),
    listCycles(viewer.companyId),
  ]);

  // 今の期に自分が答えるアンケート（自分の等級のもの）
  const forms = openCycle ? await listForms(viewer.companyId, openCycle.id) : [];
  const myForm = forms.find((f) => f.gradeId === viewer.gradeId) ?? null;
  const myResponse = myForm ? await getResponse(viewer.companyId, myForm.id, viewer.id) : null;

  const finalized = evaluations.filter((e) => e.status === "finalized");
  const latest = finalized[0] ?? null;
  const previous = finalized[1] ?? null;

  return (
    <>
      <PageTitle
        title={`${viewer.name} さんの評価ページ`}
        lede={
          openCycle
            ? `いまの評価期間は「${openCycle.name}」（${formatPeriod(openCycle.periodStart, openCycle.periodEnd)}）です。`
            : "いま回答を受け付けている評価期間はありません。"
        }
      />

      <SectionHeading>いま対応すること</SectionHeading>
      {myForm && myResponse?.status !== "submitted" ? (
        <Card className="card-pad">
          <p className="todo-row-title m-0">{myForm.title}</p>
          <p className="todo-row-sub m-0 mt-1">
            回答の締め切りは {formatPeriod(myForm.opensAt, myForm.closesAt)} です。全{myForm.questionCount}問。
            {myResponse ? "入力途中の内容が保存されています。" : ""}
          </p>
          <div className="mt-3">
            <LinkButton href={`/me/forms/${myForm.id}`} variant="primary">
              {myResponse ? "続きから入力する" : "実績を報告する"}
            </LinkButton>
          </div>
        </Card>
      ) : myForm ? (
        <Card className="card-pad">
          <p className="todo-row-title m-0">
            {myForm.title} <Badge tone="done">提出済み</Badge>
          </p>
          <p className="todo-row-sub m-0 mt-1">
            提出は完了しています。上長の確認が終わると、結果がこの画面に表示されます。
          </p>
          <div className="mt-3">
            <LinkButton href={`/me/forms/${myForm.id}`}>提出した内容を見る</LinkButton>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="いま回答するアンケートはありません"
          body={
            viewer.gradeId
              ? "新しい評価期間が始まると、ここに回答するアンケートが並びます。"
              : "等級がまだ設定されていないため、アンケートが割り当てられていません。会社の管理者にご確認ください。"
          }
        />
      )}

      <SectionHeading>これまでの評価</SectionHeading>
      {finalized.length === 0 ? (
        <EmptyState
          title="確定した評価はまだありません"
          body="評価期間が終わり、上長の確認が済むとここに結果が並びます。"
        />
      ) : (
        <Card>
          {finalized.map((e) => (
            <div key={e.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/me/results/${e.id}`} className="text-[var(--brand-deep)]">
                    {e.cycleName}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">
                  {e.gradeName} ／ 等級要件の達成 <Num value={e.requirementAchieved} />/
                  <Num value={e.requirementTotal} /> 項目
                </p>
              </div>
              {e.raiseEligible ? <Badge tone="active">昇給の要件を満たしています</Badge> : <Badge tone="done">継続</Badge>}
              {e.promotionEligible && <Badge tone="active">昇格の要件を満たしています</Badge>}
            </div>
          ))}
        </Card>
      )}

      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label">直近の等級要件の達成率</div>
          <div className="kpi-value">
            <Num value={latest?.requirementRate ?? null} unit="%" />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">前回からの変化</div>
          <div className="kpi-value">
            {latest && previous ? (
              <Num
                value={Math.round(((latest.requirementRate ?? 0) - (previous.requirementRate ?? 0)) * 10) / 10}
                unit="pt"
              />
            ) : (
              <span className="text-[var(--ink-muted)]">—</span>
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">評価を受けた回数</div>
          <div className="kpi-value">
            <Num value={finalized.length} unit="回" />
          </div>
        </div>
      </div>
      <p className="footnote mt-3">
        評価の基準や配点、昇格に必要な点数は、上長・管理者のみが確認できます。
        {cycles.length > 0 && ` これまでの評価期間は${cycles.length}件あります。`}
      </p>
    </>
  );
}
