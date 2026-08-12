/**
 * 評価結果を「誰に見せてよい形」に整える純関数。
 *
 * 画面で条件分岐するだけでは、APIの返り値に配点や必要点数が載ったままになる。
 * ここで1度だけ削り、queries から必ず通す。純関数にしてあるのは
 * 「本人向けの出力に数値が混ざっていない」ことをテストで固定するため。
 */

/* ───────────── ランクの意味（本人にも見せる凡例）─────────────
 * 文言は data/_authoritative-kpi-criteria.tsv の正本（【8】ランクの意味）に合わせている。
 * 配点は書かない。ランクが何を意味するかだけを伝える。 */
export const RANK_LEGEND: { rank: string; meaning: string }[] = [
  { rank: "A", meaning: "昇給要件を満たす（選択項目すべてAで昇給）" },
  { rank: "B", meaning: "Aに一歩届かない水準。この項目がBなら昇給は見送り" },
  { rank: "C", meaning: "必達ライン／現状維持" },
  { rank: "D", meaning: "要改善" },
  { rank: "E", meaning: "未達" },
];

export const RANK_MEANING: Record<string, string> = Object.fromEntries(
  RANK_LEGEND.map((r) => [r.rank, r.meaning]),
);

/* ───────────── 本人に出してはいけない表現の検知 ─────────────
 *
 * 根拠文は自由文なので、列を分けただけでは「うっかり点数入りの文が本人側に入る」事故を防げない。
 * 保存された本人向けの文をそのまま信じず、ここで最後にもう一度ふるいにかける（fail-closed）。
 * 実績値は本人に見せてよいので、単位（% と 件）だけの数字は通す。 */
export const CRITERIA_LEAK_PATTERNS: RegExp[] = [
  /[0-9０-９][0-9０-９.,．，\s]*点/, // 「80点」「12.5 点」
  /配点|満点|得点|評価点|合計点|必要点数|必要な点数|昇格に必要|基準表|割合/,
  /[0-9０-９][0-9０-９.,．，]*\s*[%％]?\s*(以上|以下|未満|超)/, // 閾値ラベル「80%以上 100%未満」
  /[0-9０-９][0-9０-９.,．，]*\s*(円|Pt|ポイント)/,
];

/** 評価基準・配点・必要点数につながる表現が含まれていれば true。 */
export function containsCriteriaLeak(text: string | null | undefined): boolean {
  if (!text) return false;
  return CRITERIA_LEAK_PATTERNS.some((p) => p.test(text));
}

/**
 * 本人向けの文を1本選ぶ。
 * 保存された本人向けの文が無い／点数を含んでしまっている場合は、
 * 評価者向けの文へは絶対に落とさず、安全な値だけで組み立てた文に差し替える。
 */
export function pickEmployeeText(saved: string | null | undefined, fallback: string): string {
  if (saved && !containsCriteriaLeak(saved)) return saved;
  return fallback;
}

/* ───────────── 項目ごとの根拠文（本人向け）───────────── */

export interface EmployeeItemFacts {
  itemName: string;
  rank: string | null;
  actualValue: number | null;
  unit: string | null;
}

const nf = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

/**
 * 本人向けの根拠文を、本人に見せてよい値（項目名・ランク・実績値）だけで組み立てる。
 *
 * 2026-08-10 より前に確定した48件は rationale_employee が NULL で、当時の文面は
 * 配点と獲得点数を含むため本人には出せない。「表示できません」で終わらせると
 * 「なぜこの評価か」が本人に伝わらなくなるので、残っている安全な値から
 * 説明文をその場で組み立てる方を選んだ（過去の評価そのものは書き換えない）。
 */
export function buildEmployeeItemRationale(item: EmployeeItemFacts, opts?: { legacy?: boolean }): string {
  const value =
    item.actualValue === null ? null : `${nf.format(item.actualValue)}${item.unit ?? ""}`;
  const head =
    item.rank === null
      ? `「${item.itemName}」は実績が入力されていないため、この期は判定できていません（判定外）。`
      : value === null
        ? `「${item.itemName}」はランク ${item.rank} と判定しました。`
        : `「${item.itemName}」は実績値 ${value} により、ランク ${item.rank} と判定しました。`;
  const meaning = item.rank && RANK_MEANING[item.rank] ? `ランク ${item.rank} は「${RANK_MEANING[item.rank]}」です。` : "";
  // 組み立て直したことを黙っていると「説明が薄くなった」と受け取られるため、理由を添える
  const legacy = opts?.legacy
    ? "（この評価は、判定根拠の記録方式を変える前に確定しています。そのため説明文をランクと実績値から組み立てています。）"
    : "";
  return `${head}${meaning}${legacy}`;
}

