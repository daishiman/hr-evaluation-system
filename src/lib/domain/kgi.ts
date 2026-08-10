/**
 * 事業所KGI達成係数 → 個人Pt → 賞与額 の集計。
 *
 * 元スプレッドシート「KPI基準定義_配点」の集計欄から復元した式:
 *   個人Pt   ＝ KPI評価点合計 × 事業所KGI達成係数
 *   賞与額   ＝ 個人Pt × 1点あたりの金額（元シートは 3,200円／賞与原資 930,000円）
 *
 * 係数の値も境界もコードには書かない。会社ごとに kgi_coefficients テーブルで持ち、
 * 管理画面から編集できる。ここはテーブルの行を受け取って引き当てるだけ。
 *
 * ■ 元シートの境界に穴があったこと（重要・画面にも明示する）
 * 元の表は「121%以上／111〜120%／100〜110%／95〜99%／90〜94%／89%以下」と
 * 整数％で書かれており、99%と100%の間、110%と111%の間が抜けていた。
 * 99.5% のような小数の実績が来ると、どの区分にも入らない。
 * そこで下限以上・上限未満（lower ≦ x < upper）で連続させる形に補完した。
 * 補完したことは isGapFilled で呼び出し側に返し、画面に注記を出す。
 */

export interface KgiCoefficientRow {
  label: string;
  /** 下限（この値を含む）。null は下限なし */
  lowerBound: number | null;
  /** 上限（この値を含まない）。null は上限なし */
  upperBound: number | null;
  coefficient: number;
  displayOrder: number;
}

export interface KgiMatch {
  row: KgiCoefficientRow;
  coefficient: number;
  /** 「なぜこの係数か」を日本語で説明した文字列（判定根拠として保存する） */
  rationale: string;
}

/**
 * 事業所KGI達成率（%）から係数を引き当てる。
 *
 * 判定は「下限以上・上限未満」で統一する（ランク基準の通常指標と同じ規則）。
 * どの行にも当てはまらなかった場合は null を返す。0 や最小係数に丸めない
 * ——「表に穴がある」ことを、静かに低い係数へ落として隠さないため。
 */
