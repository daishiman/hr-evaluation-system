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
  /** 「なぜこのランクか」を日本語で説明した文字列（評価者向け。閾値をそのまま出す） */
  rationale: string;
  /** 本人向けの説明。閾値の数値を出さず、実績値とランクだけで説明する */
  rationaleEmployee: string;
  /** 基準表に穴があり、最下位ランクへ丸めた場合に true */
  fellThrough: boolean;
}

/* ───────────── 本人向けの言い換え ─────────────
 *
 * 本人に見せる文には、配点・獲得点数・満点・閾値の数値を一切入れない（2026-08-11 決定）。
 * 閾値を本人に出すと「あと0.4%で上のランクだった」という交渉の材料になり、
 * 実績そのものではなく境界の押し引きに関心が向くため。
 * 実績値とランク（A〜E）は本人に見せてよい ＝ 自分が何をどれだけやったかは本人の情報。
 */

/** ランクを「上から何番目の水準か」に言い換える。閾値の数字を出さずに位置だけ伝える。 */
export function rankLevelLabel(rank: Rank): string {
  const idx = RANK_ORDER.indexOf(rank);
  if (idx === 0) return "もっとも高い水準";
  if (idx === RANK_ORDER.length - 1) return "もっとも下の水準";
  return `上から${["", "2", "3", "4"][idx]}番目の水準`;
}

/** 実績が出せずランクを付けられなかった項目の、本人向けの説明。 */
export const UNRATED_RATIONALE_EMPLOYEE =
  "実績を計算するための回答がそろっていないため、この項目は今回判定していません（判定外）。";

/** 等級要件の設問が1件も無く、固定枠の達成率が出せなかったときの本人向けの説明。 */
export const UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE =
  "今回のアンケートに等級要件の設問が含まれていなかったため、この項目は判定していません（判定外）。";

/**
 * 実績値からランクを判定する。
 *
 * criteria は A→E の順に並んでいなくてもよい（内部で並べ替える）。
 * unit を渡すと本人向けの文に単位が付く（「実績値 92%」）。
 */
