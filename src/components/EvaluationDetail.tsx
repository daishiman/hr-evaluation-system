import { getEvaluationDetail, listEvaluations } from "@/lib/queries";
import { Badge, Bar, Card, DefList, Num, PageTitle, ProvisionalMark, RankMark, ReasonNote, SectionHeading } from "@/components/ui";
import { EightAxisRadar } from "@/components/LazyCharts";
import { PrintButton } from "@/components/PrintButton";
import { formatPeriod, rankToPercent } from "@/lib/view";
import type { Role } from "@/lib/session";

/**
 * 評価結果の詳細。
 * 同じ画面をロール別に使い分ける。評価される方には配点・閾値・昇格に必要な点数を出さない
 * （出さない判断は queries.getEvaluationDetail で行い、ここは受け取った内容を描くだけ）。
 */
export async function EvaluationDetail({
  companyId,
  evaluationId,
  role,
  backHref,
}: {
  companyId: string;
  evaluationId: string;
  role: Role;
  backHref: string;
}) {
  const detail = await getEvaluationDetail(companyId, evaluationId, role);
  if (!detail) {
    return <ReasonNote>この評価は見つかりませんでした。一覧からもう一度お選びください。</ReasonNote>;
  }

  const { head, items, behaviors, requirements, gates, showsCriteria } = detail;

  // 前回の評価（同じ人の1つ前のサイクル）をレーダーの比較に使う
  const history = (await listEvaluations(companyId, { employeeId: head.employeeId })).filter(
    (e) => e.status === "finalized",
  );
  const myIndex = history.findIndex((e) => e.id === evaluationId);
  const prev = myIndex >= 0 ? history[myIndex + 1] : undefined;
  const prevDetail = prev ? await getEvaluationDetail(companyId, prev.id, role) : null;

  const radar = items.map((i) => ({
    item: i.itemName,
    value: rankToPercent(i.rank ?? "E"),
    rank: i.rank,
  }));
  const radarPrev = prevDetail?.items.map((i) => ({
    item: i.itemName,
    value: rankToPercent(i.rank ?? "E"),
    rank: i.rank,
  }));

  const gateFail = gates.filter((g) => !g.achieved);
  // 実績が入力されておらずランクを付けられなかった項目（移行元のGASでいう「判定外」）
  const unrated = items.filter((i) => i.rank === null);
  /* 2026-08-10 に達成率の分母を「出題した項目数」へ変更した。それ以前に確定した評価は
     作り直さない（過去評価の不変性）ため、保存済みの達成率と項目数の割合が合わない。
     食い違うときだけ、その理由を画面に出す。 */
  const isLegacyRate =
    head.requirementRate !== null &&
    head.requirementTotal !== null &&
    head.requirementTotal > 0 &&
    head.requirementAchieved !== null &&
    Math.abs(head.requirementRate - Math.round((head.requirementAchieved / head.requirementTotal) * 1000) / 10) > 0.1;

  const supportReqs = requirements.filter((r) => r.category === "support");
  const operationReqs = requirements.filter((r) => r.category === "operation");

  return (
    <>
      <PageTitle
        title={`${head.employeeName} さん ／ ${head.cycleName}`}
        lede={`${head.gradeName} ／ 対象期間 ${formatPeriod(head.periodStart, head.periodEnd)}`}
        actions={
          <>
            <PrintButton />
            <a href={backHref} className="btn btn-tertiary no-print">
              一覧に戻る
            </a>
          </>
        }
      />

      {/* 視覚的主役: 結論を1つだけ大きく出す */}
      <Card className="hero-tint">
        <div className="hero-number">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">この期の判定</p>
          <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
            {head.raiseEligible ? "昇給の要件を満たしています" : "昇給は見送りです"}
          </p>
          <p className="m-0 mt-2 text-[13px]">
            {head.promotionEligible ? (
              <>昇格の要件も満たしています。</>
            ) : (
              <>昇格の要件は満たしていません。</>
            )}
          </p>
          {showsCriteria && (
            <p className="m-0 mt-3 text-[13px] text-[var(--ink-muted)]">
              KPI評価点 <Num value={head.totalScore} unit="点" /> / <Num value={head.maxScore} unit="点" />
              {head.requiredKpiPointsSnapshot !== null && (
                <>（昇格に必要な点数 <Num value={head.requiredKpiPointsSnapshot} unit="点" />）</>
              )}
            </p>
          )}
        </div>
      </Card>

      {head.promotionBlockedReason && (
        <div className="mt-4">
          <ReasonNote>
            <strong>昇格できない理由：</strong>
            {head.promotionBlockedReason}
          </ReasonNote>
        </div>
      )}

      <SectionHeading aside={<span className="footnote">8項目の達成度（外側ほど良い）</span>}>
        評価の全体像
      </SectionHeading>
      <Card className="card-pad">
        <EightAxisRadar
          data={radar}
          compare={radarPrev && radarPrev.length === radar.length ? radarPrev : undefined}
          compareLabel={prev?.cycleName ?? "前回"}
          label={head.cycleName ?? "今回"}
        />
      </Card>

      <SectionHeading>項目ごとの判定と理由</SectionHeading>
      <Card>
        {items.map((i) => (
          <div key={i.id} className="card-row items-start">
            <div className="pt-0.5">
              <RankMark rank={i.rank} />
            </div>
            <div className="row-main">
              <p className="todo-row-title m-0">
                {i.itemName}
                {i.rank === null ? <> <Badge tone="alert">判定外</Badge></> : null}
                {i.isProvisional ? <> <ProvisionalMark /></> : null}
              </p>
              <p className="todo-row-sub m-0">
                {i.categoryName} ／ 実績値 <Num value={i.actualValue} unit={i.unit ?? undefined} />
              </p>
              <p className="m-0 mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">{i.rationale}</p>
              {showsCriteria && i.calcNote && (
                <p className="m-0 mt-1 text-[11px] text-[var(--ink-muted)]">計算式：{i.calcNote}</p>
              )}
            </div>
            {showsCriteria && (
              <div className="shrink-0 text-right">
                <Num value={i.points} display />
                <span className="unit">点</span>
                <p className="m-0 text-[11px] text-[var(--ink-muted)]">
                  配点 <Num value={i.maxPoints} unit="点" />
                </p>
              </div>
            )}
          </div>
        ))}
      </Card>
      {unrated.length > 0 && (
        <p className="footnote mt-2">
          {unrated.map((i) => i.itemName).join("、")} は実績が入力されていないため判定できていません（判定外）。
          配点は合計に残しているので、回答をそろえて集計し直すと点数が上がることがあります。
        </p>
      )}
      {!showsCriteria && (
        <p className="footnote mt-2">
          配点と基準の数値は、上長・管理者のみが確認できます。判定の理由は上に表示しています。
        </p>
      )}

      <SectionHeading
        aside={
          <span className="footnote">
            達成率 <Num value={head.requirementRate} unit="%" />
          </span>
        }
      >
        等級要件（支援・運営）
      </SectionHeading>
      <Card className="card-pad">
        {/* 達成率の分母は「このアンケートで実際に出題した等級要件の項目数」。
            判定した時点の分子・分母をそのまま保存しているので、あとから設問を
            増減させてもこの表示は動かない。 */}
        <Bar value={head.requirementRate ?? 0} max={100} label="％（達成率）" />
        <p className="footnote mt-1">
          <Num value={head.requirementTotal} unit="項目" /> 中{" "}
          <Num value={head.requirementAchieved} unit="項目" /> 達成 →{" "}
          <Num value={head.requirementRate} unit="%" />
          。分母はこのアンケートで実際に聞いた等級要件の項目数です（未回答の項目も未達として数えます）。
        </p>
        {isLegacyRate && (
          <ReasonNote>
            この評価は、達成率の分母を「半期の目標設定上限数」としていた以前の決まりで確定済みです。
            そのため上の項目数と達成率の割合が一致していません。確定済みの評価は作り直しません。
          </ReasonNote>
        )}
        <div className="card-grid mt-4">
          {[
            { title: "支援について", rows: supportReqs },
            { title: "運営について", rows: operationReqs },
          ].map((g) => (
            <div key={g.title}>
              <p className="section-heading m-0 mb-1">{g.title}</p>
              {g.rows.length === 0 ? (
                <p className="footnote m-0">この等級には設定されていません。</p>
              ) : (
                <ul className="m-0 list-none space-y-1 p-0">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 text-[13px]">
                      <span className="shrink-0">
                        {r.achieved ? <Badge tone="active">達成</Badge> : <Badge tone="dropped">未達</Badge>}
                      </span>
                      <span className="min-w-0">{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      <SectionHeading>昇格要件（受講後の報告書・テスト）</SectionHeading>
      {gates.length === 0 ? (
        <ReasonNote>この等級には昇格要件が登録されていません。</ReasonNote>
      ) : (
        <Card>
          {gates.map((g) => (
            <div key={g.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">{g.text}</p>
                <p className="todo-row-sub m-0">{g.kind === "report" ? "受講して報告書を提出" : "独学してテストに合格"}</p>
              </div>
              {g.achieved ? <Badge tone="active">提出済み</Badge> : <Badge tone="alert">未提出</Badge>}
            </div>
          ))}
        </Card>
      )}
      {gateFail.length > 0 && (
        <p className="footnote mt-2">
          報告書が未提出の項目が {gateFail.length} 件あります。点数が足りていても、この項目が残っていると昇格できません。
        </p>
      )}

      {behaviors.length > 0 && (
        <>
          <SectionHeading
            aside={
              showsCriteria && head.requiredBehaviorPointsSnapshot !== null ? (
                <span className="footnote">
                  昇格に必要な点数 <Num value={head.requiredBehaviorPointsSnapshot} unit="点" />
                </span>
              ) : undefined
            }
          >
            行動指針（合計 <Num value={head.behaviorTotal} unit="点" />）
          </SectionHeading>
          <Card>
            {behaviors.map((b) => (
              <div key={b.id} className="card-row items-start">
                <div className="row-main">
                  <p className="todo-row-title m-0">{b.aspectName}</p>
                  <p className="m-0 text-[12px] text-[var(--ink-muted)]">{b.levelLabel}</p>
                </div>
                <div className="shrink-0">
                  <Num value={b.score} unit="点" />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {head.evaluatorComment && (
        <>
          <SectionHeading>上長からのコメント</SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-[13px] leading-relaxed">{head.evaluatorComment}</p>
          </Card>
        </>
      )}

      <SectionHeading>この評価の記録</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            { label: "評価期間", value: formatPeriod(head.periodStart, head.periodEnd) },
            { label: "等級", value: head.gradeName ?? "—" },
            { label: "所属", value: head.department ?? "—" },
            { label: "状態", value: head.status === "finalized" ? "確定済み" : "確認中" },
            {
              label: "確定日",
              value: head.finalizedAt ? new Date(head.finalizedAt).toLocaleDateString("ja-JP") : "—",
            },
          ]}
        />
      </Card>
    </>
  );
}
