/**
 * 作業指示文を払い出すAPIの門番。
 *
 * 鍵を読む・回線ごとに回数を数える・断る、の3つだけを持つ。
 * 何を返すかは呼び出し側、断り方の言葉は src/lib/domain/agent-api.ts にある。
 *
 * 数える順番は「回線 → 鍵」。鍵を確かめてから数えると、鍵を当てにくる相手は
 * 何度でも試せてしまう（外れた回が数に入らないため）。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { agentAuth } from "@/lib/domain/agent-api";
import { AGENT_API_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";

interface AgentEnv {
  AGENT_API_KEY?: string;
}

/**
 * 鍵を読む。実行コンテキストが無い場所（テスト・手元の一部）では読めないので、
 * その場合は「未設定」と同じ扱いにする（設定手順を返して止まる）。
 */
async function agentKey(): Promise<string | null> {
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

  const auth = agentAuth(await agentKey(), req.headers.get("authorization"));
  if (auth.ok) return null;
  return textResponse(
    auth.status,
    auth.message,
    auth.status === 401 ? { "www-authenticate": 'Bearer realm="improvements"' } : {},
  );
}
