import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

/** リクエストごとに D1 バインディングから Drizzle クライアントを作る。 */
export async function getDb(): Promise<DB> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export { schema };

/** D1 は1つのSQL文につき bound parameter が最大100個。上限ちょうどを避けて99個までにする。 */
export const D1_SAFE_BOUND_PARAMETER_LIMIT = 99;

/**
 * Drizzle の INSERT で1行が使う bound parameter 数を安全側に見積もる。
 *
 * 渡した列は1列につき1個。加えて schema の `$defaultFn` など、呼び出し側の
 * オブジェクトには現れない自動列が parameter になるため、4個ぶん余裕を持たせる。
 * 現在の共通列は created_at / updated_at の2個だが、将来1〜2列増えても
 * D1の上限を越えないようにしている。
 */
export function estimateInsertBoundParameters(row: Record<string, unknown>): number {
  return Object.keys(row).length + 4;
}

/**
 * 各chunkの bound parameter 見積もりがD1の安全上限以下になるよう行を分ける。
 * 順序と全行を保ち、1行だけで上限を越える入力は黙って発行せず先に失敗させる。
 */
export function chunkRowsForD1<T extends Record<string, unknown>>(
  rows: T[],
  limit = D1_SAFE_BOUND_PARAMETER_LIMIT,
): T[][] {
  if (limit <= 0 || limit >= 100) {
    throw new Error("D1のbound parameter安全上限は1以上100未満にしてください。");
  }

  const chunks: T[][] = [];
  let chunk: T[] = [];
  let used = 0;

  for (const row of rows) {
    const needed = estimateInsertBoundParameters(row);
    if (needed > limit) {
      throw new Error(`1行のbound parameter見積もりは${needed}個です。D1の安全上限（${limit}個）を超えています。`);
    }
    if (chunk.length > 0 && used + needed > limit) {
      chunks.push(chunk);
      chunk = [];
      used = 0;
    }
    chunk.push(row);
    used += needed;
  }

  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

/**
 * まとめて登録するときの分割保存。
 *
 * データベース（D1）は「1回の登録文で渡せる値は100個まで」という制限がある。
 * アンケートの設問が数十件あると1回で入りきらないため、
 * 値の個数が100を超えないように何回かに分けて登録する。
 */
export async function insertMany<T extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (rows: T[]) => Promise<any>,
  rows: T[],
): Promise<void> {
  for (const chunk of chunkRowsForD1(rows)) await run(chunk);
}
