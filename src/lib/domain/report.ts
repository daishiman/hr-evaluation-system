/**
 * 個人別の評価レポート（G18・I19・DD-024）。
 *
 * レポートは保存した写しを持たず、開くたびに確定した評価からこの関数で作る。
 * 確定した評価は後から変わらないので、同じ入力からは同じ出力になる（qa-x06 (2)）。
 * そのために、並び順（開始日→終了日→id）・丸め（小数第1位）・作った時刻を外から受け取ることを固定する。
 *
 * 見る人が本人なら、型ごと本人向けの形に落とす（SelfReport）。
 * 本人向けの型は点数の鍵（kpiTotal・kpiRatio・behaviorTotal・peer）を持たないので、
 * 画面が誤って点数を描こうとしても型で止まる。値を null にするだけだと、鍵が残って描けてしまう。
 *
 * - 期や等級をまたぐ図は、満点に対する割合（KPI評価点の合計 ÷ 満点 × 100）で比べる（qa-x06 (4)）
 * - 同じ等級の平均と幅は、同じ会社の確定した評価だけから作り、3人未満なら出さない（qa-x06 (5)）
 * - 本人向けは、点数の代わりに判定（A〜E）と等級要件の達成率（本人の結果の画面でも見えている値）で描く
 */

import { buildRadarValues, type RadarSourceItem } from "@/lib/domain/evaluation-view";
import {
  conclusionText,
  conclusionValue,
  DECISION_SUBJECT_LABEL,
  DECISION_SUBJECTS,
  decisionKindText,
  finalDecisionOf,
  scoreJudgementText,
  shortJudgementReason,
  type DecisionColumns,
  type DecisionKind,
  type DecisionSubject,
} from "@/lib/domain/final-decision";

/** 同じ等級の平均を出す最少の人数。これより少ないと、平均から個人の点数が分かる */
export const REPORT_PEER_MIN = 3;

/** レーダー図の軸がこれより少ないと、形にならないので棒グラフで描く */
export const REPORT_RADAR_MIN_AXES = 3;

/* ───────────── 入力 ───────────── */

/** 評価1件（listEvaluations の行のうち、レポートが読む列） */
export interface ReportEvaluationInput extends DecisionColumns {
  id: string;
  cycleName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  gradeId: string | null;
  gradeName: string | null;
  gradeOrder: number | null;
  /** 本人向けの行では null（listEvaluations が削る） */
  totalScore: number | null;
  maxScore: number | null;
  requirementRate: number | null;
  requirementAchieved: number | null;
  requirementTotal: number | null;
  behaviorTotal: number | null;
  evaluatorComment: string | null;
}

export interface ReportBehaviorInput {
  aspectName: string;
  /** 本人向けでは null（getEvaluationDetail が削る） */
  score: number | null;
  levelLabel: string | null;
}

/** 基にした評価（最新の確定）の中身。理由の文は、閲覧者に合わせて削った後の値を渡す */
export interface ReportDetailInput {
  items: RadarSourceItem[];
  behaviors: ReportBehaviorInput[];
  raiseReason: string | null;
  promotionBlockedReason: string | null;
}

/** 同じ会社の確定した評価1件（同じ等級の平均に使う）。評価者向けのときだけ渡す */
export interface ReportPeerInput {
  employeeId: string;
  cycleId: string;
  gradeId: string | null;
  totalScore: number;
  maxScore: number;
}

interface ReportInputBase {
  employeeName: string;
  currentGradeName: string | null;
  officeName: string | null;
  generatedAt: Date;
  /** 確定していない評価が混ざっていてもよい（ここで落とす） */
  evaluations: (ReportEvaluationInput & { cycleId: string })[];
  /** 最新の確定の中身。確定が無いときは null */
  latest: ReportDetailInput | null;
  /** 1つ前の確定の項目（レーダー図に重ねる）。無いときは null */
  previousItems: RadarSourceItem[] | null;
  /** 判断を記録した人の名前（利用者 id → 名前） */
  recorderNames: Record<string, string>;
}

export type ReportInput =
  | (ReportInputBase & { view: "reviewer"; peers: ReportPeerInput[] })
  | (ReportInputBase & { view: "self" });

/* ───────────── 出力 ───────────── */

export interface ReportHeader {
  employeeName: string;
  currentGradeName: string | null;
  officeName: string | null;
  baseCycleName: string;
  basePeriodStart: string | null;
  basePeriodEnd: string | null;
  generatedAt: Date;
}

