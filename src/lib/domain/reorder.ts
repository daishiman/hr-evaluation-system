/**
 * 並べ替え（S11・A10・DD-005）。
 *
 * 画面は並び全体（id の配列）を送り、サーバーは今の id の集まりと照合してから
 * display_order を1から振り直して1回で書く。1つずつの上下（up/down/top/bottom）を送らないのは、
 * 長押しのドラッグでは1回の操作で何段も動くため（段ごとに保存すると、途中で失敗したとき並びが半端に残る）。
 */

/** 送られた並びと今の並びで id の集まりが違うとき（ほかの人が足した・消した）に、409 と一緒に返す言葉 */
export const REORDER_CONFLICT_MESSAGE =
  "ほかの操作で項目が増えたか減ったため、並びを保存できませんでした。画面を再読み込みしてから、もう一度並べ替えてください。";

/**
 * from の位置の1つを取り出し、to の位置へ入れた新しい配列を返す。元の配列は変えない。
 * to が範囲の外なら端へ寄せる。from が範囲の外なら、動かさずに写しを返す。
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item);
  return next;
}

/**
 * 送られた並びが、今の並びと同じ id の集まりか（順番は問わない）。
 * 過不足・重複が1つでもあれば false。サーバーは false のとき 409 を返し、1行も書かない。
 */
export function sameIdSet(current: readonly string[], submitted: readonly string[]): boolean {
  if (current.length !== submitted.length) return false;
  const known = new Set(current);
  const seen = new Set<string>();
  for (const id of submitted) {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** 並びの順に display_order を1から振り直す（間を空けない） */
export function renumber(ids: readonly string[]): { id: string; displayOrder: number }[] {
  return ids.map((id, index) => ({ id, displayOrder: index + 1 }));
}

/**
 * 並び全体の保存で書き換える行。current は今の並び（今の番号つき）、submitted は送られた並び。
 * id の集まりが違えば null（サーバーは 409 にして1行も書かない）。
 * 今の番号の集まりをそのまま新しい並びへ配り直すので、使っていない行など並びの外の番号とは重ならない。
 * 今の番号に重複があるとき（壊れた旧データ）だけ、1から振り直す（重複のままだと id の順へ戻りうる）。
 * 番号の変わらない行は返さない（何も変わらなければ空の配列）。
 */
export function reorderChanges(
  current: readonly { id: string; displayOrder: number }[],
  submitted: readonly string[],
): { id: string; before: number; displayOrder: number }[] | null {
  if (
    !sameIdSet(
      current.map((row) => row.id),
      submitted,
    )
  ) {
    return null;
  }
  const orders = current.map((row) => row.displayOrder).sort((a, b) => a - b);
  const slots = new Set(orders).size === orders.length ? orders : renumber(submitted).map((row) => row.displayOrder);
  const before = new Map(current.map((row) => [row.id, row.displayOrder]));
  return submitted
    .map((id, index) => ({ id, before: before.get(id)!, displayOrder: slots[index] }))
    .filter((row) => row.before !== row.displayOrder);
}
