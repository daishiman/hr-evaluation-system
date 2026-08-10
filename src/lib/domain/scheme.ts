/**
 * 評価セット（8項目・配点）の組み立てルール。
 *
 * 制度上の決めごと:
 *  - 8項目のうち1枠は「等級要件達成率」で固定。差し替えできない。
 *  - 残り7枠は7カテゴリから1つずつ選ぶ（同じカテゴリから2つ選べない）。
 *  - 配点の合計は満点（既定100点）ちょうどにする。
 * どれもDBの値を使って判定する。ここには点数を書かない。
 */

export interface SchemeSelection {
  kpiItemId: string;
  categoryId: string | null;
  weight: number;
  isFixedSlot: boolean;
}

export interface SchemeValidation {
  ok: boolean;
  /** 画面にそのまま出せる日本語の指摘。空なら問題なし。 */
  errors: string[];
  total: number;
}

export function validateScheme(
  selections: SchemeSelection[],
  opts: { totalPoints: number; categoryIds: string[]; categoryNameOf?: (id: string) => string },
): SchemeValidation {
  const errors: string[] = [];
  const total = selections.reduce((sum, x) => sum + x.weight, 0);
  const expected = opts.categoryIds.length + 1; // 固定枠1 + カテゴリ数

  if (selections.length !== expected) {
    errors.push(`選ぶ項目は${expected}件です（いまは${selections.length}件）。`);
  }

  const fixed = selections.filter((x) => x.isFixedSlot);
  if (fixed.length !== 1) {
    errors.push("固定枠（等級要件達成率）はちょうど1件にしてください。");
  }

  const nameOf = opts.categoryNameOf ?? ((id: string) => id);
  for (const catId of opts.categoryIds) {
    const picked = selections.filter((x) => !x.isFixedSlot && x.categoryId === catId);
    if (picked.length === 0) errors.push(`「${nameOf(catId)}」から1件選んでください。`);
    if (picked.length > 1) errors.push(`「${nameOf(catId)}」から選べるのは1件です（いまは${picked.length}件）。`);
  }

  const ids = new Set(selections.map((x) => x.kpiItemId));
  if (ids.size !== selections.length) errors.push("同じ項目が重複して選ばれています。");

  if (selections.some((x) => x.weight <= 0)) errors.push("配点は1点以上にしてください。");

  if (total !== opts.totalPoints) {
    const diff = opts.totalPoints - total;
    errors.push(
      `配点の合計が${total}点です。${opts.totalPoints}点ちょうどにしてください（あと${diff > 0 ? `${diff}点増やす` : `${-diff}点減らす`}）。`,
    );
  }

  return { ok: errors.length === 0, errors, total };
}

/** 配点を等分して、端数を先頭の項目に寄せた叩き台を作る。 */
export function suggestWeights(count: number, totalPoints: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalPoints / count);
  const rest = totalPoints - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}
