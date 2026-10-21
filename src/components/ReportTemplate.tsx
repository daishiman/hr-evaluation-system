import type { ReactNode } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ReportGradeBars, ReportRadarChart, ReportTrendChart } from "@/components/LazyCharts";
import { Bar, Card, DefList, EmptyState, LinkButton, Num, RankMark, SectionHeading, StatGrid } from "@/components/ui";
import { formatDateTime, formatPeriod } from "@/lib/view";
import type {
  EvaluationReport,
  ReportBody,
  ReportDecision,
  ReportPeerStat,
  ReportRadar,
  ReportRadarAxis,
  ReviewerGradeRow,
  ReviewerHistoryRow,
  ReviewerReport,
  ReviewerTrendPoint,
  SelfGradeRow,
  SelfHistoryRow,
  SelfReport,
  SelfTrendPoint,
} from "@/lib/domain/report";

/**
 * 1人の評価レポート（DD-024）。
 *
 * 中身は buildEvaluationReport が作り、ここは並べるだけにする（計算も出し分けもしない）。
 * 本人向け（self）の形には点数のキーがそもそも無いので、ここで隠す処理は持たない。
 *
 * 並びは ①見出し ②評価に値するか ③点数 ④レーダー図 ⑤その等級の推移 ⑥等級ごとの点数
 * ⑦過去の実績、末尾に上長からのコメント。4つの幅で同じ順に出す。
 * 印刷では1枚目に①〜④とコメント、2枚目に⑤〜⑦を載せる。HTML の順はそのままにし、
 * コメントを1枚目へ寄せるのは globals.css の @media print の中だけで行う。
 *
 * 図は1つのデータを2通りに描く。画面用は入れ物の幅に合わせ、印刷用は決まった大きさにする
 * （片方は CSS で隠す）。図の中身は隣の表と同じで、読み上げは表から読む。
 */
export function ReportTemplate({
  report,
  emptyHref,
  emptyLabel,
}: {
  report: EvaluationReport;
  /** 確定した評価がまだ無いときに案内する先 */
  emptyHref: string;
  emptyLabel: string;
}) {
  if (report.kind === "empty") {
    return (
      <EmptyState
        title="まだ確定した評価がありません"
        body={`${report.employeeName}さんの評価が確定すると、ここにレポートが出ます。`}
        action={<LinkButton href={emptyHref}>{emptyLabel}</LinkButton>}
      />
    );
  }

  return (
    <div className="report" data-view={report.kind}>
      <div className="report-page-1">
        <ReportHead report={report} />
        <Decisions decisions={report.decisions} />
        {report.kind === "reviewer" ? <ReviewerScoreSection report={report} /> : <SelfScoreSection report={report} />}
        <RadarSection radar={report.radar} baseCycleName={report.header.baseCycleName} />
      </div>

      <div className="report-page-2">
        {/* 2枚目の頭。紙だけに刷り、どの人のどの期のレポートかを2枚目だけでも分かるようにする */}
        <p className="report-print-head m-0">
          {report.header.employeeName}・{report.header.baseCycleName}（評価レポートの続き）
        </p>
        {report.kind === "reviewer" ? <ReviewerHistorySections report={report} /> : <SelfHistorySections report={report} />}
      </div>

      <section className="report-comment">
        <SectionHeading>上長からのコメント</SectionHeading>
        <Card className="card-pad">
          {report.comment ? (
            <p className="m-0 whitespace-pre-wrap text-sub leading-relaxed">{report.comment}</p>
          ) : (
            <p className="footnote m-0">この期のコメントはありません。</p>
          )}
        </Card>
      </section>
    </div>
  );
}

/* ───────────── ① 見出し ───────────── */