/* ───────────── 行ごとの出し分け ───────────── */

export interface EvaluationRowScope {
  totalScore: number;
  maxScore: number;
  behaviorTotal: number | null;
  promotionBlockedReason: string | null;
  requiredKpiPointsSnapshot: number | null;
  requiredBehaviorPointsSnapshot: number | null;
}

export type ScopedEvaluationRow<T extends EvaluationRowScope> = Omit<T, keyof EvaluationRowScope> & {
  totalScore: number | null;
  maxScore: number | null;
  behaviorTotal: number | null;
  promotionBlockedReason: string | null;
  requiredKpiPointsSnapshot: number | null;
  requiredBehaviorPointsSnapshot: number | null;
};

/**
 * 評価1行を閲覧者に合わせて削る。
 *
 * 行動指針の合計点も本人には出さない。KPI側の配点を厳しく伏せている一方で
 * 行動指針だけ裸の点数を出すのは非対称で、しかも昇格に必要な点数
 * （required_behavior_points_snapshot）と直結しているため、複数回の評価を並べると
 * 必要点数の位置が推測できてしまう。本人には水準ラベルだけを見せる方針に揃えた。
 */
export function scopeEvaluationRow<T extends EvaluationRowScope>(
  row: T,
  canSeeCriteria: boolean,
): ScopedEvaluationRow<T> {
  if (canSeeCriteria) return row as ScopedEvaluationRow<T>;
  return {
    ...row,
    totalScore: null,
    maxScore: null,
    behaviorTotal: null,
    // 評価者向けの文（必要点数と獲得点数が入る）は1文字も返さない。本人向けの文は詳細画面で別に組み立てる
    promotionBlockedReason: null,
    requiredKpiPointsSnapshot: null,
    requiredBehaviorPointsSnapshot: null,
  };
}

export interface EvaluationItemScope extends EmployeeItemFacts {
  points: number;
  maxPoints: number;
  thresholdLabel: string | null;
  thresholdLower: number | null;
  thresholdUpper: number | null;
  rationale: string | null;
  rationaleEmployee: string | null;
  calcNote: string | null;
}

export type ScopedEvaluationItem<T extends EvaluationItemScope> = Omit<
  T,
  "points" | "maxPoints" | "rationale"
> & {
  points: number | null;
  maxPoints: number | null;
  /** その閲覧者が読んでよい根拠文。画面はこれだけを描く */
  rationale: string;
};

/**
 * 項目1件を閲覧者に合わせて削る。
 * 本人には配点・獲得点数・閾値を返さず、根拠文も本人向けの1本だけにする
 * （評価者向けの文が本人のレスポンスに残らないよう、列ごと差し替える）。
 */
export function scopeEvaluationItem<T extends EvaluationItemScope>(
  item: T,
  canSeeCriteria: boolean,
): ScopedEvaluationItem<T> {
  if (canSeeCriteria) {
    return { ...item, rationale: item.rationale ?? "" } as ScopedEvaluationItem<T>;
  }
  const fallback = buildEmployeeItemRationale(item, { legacy: !item.rationaleEmployee });
  return {
    ...item,
    points: null,
    maxPoints: null,
    thresholdLabel: null,
    thresholdLower: null,
    thresholdUpper: null,
    rationale: pickEmployeeText(item.rationaleEmployee, fallback),
    // 本人向けの列も、中身が汚れていた場合に備えて同じ検査を通した値で上書きする
    rationaleEmployee: pickEmployeeText(item.rationaleEmployee, fallback),
    // 計算式は実績値の作り方（等級別の分母など）を含むため、本人には返さない
    calcNote: null,
  };
}

/* ───────────── 昇給・昇格の理由（本人向けの言い換え）───────────── */

export function employeeRaiseReason(saved: string | null | undefined, raiseEligible: boolean): string {
  const fallback = raiseEligible
    ? "選択された項目がすべてAのため、昇給の要件を満たしています。"
    : "Aに届かなかった項目があるため、この期の昇給は見送りです。項目ごとの判定は下の一覧をご確認ください。";
  return pickEmployeeText(saved, fallback);
}

