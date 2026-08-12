/**
 * 本文を版として残す制度マスタの、小さな系譜ユーティリティ。
 *
 * DB は `previous_version_id` の一意制約で一本道を保証する。ここでは、その事実を
 * 画面・利用判定・削除判定が同じ方法で読めるようにする。系譜は少数行なので、
 * 読み出した配列上で扱い、論理IDなどの重複した正本は増やさない。
 */

export interface VersionedMasterRow {
  id: string;
  previousVersionId?: string | null;
}

/** 後続版を持つID。ここに無い行が、その系譜の現在版になる。 */
export function predecessorIds<T extends VersionedMasterRow>(rows: readonly T[]): Set<string> {
  return new Set(rows.flatMap((row) => (row.previousVersionId ? [row.previousVersionId] : [])));
}

/** 各系譜の末尾（現在版）だけを返す。使用中かどうかは isActive が別に表す。 */
export function currentVersionRows<T extends VersionedMasterRow>(rows: readonly T[]): T[] {
  const predecessors = predecessorIds(rows);
  return rows.filter((row) => !predecessors.has(row.id));
}

export function isCurrentVersion<T extends VersionedMasterRow>(row: T, rows: readonly T[]): boolean {
  return !rows.some((candidate) => candidate.previousVersionId === row.id);
}

/** 系譜の起点（previous_version_id が null の版）のID。イベントストアの entity_id に使う安定キー。 */
export function lineageRootId<T extends VersionedMasterRow>(rows: readonly T[], id: string): string {
  const byId = new Map(rows.map((row) => [row.id, row]));
  let current = byId.get(id);
  if (!current) return id;
  const seen = new Set<string>();
  while (current.previousVersionId && byId.has(current.previousVersionId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.previousVersionId)!;
  }
  return current.id;
}

/** 指定した版と、親子どちら向きでもつながっている版IDをすべて返す。 */
export function versionFamilyIds<T extends VersionedMasterRow>(rows: readonly T[], id: string): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (!byId.has(id)) return [];

  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.previousVersionId) continue;
    const list = children.get(row.previousVersionId) ?? [];
    list.push(row.id);
    children.set(row.previousVersionId, list);
  }

  const found = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (found.has(current)) continue;
    found.add(current);
    const parent = byId.get(current)?.previousVersionId;
    if (parent && byId.has(parent)) queue.push(parent);
    for (const child of children.get(current) ?? []) queue.push(child);
  }
  return [...found];
}

/** 子から親の順。自己参照FKを壊さず系譜を物理削除するときに使う。 */
export function versionFamilyDeleteOrder<T extends VersionedMasterRow>(rows: readonly T[], id: string): string[] {
  const family = new Set(versionFamilyIds(rows, id));
  const depthOf = (rowId: string) => {
    let depth = 0;
    let current = rows.find((row) => row.id === rowId);
    const seen = new Set<string>();
    while (current?.previousVersionId && family.has(current.previousVersionId) && !seen.has(current.id)) {
      seen.add(current.id);
      depth++;
      current = rows.find((row) => row.id === current!.previousVersionId);
    }
    return depth;
  };
  return [...family].sort((a, b) => depthOf(b) - depthOf(a));
}
