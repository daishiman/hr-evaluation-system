import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { HttpError } from "@/lib/session";

type ManagerLookup = (userId: string) => Promise<string | null>;

async function lookupManagerId(userId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db
    .select({ managerId: s.users.managerId })
    .from(s.users)
    .where(eq(s.users.id, userId))
    .limit(1);
  return row[0]?.managerId ?? null;
}

/** 上長の連鎖をたどり、本人への逆戻りや既存の循環へ接続する変更を拒否する。 */
export async function assertNoManagerCycle(
  userId: string,
  managerId: string | null,
  lookup: ManagerLookup = lookupManagerId,
): Promise<void> {
  const seen = new Set([userId]);
  let current = managerId;

  while (current) {
    if (seen.has(current)) {
      throw new HttpError(400, "上長の関係が循環します。別の上長を選んでください。");
    }
    seen.add(current);
    current = await lookup(current);
  }
}
