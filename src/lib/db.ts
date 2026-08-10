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
