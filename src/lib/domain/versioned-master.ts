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

export interface HistoricalVersionRow<T extends VersionedMasterRow> {
  row: T;
  /** 履歴から新版を作るとき、新版の直前になる現在版。 */
  currentId: string;
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
  const scope = rows.some((candidate) => candidate.id === row.id) ? rows : [...rows, row];
  return currentVersionRows(scope).some((candidate) => candidate.id === row.id);
}

/**
 * 各系譜の現在版と履歴を、同じ現在版判定で分ける。
 *
 * current の判定は currentVersionRows だけが正本。履歴側は、その補集合から
 * 後続をたどって現在版IDを求める。親が一覧に無い orphan は画面から
 * 消さないため現在版とし、壊れた cycle も無限ループせず履歴として返す。
 */
export function classifyVersionedRows<T extends VersionedMasterRow>(rows: readonly T[]): {
  current: T[];
  history: HistoricalVersionRow<T>[];
} {
  const current = currentVersionRows(rows);
  const currentIds = new Set(current.map((row) => row.id));
  const ids = new Set(rows.map((row) => row.id));
  const successorByPreviousId = new Map<string, T>();

  for (const row of rows) {
    if (row.previousVersionId && ids.has(row.previousVersionId)) {
      successorByPreviousId.set(row.previousVersionId, row);
    }
  }

  const history = rows
    .filter((row) => !currentIds.has(row.id))
    .map((row) => {
      let latest = row;
      const visited = new Set<string>();
      while (successorByPreviousId.has(latest.id) && !visited.has(latest.id)) {
        visited.add(latest.id);
        latest = successorByPreviousId.get(latest.id)!;
      }
      return { row, currentId: latest.id };
    });

  return { current, history };
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