export interface ReportDecision {
  subject: DecisionSubject;
  label: string;
  /** 例：昇給：見送り（上司の判断） */
  conclusion: string;
  approved: boolean;
  overridden: boolean;
  unrecorded: boolean;
  /** 点数の判定と上司の判断の生の値。画面は DecisionBadge にこの2つを渡して結論を描く */
  scoreJudgement: boolean;
  decision: DecisionKind | null;
  /** 例：点数の判定では可 */
  scoreJudgementText: string;
  /** 点数の判定の短い理由。本人向けは本人向けの文 */
  scoreReason: string;
  /** 例：点数の判定どおり／変える／記録なし */
  decisionKind: string;
  /** 「変える」のときの理由。本人にも同じ文を見せる（DD-023） */
  decisionReason: string | null;
  recordedBy: string | null;
  recordedAt: Date | null;
}

export interface ReportRadarAxis {
  item: string;
  /** 0〜100。判定外は null（0点と混ぜない） */
  value: number | null;
  rank: string | null;
  unrated: boolean;
  /** 前の期の同じ項目。前の期に無い項目は null */
  previousValue: number | null;
  previousRank: string | null;
}

export interface ReportRadar {
  axes: ReportRadarAxis[];
  /** 軸が3未満なら棒グラフで描く */
  asBars: boolean;
  previousCycleName: string | null;
  /** ratio ＝ 獲得点 ÷ 配点（評価者向け）／ rank ＝ 判定を等間隔に置いた形（本人向け） */
  basis: "ratio" | "rank";
}

export interface ReportPeerStat {
  average: number;
  min: number;
  max: number;
  people: number;
}

