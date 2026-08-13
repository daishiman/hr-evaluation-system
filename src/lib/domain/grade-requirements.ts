import { currentVersionRows } from "@/lib/domain/versioned-master";

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
  previousVersionId?: string | null;
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
  return currentVersionRows(rows)
    .filter((r) => r.category === category && r.isActive)
    .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
}

/** 現在版のうち、使わない状態にしてある項目（元に戻せる）。 */
export function inactiveOf(rows: RequirementRow[]): RequirementRow[] {
  return currentVersionRows(rows)
    .filter((r) => !r.isActive)
    .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
}

/** 後続版があるため、再開ではなく履歴としてだけ見せる版。 */
export function historicalOf(rows: RequirementRow[]): RequirementRow[] {
  const currentIds = new Set(currentVersionRows(rows).map((row) => row.id));
  return rows.filter((row) => !currentIds.has(row.id));
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
 * 並べ替え1回分の変更内容を出す。
 * 同じ区分の中で seq を入れ替える（他の区分の並びに影響させない）。
 * up/down は隣どうしの交換、top/bottom は先頭・末尾への移動（間の項目は1つずつ詰める）。
 * 動かせないとき（先頭で↑・top、末尾で↓・bottom）は null。
 */
export function changesForMove(
  rows: RequirementRow[],
  category: string,
  id: string,
  direction: "up" | "down" | "top" | "bottom",
): { id: string; seq: number }[] | null {
  const list = activeOf(rows, category);
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;

  let reordered: RequirementRow[];
  if (direction === "up" || direction === "down") {
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return null;
    reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  } else {
    if ((direction === "top" && i === 0) || (direction === "bottom" && i === list.length - 1)) return null;
    const rest = list.filter((row) => row.id !== id);
    reordered = direction === "top" ? [list[i], ...rest] : [...rest, list[i]];
  }

  const seqs = list.map((r) => r.seq);
  // 重複seqのまま値を入れ替えても、IDの第2ソートで元の順へ戻りうる。
  // 壊れた旧データを操作したときだけ1始まりへ正規化し、指定した順を確実に保存する。
  const nextSeqs = new Set(seqs).size === seqs.length ? seqs : list.map((_, index) => index + 1);
  const previousSeqById = new Map(list.map((row) => [row.id, row.seq]));
  const changes = reordered
    .map((row, idx) => ({ id: row.id, seq: nextSeqs[idx] }))
    .filter((change) => change.seq !== previousSeqById.get(change.id));
  // 隣との交換は、従来どおり操作対象を先頭に返す（監査記録・既存呼び出しの順序も維持する）。
  if (direction === "up" || direction === "down") {
    return [...changes.filter((change) => change.id === id), ...changes.filter((change) => change.id !== id)];
  }
  return changes;
}