export function judgeRank(
  value: number,
  criteria: RankCriterion[],
  direction: Direction,
  opts?: { unit?: string | null },
): RankJudgement {
  const sorted = [...criteria].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
  const shown = `${formatValue(value)}${opts?.unit && opts.unit !== "-" ? opts.unit : ""}`;

  for (const c of sorted) {
    if (matchesCriterion(value, c, direction)) {
      return {
        rank: c.rank,
        criterion: c,
        rationale: `実績値 ${formatValue(value)} が「${c.displayLabel}」に該当するため ${c.rank} と判定しました。`,
        rationaleEmployee: `実績値 ${shown} は${rankLevelLabel(c.rank)}に該当するため、${c.rank} と判定しました。`,
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
    /* 本人向けにも「基準表に穴がある」という事実は伏せない。
       黙ってEにすると、本人には「実績が悪かったからE」としか読めなくなるため。 */
    rationaleEmployee: `実績値 ${shown} は評価基準のどの水準にも当てはまらなかったため、いったん${rankLevelLabel("E")}（E）として扱っています。評価基準の見直しが必要な状態です。`,
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

/** ランクと配点から獲得点数を出す（一律割合方式）。 */
export function scoreFromRank(rank: Rank, weight: number, ratios: RankRatio[]): number {
  const r = ratios.find((x) => x.rank === rank);
  const ratio = r ? r.ratio : 0;
  return Math.round(weight * ratio * 10) / 10;
}

/* ─────────────── ランク→点数の換算方式（会社ごとに選べる） ───────────────
 *
 * 制度の意味が変わる論点なので、方式を1つに決め打ちせず、管理画面から選べるようにしている。
 *
 *  1) ratio（一律割合方式・既定）
 *     どの項目も同じ割合で減点する。A=100% / B=80% / C=60% / D=40% / E=0%。
 *     割合は scheme_rank_ratios テーブルにあり、会社ごとに変更できる。
 *     元の制度に無かった按分のため「仮」バッジを付けて表示する。
 *
 *  2) absolute（項目別絶対点方式）
 *     移行前の「KPI基準定義_配点」シートのやり方。項目ごとに刻みが違う
 *     （項目1 = 100/85/70/55/0、項目2 = 10/8/7/5/0 など）。
 *     点数は kpi_reference_points テーブル（等級区分×ランク）から引く。
 *
 * どちらを選んでも、確定時に evaluation_items へ点数と根拠を保存するため、
 * あとから方式を切り替えても確定済みの評価は動かない。
 */

export type ScoringMode = "ratio" | "absolute";

/** 項目別絶対点方式で使う、1項目分のランク別点数表 */
export interface AbsolutePointTable {
  /** ランクごとの点数。元の表で「-」（対象外）だったランクは含めない */
  byRank: { rank: string; points: number }[];
}

export interface ScoreItemInput {
  rank: Rank;
  /** 一律割合方式で使う配点（Aのときの点数） */
  weight: number;
  mode: ScoringMode;
  ratios: RankRatio[];
  /** 項目別絶対点方式で使う点数表。方式が absolute のときだけ参照する */
  absolute?: AbsolutePointTable | null;
}

export interface ScoreItemResult {
  points: number;
  /** その項目の満点（合計の分母に使う） */
  maxPoints: number;
  /** 「何点がどう決まったか」を日本語で説明した文字列（評価者向け） */
  note: string;
  /** 本人向けの説明。点数・満点・割合の数値を出さず、ランクが反映されたことだけを伝える */
  noteEmployee: string;
  /** 絶対点方式を選んだのに点数表が無く、一律割合方式へ退避した場合に true */
  fellBackToRatio: boolean;
}

/**
 * 選んだ方式でランクを点数に換算する。
 *
 * 絶対点方式を選んでいても、その項目の点数表が無い（元シートで対象外だった等級区分など）
 * 場合は一律割合方式へ退避し、退避したことを note と fellBackToRatio で返す。
 * 黙って0点にすると「評価されなかった」ことが「0点だった」に化けるため。
 */
export function scoreItem(input: ScoreItemInput): ScoreItemResult {
  if (input.mode === "absolute") {
    const table = input.absolute;
    const a = table?.byRank.find((x) => x.rank === "A");
    const hit = table?.byRank.find((x) => x.rank === input.rank);
    if (table && a) {
      // 元の表で対象外だったランクは0点として扱う（Eは元表でも0点）
      const points = hit ? hit.points : 0;
      return {
        points: Math.round(points * 10) / 10,
        maxPoints: Math.round(a.points * 10) / 10,
        note: `項目別絶対点方式：ランク${input.rank}の点数 ${points}点（この項目の満点は${a.points}点）。`,
        noteEmployee: `この項目は ${input.rank} として評価点に反映しています。`,
        fellBackToRatio: false,
      };
    }
    const points = scoreFromRank(input.rank, input.weight, input.ratios);
    return {
      points,
      maxPoints: input.weight,
      note: `この項目には元の配点表がないため、一律割合方式で計算しました：配点${input.weight}点 × ランク${input.rank}の割合 ＝ ${points}点。`,
      noteEmployee: `この項目は ${input.rank} として評価点に反映しています。`,
      fellBackToRatio: true,
    };
  }

  const points = scoreFromRank(input.rank, input.weight, input.ratios);
  const ratio = input.ratios.find((x) => x.rank === input.rank)?.ratio ?? 0;
  return {
    points,
    maxPoints: input.weight,
    note: `一律割合方式：配点${input.weight}点 × ランク${input.rank}の割合${Math.round(ratio * 100)}% ＝ ${points}点。`,
    /* 本人向けは「ランクが点数に反映された」ことだけを伝える。
       配点も割合も出さないのは、項目ごとの重みが分かると
       「配点の大きい項目だけ頑張る」方向に働くため（2026-08-11 決定）。 */
    noteEmployee: `この項目は ${input.rank} として評価点に反映しています。`,
    fellBackToRatio: false,
  };
}

/* ─────────────────── 等級要件達成率（固定枠の実績値） ─────────────────── */

/**
 * 等級要件達成率を出す。
 *
 *   達成率 ＝ 達成した数（○の数） ÷ その等級のアンケートで実際に出題した等級要件の項目数 × 100
 *
 * 分母は「半期の目標設定上限数」ではなく **判定時点で実際に出題した項目数**（2026-08-10 決定）。
 * 上限を分母にすると上限超えの達成が続いて全員100%になり、この項目が飾りになるため。
 *
 * 未回答の項目も分母に含める（＝未達として数える）。回答を空にすると分母が減って
 * 達成率が上がる、という抜け道を作らないため。この扱いは評価詳細画面に明示している。
 *
 * 出題が0件だった場合は達成率を出さない（判定外）。0件を0%とすると
 * 「アンケートに等級要件が無かった」ことが「全部未達だった」に化けてしまう。
 */
export function gradeRequirementRate(achieved: number, asked: number): number | null {
  if (asked <= 0) return null;
  const rate = (achieved / asked) * 100;
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
  /** 本人向けの昇給理由。点数・満点の数値を出さない */
  raiseReasonEmployee: string;
  promotionEligible: boolean;
  promotionBlockedReason: string | null;
  /** 本人向けの昇格できない理由。必要点数・獲得点数の数値を出さない */
  promotionBlockedReasonEmployee: string | null;
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

  /* 昇給理由は「評価者向け」と「本人向け」を同時に作る。
     本人向けには点数・満点を出さない（項目ごとのランクと、何が足りなかったかだけを伝える）。
     表示側で数字を消す作りにすると、消し忘れが本人に見える事故になるため、
     数字を含まない文をここで作り切って保存する。 */
  const unratedNames = unrated.map((i) => i.itemName).join("、");
  const raiseReasonParts: string[] = [];
  const raiseReasonEmployeeParts: string[] = [];
  if (input.raiseRequiresAllA) {
    if (raiseEligible) {
      raiseReasonParts.push(`選択された${input.items.length}項目すべてがAのため、昇給の要件を満たします。`);
      raiseReasonEmployeeParts.push("評価対象の項目がすべてAのため、昇給の要件を満たしています。");
    } else {
      if (nonA.length > 0) {
        const names = nonA.map((i) => `${i.itemName}（${i.rank}）`).join("、");
        raiseReasonParts.push(`${names} がA未満のため、昇給は見送りです。`);
        raiseReasonEmployeeParts.push(`${names} がAに届いていないため、今回の昇給は見送りです。`);
      }
      if (unrated.length > 0) {
        raiseReasonParts.push(`${unratedNames} は実績が入力されていないため判定できていません（判定外）。`);
        raiseReasonEmployeeParts.push(`${unratedNames} は実績が入力されていないため判定できていません（判定外）。`);
      }
    }
  } else {
    raiseReasonParts.push(`合計${totalScore}点 / ${maxScore}点。`);
    raiseReasonEmployeeParts.push(
      raiseEligible
        ? "評価点が満点に達しているため、昇給の要件を満たしています。"
        : "評価点が満点に達していないため、今回の昇給は見送りです。",
    );
    if (unrated.length > 0) {
      raiseReasonParts.push(`${unratedNames} は実績が未入力のため判定外です。`);
      raiseReasonEmployeeParts.push(`${unratedNames} は実績が入力されていないため判定できていません（判定外）。`);
    }
  }
  const raiseReason = raiseReasonParts.join("");
  const raiseReasonEmployee = raiseReasonEmployeeParts.join("");

  // 昇格判定: 必須ゲート → 点数 の順に見る
  const blockedGates = input.gates.filter((g) => !g.achieved);
  const reasons: string[] = [];
  const reasonsEmployee: string[] = [];
  if (blockedGates.length > 0) {
    const names = blockedGates.map((g) => g.text).join("、");
    reasons.push(`昇格要件が未達です（${names}）。`);
    // 何をすれば昇格に近づくかは本人に伝わったほうがよいので、要件そのものは隠さない
    reasonsEmployee.push(`昇格要件が未達です（${names}）。`);
  }
  if (input.requiredKpiPoints !== null && totalScore < input.requiredKpiPoints) {
    reasons.push(`KPI評価点が${totalScore}点で、昇格に必要な${input.requiredKpiPoints}点に達していません。`);
    reasonsEmployee.push("KPI評価が、昇格に必要な水準に達していません。");
  }
  if (
    input.requiredBehaviorPoints !== null &&
    input.behaviorTotal !== null &&
    input.behaviorTotal < input.requiredBehaviorPoints
  ) {
    reasons.push(
      `行動指針の評価が${input.behaviorTotal}点で、昇格に必要な${input.requiredBehaviorPoints}点に達していません。`,
    );
    reasonsEmployee.push("行動指針の評価が、昇格に必要な水準に達していません。");
  }

  return {
    totalScore,
    maxScore,
    raiseEligible,
    raiseReason,
    raiseReasonEmployee,
    promotionEligible: reasons.length === 0,
    promotionBlockedReason: reasons.length === 0 ? null : reasons.join(""),
    promotionBlockedReasonEmployee: reasonsEmployee.length === 0 ? null : reasonsEmployee.join(""),
    unratedItemNames: unrated.map((i) => i.itemName),
  };
}
