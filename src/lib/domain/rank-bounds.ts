import { checkNumberMagnitude } from "@/lib/domain/number-input";
import { RANK_ORDER, type Direction, type Rank } from "@/lib/domain/scoring";

/**
 * ランクA〜Eの境界が、重なりも隙間もなく繋がっているかを見る。
 *
 * なぜ1ランクずつでは足りないか:
 *   1つのランクの中で「下限 < 上限」を確かめても、**ランク同士の関係は誰も見ていない**。
 *   A「80以上」・B「60以上85未満」なら 85〜99 は両方に当てはまり、
 *   どちらに判定されるかは並び順まかせになる（説明できない結果になる）。
 *   A「90以上」・B「60以上80未満」なら 80〜89 がどこにも当てはまらない。
 *
 * 判定の規則（scoring.ts の matchesCriterion が本体、ここはその写し）:
 *   - higher（高いほど良い）… 下限は含む・上限は含まない。A がいちばん大きい値の側。
 *   - lower （低いほど良い）… 下限は含まない・上限は含む。A がいちばん小さい値の側。
 *   どちらの向きでも「A から E へ向かって、良い側から悪い側へ並ぶ」ことは変わらないが、
 *   **繋ぎ目に来る欄が逆になる**（higher は上のランクの下限＝下のランクの上限、
 *   lower は上のランクの上限＝下のランクの下限）。ここを取り違えると、
 *   片方の向きだけ検査がすり抜ける。
 *
 * 端（A の外側・E の外側）は必ず空欄にする。閉じてしまうと、その外の実績値が
 * どのランクにも当てはまらなくなる（判定は E に丸めるが、それは事故の隠蔽でしかない）。
 *
 * この関数は画面と保存の受け口の**両方**から呼ぶ。片方だけに置くと必ず食い違う。
 */

export type RankBoundRow = {
  rank: string;
  lowerBound: number | null;
  upperBound: number | null;
};

/** 直し方の提案。勝手には書き換えず、押してもらうために持ち回る。 */
export type BoundFix = {
  rank: string;
  field: "lowerBound" | "upperBound";
  value: number | null;
};

export type BoundIssue = {
  message: string;
  fix: BoundFix | null;
};

export type BoundCheck = { ok: true } | { ok: false; issues: BoundIssue[] };

function num(v: number | null): string {
  return v === null ? "空欄" : String(v);
}

/** A→E の順（良い側から悪い側へ）に並べ直す。A〜E 以外は末尾へ回す。 */
export function sortByRank<T extends { rank: string }>(rows: T[]): T[] {
  const order = (r: string) => {
    const i = RANK_ORDER.indexOf(r as Rank);
    return i === -1 ? RANK_ORDER.length : i;
  };
  return [...rows].sort((a, b) => order(a.rank) - order(b.rank));
}

