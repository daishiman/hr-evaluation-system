import { z } from "zod";
import { handle } from "@/lib/api";
import { apiViewer, HttpError } from "@/lib/session";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { approveDeviceGrant, denyDeviceGrant, findDeviceGrant, revokeAgentSession } from "@/lib/agent-device";
import {
  DEVICE_APPROVED_MESSAGE,
  DEVICE_DENIED_MESSAGE,
  DEVICE_EXPIRED_MESSAGE,
  DEVICE_UNKNOWN_MESSAGE,
  deviceApprovalQuestion,
  normalizeUserCode,
} from "@/lib/domain/agent-device";

export const dynamic = "force-dynamic";

const decideSchema = z.object({ userCode: z.string().max(50), approve: z.boolean() }).strict();

/** 打ち込まれた合言葉が何なのかを、押す前に見せる（システム全体管理者のみ）。 */
export async function GET(req: Request) {
  return handle(async () => {
    await apiViewer("SUPER_ADMIN");
    const code = normalizeUserCode(new URL(req.url).searchParams.get("userCode"));
    if (!code) throw new HttpError(400, DEVICE_UNKNOWN_MESSAGE);
    const found = await findDeviceGrant(code);
    if (!found || found.state === "expired") throw new HttpError(404, DEVICE_EXPIRED_MESSAGE);
    if (found.state === "denied") throw new HttpError(400, DEVICE_DENIED_MESSAGE);
    return { question: deviceApprovalQuestion(found.label, found.userCode), state: found.state };
  });
}

/**
 * 合言葉を承認する・断る（システム全体管理者のみ）。
 *
 * 会社は承認した人の会社を焼き込む。ここで決めないと、通ったあとに
 * 「どの会社の話か」が決まらないまま読み書きできる端末ができてしまう。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const input = decideSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const code = normalizeUserCode(input.userCode);
    if (!code) throw new HttpError(400, DEVICE_UNKNOWN_MESSAGE);

    if (!input.approve) {
      const state = await denyDeviceGrant(code);
      if (state !== "denied") throw new HttpError(400, DEVICE_EXPIRED_MESSAGE);
      return { message: "この端末は通しませんでした。" };
    }

    if (!viewer.companyId) throw new HttpError(400, "操作する会社が選ばれていません。");
    const state = await approveDeviceGrant(viewer.id, viewer.companyId, code);
    if (state !== "approved") throw new HttpError(400, DEVICE_EXPIRED_MESSAGE);
    return { message: DEVICE_APPROVED_MESSAGE };
  });
}

/** 通した端末を1台だけ止める（システム全体管理者のみ）。他の端末は動き続ける。 */
export async function DELETE(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) throw new HttpError(400, "止める端末が選ばれていません。");
    const revoked = await revokeAgentSession(viewer.id, id);
    if (!revoked) throw new HttpError(400, "この端末はすでに止まっています。");
    return { message: "この端末からの受け取りを止めました。" };
  });
}
