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
  if (rows.length === 0) return;
  // 作成日時など、書いていない列も自動で付くので少し多めに見積もる
  const columns = Object.keys(rows[0]).length + 4;
  const perChunk = Math.max(1, Math.floor(90 / columns));
  for (let i = 0; i < rows.length; i += perChunk) {
    await run(rows.slice(i, i + perChunk));
  }
}
