import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { redeemDeviceGrant, startDeviceGrant } from "@/lib/agent-device";
import {
  DEVICE_APPROVE_PATH,
  DEVICE_DENIED_MESSAGE,
  DEVICE_EXPIRED_MESSAGE,
  DEVICE_PENDING_MESSAGE,
  DEVICE_POLL_INTERVAL_SECONDS,
  deviceLoginInstructions,
  expiresInMinutes,
} from "@/lib/domain/agent-device";
import { AGENT_API_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const startSchema = z.object({ label: z.string().max(200) }).strict();
const redeemSchema = z.object({ deviceCode: z.string().min(1).max(500) }).strict();

/**
 * 承認待ちを1件作る（誰でも呼べる）。
 *
 * ここに鍵を要求しないのが、この仕組みの入口である理由。まだ何も持って
 * いない端末が最初に呼ぶので、鍵を持っていることを前提にできない。
 * 代わりに、ここで返すものだけでは何も読めない（承認が要る）。
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
    const input = startSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const grant = await startDeviceGrant(input.label);
    // 案内に出す場所は、いま話している相手そのものにする。設定値の本番URLを
    // 出すと、ローカルで確かめている人を、合言葉の無い本番へ送ってしまう。
    const origin = new URL(req.url).origin;
    const minutes = expiresInMinutes(grant.expiresAt, new Date());
    return {
      // 合言葉は画面に打ち込むもの。長い方は台本だけが持ち、表示しない。
      userCode: grant.userCode,
      deviceCode: grant.deviceCode,
      verificationUri: `${origin}${DEVICE_APPROVE_PATH}`,
      intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
      expiresInMinutes: minutes,
      instructions: deviceLoginInstructions(origin, grant.userCode, minutes),
    };
  });
}

/**
 * 承認されたかを確かめ、済んでいれば通行証を1回だけ引き取る。
 *
 * 待ちも断りも 200 で返し、`state` で見分ける。待っている間ずっと
 * 失敗の応答を返し続けると、本当の失敗と区別が付かなくなる。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const limit = consumeRateLimit(`agent-device:${ip}`, AGENT_API_RATE_LIMIT);
    if (!limit.allowed) {
      throw new HttpError(429, "しばらく待ってからお試しください。", {
        "retry-after": String(limit.retryAfterSeconds),
      });
    }
    const input = redeemSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const result = await redeemDeviceGrant(input.deviceCode);
    if (result.state === "approved") {
      return {
        state: "approved",
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresInSeconds: result.tokens.expiresInSeconds,
      };
    }
    if (result.state === "pending") return { state: "pending", message: DEVICE_PENDING_MESSAGE };
    if (result.state === "denied") return { state: "denied", message: DEVICE_DENIED_MESSAGE };
    if (result.state === "taken") {
      return { state: "taken", message: "この合言葉はもう使われています。\nもう一度やり直してください。" };
    }
    return { state: "expired", message: DEVICE_EXPIRED_MESSAGE };
  });
}
