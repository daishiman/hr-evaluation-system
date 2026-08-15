import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { refreshAgentAccess } from "@/lib/agent-device";
import { DEVICE_REFRESH_EXPIRED_MESSAGE } from "@/lib/domain/agent-device";
import { AGENT_API_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ refreshToken: z.string().min(1).max(500) }).strict();

/**
 * 長い方の通行証で、短い方を取り直す。台本が期限切れのたびに黙って呼ぶ。
 *
 * 断るときは理由を1つにする（切れた・止められた・そもそも違う、を
 * 言い分けない）。言い分けると、当てにくる相手に手がかりを渡す。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const limit = consumeRateLimit(`agent-device:${ip}`, AGENT_API_RATE_LIMIT);
    if (!limit.allowed) {
      throw new HttpError(429, "しばらく待ってからお試しください。", {
        "retry-after": String(limit.retryAfterSeconds),
      });
    }
    const input = schema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const issued = await refreshAgentAccess(input.refreshToken);
    if (!issued) throw new HttpError(401, DEVICE_REFRESH_EXPIRED_MESSAGE);
    return { accessToken: issued.accessToken, expiresInSeconds: issued.expiresInSeconds };
  });
}
