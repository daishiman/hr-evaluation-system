import type { BatchItem } from "drizzle-orm/batch";
import type { DB } from "@/lib/db";

/** 1回の D1 batch に入れる文。 */
export type BatchStatement = BatchItem<"sqlite">;

/**
 * 文を1回の D1 batch で書く。全文が通るか、どれも書かれないかのどちらかになる。
 * 文が無ければ何もしない。
 *
 * Drizzle の db.batch は「1文以上の tuple」しか受け取らない。呼び出し側ごとに
 * 空のときの扱いと型合わせ（`as unknown as …`）が3通りに分かれていたので、ここ1か所で済ませる。
 */
export async function batchAll(db: DB, statements: BatchStatement[]): Promise<void> {
  const [first, ...rest] = statements;
  if (!first) return;
  await db.batch([first, ...rest]);
}
