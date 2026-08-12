import { getEvaluationDetail, listEvaluations } from "@/lib/queries";
import { Badge, Bar, Card, CardRow, DefList, Disclosure, InlineDetail, LinkButton, Num, PageTitle, ProvisionalMark, RankMark, ReasonNote, SectionHeading } from "@/components/ui";
import { EightAxisRadar } from "@/components/LazyCharts";
import { PrintButton } from "@/components/PrintButton";
import { formatPeriod } from "@/lib/view";
import { buildRadarValues, buildThresholdScale, parseReasonText, RANK_LEGEND } from "@/lib/domain/evaluation-view";
import type { Role } from "@/lib/session";

/**
 * 評価結果の詳細。
 * 同じ画面をロール別に使い分ける。一般の方には配点・閾値・昇格に必要な点数を出さない
 * （出さない判断は queries.getEvaluationDetail で行い、ここは受け取った内容を描くだけ）。
 */
export async function EvaluationDetail({
  companyId,
  evaluationId,
  role,
  backHref,
  backLabel,
}: {
  companyId: string;
  evaluationId: string;
  role: Role;
  /** 戻り先はパンくずの1段目として出す（画面の中に「一覧に戻る」ボタンを置かない） */
  backHref: string;
  backLabel: string;
}) {
  const detail = await getEvaluationDetail(companyId, evaluationId, role);
  if (!detail) {
    return <ReasonNote>この評価は見つかりませんでした。一覧からもう一度お選びください。</ReasonNote>;
  }

  const { head, items, behaviors, requirements, gates, rankCriteria, showsCriteria } = detail;

  // 前回の評価（同じ人の1つ前のサイクル）をレーダーの比較に使う
  const history = (await listEvaluations(companyId, role, { employeeId: head.employeeId })).filter(
    (e) => e.status === "finalized",
  );
  const myIndex = history.findIndex((e) => e.id === evaluationId);
  const prev = myIndex >= 0 ? history[myIndex + 1] : undefined;
  const prevDetail = prev ? await getEvaluationDetail(companyId, prev.id, role) : null;

  /* レーダーの軸の作り方はロールで変える。
     評価者には実際の「獲得点 ÷ 配点」、本人には配点を出せないのでランク由来の形。
     判定外（実績が未入力）はどちらでも欠損として扱う（0点として描かない）。 */
  const radar = buildRadarValues(items, showsCriteria);
  const radarPrev = prevDetail ? buildRadarValues(prevDetail.items, showsCriteria) : undefined;
  const sameAxes =
    radarPrev !== undefined &&
    radarPrev.length === radar.length &&
    radar.every((r, idx) => radarPrev[idx]?.item === r.item);

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
      {/* 縦に長い画面。誰の・どの期の・確定済みかどうかを帯に固定して見えたままにする */}
      <PageTitle
        sticky
        breadcrumb={[{ label: backLabel, href: backHref }]}
        title={`${head.employeeName} さん ／ ${head.cycleName}`}
        lede={`${head.gradeName} ／ 対象期間 ${formatPeriod(head.periodStart, head.periodEnd)}`}
        tags={
          <>
            <span className="tag">{head.gradeName}</span>
            <span className="tag" data-tone="muted">
              {formatPeriod(head.periodStart, head.periodEnd)}
            </span>
            <Badge tone={head.status === "finalized" ? "done" : "active"}>
              {head.status === "finalized" ? "確定済み" : "確認中"}
            </Badge>
          </>
        }
        actions={
          <>
            {/* 実績値の出どころ（このとき提出したアンケート）へ辿れるようにする。
                回答は当時の版・当時の設問文で表示される（/me/responses/[id]）。 */}
            {head.responseId && (
              <LinkButton href={`/me/responses/${head.responseId}`} variant="tertiary" className="no-print">
                このときの回答を見る
              </LinkButton>
            )}
            <PrintButton />
          </>
        }
      />

      {/* 視覚的主役: 結論を1つだけ大きく出す */}
      <Card className="hero-tint">
        <div className="hero-number">
          <p className="m-0 text-note text-[var(--ink-muted)]">この期の判定</p>
          <p className="num-display m-0 text-hero-sp leading-tight text-[var(--accent)]">
            {head.raiseEligible ? "昇給の要件を満たしています" : "昇給は見送りです"}
          </p>
          <p className="m-0 mt-2 text-sub">
            {head.promotionEligible ? (
              <>昇格の要件も満たしています。</>
            ) : (
              <>昇格の要件は満たしていません。</>
            )}
          </p>
          {showsCriteria && (
            <p className="m-0 mt-3 text-sub text-[var(--ink-muted)]">
              KPI評価点 <Num value={head.totalScore} unit="点" /> / <Num value={head.maxScore} unit="点" />
              {head.requiredKpiPointsSnapshot !== null && (
                <>（昇格に必要な点数 <Num value={head.requiredKpiPointsSnapshot} unit="点" />）</>
              )}
            </p>
          )}
        </div>
      </Card>

      {/* 昇給・昇格の理由。評価者には点数入りの原文、本人には数値を含まない言い換えが
          queries.getEvaluationDetail から返る（このコンポーネントは出し分けをしない）。 */}
      {head.raiseReason && (
        <div className="mt-4">
          <ReasonNote>
            <ReasonBlocks label="この判定になった理由" text={head.raiseReason} />
          </ReasonNote>
        </div>
      )}
      {head.promotionBlockedReason && (
        <div className="mt-4">
          <ReasonNote>
            <ReasonBlocks label="昇格できない理由" text={head.promotionBlockedReason} />
          </ReasonNote>
        </div>
      )}

      <SectionHeading
        aside={<span className="footnote">{items.length}項目の達成度（外側ほど良い）</span>}
      >
        評価の全体像
      </SectionHeading>
      <Card className="card-pad">
        <EightAxisRadar
          data={radar}
          compare={sameAxes ? radarPrev : undefined}
          compareLabel={prev?.cycleName ?? "前回"}
          label={head.cycleName ?? "今回"}
          valueLabel={showsCriteria ? "獲得点 / 配点" : "ランクをもとにした大きさ"}
        />
        {/* 図から読み取れない事実（欠けている軸の意味）は残し、軸の作り方は押したら出す */}
        {unrated.length > 0 && (
          <p className="footnote m-0 mt-2">
            ※ の軸は、実績が入力されておらず判定できていない項目です。
            0点ではありません（形が欠けて見えます）。
          </p>
        )}
        <div className="mt-2">
          <InlineDetail summary="この図の見方">
            {showsCriteria ? (
              <>
                <p className="m-0">軸の長さは、その項目の「獲得点 ÷ 配点」です。</p>
                <p className="m-0 mt-1">配点の重い項目ほど、へこみが合計点に効きます。</p>
              </>
            ) : (
              <>
                <p className="m-0">軸の長さは、ランク（A〜E）をもとにした形です。</p>
                <p className="m-0 mt-1">配点は上長・管理者のみが確認できます。</p>
                <p className="m-0 mt-1">そのため、点数そのものは反映していません。</p>
              </>
            )}
          </InlineDetail>
        </div>
      </Card>

      {/* ランクの意味は本人にも出す。A〜Eだけ見せて意味を伏せると、
          「なぜこの結果か」が伝わらないため。配点は書かない。
          ただし一度読めば済む早見表なので、開く場所を残したまま畳んでおく。 */}
      <div className="mt-3">
        <Disclosure summary="ランクの意味（A〜E）" meta="押すと出ます">
        <ul className="m-0 list-none space-y-1 p-0">
          {RANK_LEGEND.map((r) => (
            <li key={r.rank} className="flex items-start gap-2 text-sub">
              <span className="shrink-0">
                <RankMark rank={r.rank} />
              </span>
              <span className="min-w-0">{r.meaning}</span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-sub">
            <span className="shrink-0">
              <RankMark rank={null} />
            </span>
            <span className="min-w-0">実績が入力されておらず判定できていない項目（判定外）</span>
          </li>
        </ul>
        </Disclosure>
      </div>

      <SectionHeading>項目ごとの判定と理由</SectionHeading>
      <Card>
        {items.map((i) => (
          <CardRow
            key={i.id}
            alignTop
            lead={
              <div className="pt-0.5">
                <RankMark rank={i.rank} />
              </div>
            }
            title={
              <>
                {i.itemName}
                {i.rank === null ? <> <Badge tone="alert">判定外</Badge></> : null}
                {i.isProvisional ? <> <ProvisionalMark /></> : null}
              </>
            }
            sub={
              <>
                {i.categoryName} ／ 実績値 <Num value={i.actualValue} unit={i.unit ?? undefined} />
              </>
            }
            detail={
              <>
                <p className="m-0 mt-1 text-note leading-relaxed text-[var(--ink-muted)]">{i.rationale}</p>
                {showsCriteria && i.calcNote && (
                  <p className="m-0 mt-1 text-note text-[var(--ink-muted)]">計算式：{i.calcNote}</p>
                )}
                {/* 得点バーと判定範囲は配点そのものなので評価者だけに出す */}
                {showsCriteria && <ScoreBar points={i.points} maxPoints={i.maxPoints} />}
                {showsCriteria && (
                  <ThresholdBand
                    criteria={rankCriteria.filter((c) => c.kpiItemId === i.kpiItemId)}
                    actualValue={i.actualValue}
                    rank={i.rank}
                    unit={i.unit}
                    snapshotLabel={i.thresholdLabel}
                  />
                )}
              </>
            }
            value={
              showsCriteria ? (
                <>
                  <Num value={i.points} display />
                  <span className="unit">点</span>
                  <p className="m-0 text-note text-[var(--ink-muted)]">
                    配点 <Num value={i.maxPoints} unit="点" />
                  </p>
                </>
              ) : undefined
            }
          />
        ))}
      </Card>
      {unrated.length > 0 && (
        <p className="footnote mt-2">
          {unrated.map((i) => i.itemName).join("、")} は実績が入力されていないため判定できていません（判定外）。
          {showsCriteria
            ? "配点は合計に残しているので、回答をそろえて集計し直すと点数が上がることがあります。"
            : "0という評価ではありません。実績をそろえて集計し直すと、判定が付きます。"}
        </p>
      )}
      {/* 全項目に同じ文が付いていた注記。行から外して一覧の下に1か所だけ置く */}
      {showsCriteria && (
        <div className="mt-2">
          <InlineDetail summary="判定範囲の帯について">
            <p className="m-0">帯は、現在の基準表のA〜Eです。</p>
            <p className="m-0 mt-1">確定時の基準は、各項目の「判定範囲」が正です。</p>
          </InlineDetail>
        </div>
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
        </p>
        {/* 分母の作り方は、結果を読むうえでは背景。押したときに読めればよい */}
        <InlineDetail summary="達成率の分母について">
          <p className="m-0">分母は、このアンケートで実際に聞いた等級要件の項目数です。</p>
          <p className="m-0 mt-1">未回答の項目も、未達として数えます。</p>
        </InlineDetail>
        {isLegacyRate && (
          <ReasonNote>
            この評価は、以前の決まりで確定済みです。
            当時の分母は「半期の目標設定上限数」でした。
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
                    <li key={r.id} className="flex items-start gap-2 text-sub">
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

      {/* 賞与（仮）。一般の方には出さない（個人Ptから KPI評価点合計 が逆算できるため、
          queries.getEvaluationDetail で null にして返している）。 */}
      {showsCriteria && (
        <>
          <SectionHeading aside={<ProvisionalMark note="配点が未確定のため、金額は仮のものです。" />}>
            個人Pt と 賞与額（仮）
          </SectionHeading>
          <Card className="card-pad">
            {head.personalPoints === null ? (
              <ReasonNote
                action={
                  <LinkButton href="/admin/kgi" variant="secondary" className="no-print">
                    達成率を登録する
                  </LinkButton>
                }
              >
                {head.bonusRationale ??
                  "事業所KGIの達成率が未登録です。個人Ptと賞与額を算出できません（0円ではありません）。"}
              </ReasonNote>
            ) : (
              <>
                <div className="hero-number">
                  <p className="m-0 text-note text-[var(--ink-muted)]">個人Pt</p>
                  <p className="num-display m-0 text-num-l leading-tight">
                    <Num value={head.personalPoints} unit="Pt" display />
                  </p>
                  {head.bonusYen !== null && (
                    <p className="m-0 mt-2 text-sub">
                      賞与額（仮） <Num value={head.bonusYen} unit="円" />
                    </p>
                  )}
                </div>
                <DefList
                  rows={[
                    {
                      label: "事業所KGI達成率",
                      value: <Num value={head.officeAchievementRate} unit="%" />,
                    },
                    { label: "達成係数", value: <Num value={head.kgiCoefficient} /> },
                  ]}
                />
                {head.bonusRationale && (
                  <p className="m-0 mt-2 text-note leading-relaxed text-[var(--ink-muted)]">{head.bonusRationale}</p>
                )}
                <p className="footnote m-0 mt-2">
                  {head.status === "finalized"
                    ? "この評価は確定済みのため、あとから達成率や係数を変えてもこの金額は動きません。"
                    : "確定前のため、達成率を変えると計算し直されます。"}
                  金額は配点が未確定のうちは仮の値です。
                </p>
              </>
            )}
          </Card>
        </>
      )}

      <SectionHeading>昇格要件（受講後の報告書・テスト）</SectionHeading>
      {gates.length === 0 ? (
        <ReasonNote>この等級には昇格要件が登録されていません。</ReasonNote>
      ) : (
        <Card>
          {gates.map((g) => (
            <CardRow
              key={g.id}
              title={g.text}
              sub={g.kind === "report" ? "受講して報告書を提出" : "独学してテストに合格"}
              marks={g.achieved ? <Badge tone="active">提出済み</Badge> : <Badge tone="alert">未提出</Badge>}
            />
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
            {/* 本人には点数を出さず水準ラベルだけにする。KPI側の配点を伏せているのに
                行動指針だけ裸の点数を出すのは非対称で、しかも「昇格に必要な点数」と直結しており
                何回か並べれば必要点数の位置が推測できてしまうため、伏せる側に揃えた。 */}
            {showsCriteria ? (
              <>行動指針（合計 <Num value={head.behaviorTotal} unit="点" />）</>
            ) : (
              <>行動指針</>
            )}
          </SectionHeading>
          <Card>
            {behaviors.map((b) => (
              <CardRow
                key={b.id}
                alignTop
                title={b.aspectName}
                sub={b.levelLabel}
                value={showsCriteria ? <Num value={b.score} unit="点" /> : undefined}
              />
            ))}
          </Card>
          {!showsCriteria && (
            <p className="footnote mt-2">
              行動指針は、観点ごとに当てはまる水準を選んで判定しています。点数と昇格に必要な点数は、
              上長・管理者のみが確認できます。
            </p>
          )}
        </>
      )}

      {head.evaluatorComment && (
        <>
          <SectionHeading>上長からのコメント</SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-sub leading-relaxed">{head.evaluatorComment}</p>
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

/**
 * 昇給・昇格の理由を「結論の1文」と「対象の並び」に分けて描く。
 *
 * 判定側（scoring.ts）は、項目名・要件名の列挙を文へ詰めず
 * 「見出し＋並び」の形（行頭が `- ` なら並びの1件）で保存している。
 * ここで読み戻し、並びは <ul> として出す。1行に「、」で繋ぎ直さない
 * ＝ 項目が何件あっても、1件ずつが同じ重さで読めるようにする。
 * 2026-08-12 より前に確定した評価は1行の文なので、見出しだけとして描かれる。
 */
function ReasonBlocks({ label, text }: { label: string; text: string }) {
  const blocks = parseReasonText(text);
  return (
    <>
      {blocks.length === 0 && <strong>{label}：</strong>}
      {blocks.map((b, idx) => (
        <div key={`${b.headline}-${idx}`} className={idx === 0 ? "" : "mt-2"}>
          {idx === 0 && <strong>{label}：</strong>}
          {b.headline && <span>{b.headline}</span>}
          {b.items.length > 0 && (
            <ul className="m-0 mt-1 list-disc space-y-0.5 pl-5">
              {b.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * 項目ごとの「獲得点 / 配点」の帯（評価者向け）。
 * 数字だけだと、100点のうちどの項目がどれだけ効いたかが読み取れないため、
 * 配点を全体の幅、獲得点を塗りで示す。数値も必ず添える（帯だけで値を読ませない）。
 */
function ScoreBar({ points, maxPoints }: { points: number | null; maxPoints: number | null }) {
  if (points === null || maxPoints === null || maxPoints <= 0) return null;
  const pct = Math.min(100, Math.max(0, (points / maxPoints) * 100));
  return (
    <div className="mt-2">
      <div
        className="bar-track"
        role="img"
        aria-label={`配点${maxPoints}点のうち${points}点`}
      >
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {/* 数値は同じ行の右側に出しているので、ここでは重ねて書かない（バーは量の比較だけを担う） */}
    </div>
  );
}

/**
 * A〜Eの判定範囲と、実績値がその中のどこに落ちたかの帯（評価者向け）。
 *
 * 判定に使った範囲は evaluation_items のスナップショット（当たったランクぶん）が正で、
 * 帯として並べる A〜E は現在の基準表から読んでいる。両方を並べて出し、
 * 食い違う可能性がある旨は基準表側の注記で伝える。配点情報なので本人には出さない。
 */
function ThresholdBand({
  criteria,
  actualValue,
  rank,
  unit,
  snapshotLabel,
}: {
  criteria: { rank: string; displayLabel: string; lowerBound: number | null; upperBound: number | null }[];
  actualValue: number | null;
  rank: string | null;
  unit: string | null;
  snapshotLabel: string | null;
}) {
  const scale = buildThresholdScale(criteria, actualValue, rank);
  if (!scale) return null;

  return (
    <div className="mt-2">
      <div className="relative h-6 w-full" role="img" aria-label={`判定範囲。実績値 ${actualValue ?? "未入力"}`}>
        {scale.segments.map((sg) => (
          <div
            key={sg.rank}
            title={`${sg.rank}：${sg.label}`}
            className="absolute top-0 flex h-6 items-center justify-center overflow-hidden text-note"
            style={{
              left: `${sg.left}%`,
              /* 隣の区間と2px空けて、境目を線ではなく余白で見せる */
              width: `calc(${sg.width}% - 2px)`,
              background: sg.hit ? "var(--brand-soft)" : "var(--subtle)",
              color: sg.hit ? "var(--brand-deep)" : "var(--ink-muted)",
              borderRadius: 3,
            }}
          >
            {sg.width >= 8 ? sg.rank : ""}
          </div>
        ))}
        {scale.markerLeft !== null && (
          <div
            className="absolute top-0 h-6 w-0.5"
            style={{ left: `${scale.markerLeft}%`, background: "var(--ink)" }}
          />
        )}
      </div>
      {/* 「帯は現在の基準表のA〜E」は全項目で同じ文になるので、行から外して
          一覧の下に1か所だけ置いた（項目数ぶん繰り返すと一覧が文字で埋まる）。 */}
      <p className="m-0 mt-1 text-note text-[var(--ink-muted)]">
        判定範囲 {snapshotLabel ?? "—"}
        {rank ? `（ランク${rank}）` : "（判定外）"} ／ 実績値 <Num value={actualValue} unit={unit ?? undefined} />
      </p>
    </div>
  );
}
