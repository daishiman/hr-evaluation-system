/**
 * ブラウザで承認して端末を通す仕組みの、保存と受け渡し。
 *
 * 生の合言葉・通行証を持つのはこのファイルの中だけで、しかも作った瞬間だけ。
 * 保存するのはハッシュで、呼び出し側へ返すのも1回きり。
 * 「あとから見せてほしい」に応えられる作りにしない（応えられる作りは、
 * 盗まれたときにもそのまま応えてしまう）。
 *
 * 判断の言葉と寿命は src/lib/domain/agent-device.ts が正本。ここは
 * 乱数・ハッシュ・保存だけを受け持つ。
 */

import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import { hashAgentKey } from "@/lib/agent-keys";
import { AGENT_KEY_BYTES, encodeAgentKey, normalizeAgentKeyLabel } from "@/lib/domain/agent-keys";
import {
  ACCESS_TOKEN_TTL_MS,
  DEVICE_GRANT_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  deviceGrantState,
  isExpired,
  type DeviceGrantState,
} from "@/lib/domain/agent-device";
import {
  DEFAULT_AGENT_SCOPES,
  parseAgentScopes,
  serializeAgentScopes,
  type AgentScope,
} from "@/lib/domain/agent-scope";

/** 推測されにくい長さの文字列を1本作る。鍵と同じ作り方をそろえる。 */
function randomToken(): string {
  const bytes = new Uint8Array(AGENT_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return encodeAgentKey(bytes);
}

/**
 * 画面に打ち込む合言葉。読み違えない文字だけから、偏りなく選ぶ。
 *
 * 剰余で丸めると先頭の文字だけ出やすくなるので、はみ出た乱数は捨てる。
 * 短い文字列なので、偏りはそのまま当てやすさになる。
 */
function randomUserCode(): string {
  const size = USER_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = "";
  while (code.length < USER_CODE_LENGTH) {
    const bytes = new Uint8Array(USER_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      code += USER_CODE_ALPHABET[b % size];
      if (code.length === USER_CODE_LENGTH) break;
    }
  }
  return code;
}

/* ───────────────────────── 承認を待つ ───────────────────────── */

export interface StartedDeviceGrant {
  userCode: string;
  deviceCode: string;
  expiresAt: Date;
}

/**
 * 承認待ちを1件作る。合言葉と、引き取り用の長い文字列を返す。
 *
 * 期限切れの行は作るたびに消す。合言葉は短くて使い回すので、
 * 使い終わった行を残すと、いつか同じ合言葉を作れなくなる。
 */
export async function startDeviceGrant(rawLabel: string): Promise<StartedDeviceGrant> {
  const db = await getDb();
  const now = new Date();
  await db.delete(s.agentDeviceGrants).where(lt(s.agentDeviceGrants.expiresAt, now));

  const deviceCode = randomToken();
  const expiresAt = new Date(now.getTime() + DEVICE_GRANT_TTL_MS);
  const label = normalizeAgentKeyLabel(rawLabel);

  // 合言葉がぶつかることはまれだが、ぶつかったら別の合言葉で作り直す。
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = randomUserCode();
    const taken = await db
      .select({ id: s.agentDeviceGrants.id })
      .from(s.agentDeviceGrants)
      .where(eq(s.agentDeviceGrants.userCode, userCode))
      .limit(1);
    if (taken.length > 0) continue;
    await db.insert(s.agentDeviceGrants).values({
      id: newId("agdev"),
      userCode,
      deviceCodeHash: await hashAgentKey(deviceCode),
      label,
      expiresAt,
    });
    return { userCode, deviceCode, expiresAt };
  }
  throw new Error("device grant code collision");
}

export interface DeviceGrantLookup {
  id: string;
  label: string;
  userCode: string;
  state: DeviceGrantState;
}

/** 合言葉から1件を探す。無ければ null（近い合言葉を探しにいかない）。 */
export async function findDeviceGrant(userCode: string): Promise<DeviceGrantLookup | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: s.agentDeviceGrants.id,
      label: s.agentDeviceGrants.label,
      userCode: s.agentDeviceGrants.userCode,
      expiresAt: s.agentDeviceGrants.expiresAt,
      approvedAt: s.agentDeviceGrants.approvedAt,
      deniedAt: s.agentDeviceGrants.deniedAt,
    })
    .from(s.agentDeviceGrants)
    .where(eq(s.agentDeviceGrants.userCode, userCode))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    userCode: row.userCode,
    state: deviceGrantState(row, new Date()),
  };
}

