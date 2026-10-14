import type { LatestScore } from "@/lib/score-visibility";
import { Num } from "@/components/ui";

/**
 * 一覧の右端に置く、確定した最新の評価の点数（S6・A5）。
 * KPI評価点（満点つき）・等級要件の達成率・どの評価期間の値かを2行で出す。確定した評価が無ければそう書く。
 * 見てよくない役割にはサーバーが点数を渡さないので、この部品を描かない。
 */
export function LatestScoreValue({ score }: { score: LatestScore | null }) {
  if (!score) return <span className="user-row-score footnote">確定した評価なし</span>;
  return (
    <span className="user-row-score">
      <span className="text-body font-semibold text-ink">
        <Num value={score.totalScore} />
        <span className="unit">／{score.maxScore}点</span>
      </span>
      <span className="text-note text-ink-muted">
        達成率 <Num value={score.requirementRate} unit="%" />・{score.cycleName}
      </span>
    </span>
  );
}