function ReportHead({ report }: { report: ReportBody }) {
  const h = report.header;
  return (
    <Card className="card-pad report-head">
      <p className="report-kicker m-0 text-note text-ink-muted">評価レポート</p>
      <p className="report-name m-0 text-name font-bold">{h.employeeName}</p>
      <div className="report-meta mt-2">
        <DefList
          rows={[
            { label: "いまの等級", value: h.currentGradeName ?? "—" },
            { label: "所属", value: h.officeName ?? "—" },
            {
              label: "元にした評価期間",
              value: (
                <>
                  {h.baseCycleName}
                  <span className="block text-note text-ink-muted">{formatPeriod(h.basePeriodStart, h.basePeriodEnd)}</span>
                </>
              ),
            },
            { label: "作った日時", value: formatDateTime(h.generatedAt) },
          ]}
        />
      </div>
    </Card>
  );
}

/* ───────────── ② 評価に値するか ───────────── */

function Decisions({ decisions }: { decisions: ReportDecision[] }) {
  return (
    <section>
      <SectionHeading help="点数の判定に、上司の判断を重ねた結論です。">昇給・昇格の判断</SectionHeading>
      <div className="report-decisions">
        {decisions.map((d) => (
          <Card key={d.subject} className="card-pad">
            <p className="report-decision-label m-0 text-note text-ink-muted">{d.label}</p>
            <div className="text-strong">
              <DecisionBadge
                subject={d.subject}
                scoreJudgement={d.scoreJudgement}
                decision={d.decision}
                reason={d.decisionReason}
                finalized
                conclusionOnly
              />
            </div>
            <div className="mt-2">
              <DefList
                rows={[
                  {
                    label: "点数の判定",
                    value: (
                      <>
                        {d.scoreJudgementText}
                        <span className="block whitespace-pre-wrap text-ink-muted">{d.scoreReason}</span>
                      </>
                    ),
                  },
                  {
                    label: "上司の判断",
                    value: (
                      <>
                        {d.decisionKind}
                        {d.decisionReason && <span className="block whitespace-pre-wrap">理由：{d.decisionReason}</span>}
                      </>
                    ),
                  },
                  { label: "記録", value: <RecordedBy name={d.recordedBy} at={d.recordedAt} /> },
                ]}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ───────────── ③ 点数 ───────────── */

function ReviewerScoreSection({ report }: { report: ReviewerReport }) {
  const s = report.scores;
  const columns: Column<ReviewerReport["scores"]["behaviors"][number]>[] = [
    { key: "aspect", header: "観点", cell: (b) => b.aspectName, role: "title" },
    { key: "level", header: "段階", cell: (b) => b.levelLabel ?? "—" },
    { key: "score", header: "点数", cell: (b) => <Num value={b.score} unit="点" />, num: true },
  ];
  return (
    <section>
      <SectionHeading>点数</SectionHeading>
      <Card className="card-pad">
        <StatGrid
          stats={[
            {
              label: "KPI評価点",
              value: (
                <>
                  <Num value={s.kpiTotal} display /> / <Num value={s.kpiMax} unit="点" />
                </>
              ),
            },
            { label: "KPIの達成率", value: <Num value={s.kpiRatio} unit="%" display /> },
            {
              label: "等級要件の達成率",
              value: (
                <>
                  <Num value={s.requirementRate} unit="%" display />
                  <RequirementCount achieved={s.requirementAchieved} total={s.requirementTotal} />
                </>
              ),
            },
            { label: "行動指針の合計", value: <Num value={s.behaviorTotal} unit="点" display /> },
          ]}
        />
      </Card>
      {s.behaviors.length > 0 && (
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={s.behaviors}
            rowKey={(b) => b.aspectName}
            caption="行動指針の観点ごとの段階と点数"
            scroll
          />
        </div>
      )}
    </section>
  );
}

function SelfScoreSection({ report }: { report: SelfReport }) {
  const j = report.judgements;
  const columns: Column<SelfReport["judgements"]["behaviors"][number]>[] = [
    { key: "aspect", header: "観点", cell: (b) => b.aspectName, role: "title" },
    { key: "level", header: "段階", cell: (b) => b.levelLabel ?? "—" },
  ];
  return (
    <section>
      <SectionHeading help="点数は上長と管理者だけが見られます。">判定</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            {
              label: "KPIの判定の内訳",
              value: j.rankCounts.map((c) => `${c.rank} ${c.count}件`).join("・"),
            },
            {
              label: "等級要件の達成率",
              value: (
                <>
                  <Num value={j.requirementRate} unit="%" />
                  <RequirementCount achieved={j.requirementAchieved} total={j.requirementTotal} />
                </>
              ),
            },
          ]}
        />
      </Card>
      {j.behaviors.length > 0 && (
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={j.behaviors}
            rowKey={(b) => b.aspectName}
            caption="行動指針の観点ごとの段階"
            scroll
          />
        </div>
      )}
    </section>
  );
}

function RequirementCount({ achieved, total }: { achieved: number | null; total: number | null }) {
  if (achieved === null || total === null) return null;
  return (
    <span className="block text-note text-ink-muted">
      {total}件のうち{achieved}件
    </span>
  );
}

/* ───────────── ④ レーダー図 ───────────── */

function RadarSection({ radar, baseCycleName }: { radar: ReportRadar; baseCycleName: string }) {
  const byRatio = radar.basis === "ratio";
  const showPrevious = radar.previousCycleName !== null && radar.axes.some((a) => a.previousValue !== null);
  const unrated = radar.axes.filter((a) => a.unrated);
  const data = radar.axes.map((a) => ({ item: a.item, value: a.value, previous: a.previousValue, unrated: a.unrated }));
  const columns: Column<ReportRadarAxis>[] = [
    { key: "item", header: "項目", cell: (a) => (a.unrated ? `${a.item}（※）` : a.item), role: "title" },
    byRatio
      ? { key: "now", header: "今回", cell: (a) => <Num value={a.value} unit="%" />, num: true }
      : { key: "now", header: "今回", cell: (a) => <RankMark rank={a.rank} /> },
  ];
  if (showPrevious) {
    columns.push(
      byRatio
        ? { key: "prev", header: "前回", cell: (a) => <Num value={a.previousValue} unit="%" />, num: true }
        : { key: "prev", header: "前回", cell: (a) => <RankMark rank={a.previousRank} /> },
    );
  }
  const basisNote = byRatio ? "軸の長さは、その項目の獲得点÷配点です。" : "軸の長さは、判定（A〜E）をもとにした形です。";

  return (
    <section>
      <SectionHeading help={basisNote}>KPIの項目ごとの達成度</SectionHeading>
      <ReportPair
        chart={
          <>
            {radar.asBars ? (
              // 軸が3つ未満だとレーダー図は線か点になり形が読めないので、横棒で出す
              <ul className="m-0 list-none space-y-3 p-0" aria-label="KPIの項目ごとの達成度">
                {radar.axes.map((a) => (
                  <li key={a.item}>
                    <p className="m-0 text-sub">{a.item}</p>
                    {a.value === null ? (
                      <p className="footnote m-0">判定外</p>
                    ) : (
                      <Bar value={a.value} max={100} label={byRatio ? "％" : "（判定をもとにした大きさ）"} />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <ul className="report-legend">
                  <li>
                    <span className="report-swatch" data-shape="area" />
                    今回（{baseCycleName}）
                  </li>
                  {showPrevious && (
                    <li>
                      <span className="report-swatch" data-shape="dashed-soft" />
                      前回（{radar.previousCycleName}）
                    </li>
                  )}
                </ul>
                <ReportFigure
                  label={`KPIの項目ごとの達成度のレーダー図。${radar.axes.length}項目。値は隣の表と同じです。`}
                  screen={<ReportRadarChart data={data} showPrevious={showPrevious} />}
                  print={<ReportRadarChart data={data} showPrevious={showPrevious} {...PRINT_RADAR} />}
                  printSize={PRINT_RADAR}
                />
              </>
            )}
            {unrated.length > 0 && (
              <p className="footnote m-0 mt-2">※ は実績が未入力で、判定していない項目です。0点ではありません。</p>
            )}
          </>
        }
        table={
          <DataTable
            columns={columns}
            rows={radar.axes}
            rowKey={(a) => a.item}
            caption="KPIの項目ごとの達成度（今回と前回）"
            scroll
          />
        }
      />
    </section>
  );
}

/* ───────────── ⑤〜⑦（評価者向け） ───────────── */

function ReviewerHistorySections({ report }: { report: ReviewerReport }) {
  const hasTrendPeer = report.trend.some((t) => t.peer !== null);
  const hasGradePeer = report.grades.some((g) => g.peer !== null);
  const trendData = report.trend.map((t) => ({
    cycle: t.cycleName,
    value: t.value,
    average: t.peer?.average ?? null,
    range: t.peer ? ([t.peer.min, t.peer.max] as [number, number]) : null,
  }));
  const trendColumns: Column<ReviewerTrendPoint>[] = [
    { key: "cycle", header: "評価期間", cell: (t) => t.cycleName, role: "title" },
    { key: "value", header: "本人", cell: (t) => <Num value={t.value} unit="%" />, num: true },
    { key: "avg", header: "同じ等級の平均", cell: (t) => <Num value={t.peer?.average ?? null} unit="%" />, num: true },
    { key: "range", header: "幅", cell: (t) => <PeerRange peer={t.peer} /> },
  ];
  const gradeData = report.grades.map((g) => ({ grade: g.gradeName, value: g.average, average: g.peer?.average ?? null }));
  const gradeColumns: Column<ReviewerGradeRow>[] = [
    { key: "grade", header: "等級", cell: (g) => g.gradeName, role: "title" },
    { key: "periods", header: "期の数", cell: (g) => <Num value={g.periods} />, num: true },
    { key: "avg", header: "本人の平均", cell: (g) => <Num value={g.average} unit="%" />, num: true },
    { key: "peer", header: "同じ等級の平均", cell: (g) => <Num value={g.peer?.average ?? null} unit="%" />, num: true },
  ];
  const historyColumns: Column<ReviewerHistoryRow>[] = [
    { key: "cycle", header: "評価期間", cell: (h) => <PeriodCell row={h} />, role: "title" },
    { key: "grade", header: "等級", cell: (h) => h.gradeName ?? "—" },
    {
      key: "kpi",
      header: "KPI評価点",
      cell: (h) => (
        <>
          <Num value={h.kpiTotal} /> / <Num value={h.kpiMax} unit="点" />
        </>
      ),
      num: true,
    },
    { key: "ratio", header: "KPIの達成率", cell: (h) => <Num value={h.kpiRatio} unit="%" />, num: true },
    { key: "req", header: "等級要件", cell: (h) => <Num value={h.requirementRate} unit="%" />, num: true },
    { key: "raise", header: "昇給", cell: (h) => h.raise },
    { key: "promotion", header: "昇格", cell: (h) => h.promotion },
  ];

  return (
    <>
      <section>
        <SectionHeading help={`${report.trendGradeName ?? "同じ等級"}だった期の、KPIの達成率です。`}>
          その等級の推移
        </SectionHeading>
        <ReportPair
          chart={
            <>
              <ul className="report-legend">
                <li>
                  <span className="report-swatch" data-shape="solid" />
                  本人
                </li>
                {hasTrendPeer && (
                  <>
                    <li>
                      <span className="report-swatch" data-shape="dashed" />
                      同じ等級の平均
                    </li>
                    <li>
                      <span className="report-swatch" data-shape="band" />
                      同じ等級の幅（最小〜最大）
                    </li>
                  </>
                )}
              </ul>
              <ReportFigure
                label={`${report.trend.length}期ぶんのKPIの達成率の推移の図。値は隣の表と同じです。`}
                screen={<ReportTrendChart data={trendData} />}
                print={<ReportTrendChart data={trendData} {...PRINT_CHART} />}
                printSize={PRINT_CHART}
              />
              <PeerNote />
            </>
          }
          table={
            <DataTable
              columns={trendColumns}
              rows={report.trend}
              rowKey={(t) => `${t.cycleName}-${t.periodStart ?? ""}`}
              caption="その等級の期ごとのKPIの達成率と、同じ等級の平均と幅"
              scroll
            />
          }
        />
      </section>

      <section>
        <SectionHeading help="等級ごとの、KPIの達成率の平均です。">等級ごとの点数</SectionHeading>
        <ReportPair
          chart={
            <>
              <ul className="report-legend">
                <li>
                  <span className="report-swatch" data-shape="bar" />
                  本人の平均
                </li>
                {hasGradePeer && (
                  <li>
                    <span className="report-swatch" data-shape="bar-dashed" />
                    同じ等級の平均
                  </li>
                )}
              </ul>
              <ReportFigure
                label={`${report.grades.length}等級ぶんのKPIの達成率の平均の棒グラフ。値は隣の表と同じです。`}
                screen={<ReportGradeBars data={gradeData} />}
                print={<ReportGradeBars data={gradeData} {...PRINT_CHART} />}
                printSize={PRINT_CHART}
              />
            </>
          }
          table={
            <DataTable
              columns={gradeColumns}
              rows={report.grades}
              rowKey={(g) => g.gradeName}
              caption="等級ごとの期の数とKPIの達成率の平均"
              scroll
            />
          }
        />
      </section>

      <section>
        <SectionHeading>過去の実績</SectionHeading>
        <DataTable
          columns={historyColumns}
          rows={report.history}
          rowKey={(h) => `${h.cycleName}-${h.periodStart ?? ""}`}
          caption="確定した評価の期ごとの点数と結論"
          scroll
        />
      </section>
    </>
  );
}

/* ───────────── ⑤〜⑦（本人向け） ───────────── */

/**
 * 本人向けには点数の数値を出さないので、⑤⑥は等級要件の達成率で描く（DD-024）。
 * 同じ等級の人の値は本人には出さない（読みもしない）。
 */
function SelfHistorySections({ report }: { report: SelfReport }) {
  const trendData = report.trend.map((t) => ({ cycle: t.cycleName, value: t.value, average: null, range: null }));
  const trendColumns: Column<SelfTrendPoint>[] = [
    { key: "cycle", header: "評価期間", cell: (t) => t.cycleName, role: "title" },
    { key: "value", header: "等級要件の達成率", cell: (t) => <Num value={t.value} unit="%" />, num: true },
  ];
  const gradeData = report.grades.map((g) => ({ grade: g.gradeName, value: g.averageRequirementRate, average: null }));
  const gradeColumns: Column<SelfGradeRow>[] = [
    { key: "grade", header: "等級", cell: (g) => g.gradeName, role: "title" },
    { key: "periods", header: "期の数", cell: (g) => <Num value={g.periods} />, num: true },
    { key: "avg", header: "達成率の平均", cell: (g) => <Num value={g.averageRequirementRate} unit="%" />, num: true },
  ];
  const historyColumns: Column<SelfHistoryRow>[] = [
    { key: "cycle", header: "評価期間", cell: (h) => <PeriodCell row={h} />, role: "title" },
    { key: "grade", header: "等級", cell: (h) => h.gradeName ?? "—" },
    { key: "req", header: "等級要件", cell: (h) => <Num value={h.requirementRate} unit="%" />, num: true },
    { key: "raise", header: "昇給", cell: (h) => h.raise },
    { key: "promotion", header: "昇格", cell: (h) => h.promotion },
  ];

  return (
    <>
      <section>
        <SectionHeading help={`${report.trendGradeName ?? "同じ等級"}だった期の、等級要件の達成率です。`}>
          その等級の推移
        </SectionHeading>
        <ReportPair
          chart={
            <>
              <ul className="report-legend">
                <li>
                  <span className="report-swatch" data-shape="solid" />
                  等級要件の達成率
                </li>
              </ul>
              <ReportFigure
                label={`${report.trend.length}期ぶんの等級要件の達成率の推移の図。値は隣の表と同じです。`}
                screen={<ReportTrendChart data={trendData} />}
                print={<ReportTrendChart data={trendData} {...PRINT_CHART} />}
                printSize={PRINT_CHART}
              />
            </>
          }
          table={
            <DataTable
              columns={trendColumns}
              rows={report.trend}
              rowKey={(t) => `${t.cycleName}-${t.periodStart ?? ""}`}
              caption="その等級の期ごとの等級要件の達成率"
              scroll
            />
          }
        />
      </section>

      <section>
        <SectionHeading help="等級ごとの、等級要件の達成率の平均です。">等級ごとの達成率</SectionHeading>
        <ReportPair
          chart={
            <>
              <ul className="report-legend">
                <li>
                  <span className="report-swatch" data-shape="bar" />
                  達成率の平均
                </li>
              </ul>
              <ReportFigure
                label={`${report.grades.length}等級ぶんの等級要件の達成率の平均の棒グラフ。値は隣の表と同じです。`}
                screen={<ReportGradeBars data={gradeData} />}
                print={<ReportGradeBars data={gradeData} {...PRINT_CHART} />}
                printSize={PRINT_CHART}
              />
            </>
          }
          table={
            <DataTable
              columns={gradeColumns}
              rows={report.grades}
              rowKey={(g) => g.gradeName}
              caption="等級ごとの期の数と等級要件の達成率の平均"
              scroll
            />
          }
        />
      </section>

      <section>
        <SectionHeading>過去の実績</SectionHeading>
        <DataTable
          columns={historyColumns}
          rows={report.history}
          rowKey={(h) => `${h.cycleName}-${h.periodStart ?? ""}`}
          caption="確定した評価の期ごとの等級要件と結論"
          scroll
        />
      </section>
    </>
  );
}

/* ───────────── 共通の小さな部品 ───────────── */

/** 図と、その値を読める表を同じ順序・幅の枠で並べる。本人向けと評価者向けの中身は混ぜない。 */
function ReportPair({ chart, table }: { chart: ReactNode; table: ReactNode }) {
  return (
    <div className="report-pair">
      <Card className="card-pad report-pair-chart">{chart}</Card>
      <div className="report-pair-table">{table}</div>
    </div>
  );
}

/* 印刷用の図の大きさ。A4縦（余白12mm・本文の幅は約700px）で図と表を左右に並べ、
   表が切れずに入る幅にする。高さは2枚に収まるように決めた。
   レーダー図は隣の表が3列と細いので、軸の名前と凡例2つが1行に入る幅まで広げ、低くする */
const PRINT_CHART = { width: 300, height: 200 };
const PRINT_RADAR = { width: 380, height: 190 };

/** 1つのデータを、画面用（幅に合わせる）と印刷用（決まった大きさ）の2通りに描く */
function ReportFigure({
  label,
  screen,
  print,
  printSize,
}: {
  label: string;
  screen: ReactNode;
  print: ReactNode;
  printSize: { width: number; height: number };
}) {
  return (
    <figure className="report-figure m-0" role="img" aria-label={label}>
      <div className="report-chart-screen">{screen}</div>
      {/* 図は遅れて読み込むので、届く前に刷られても紙面が伸びないよう、枠を紙の大きさで先に取る */}
      <div className="report-chart-print" style={{ width: `calc(${printSize.width}px * var(--report-print-scale, 1))`, height: `calc(${printSize.height}px * var(--report-print-scale, 1))` }} aria-hidden="true">
        {print}
      </div>
    </figure>
  );
}

function PeerRange({ peer }: { peer: ReportPeerStat | null }) {
  if (!peer) return <span className="text-ink-muted">—</span>;
  return (
    <span className="num">
      <Num value={peer.min} />〜<Num value={peer.max} unit="%" />
      <span className="block text-note text-ink-muted">{peer.people}人</span>
    </span>
  );
}

function PeerNote() {
  return <p className="footnote m-0 mt-2">同じ等級の平均と幅は、3人以上いる期だけ出します。</p>;
}

/** 上司の判断を記録した人と日時。記録の無い評価（この仕組みより前に確定）は — だけにする */
function RecordedBy({ name, at }: { name: string | null; at: Date | null }) {
  if (!name && !at) return <span className="text-ink-muted">—</span>;
  return (
    <>
      {name ?? "—"}
      <span className="block text-note text-ink-muted">{formatDateTime(at)}</span>
    </>
  );
}

function PeriodCell({ row }: { row: { cycleName: string; periodStart: string | null; periodEnd: string | null } }) {
  return (
    <>
      {row.cycleName}
      <span className="block text-note text-ink-muted">{formatPeriod(row.periodStart, row.periodEnd)}</span>
    </>
  );
}