/**
 * 承認する。会社は承認した人の会社を焼き込む（あとから広げない）。
 * 通行証はここでは作らない。作ると、平文を誰も受け取らないまま残る。
 */
export async function approveDeviceGrant(
  actorId: string,
  companyId: string,
  userCode: string,
): Promise<DeviceGrantState> {
  const found = await findDeviceGrant(userCode);
  if (!found) return "expired";
  if (found.state !== "pending") return found.state;
  const db = await getDb();
  await db
    .update(s.agentDeviceGrants)
    .set({ approvedAt: new Date(), approvedById: actorId, companyId })
    .where(eq(s.agentDeviceGrants.id, found.id));
  return "approved";
}

/** 断る。心当たりのない合言葉を押し返すための操作なので、行は残す。 */
export async function denyDeviceGrant(userCode: string): Promise<DeviceGrantState> {
  const found = await findDeviceGrant(userCode);
  if (!found) return "expired";
  if (found.state !== "pending") return found.state;
  const db = await getDb();
  await db
    .update(s.agentDeviceGrants)
    .set({ deniedAt: new Date() })
    .where(eq(s.agentDeviceGrants.id, found.id));
  return "denied";
}

/* ───────────────────────── 通行証を引き取る ───────────────────────── */

export interface AgentTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export type RedeemResult =
  | { state: "pending" | "denied" | "expired" | "taken"; tokens: null }
  | { state: "approved"; tokens: AgentTokens };

/**
 * 承認された端末が、通行証を1回だけ引き取る。
 *
 * 平文を作るのはこの1回だけ。2回目からは「引き取り済み」として断る。
 * 何度でも引き取れると、長い文字列が漏れたときに何度でも作り直せてしまう。
 */
