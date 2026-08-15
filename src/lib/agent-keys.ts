/**
 * 画面から発行する鍵の、保存と取り出し。
 *
 * 生の鍵を持ち歩くのはこのファイルの中だけで、しかも発行の瞬間だけ。
 * 保存するのはハッシュと先頭数文字で、呼び出し側へ返すのも1回きり。
 * 「あとから見せてほしい」に応えられる作りにしない（応えられる作りは、
 * 盗まれたときにもそのまま応えてしまう）。
 *
 * 判断の言葉と形は src/lib/domain/agent-keys.ts が正本。ここは
 * 乱数・ハッシュ・保存だけを受け持つ。
 */

import { desc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import {
  AGENT_KEY_BYTES,
  agentKeyPrefix,
  encodeAgentKey,
  shouldTouchLastUsed,
  type AgentKeyRecord,
} from "@/lib/domain/agent-keys";

/** 鍵のハッシュ。保存するのも突き合わせるのも、この値だけ。 */
export async function hashAgentKey(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 鍵を発行する。前の鍵はここで失効させる（作り直しと発行を別物にしない）。
 *
 * 返す生の鍵は、この戻り値が唯一の出口。保存もログ出力もしない。
 */
export async function issueAgentKey(actorId: string): Promise<{ raw: string; prefix: string }> {
  const bytes = new Uint8Array(AGENT_KEY_BYTES);
  crypto.getRandomValues(bytes);
  const raw = encodeAgentKey(bytes);
  const prefix = agentKeyPrefix(raw);
  const db = await getDb();
  const now = new Date();

  // 使える鍵は常に1本だけにする。2本あると、止めたつもりの鍵が残る。
  await db
    .update(s.agentApiKeys)
    .set({ revokedAt: now, revokedById: actorId })
    .where(isNull(s.agentApiKeys.revokedAt));

  await db.insert(s.agentApiKeys).values({
    id: newId("agkey"),
    keyHash: await hashAgentKey(raw),
    keyPrefix: prefix,
    createdById: actorId,
  });

  return { raw, prefix };
}

/** いま使える鍵を失効させる。止める鍵が無ければ false（押し間違いを黙って成功にしない）。 */
export async function revokeAgentKeys(actorId: string): Promise<boolean> {
  const db = await getDb();
  const active = await db
    .select({ id: s.agentApiKeys.id })
    .from(s.agentApiKeys)
    .where(isNull(s.agentApiKeys.revokedAt))
    .limit(1);
  if (active.length === 0) return false;
  await db
    .update(s.agentApiKeys)
    .set({ revokedAt: new Date(), revokedById: actorId })
    .where(isNull(s.agentApiKeys.revokedAt));
  return true;
}

/** 画面に出す発行の記録。生の鍵は入らない（先頭数文字だけ）。 */
export async function listAgentKeys(): Promise<AgentKeyRecord[]> {
  const db = await getDb();
  const creators = { id: s.users.id, name: s.users.name };
  const rows = await db
    .select({
      id: s.agentApiKeys.id,
      keyPrefix: s.agentApiKeys.keyPrefix,
      createdAt: s.agentApiKeys.createdAt,
      createdById: s.agentApiKeys.createdById,
      lastUsedAt: s.agentApiKeys.lastUsedAt,
      revokedAt: s.agentApiKeys.revokedAt,
      revokedById: s.agentApiKeys.revokedById,
    })
    .from(s.agentApiKeys)
    .orderBy(desc(s.agentApiKeys.createdAt))
    .limit(20);
  const names = new Map((await db.select(creators).from(s.users)).map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt,
    createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
    revokedByName: r.revokedById ? (names.get(r.revokedById) ?? null) : null,
  }));
}

/** いま使える鍵のハッシュ。無ければ null（未設定として扱う）。 */
export async function activeAgentKeyHash(db: DB): Promise<{ id: string; hash: string; lastUsedAt: Date | null } | null> {
  const rows = await db
    .select({ id: s.agentApiKeys.id, hash: s.agentApiKeys.keyHash, lastUsedAt: s.agentApiKeys.lastUsedAt })
    .from(s.agentApiKeys)
    .where(isNull(s.agentApiKeys.revokedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 使った時刻を書き足す。毎回書くと読み取りのたびに書き込みが起きるので、
 * 一定の間隔を空ける（「使われているか」が分かればよく、正確な回数は要らない）。
 */
export async function touchAgentKey(db: DB, id: string, lastUsedAt: Date | null): Promise<void> {
  const now = new Date();
  if (!shouldTouchLastUsed(lastUsedAt, now)) return;
  await db.update(s.agentApiKeys).set({ lastUsedAt: now }).where(eq(s.agentApiKeys.id, id));
}
