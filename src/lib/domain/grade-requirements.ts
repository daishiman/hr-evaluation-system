/**
 * 等級要件（支援について／運営について）の決まりごと。
 *
 * 制度としての構造:
 *   - 区分は「支援について」「運営について」の2つ
 *   - それぞれ 0〜10 項目を、会社ごと・等級ごとに自由に決められる
 *   - 10項目ちょうどである必要はない（1項目でも、0項目でも成立する）
 *
 * 等級要件達成率の分母は「そのアンケートで実際に出題した項目数」＝
 * 支援の登録数 ＋ 運営の登録数 になる。上限10や合計20を分母にしてはいけない。
 */

/** 1区分に登録できる上限。制度で決まっている値。 */
export const GRADE_REQUIREMENT_MAX = 10;

export type RequirementCategory = "support" | "operation";

export interface RequirementRow {
  id: string;
  category: string;
  seq: number;
  text: string;
  isActive: boolean;
}

export const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  support: "支援について",
  operation: "運営について",
};

/**
 * 区分ごとに、使う項目を並び順で取り出す。
 * 区分の値を文字列で受けるのは、同じ形をしている昇格要件（種類 report / test）でも使い回すため。
 */
export function activeOf(rows: RequirementRow[], category: string): RequirementRow[] {
  return rows.filter((r) => r.category === category && r.isActive).sort((a, b) => a.seq - b.seq);
}

/** 使わない状態にしてある項目（元に戻せるように残してある）。 */
export function inactiveOf(rows: RequirementRow[]): RequirementRow[] {
  return rows.filter((r) => !r.isActive).sort((a, b) => a.seq - b.seq);
}

/** あと何項目登録できるか。 */
export function remainingSlots(usedCount: number): number {
  return Math.max(0, GRADE_REQUIREMENT_MAX - usedCount);
}

/**
 * この等級の評価で、達成率の分母になる項目数。
 * 支援と運営の登録数の合計であって、上限（10や20）ではない。
 */
export function denominatorOf(rows: RequirementRow[]): number {
  return activeOf(rows, "support").length + activeOf(rows, "operation").length;
}

/**
 * 並べ替え1回分の入れ替え内容を出す。
 * 同じ区分の中で隣どうしの seq を交換する（他の区分の並びに影響させない）。
 * 動かせないとき（先頭で↑、末尾で↓）は null。
 */
export function swapForMove(
  rows: RequirementRow[],
  category: string,
  id: string,
  direction: "up" | "down",
): { id: string; seq: number }[] | null {
  const list = activeOf(rows, category);
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return null;
  return [
    { id: list[i].id, seq: list[j].seq },
    { id: list[j].id, seq: list[i].seq },
  ];
}