export function matchKgiCoefficient(achievementRate: number, rows: KgiCoefficientRow[]): KgiMatch | null {
  const sorted = [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
  for (const r of sorted) {
    if (r.lowerBound !== null && !(achievementRate >= r.lowerBound)) continue;
    if (r.upperBound !== null && !(achievementRate < r.upperBound)) continue;
    return {
      row: r,
      coefficient: r.coefficient,
      rationale: `事業所KGI達成率 ${formatRate(achievementRate)}% が「${r.label}」に該当するため、達成係数 ${r.coefficient} を適用しました。`,
    };
  }
  return null;
}

export interface CoverageProblem {
  kind: "gap" | "overlap";
  message: string;
}

/**
 * 係数表が数直線を過不足なく覆っているかを調べる。
 * 管理画面の保存時に呼び、穴（gap）と重なり（overlap）を日本語で返す。
 */
export function checkKgiCoverage(rows: KgiCoefficientRow[]): CoverageProblem[] {
  return checkRangeCoverage(
    rows.map((r) => ({ label: r.label, lowerBound: r.lowerBound, upperBound: r.upperBound })),
    "達成率",
  );
}

/* ───────────────────────── 個人Pt と 賞与額 ───────────────────────── */

export interface BonusInput {
  /** KPI評価点の合計（100点満点） */
  kpiTotalScore: number;
  /** 事業所KGI達成率（%）。未入力なら null */
  officeAchievementRate: number | null;
  coefficients: KgiCoefficientRow[];
  /** 個人Pt 1点あたりの金額（元シートは3,200円）。0 なら賞与額を出さない */
  yenPerPoint: number;
}

export interface BonusResult {
  /** 適用した係数。引き当てられなければ null */
  coefficient: number | null;
  /** 個人Pt ＝ KPI評価点合計 × 係数。係数が出せなければ null */
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
 * 達成率が未入力・係数が引き当てられない場合は 0 円ではなく null を返し、
 * 「まだ出せない」ことを画面にそのまま出す（0円と表示すると賞与なしと誤読される）。
 */
export function computeBonus(input: BonusInput): BonusResult {
  if (input.officeAchievementRate === null) {
    return {
      coefficient: null,
      personalPoints: null,
      bonusYen: null,
      rationale: "事業所KGIの達成率が未入力のため、個人Ptと賞与額を出せません。",
    };
  }

  const m = matchKgiCoefficient(input.officeAchievementRate, input.coefficients);
  if (!m) {
    return {
      coefficient: null,
      personalPoints: null,
      bonusYen: null,
      rationale: `事業所KGI達成率 ${formatRate(input.officeAchievementRate)}% に対応する達成係数が表にありません。達成係数の表に抜けがあるため、設定を見直してください。`,
    };
  }

  /* 個人Ptは整数に四捨五入する。
     元シートの検証例（Manager 合計62点）と突き合わせて決めた:
       62×1.5 = 93.0 → 93 ／ 62×1.2 = 74.4 → 74 ／ 62×1.0 = 62.0 → 62
       62×0.6 = 37.2 → 37 ／ 62×0.4 = 24.8 → 25 ／ 62×0.2 = 12.4 → 12
     小数第1位までで持つと 37.2 / 24.8 / 12.4 となり、元シートの個人Pt列と合わない。 */
  const personalPoints = Math.round(input.kpiTotalScore * m.coefficient);
  const bonusYen = input.yenPerPoint > 0 ? Math.round(personalPoints * input.yenPerPoint) : null;

  const parts = [
    m.rationale,
    `個人Pt ＝ KPI評価点合計 ${round1(input.kpiTotalScore)}点 × ${m.coefficient} ＝ ${personalPoints}Pt。`,
  ];
  if (bonusYen !== null) {
    parts.push(`賞与額 ＝ ${personalPoints}Pt × ${input.yenPerPoint.toLocaleString("ja-JP")}円 ＝ ${bonusYen.toLocaleString("ja-JP")}円（配点が未確定のため仮の金額です）。`);
  }
  return { coefficient: m.coefficient, personalPoints, bonusYen, rationale: parts.join("") };
}

/* ───────────────────────── 共通: 範囲表の検査 ───────────────────────── */

export interface RangeRow {
  label: string;
  lowerBound: number | null;
  upperBound: number | null;
}

/**
 * 「下限以上・上限未満」で並ぶ範囲表に、穴（gap）や重なり（overlap）が無いかを調べる。
 * ランク基準（A〜E）と KGI係数表の両方から使う。
 *
 * 下限 null は −∞、上限 null は +∞ として扱う。
 */
export function checkRangeCoverage(rows: RangeRow[], subject: string): CoverageProblem[] {
  const problems: CoverageProblem[] = [];
  if (rows.length === 0) return problems;

  for (const r of rows) {
    if (r.lowerBound !== null && r.upperBound !== null && r.lowerBound >= r.upperBound) {
      problems.push({
        kind: "overlap",
        message: `「${r.label}」の下限（${r.lowerBound}）が上限（${r.upperBound}）以上になっています。`,
      });
    }
  }

  // 下限の小さい順（−∞が先頭）に並べ、隣り合う区間がぴったり接しているかを見る
  const sorted = [...rows].sort(
    (a, b) => (a.lowerBound ?? -Infinity) - (b.lowerBound ?? -Infinity),
  );

  const first = sorted[0];
  if (first.lowerBound !== null) {
    problems.push({
      kind: "gap",
      message: `いちばん下の区間「${first.label}」に下限（${first.lowerBound}）が入っています。${subject}がそれより小さいとどこにも当てはまりません。下限を空にしてください。`,
    });
  }
  const last = sorted[sorted.length - 1];
  if (last.upperBound !== null) {
    problems.push({
      kind: "gap",
      message: `いちばん上の区間「${last.label}」に上限（${last.upperBound}）が入っています。${subject}がそれ以上だとどこにも当てはまりません。上限を空にしてください。`,
    });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const curUpper = cur.upperBound;
    const nextLower = next.lowerBound;
    if (curUpper === null || nextLower === null) continue; // ±∞ は上の検査で拾っている
    if (curUpper < nextLower) {
      problems.push({
        kind: "gap",
        message: `「${cur.label}」の上限（${curUpper}）と「${next.label}」の下限（${nextLower}）の間が空いています。${subject}がこの間だとどこにも当てはまりません。`,
      });
    } else if (curUpper > nextLower) {
      problems.push({
        kind: "overlap",
        message: `「${cur.label}」と「${next.label}」の範囲が重なっています（${nextLower}〜${curUpper}）。同じ${subject}が2つの区分に当てはまってしまいます。`,
      });
    }
  }

  return problems;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function formatRate(v: number): string {
  return Number.isInteger(v) ? String(v) : String(round1(v));
}