interface ReportPeriod {
  cycleName: string;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ReviewerTrendPoint extends ReportPeriod {
  /** KPI評価点の合計 ÷ 満点（%） */
  value: number | null;
  peer: ReportPeerStat | null;
}

export interface SelfTrendPoint extends ReportPeriod {
  /** 等級要件の達成率（%） */
  value: number | null;
}

export interface ReviewerGradeRow {
  gradeName: string;
  periods: number;
  /** その等級にいた期の KPI評価点の割合の平均（%） */
  average: number | null;
  peer: ReportPeerStat | null;
}

export interface SelfGradeRow {
  gradeName: string;
  periods: number;
  /** その等級にいた期の等級要件の達成率の平均（%） */
  averageRequirementRate: number | null;
}

export interface ReviewerHistoryRow extends ReportPeriod {
  gradeName: string | null;
  kpiTotal: number | null;
  kpiMax: number | null;
  kpiRatio: number | null;
  requirementRate: number | null;
  raise: string;
  promotion: string;
}

export interface SelfHistoryRow extends ReportPeriod {
  gradeName: string | null;
  requirementRate: number | null;
  raise: string;
  promotion: string;
}

export interface ReviewerScores {
  kpiTotal: number | null;
  kpiMax: number | null;
  kpiRatio: number | null;
  requirementRate: number | null;
  requirementAchieved: number | null;
  requirementTotal: number | null;
  behaviorTotal: number | null;
  behaviors: { aspectName: string; score: number | null; levelLabel: string | null }[];
}

export interface SelfJudgements {
  kpiRanks: { item: string; rank: string | null }[];
  /** A〜E と判定外の件数（0件の判定も並べる） */
  rankCounts: { rank: string; count: number }[];
  requirementRate: number | null;
  requirementAchieved: number | null;
  requirementTotal: number | null;
  behaviors: { aspectName: string; levelLabel: string | null }[];
}

export interface ReportBody {
  header: ReportHeader;
  decisions: ReportDecision[];
  radar: ReportRadar;
  trendGradeName: string | null;
  comment: string | null;
}

export interface ReviewerReport extends ReportBody {
  kind: "reviewer";
  scores: ReviewerScores;
  trend: ReviewerTrendPoint[];
  grades: ReviewerGradeRow[];
  history: ReviewerHistoryRow[];
}

export interface SelfReport extends ReportBody {
  kind: "self";
  judgements: SelfJudgements;
  trend: SelfTrendPoint[];
  grades: SelfGradeRow[];
  history: SelfHistoryRow[];
}

/** 確定した評価が1件も無い */
export interface EmptyReport {
  kind: "empty";
  view: "reviewer" | "self";
  employeeName: string;
  currentGradeName: string | null;
  generatedAt: Date;
}

export type EvaluationReport = ReviewerReport | SelfReport | EmptyReport;

/* ───────────── 小さな規則 ───────────── */

/** 小数第1位に丸める（レポートの数値はすべてこれを通す） */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 満点に対する割合（%）。満点が無いときは null */
export function scoreRatio(total: number | null, max: number | null): number | null {
  if (total === null || max === null || max <= 0) return null;
  return round1((total / max) * 100);
}

/** 期の並び。開始日→終了日→id（同じ開始日の期の選び方を固定する。latestFinalizedRows と同じ順） */
export function compareByPeriod(
  a: { periodStart: string | null; periodEnd: string | null; id: string },
  b: { periodStart: string | null; periodEnd: string | null; id: string },
): number {
  return (
    (a.periodStart ?? "").localeCompare(b.periodStart ?? "") ||
    (a.periodEnd ?? "").localeCompare(b.periodEnd ?? "") ||
    a.id.localeCompare(b.id)
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** 同じ等級の平均と幅。人数（重ならない社員の数）が REPORT_PEER_MIN 未満なら出さない */
export function peerStat(rows: { employeeId: string; ratio: number }[]): ReportPeerStat | null {
  const people = new Set(rows.map((r) => r.employeeId)).size;
  if (people < REPORT_PEER_MIN) return null;
  const ratios = rows.map((r) => r.ratio);
  return {
    average: average(ratios) as number,
    min: round1(Math.min(...ratios)),
    max: round1(Math.max(...ratios)),
    people,
  };
}

const RANK_ORDER = ["A", "B", "C", "D", "E"];
const UNRATED_LABEL = "判定外";

function periodOf(e: ReportEvaluationInput): ReportPeriod {
  return { cycleName: e.cycleName ?? "—", periodStart: e.periodStart, periodEnd: e.periodEnd };
}

/** 等級ごとにまとめる。並びは等級の表示順（無ければ初めて経た順） */
function groupByGrade(rows: ReportEvaluationInput[]): { gradeName: string; rows: ReportEvaluationInput[] }[] {
  const groups = new Map<string, { gradeName: string; order: number; first: number; rows: ReportEvaluationInput[] }>();
  rows.forEach((e, i) => {
    const key = e.gradeId ?? `name:${e.gradeName ?? "—"}`;
    const g = groups.get(key) ?? {
      gradeName: e.gradeName ?? "—",
      order: e.gradeOrder ?? Number.MAX_SAFE_INTEGER,
      first: i,
      rows: [],
    };
    g.rows.push(e);
    groups.set(key, g);
  });
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.first - b.first)
    .map(({ gradeName, rows: r }) => ({ gradeName, rows: r }));
}

function buildDecisions(
  latest: ReportEvaluationInput,
  detail: ReportDetailInput,
  recorderNames: Record<string, string>,
): ReportDecision[] {
  const recordedBy = latest.decisionRecordedBy ? (recorderNames[latest.decisionRecordedBy] ?? null) : null;
  return DECISION_SUBJECTS.map((subject) => {
    const fd = finalDecisionOf(subject, latest);
    const reasonText = subject === "raise" ? detail.raiseReason : detail.promotionBlockedReason;
    const decisionReason = subject === "raise" ? latest.raiseDecisionReason : latest.promotionDecisionReason;
    return {
      subject,
      label: DECISION_SUBJECT_LABEL[subject],
      conclusion: conclusionText(subject, fd),
      approved: fd.approved,
      overridden: fd.overridden,
      unrecorded: fd.unrecorded,
      scoreJudgement: fd.scoreJudgement,
      decision: fd.decision,
      scoreJudgementText: scoreJudgementText(fd.scoreJudgement),
      scoreReason: shortJudgementReason(subject, fd.scoreJudgement, reasonText),
      decisionKind: decisionKindText(fd, { finalized: true }),
      decisionReason: fd.overridden ? decisionReason : null,
      recordedBy: fd.unrecorded ? null : recordedBy,
      recordedAt: fd.unrecorded ? null : (latest.decisionRecordedAt ?? null),
    };
  });
}

function buildRadar(
  items: RadarSourceItem[],
  previousItems: RadarSourceItem[] | null,
  previousCycleName: string | null,
  isReviewer: boolean,
): ReportRadar {
  const current = buildRadarValues(items, isReviewer);
  const previous = new Map(buildRadarValues(previousItems ?? [], isReviewer).map((v) => [v.item, v]));
  return {
    axes: current.map((v) => {
      const p = previous.get(v.item);
      return { ...v, previousValue: p?.value ?? null, previousRank: p?.rank ?? null };
    }),
    asBars: current.length < REPORT_RADAR_MIN_AXES,
    previousCycleName: previousItems ? previousCycleName : null,
    basis: isReviewer ? "ratio" : "rank",
  };
}

function conclusionCells(e: ReportEvaluationInput): { raise: string; promotion: string } {
  return {
    raise: conclusionValue(finalDecisionOf("raise", e)),
    promotion: conclusionValue(finalDecisionOf("promotion", e)),
  };
}

/* ───────────── 組み立て ───────────── */

/**
 * レポートを作る。
 * 評価者向けの点数は、評価者向けに読んだ行からだけ作る（本人向けの行の totalScore は null）。
 */
export function buildEvaluationReport(input: ReportInput): EvaluationReport {
  const finalized = input.evaluations.filter((e) => e.status === "finalized").sort(compareByPeriod);
  const latest = finalized.at(-1);
  if (!latest || !input.latest) {
    return {
      kind: "empty",
      view: input.view,
      employeeName: input.employeeName,
      currentGradeName: input.currentGradeName,
      generatedAt: input.generatedAt,
    };
  }

  const previous = finalized.at(-2) ?? null;
  const isReviewer = input.view === "reviewer";
  const inTrendGrade = finalized.filter((e) => e.gradeId === latest.gradeId && e.gradeName === latest.gradeName);
  const body: ReportBody = {
    header: {
      employeeName: input.employeeName,
      currentGradeName: input.currentGradeName,
      officeName: input.officeName,
      baseCycleName: latest.cycleName ?? "—",
      basePeriodStart: latest.periodStart,
      basePeriodEnd: latest.periodEnd,
      generatedAt: input.generatedAt,
    },
    decisions: buildDecisions(latest, input.latest, input.recorderNames),
    radar: buildRadar(input.latest.items, input.previousItems, previous?.cycleName ?? null, isReviewer),
    trendGradeName: latest.gradeName,
    comment: latest.evaluatorComment?.trim() ? latest.evaluatorComment : null,
  };

  if (input.view === "self") {
    const counts = new Map<string, number>();
    for (const item of input.latest.items) {
      const key = item.rank ?? UNRATED_LABEL;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
      ...body,
      kind: "self",
      judgements: {
        kpiRanks: input.latest.items.map((i) => ({ item: i.itemName, rank: i.rank })),
        rankCounts: [...RANK_ORDER, UNRATED_LABEL]
          .map((rank) => ({ rank, count: counts.get(rank) ?? 0 }))
          .filter((c) => c.rank !== UNRATED_LABEL || c.count > 0),
        requirementRate: latest.requirementRate,
        requirementAchieved: latest.requirementAchieved,
        requirementTotal: latest.requirementTotal,
        behaviors: input.latest.behaviors.map((b) => ({ aspectName: b.aspectName, levelLabel: b.levelLabel })),
      },
      trend: inTrendGrade.map((e) => ({ ...periodOf(e), value: e.requirementRate })),
      grades: groupByGrade(finalized).map((g) => ({
        gradeName: g.gradeName,
        periods: g.rows.length,
        averageRequirementRate: average(
          g.rows.flatMap((e) => (e.requirementRate === null ? [] : [e.requirementRate])),
        ),
      })),
      history: finalized.map((e) => ({
        ...periodOf(e),
        gradeName: e.gradeName,
        requirementRate: e.requirementRate,
        ...conclusionCells(e),
      })),
    };
  }

  const peers = input.peers.map((p) => ({
    employeeId: p.employeeId,
    cycleId: p.cycleId,
    gradeId: p.gradeId,
    ratio: scoreRatio(p.totalScore, p.maxScore),
  }));
  // 等級の分からない評価どうしは同じ等級として比べない
  const peersOf = (gradeId: string | null, cycleId?: string) =>
    peers.flatMap((p) =>
      gradeId !== null &&
      p.ratio !== null &&
      p.gradeId === gradeId &&
      (cycleId === undefined || p.cycleId === cycleId)
        ? [{ employeeId: p.employeeId, ratio: p.ratio }]
        : [],
    );

  return {
    ...body,
    kind: "reviewer",
    scores: {
      kpiTotal: latest.totalScore === null ? null : round1(latest.totalScore),
      kpiMax: latest.maxScore === null ? null : round1(latest.maxScore),
      kpiRatio: scoreRatio(latest.totalScore, latest.maxScore),
      requirementRate: latest.requirementRate,
      requirementAchieved: latest.requirementAchieved,
      requirementTotal: latest.requirementTotal,
      behaviorTotal: latest.behaviorTotal === null ? null : round1(latest.behaviorTotal),
      behaviors: input.latest.behaviors.map((b) => ({
        aspectName: b.aspectName,
        score: b.score,
        levelLabel: b.levelLabel,
      })),
    },
    trend: inTrendGrade.map((e) => ({
      ...periodOf(e),
      value: scoreRatio(e.totalScore, e.maxScore),
      peer: peerStat(peersOf(e.gradeId, e.cycleId)),
    })),
    grades: groupByGrade(finalized).map((g) => ({
      gradeName: g.gradeName,
      periods: g.rows.length,
      average: average(g.rows.flatMap((e) => {
        const r = scoreRatio(e.totalScore, e.maxScore);
        return r === null ? [] : [r];
      })),
      peer: peerStat(peersOf(g.rows[0].gradeId)),
    })),
    history: finalized.map((e) => ({
      ...periodOf(e),
      gradeName: e.gradeName,
      kpiTotal: e.totalScore === null ? null : round1(e.totalScore),
      kpiMax: e.maxScore === null ? null : round1(e.maxScore),
      kpiRatio: scoreRatio(e.totalScore, e.maxScore),
      requirementRate: e.requirementRate,
      ...conclusionCells(e),
    })),
  };
}
