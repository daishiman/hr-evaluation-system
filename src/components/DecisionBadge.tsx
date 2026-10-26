import {
  conclusionText,
  DECISION_PENDING_TEXT,
  DECISION_UNRECORDED_TEXT,
  finalDecision,
  scoreJudgementText,
  type DecisionKind,
  type DecisionSubject,
  type FinalDecision,
} from "@/lib/domain/final-decision";

/**
 * 昇給・昇格の最終の結論（DD-024・qa-y10 (21)）。
 *
 * 評価の詳細・本人の結果・評価期間の一覧・レポートは、結論をこの部品だけで出す。
 * 文言は final-decision.ts の関数から作り、ここで言い回しを足さない。
 * 上司が変えたことは「（上司の判断）」という語で示し、色だけで区別しない。
 */
export function DecisionBadge({
  subject,
  scoreJudgement,
  decision,
  reason,
  finalized,
  compact,
  conclusionOnly,
}: {
  subject: DecisionSubject;
  /** 点数の判定（raiseEligible / promotionEligible） */
  scoreJudgement: boolean;
  decision: DecisionKind | null | undefined;
  /** 上司が変えたときの理由。本人にも同じ文で見せる（DD-023） */
  reason: string | null | undefined;
  finalized: boolean;
  /** 一覧の1セル向け。結論の1行と、変えたときの点数の判定だけを出す */
  compact?: boolean;
  /** 点数の判定・上司の判断・理由を別の欄に並べる場所（レポート）向け。結論の1行だけを出す */
  conclusionOnly?: boolean;
}) {
  const fd = finalDecision(scoreJudgement, decision);
  return (
    <span className="decision-badge block ui-mark">
      <span className="block font-semibold">{conclusionText(subject, fd)}</span>
      {!conclusionOnly && <DecisionDetails fd={fd} reason={reason} finalized={finalized} compact={compact} />}
    </span>
  );
}

/**
 * 結論の下に添える説明。変えたときは点数の判定と理由、記録が無いときはその旨。
 * 判定どおり（follow）のときは何も出さない（結論の1行で足りる）。
 */
export function DecisionDetails({
  fd,
  reason,
  finalized,
  compact,
}: {
  fd: FinalDecision;
  reason: string | null | undefined;
  finalized: boolean;
  compact?: boolean;
}) {
  if (fd.overridden) {
    return (
      // 文字の色は ui-mark-note の規則が持つ（補足は muted、中の理由は本文の色）
      <span className="block text-note ui-mark-note">
        {scoreJudgementText(fd.scoreJudgement)}
        {!compact && reason && (
          <span className="block whitespace-pre-wrap text-sub">理由：{reason}</span>
        )}
      </span>
    );
  }
  if (!fd.unrecorded) return null;
  // 確認中の評価に「記録なし」と出すと、まだ選んでいないだけなのに古い評価に見える。一覧では黙る
  if (!finalized) return compact ? null : <span className="block footnote">{DECISION_PENDING_TEXT}</span>;
  return <span className="block footnote">{DECISION_UNRECORDED_TEXT}</span>;
}
