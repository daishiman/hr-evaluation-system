/**
 * ランク判定と得点化。
 *
 * 制度上の決めごと（元スプレッドシート「KPI基準定義」より）:
 *  - ランクは A〜E の5段階。閾値は kpi_rank_criteria テーブルが正であり、コードに書かない。
 *  - 通常の項目は「下限以上・上限未満」。
 *  - 逆転指標（残業率・欠員日数・ミス件数）は「上限以下」で判定する。
 *  - 昇給条件は「選択した項目がすべてA」。
 */

export type Rank = "A" | "B" | "C" | "D" | "E";

export const RANK_ORDER: Rank[] = ["A", "B", "C", "D", "E"];

/** 高いほど良い（higher）／低いほど良い＝逆転指標（lower） */
export type Direction = "higher" | "lower";

export interface RankCriterion {
  rank: Rank;
  displayLabel: string;
  /** 下限（この値を含む）。null は下限なし */
  lowerBound: number | null;
  /** 上限（この値を含まない）。null は上限なし */
  upperBound: number | null;
  meaning?: string | null;
}

export interface RankJudgement {
  rank: Rank;
  criterion: RankCriterion | null;
  /** 「なぜこのランクか」を日本語で説明した文字列 */
  rationale: string;
  /** 基準表に穴があり、最下位ランクへ丸めた場合に true */
  fellThrough: boolean;
}

/**
 * 実績値からランクを判定する。
 *
 * criteria は A→E の順に並んでいなくてもよい（内部で並べ替える）。
 */
export function judgeRank(value: number, criteria: RankCriterion[], direction: Direction): RankJudgement {
  const sorted = [...criteria].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  for (const c of sorted) {
    if (matchesCriterion(value, c, direction)) {
      return {
        rank: c.rank,
        criterion: c,
        rationale: `実績値 ${formatValue(value)} が「${c.displayLabel}」に該当するため ${c.rank} と判定しました。`,
        fellThrough: false,
      };
    }
  }

  // どのランクにも当てはまらなかった場合（基準表に穴がある場合）は最下位に丸め、その事実を残す。
  const last = sorted[sorted.length - 1] ?? null;
  return {
    rank: "E",
    criterion: last,
    rationale: `実績値 ${formatValue(value)} は基準表のどの範囲にも一致しなかったため、最下位の E として扱いました。基準表の見直しが必要です。`,
    fellThrough: true,
  };
}

/**
 * 実績値が1つのランク基準の範囲に入るかを判定する。
 *
 * 境界ルール（元シート【E】確認事項7）:
 *   - 通常の項目は「下限以上・上限未満」    → lower ≦ x < upper
 *   - 逆転指標は「上限以下・下限超」        → lower < x ≦ upper
 * どちらも境界を含む側が1つだけになるので、隣り合うランクで値が二重に該当しない。
 * 下限・上限が null の側はチェックしない（＝青天井）。
 */
