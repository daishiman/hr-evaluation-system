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
import { agentAuth, readBearer } from "@/lib/domain/agent-api";
import { activeAgentKeyHash, hashAgentKey, touchAgentKey } from "@/lib/agent-keys";
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

function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(`${body}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/**
 * 通してよいかを判定する。断るときだけ Response を返す（null なら通す）。
 *
 * 返す本文はどれも文字のまま。断り文を JSON で包んでも読みやすくならず、
 * 鍵が違うときは中身を一切返さない、という線だけが大事になる。
 */
export async function guardAgentRequest(req: Request): Promise<Response | null> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const limit = consumeRateLimit(`agent-api:${ip}`, AGENT_API_RATE_LIMIT);
  if (!limit.allowed) {
    return textResponse(429, "しばらく待ってからお試しください。", {
      "retry-after": String(limit.retryAfterSeconds),
    });
  }

  const authorization = req.headers.get("authorization");
  const given = readBearer(authorization);
  const db = await getDb();
  const active = await activeAgentKeyHash(db);
  // 受け取った鍵は、突き合わせる前にハッシュへ変える。生のまま比べる先を作らない。
  const givenHash = given ? await hashAgentKey(given) : null;

  const auth = agentAuth(
    { envKey: await envKey(), activeKeyHash: active?.hash ?? null },
    authorization,
    givenHash,
    await appOrigin(),
  );
  if (!auth.ok) {
    return textResponse(
      auth.status,
      auth.message,
      auth.status === 401 ? { "www-authenticate": 'Bearer realm="improvements"' } : {},
    );
  }

  // 通った鍵が画面発行のものなら、使われたことを控える（配ったのに届いていない、に気づくため）。
  if (active && givenHash && active.hash === givenHash) {
    await touchAgentKey(db, active.id, active.lastUsedAt);
  }
  return null;
}
