/**
 * 個人Pt → 賞与額（仮）の集計。
 *
 *   個人Pt ＝ KPI評価点合計（整数に四捨五入）
 *   賞与額 ＝ 個人Pt × 1点あたりの金額（昇給の設定 raise_policies.bonus_yen_per_point）
 *
 * 以前は KPI評価点合計に事業所の達成係数を掛けていたが、事業所の達成率と係数の仕組みは
 * 2026-10-19 に削除した（DD-024）。係数を受け取る口も残さない。
 *
 * 1点あたりの金額はコードに書かない。会社ごとの昇給の設定から受け取るだけ。
 */

export interface BonusInput {
  /** KPI評価点の合計（100点満点）。まだ出ていなければ null */
  kpiTotalScore: number | null;
  /** 個人Pt 1点あたりの金額（円）。0 以下・未設定なら賞与額を出さない */
  yenPerPoint: number | null;
}

export interface BonusResult {
  /** 個人Pt ＝ KPI評価点合計を整数に四捨五入した値。合計が出ていなければ null */
  personalPoints: number | null;
  /** 賞与額（円）。個人Pt か 1点あたり金額が出せなければ null */
  bonusYen: number | null;
  /** 画面と evaluation に保存する日本語の根拠 */
  rationale: string;
}

/**
 * 個人Pt と 賞与額 を出す。
 *
 * 賞与の配点は制度として未確定のため、呼び出し側は必ず「仮」バッジを付けて表示すること。
 * 1点あたりの金額が無いときは 0 円ではなく null を返す
 * （0円と表示すると「賞与なしと判定された」と誤読されるため）。
 */
export function computeBonus(input: BonusInput): BonusResult {
  if (input.kpiTotalScore === null) {
    return {
      personalPoints: null,
      bonusYen: null,
      rationale: "KPI評価点の合計が出ていないため、個人Ptと賞与額を出せません。",
    };
  }

  /* 個人Ptは整数に四捨五入する（62.5点 → 63Pt）。
     元シートの個人Pt列が整数で、賞与額はその整数に1点あたりの金額を掛けて出していたため。 */
  const personalPoints = Math.round(input.kpiTotalScore);
  const pointsText = `個人Pt ＝ KPI評価点合計 ${round1(input.kpiTotalScore)}点 ＝ ${personalPoints}Pt。`;

  const yenPerPoint = input.yenPerPoint ?? 0;
  if (!(yenPerPoint > 0)) {
    return {
      personalPoints,
      bonusYen: null,
      rationale: `${pointsText}1点あたりの金額が設定されていないため、賞与額は出しません。`,
    };
  }

  const bonusYen = Math.round(personalPoints * yenPerPoint);
  return {
    personalPoints,
    bonusYen,
    rationale: `${pointsText}賞与額 ＝ ${personalPoints}Pt × 1点あたり${yen(yenPerPoint)}円 ＝ ${yen(bonusYen)}円。`,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function yen(v: number): string {
  return v.toLocaleString("ja-JP");
}