export function matchesCriterion(value: number, c: RankCriterion, direction: Direction): boolean {
  if (direction === "lower") {
    if (c.upperBound !== null && !(value <= c.upperBound)) return false;
    if (c.lowerBound !== null && !(value > c.lowerBound)) return false;
    return true;
  }
  if (c.lowerBound !== null && !(value >= c.lowerBound)) return false;
  if (c.upperBound !== null && !(value < c.upperBound)) return false;
  return true;
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

/* ───────────────────────── 得点化 ───────────────────────── */

export interface RankRatio {
  rank: Rank;
  /** 配点に掛ける割合（A=1.0 など） */
  ratio: number;
}

/** ランクと配点から獲得点数を出す。 */
export function scoreFromRank(rank: Rank, weight: number, ratios: RankRatio[]): number {
  const r = ratios.find((x) => x.rank === rank);
  const ratio = r ? r.ratio : 0;
  return Math.round(weight * ratio * 10) / 10;
}

/* ─────────────────── 等級要件達成率（固定枠の実績値） ─────────────────── */

/**
 * 等級要件達成率を出す。
 *
 * 元スプレッドシートの計算式:
 *   100% = 半期での自身の等級要件達成数 ÷ 半期の目標設定上限数
 *   （例: 半期上限5件中3件達成＝60% → Cランク）
 *
 * 分母は**等級ごとの目標設定上限数**であって、アンケートの設問数ではない。
 * 上限より多く達成することがあるため（現行GASの実績で 17件／上限5件 の例がある）、
 * 100% で頭打ちにする。頭打ちにしないと 340% のような値がランク基準表からはみ出す。
 */
export function gradeRequirementRate(achieved: number, targetCap: number): number {
  const cap = Math.max(1, targetCap);
  const rate = (achieved / cap) * 100;
  return Math.round(Math.min(100, rate) * 10) / 10;
}

/* ───────────────────────── 総合判定 ───────────────────────── */

export interface ScoredItem {
  kpiItemId: string;
  itemName: string;
  /** 実績値が出せずランクを付けられなかった項目は null（現行GASの「判定外」にあたる） */
  rank: Rank | null;
  points: number;
  maxPoints: number;
}

export interface OverallInput {
  items: ScoredItem[];
  /** 昇給に「すべてA」を要求するか（会社ごとに設定可能） */
  raiseRequiresAllA: boolean;
  /** 昇格に必要なKPI点数（DBのpromotion_thresholdsから渡す） */
  requiredKpiPoints: number | null;
  /** 昇格に必要な行動指針の点数 */
  requiredBehaviorPoints: number | null;
  behaviorTotal: number | null;
  /** 昇格の必須ゲート（受講後報告書提出など）の充足状況 */
  gates: { text: string; achieved: boolean }[];
}

export interface OverallResult {
  totalScore: number;
  maxScore: number;
  raiseEligible: boolean;
  raiseReason: string;
  promotionEligible: boolean;
  promotionBlockedReason: string | null;
  /** 実績が足りずランクを付けられなかった項目の名前（画面に「判定外」として出す） */
  unratedItemNames: string[];
}

export function judgeOverall(input: OverallInput): OverallResult {
  const totalScore = Math.round(input.items.reduce((s, i) => s + i.points, 0) * 10) / 10;
  const maxScore = Math.round(input.items.reduce((s, i) => s + i.maxPoints, 0) * 10) / 10;

  /* 昇給判定: 選択した項目がすべてA。
     実績が入力されておらずランクを付けられなかった項目（判定外）は「A未満」と言い切らず、
     未判定として別に数える。実績が無いのに E と断定するのは事実に反するため。 */
  const unrated = input.items.filter((i) => i.rank === null);
  const nonA = input.items.filter((i) => i.rank !== null && i.rank !== "A");
  const raiseEligible = input.raiseRequiresAllA
    ? input.items.length > 0 && nonA.length === 0 && unrated.length === 0
    : totalScore >= maxScore;

  const raiseReasonParts: string[] = [];
  if (input.raiseRequiresAllA) {
    if (raiseEligible) {
      raiseReasonParts.push(`選択された${input.items.length}項目すべてがAのため、昇給の要件を満たします。`);
    } else {
      if (nonA.length > 0) {
        raiseReasonParts.push(`${nonA.map((i) => `${i.itemName}（${i.rank}）`).join("、")} がA未満のため、昇給は見送りです。`);
      }
      if (unrated.length > 0) {
        raiseReasonParts.push(
          `${unrated.map((i) => i.itemName).join("、")} は実績が入力されていないため判定できていません（判定外）。`,
        );
      }
    }
  } else {
    raiseReasonParts.push(`合計${totalScore}点 / ${maxScore}点。`);
    if (unrated.length > 0) {
      raiseReasonParts.push(`${unrated.map((i) => i.itemName).join("、")} は実績が未入力のため判定外です。`);
    }
  }
  const raiseReason = raiseReasonParts.join("");

  // 昇格判定: 必須ゲート → 点数 の順に見る
  const blockedGates = input.gates.filter((g) => !g.achieved);
  const reasons: string[] = [];
  if (blockedGates.length > 0) {
    reasons.push(`昇格要件が未達です（${blockedGates.map((g) => g.text).join("、")}）。`);
  }
  if (input.requiredKpiPoints !== null && totalScore < input.requiredKpiPoints) {
    reasons.push(`KPI評価点が${totalScore}点で、昇格に必要な${input.requiredKpiPoints}点に達していません。`);
  }
  if (
    input.requiredBehaviorPoints !== null &&
    input.behaviorTotal !== null &&
    input.behaviorTotal < input.requiredBehaviorPoints
  ) {
    reasons.push(
      `行動指針の評価が${input.behaviorTotal}点で、昇格に必要な${input.requiredBehaviorPoints}点に達していません。`,
    );
  }

  return {
    totalScore,
    maxScore,
    raiseEligible,
    raiseReason,
    promotionEligible: reasons.length === 0,
    promotionBlockedReason: reasons.length === 0 ? null : reasons.join(""),
    unratedItemNames: unrated.map((i) => i.itemName),
  };
}
