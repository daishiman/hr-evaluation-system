/**
 * 作業指示文を払い出すAPIの門番。
 *
 * 鍵を読む・回線ごとに回数を数える・断る、の3つだけを持つ。
 * 何を返すかは呼び出し側、断り方の言葉は src/lib/domain/agent-api.ts にある。
 *
 * 数える順番は「回線 → 鍵」。鍵を確かめてから数えると、鍵を当てにくる相手は
 * 何度でも試せてしまう（外れた回が数に入らないため）。
 *
 * 鍵の在り処は2つある。画面から発行した鍵（ハッシュで保存）と、
 * サーバーの設定値。どちらでも通す。片方だけにすると、すでに設定値で
 * 動いている場所が止まるか、画面から使い始められないかのどちらかになる。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AGENT_KEY_MIN_LENGTH, agentAuth, readBearer } from "@/lib/domain/agent-api";
import type { AgentCallerScope } from "@/lib/domain/agent-scope";
import { activeAgentKeyHashes, envKeyEnabled, hashAgentKey, touchAgentKey } from "@/lib/agent-keys";
import { agentSessionKnown, resolveAgentSession } from "@/lib/agent-device";
import { AGENT_SESSION_ENDED_MESSAGE } from "@/lib/domain/agent-device";
import { getDb } from "@/lib/db";
import { appOrigin } from "@/lib/origin";
import { AGENT_API_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";

interface AgentEnv {
  AGENT_API_KEY?: string;
}

/**
 * サーバーの設定値の鍵を読む。実行コンテキストが無い場所（テスト・手元の一部）では
 * 読めないので、その場合は「無い」として扱う（画面で発行した鍵だけで判定する）。
 */
async function envKey(): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as AgentEnv).AGENT_API_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * 設定値の鍵が登録されているか。画面で「登録されていません」と言い切るために使う。
 * 中身は見せない（登録の有無だけで、止める・戻すの判断はできる）。
 */
export async function hasEnvKey(): Promise<boolean> {
  const raw = await envKey();
  return (raw?.trim().length ?? 0) >= AGENT_KEY_MIN_LENGTH;
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(`${body}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/**
 * どの鍵で通ったか。払い出しの履歴に、そのまま写す。
 * サーバーの設定値で通ったときは鍵の行が無いので、keyId も keyLabel も null になる。
 *
 * 会社とできることも一緒に持たせる。あとから読み直す作りにすると、読み直しを
 * 忘れた入口だけが全社を見てしまう。通った瞬間に範囲まで確定させる。
 */
export interface AgentCaller extends AgentCallerScope {
  keyLabel: string | null;
}

export type AgentGate = { denied: Response; caller: null } | { denied: null; caller: AgentCaller };

/**
 * 通してよいかを判定する。断るときだけ Response が入る（denied が null なら通す）。
 *
 * 返す本文はどれも文字のまま。断り文を JSON で包んでも読みやすくならず、
 * 鍵が違うときは中身を一切返さない、という線だけが大事になる。
 *
 * 通ったときは、どの鍵で通ったかを一緒に返す。あとから「この要望は
 * どの鍵で持って行かれたか」を辿れるようにするため。
 */
export async function guardAgentRequest(req: Request): Promise<AgentGate> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const limit = consumeRateLimit(`agent-api:${ip}`, AGENT_API_RATE_LIMIT);
  if (!limit.allowed) {
    const denied = textResponse(429, "しばらく待ってからお試しください。", {
      "retry-after": String(limit.retryAfterSeconds),
    });
    return { denied, caller: null };
  }

  const authorization = req.headers.get("authorization");
  const given = readBearer(authorization);
  const db = await getDb();
  // 受け取ったものは、突き合わせる前にハッシュへ変える。生のまま比べる先を作らない。
  const givenHash = given ? await hashAgentKey(given) : null;

  // 先に短命の通行証を見る。こちらが本筋で、鍵は移行のために残している道。
  // 順番を逆にすると、鍵が1本も無い場所で通行証まで「鍵が未設定」で断られる。
  if (givenHash) {
    const session = await resolveAgentSession(db, givenHash, new Date());
    if (session) {
      const caller: AgentCaller = {
        keyId: session.id,
        keyLabel: session.label,
        companyId: session.companyId,
        scopes: session.scopes,
      };
      return { denied: null, caller };
    }
    // 通らなかったが、この仕組みで配ったものではあった＝期限切れか、止められた。
    // 鍵の話に落とすと「鍵が未設定です」と案内してしまい、直しようがなくなる。
    if (await agentSessionKnown(db, givenHash)) {
      const denied = textResponse(401, AGENT_SESSION_ENDED_MESSAGE, {
        "www-authenticate": 'Bearer realm="improvements"',
      });
      return { denied, caller: null };
    }
  }

  const active = await activeAgentKeyHashes(db);

  const auth = agentAuth(
    {
      envKey: await envKey(),
      envKeyEnabled: await envKeyEnabled(db),
      activeKeyHashes: active.map((k) => k.hash),
    },
    authorization,
    givenHash,
    await appOrigin(),
  );
  if (!auth.ok) {
    const denied = textResponse(
      auth.status,
      auth.message,
      auth.status === 401 ? { "www-authenticate": 'Bearer realm="improvements"' } : {},
    );
    return { denied, caller: null };
  }

  // 通った鍵が画面発行のものなら、使われたことを控える（配ったのに届いていない、に気づくため）。
  const used = auth.keyHash ? (active.find((k) => k.hash === auth.keyHash) ?? null) : null;
  if (used) await touchAgentKey(db, used.id, used.lastUsedAt);

  // 設定値の鍵には会社が無い。読み取りだけの鍵として扱う（→ domain/agent-scope.ts）。
  const caller: AgentCaller = used
    ? { keyId: used.id, keyLabel: used.label, companyId: used.companyId, scopes: used.scopes }
    : { keyId: null, keyLabel: null, companyId: null, scopes: ["improvements:read"] };
  return { denied: null, caller };
}
