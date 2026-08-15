/**
 * 画面から発行する鍵の、保存と取り出し。
 *
 * 生の鍵を持ち歩くのはこのファイルの中だけで、しかも発行の瞬間だけ。
 * 保存するのはハッシュと先頭数文字で、呼び出し側へ返すのも1回きり。
 * 「あとから見せてほしい」に応えられる作りにしない（応えられる作りは、
 * 盗まれたときにもそのまま応えてしまう）。
 *
 * 鍵は複数本ある。1本止めても他は動き続けるのが正しい形なので、
 * 「使える鍵」は常に配列で扱う（1本だけを前提にした読み方を残さない）。
 *
 * 判断の言葉と形は src/lib/domain/agent-keys.ts が正本。ここは
 * 乱数・ハッシュ・保存だけを受け持つ。
 */

import { desc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import {
  AGENT_KEY_BYTES,
  AGENT_KEY_CAP_MESSAGE,
  agentKeyPrefix,
  canIssueAgentKey,
  encodeAgentKey,
  normalizeAgentKeyLabel,
  shouldTouchLastUsed,
  type AgentKeyRecord,
} from "@/lib/domain/agent-keys";

/** 設定の行はアプリ全体で1つ。IDを固定して、行が増えないようにする。 */
const SETTINGS_ID = "default";

/** 鍵のハッシュ。保存するのも突き合わせるのも、この値だけ。 */
export async function hashAgentKey(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 鍵を1本発行する。前の鍵は止めない（複数本を同時に使うための仕組みなので）。
 *
 * 上限に達しているときは発行しない。ここで断らないと、画面の表示だけを
 * 信じた呼び出しで上限を超えられる。
 *
 * 返す生の鍵は、この戻り値が唯一の出口。保存もログ出力もしない。
 */
export async function issueAgentKey(actorId: string, rawLabel: string): Promise<{ raw: string; prefix: string }> {
  const label = normalizeAgentKeyLabel(rawLabel);
  const db = await getDb();
  const active = await db
    .select({ id: s.agentApiKeys.id })
    .from(s.agentApiKeys)
    .where(isNull(s.agentApiKeys.revokedAt));
  if (!canIssueAgentKey(active.length)) throw new HttpError(400, AGENT_KEY_CAP_MESSAGE);

  const bytes = new Uint8Array(AGENT_KEY_BYTES);
  crypto.getRandomValues(bytes);
  const raw = encodeAgentKey(bytes);
  const prefix = agentKeyPrefix(raw);

  await db.insert(s.agentApiKeys).values({
    id: newId("agkey"),
    label,
    keyHash: await hashAgentKey(raw),
    keyPrefix: prefix,
    createdById: actorId,
  });

  return { raw, prefix };
}

/**
 * 鍵を1本だけ止める。他の鍵はそのまま使える。
 * すでに止まっている・存在しないIDなら false（押し間違いを黙って成功にしない）。
 */
export async function revokeAgentKey(actorId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const found = await db
    .select({ id: s.agentApiKeys.id, revokedAt: s.agentApiKeys.revokedAt })
    .from(s.agentApiKeys)
    .where(eq(s.agentApiKeys.id, id))
    .limit(1);
  if (found.length === 0 || found[0].revokedAt !== null) return false;
  await db
    .update(s.agentApiKeys)
    .set({ revokedAt: new Date(), revokedById: actorId })
    .where(eq(s.agentApiKeys.id, id));
  return true;
}

/** 画面に出す発行の記録。生の鍵は入らない（先頭数文字だけ）。 */
export async function listAgentKeys(): Promise<AgentKeyRecord[]> {
  const db = await getDb();
  const creators = { id: s.users.id, name: s.users.name };
  const rows = await db
    .select({
      id: s.agentApiKeys.id,
      label: s.agentApiKeys.label,
      keyPrefix: s.agentApiKeys.keyPrefix,
      createdAt: s.agentApiKeys.createdAt,
      createdById: s.agentApiKeys.createdById,
      lastUsedAt: s.agentApiKeys.lastUsedAt,
      revokedAt: s.agentApiKeys.revokedAt,
      revokedById: s.agentApiKeys.revokedById,
    })
    .from(s.agentApiKeys)
    .orderBy(desc(s.agentApiKeys.createdAt))
    .limit(50);
  const names = new Map((await db.select(creators).from(s.users)).map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt,
    createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
    revokedByName: r.revokedById ? (names.get(r.revokedById) ?? null) : null,
  }));
}

/** いま使える鍵すべて。突き合わせに使うので、ハッシュと呼び名だけを読む。 */
export async function activeAgentKeyHashes(
  db: DB,
): Promise<{ id: string; label: string; hash: string; lastUsedAt: Date | null }[]> {
  return db
    .select({
      id: s.agentApiKeys.id,
      label: s.agentApiKeys.label,
      hash: s.agentApiKeys.keyHash,
      lastUsedAt: s.agentApiKeys.lastUsedAt,
    })
    .from(s.agentApiKeys)
    .where(isNull(s.agentApiKeys.revokedAt));
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

/* ───────────────────────── サーバーの設定値の鍵 ───────────────────────── */

/** 設定値の鍵を受け付けるか。行が無ければ受け付ける（これまでの動きのまま）。 */
export async function envKeyEnabled(db: DB): Promise<boolean> {
  const rows = await db
    .select({ enabled: s.agentKeySettings.envKeyEnabled })
    .from(s.agentKeySettings)
    .where(eq(s.agentKeySettings.id, SETTINGS_ID))
    .limit(1);
  return rows[0]?.enabled ?? true;
}

/** 設定値の鍵の受け付けを切り替える。1行だけを作り替える。 */
export async function setEnvKeyEnabled(actorId: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db
    .insert(s.agentKeySettings)
    .values({ id: SETTINGS_ID, envKeyEnabled: enabled, updatedAt: new Date(), updatedById: actorId })
    .onConflictDoUpdate({
      target: s.agentKeySettings.id,
      set: { envKeyEnabled: enabled, updatedAt: new Date(), updatedById: actorId },
    });
}