export function employeePromotionBlockedReason(
  saved: string | null | undefined,
  hasEvaluatorReason: boolean,
): string | null {
  if (!hasEvaluatorReason) return null;
  const fallback =
    "昇格の要件にまだ届いていません。未提出の昇格要件と、Aに届かなかった項目が理由です。詳しい基準は上長にご確認ください。";
  return pickEmployeeText(saved, fallback);
}

/* ───────────── レーダーチャートの値 ───────────── */

export interface RadarSourceItem {
  itemName: string;
  rank: string | null;
  points: number | null;
  maxPoints: number | null;
}

export interface RadarValue {
  item: string;
  /** 0〜100。判定外（実績未入力）は null にして、0点と混ぜない */
  value: number | null;
  rank: string | null;
  unrated: boolean;
}

/** ランク → 形の大きさ（本人向けの描き方）。実点数を出せないため、ランクを等間隔に置く。 */
export const RANK_RATIO: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, E: 0 };

/**
 * レーダーの各軸の値を作る。
 *
 * - 評価者向けは実際の「獲得点 ÷ 配点」で描く。ランク固定%だと、同じBでも配点の重い項目と
 *   軽い項目が同じ大きさに見えてしまい、どこを直すと点が伸びるか分からないため。
 * - 本人向けは配点を出せないので、ランク由来の形で描く（キャプションで明示する）。
 * - 判定外（rank=null）は「測れなかった」であって0点ではないので、value を null にして
 *   軸を欠損として扱う。E=0% で描くと、同じ画面が出している「判定外」バッジと矛盾する。
 */
export function buildRadarValues(items: RadarSourceItem[], canSeeCriteria: boolean): RadarValue[] {
  return items.map((i) => {
    if (i.rank === null) return { item: i.itemName, value: null, rank: null, unrated: true };
    if (canSeeCriteria && i.points !== null && i.maxPoints !== null && i.maxPoints > 0) {
      return {
        item: i.itemName,
        value: Math.round((i.points / i.maxPoints) * 1000) / 10,
        rank: i.rank,
        unrated: false,
      };
    }
    return { item: i.itemName, value: RANK_RATIO[i.rank] ?? 0, rank: i.rank, unrated: false };
  });
}

/* ───────────── 閾値の帯（評価者向け）───────────── */

export interface RankCriterionRange {
  rank: string;
  displayLabel: string;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface ThresholdSegment {
  rank: string;
  label: string;
  /** 帯の左端からの位置（%） */
  left: number;
  width: number;
  /** 実績値がこの範囲に入っているか */
  hit: boolean;
}

export interface ThresholdScale {
  segments: ThresholdSegment[];
  /** 実績値の位置（%）。値が無い・目盛りが作れないときは null */
  markerLeft: number | null;
}

/**
 * A〜Eの判定範囲を1本の帯に並べ、実績値がどこに落ちたかを示す目盛りを作る。
 *
 * 上端・下端が開いている範囲（「100%以上」「70%未満」）は、有限側の幅の
 * 15%ぶんを足して閉じる。開いた範囲を無限に描けないだけで、意味は変えない。
 */
export function buildThresholdScale(
  criteria: RankCriterionRange[],
  actualValue: number | null,
  matchedRank?: string | null,
): ThresholdScale | null {
  if (criteria.length === 0) return null;
  const bounds = criteria
    .flatMap((c) => [c.lowerBound, c.upperBound])
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (bounds.length === 0) return null;

  const lo = Math.min(...bounds);
  const hi = Math.max(...bounds);
  /* 上下に必ず余白を足す。境界が1つしか無い（hi === lo）ときも最低1は足すので、
     幅は必ず2以上になる。＝幅が0以下になる道は無い（`evaluation-view.test.ts` で
     この決まりを検査している）。 */
  const pad = hi > lo ? (hi - lo) * 0.15 : Math.max(Math.abs(hi) * 0.15, 1);
  const min = lo - pad;
  const max = hi + pad;
  const span = max - min;

  const pos = (v: number) => ((v - min) / span) * 100;

  const sorted = [...criteria].sort((a, b) => (a.lowerBound ?? min) - (b.lowerBound ?? min));
  const segments = sorted.map((c) => {
    const from = c.lowerBound ?? min;
    const to = c.upperBound ?? max;
    const left = pos(from);
    return {
      rank: c.rank,
      label: c.displayLabel,
      left,
      width: Math.max(0, pos(to) - left),
      hit: matchedRank ? c.rank === matchedRank : false,
    };
  });

  const markerLeft =
    actualValue === null ? null : Math.min(100, Math.max(0, pos(actualValue)));
  return { segments, markerLeft };
}