export function checkRankBoundaries(rows: RankBoundRow[], direction: Direction): BoundCheck {
  const sorted = sortByRank(rows);
  const issues: BoundIssue[] = [];
  if (sorted.length === 0) return { ok: true };

  /* 向きによって、どちらの欄が「外側の端」になるかが入れ替わる。
     higher … A の上限が外側（青天井）、E の下限が外側（下限なし）
     lower  … A の下限が外側（0に近い側）、E の上限が外側（上限なし） */
  const outerOfBest: "lowerBound" | "upperBound" = direction === "lower" ? "lowerBound" : "upperBound";
  const outerOfWorst: "lowerBound" | "upperBound" = direction === "lower" ? "upperBound" : "lowerBound";
  /* 繋ぎ目。higher は「上のランクの下限」と「下のランクの上限」が同じ値、
     lower は「上のランクの上限」と「下のランクの下限」が同じ値。 */
  const joinOfBetter: "lowerBound" | "upperBound" = direction === "lower" ? "upperBound" : "lowerBound";
  const joinOfWorse: "lowerBound" | "upperBound" = direction === "lower" ? "lowerBound" : "upperBound";
  const sideWord = (f: "lowerBound" | "upperBound") => (f === "lowerBound" ? "下限" : "上限");

  /* いちばん先に、桁が多すぎる値を断る。
     ここを先に見るのは、言い方の問題。1兆を超える値を1つ置くと、隣のランクと必ず繋がらなくなり、
     そのままだと「隣とつながっていません」とだけ言われる。本当の原因は桁の打ち間違いなので、
     直すべき場所（どのランクのどちらの欄か）が伝わる言葉を先に出す。
     決まりそのものは回答の受け取りと同じ `MAX_ABS_NUMBER`（1兆）で、ここに別の基準は置かない。 */
  const tooLarge: BoundIssue[] = [];
  for (const r of sorted) {
    for (const field of ["lowerBound", "upperBound"] as const) {
      const m = checkNumberMagnitude(`ランク${r.rank}の${sideWord(field)}（${num(r[field])}）`, r[field]);
      if (!m.ok) tooLarge.push({ message: m.message, fix: null });
    }
  }
  if (tooLarge.length > 0) return { ok: false, issues: tooLarge };

  // 1つの中で逆転していないか（下限 < 上限）
  for (const r of sorted) {
    if (r.lowerBound === null || r.upperBound === null) continue;
    if (r.lowerBound > r.upperBound) {
      issues.push({
        message: `ランク${r.rank}の下限（${r.lowerBound}）が上限（${r.upperBound}）より大きくなっています。`,
        fix: null,
      });
    } else if (r.lowerBound === r.upperBound) {
      issues.push({
        message: `ランク${r.rank}の下限と上限が同じ（${r.lowerBound}）です。当てはまる実績値がありません。`,
        fix: null,
      });
    }
  }

  // 端が閉じていないか
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best[outerOfBest] !== null) {
    issues.push({
      message: `いちばん上のランク${best.rank}に${sideWord(outerOfBest)}（${best[outerOfBest]}）が入っています。これより外側の実績値がどのランクにも当てはまりません。ランク${best.rank}の${sideWord(outerOfBest)}を空欄にすると、上限なしになります。`,
      fix: { rank: best.rank, field: outerOfBest, value: null },
    });
  }
  if (sorted.length > 1 && worst[outerOfWorst] !== null) {
    issues.push({
      message: `いちばん下のランク${worst.rank}に${sideWord(outerOfWorst)}（${worst[outerOfWorst]}）が入っています。これより外側の実績値がどのランクにも当てはまりません。ランク${worst.rank}の${sideWord(outerOfWorst)}を空欄にすると、制限なしになります。`,
      fix: { rank: worst.rank, field: outerOfWorst, value: null },
    });
  }

  // 隣同士の繋ぎ目
  for (let i = 0; i < sorted.length - 1; i++) {
    const better = sorted[i];
    const worse = sorted[i + 1];
    const a = better[joinOfBetter];
    const b = worse[joinOfWorse];
    if (a === null || b === null) {
      issues.push({
        message: `ランク${better.rank}の${sideWord(joinOfBetter)}（${num(a)}）とランク${worse.rank}の${sideWord(joinOfWorse)}（${num(b)}）が繋がっていません。どちらかが空欄だと、その間の実績値がどのランクにも当てはまりません。`,
        fix: a !== null ? { rank: worse.rank, field: joinOfWorse, value: a } : null,
      });
      continue;
    }
    if (a === b) continue;
    const gap = direction === "lower" ? b > a : b < a;
    if (gap) {
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      issues.push({
        message: `${from}〜${to}の実績値がどのランクにも当てはまりません（ランク${better.rank}の${sideWord(joinOfBetter)}が${a}、ランク${worse.rank}の${sideWord(joinOfWorse)}が${b}）。ランク${worse.rank}の${sideWord(joinOfWorse)}を${a}にすると繋がります。`,
        fix: { rank: worse.rank, field: joinOfWorse, value: a },
      });
    } else {
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      issues.push({
        message: `${from}〜${to}の実績値がランク${better.rank}とランク${worse.rank}の両方に当てはまります（ランク${better.rank}の${sideWord(joinOfBetter)}が${a}、ランク${worse.rank}の${sideWord(joinOfWorse)}が${b}）。ランク${worse.rank}の${sideWord(joinOfWorse)}を${a}にすると重なりが無くなります。`,
        fix: { rank: worse.rank, field: joinOfWorse, value: a },
      });
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/** 提案をまとめて当てた結果を返す（元の配列は変えない）。 */
export function applyFixes(rows: RankBoundRow[], fixes: BoundFix[]): RankBoundRow[] {
  return rows.map((r) => {
    const f = fixes.find((x) => x.rank === r.rank);
    return f ? { ...r, [f.field]: f.value } : r;
  });
}