export async function redeemDeviceGrant(deviceCode: string): Promise<RedeemResult> {
  const db = await getDb();
  const hash = await hashAgentKey(deviceCode);
  const rows = await db
    .select({
      id: s.agentDeviceGrants.id,
      label: s.agentDeviceGrants.label,
      companyId: s.agentDeviceGrants.companyId,
      approvedById: s.agentDeviceGrants.approvedById,
      expiresAt: s.agentDeviceGrants.expiresAt,
      approvedAt: s.agentDeviceGrants.approvedAt,
      deniedAt: s.agentDeviceGrants.deniedAt,
      sessionId: s.agentDeviceGrants.sessionId,
    })
    .from(s.agentDeviceGrants)
    .where(eq(s.agentDeviceGrants.deviceCodeHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) return { state: "expired", tokens: null };

  const state = deviceGrantState(row, new Date());
  if (state !== "approved") return { state, tokens: null };
  if (row.sessionId) return { state: "taken", tokens: null };
  if (!row.companyId) return { state: "expired", tokens: null };

  const now = new Date();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const sessionId = newId("agses");
  await db.insert(s.agentSessions).values({
    id: sessionId,
    label: row.label,
    companyId: row.companyId,
    scopes: serializeAgentScopes(DEFAULT_AGENT_SCOPES),
    refreshHash: await hashAgentKey(refreshToken),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    accessHash: await hashAgentKey(accessToken),
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    createdById: row.approvedById,
  });
  await db
    .update(s.agentDeviceGrants)
    .set({ sessionId })
    .where(eq(s.agentDeviceGrants.id, row.id));

  return {
    state: "approved",
    tokens: { accessToken, refreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_MS / 1000 },
  };
}

/**
 * 長い方の通行証で、短い方を取り直す。台本が期限切れのたびに黙って呼ぶ。
 * 長い方は作り替えない。作り替えると保管庫への書き戻しが必要になり、
 * 書き戻しに失敗した端末がその場で締め出される。
 */
export async function refreshAgentAccess(
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSeconds: number } | null> {
  const db = await getDb();
  const hash = await hashAgentKey(refreshToken);
  const rows = await db
    .select({
      id: s.agentSessions.id,
      refreshExpiresAt: s.agentSessions.refreshExpiresAt,
      revokedAt: s.agentSessions.revokedAt,
    })
    .from(s.agentSessions)
    .where(eq(s.agentSessions.refreshHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || isExpired(row.refreshExpiresAt, new Date())) return null;

  const now = new Date();
  const accessToken = randomToken();
  await db
    .update(s.agentSessions)
    .set({
      accessHash: await hashAgentKey(accessToken),
      accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      lastUsedAt: now,
    })
    .where(eq(s.agentSessions.id, row.id));
  return { accessToken, expiresInSeconds: ACCESS_TOKEN_TTL_MS / 1000 };
}

/* ───────────────────────── 受け取りのときに使う ───────────────────────── */

export interface AgentSessionScope {
  id: string;
  label: string;
  companyId: string | null;
  scopes: AgentScope[];
}

/**
 * 短い方の通行証から、この端末がどこまでしてよいかを引く。
 * 期限切れ・止められたものは通さない。読み直しの余地を残さないため、
 * 会社とできることをここで一緒に返す。
 */
export async function resolveAgentSession(
  db: DB,
  accessHash: string,
  now: Date,
): Promise<AgentSessionScope | null> {
  const rows = await db
    .select({
      id: s.agentSessions.id,
      label: s.agentSessions.label,
      companyId: s.agentSessions.companyId,
      scopes: s.agentSessions.scopes,
      accessExpiresAt: s.agentSessions.accessExpiresAt,
      revokedAt: s.agentSessions.revokedAt,
    })
    .from(s.agentSessions)
    .where(eq(s.agentSessions.accessHash, accessHash))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || isExpired(row.accessExpiresAt, now)) return null;
  return {
    id: row.id,
    label: row.label,
    companyId: row.companyId,
    scopes: parseAgentScopes(row.scopes),
  };
}

/**
 * その短い通行証が、かつてこの仕組みで配られたものかどうか。
 *
 * 期限切れ・止められた端末に「鍵が未設定です」と返すと、直しようのない
 * 案内になる。使えなくなったことだけは、そう言えるようにする。
 * 中身は返さない（在ったかどうかだけで、次の一手は決まる）。
 */
export async function agentSessionKnown(db: DB, accessHash: string): Promise<boolean> {
  const rows = await db
    .select({ id: s.agentSessions.id })
    .from(s.agentSessions)
    .where(eq(s.agentSessions.accessHash, accessHash))
    .limit(1);
  return rows.length > 0;
}

/* ───────────────────────── 画面に出す ───────────────────────── */

export interface AgentSessionRecord {
  id: string;
  label: string;
  companyName: string | null;
  createdAt: Date;
  createdByName: string | null;
  lastUsedAt: Date | null;
  refreshExpiresAt: Date;
  revokedAt: Date | null;
  scopes: AgentScope[];
}

/** 通した端末の一覧。通行証そのものは1文字も入らない。 */
export async function listAgentSessions(): Promise<AgentSessionRecord[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: s.agentSessions.id,
      label: s.agentSessions.label,
      companyId: s.agentSessions.companyId,
      companyName: s.companies.name,
      scopes: s.agentSessions.scopes,
      createdAt: s.agentSessions.createdAt,
      createdById: s.agentSessions.createdById,
      lastUsedAt: s.agentSessions.lastUsedAt,
      refreshExpiresAt: s.agentSessions.refreshExpiresAt,
      revokedAt: s.agentSessions.revokedAt,
    })
    .from(s.agentSessions)
    .leftJoin(s.companies, eq(s.companies.id, s.agentSessions.companyId))
    .orderBy(desc(s.agentSessions.createdAt))
    .limit(50);
  const names = new Map(
    (await db.select({ id: s.users.id, name: s.users.name }).from(s.users)).map((u) => [u.id, u.name]),
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    companyName: r.companyId ? (r.companyName ?? null) : null,
    createdAt: r.createdAt,
    createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
    lastUsedAt: r.lastUsedAt,
    refreshExpiresAt: r.refreshExpiresAt,
    revokedAt: r.revokedAt,
    scopes: parseAgentScopes(r.scopes),
  }));
}

/** 端末を1台だけ止める。他の端末はそのまま使える。 */
export async function revokeAgentSession(actorId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const found = await db
    .select({ id: s.agentSessions.id, revokedAt: s.agentSessions.revokedAt })
    .from(s.agentSessions)
    .where(eq(s.agentSessions.id, id))
    .limit(1);
  if (found.length === 0 || found[0].revokedAt !== null) return false;
  await db
    .update(s.agentSessions)
    .set({ revokedAt: new Date(), revokedById: actorId })
    .where(eq(s.agentSessions.id, id));
  return true;
}

/** いま生きている端末の数。長命の鍵を止めてよいかの判断に使う。 */
export async function activeAgentSessionCount(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: s.agentSessions.id })
    .from(s.agentSessions)
    .where(and(isNull(s.agentSessions.revokedAt)));
  return rows.length;
}
