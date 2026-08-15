import { z } from "zod";
import { handle } from "@/lib/api";
import { apiViewer, HttpError } from "@/lib/session";
import { issueAgentKey, revokeAgentKey, setEnvKeyEnabled } from "@/lib/agent-keys";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { agentPromptTextWithKey } from "@/lib/domain/agent-api";
import { agentKeyExportLine, agentKeyLabelError } from "@/lib/domain/agent-keys";
import { appOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

const issueSchema = z.object({ label: z.string().max(200) }).strict();
const envSchema = z.object({ envKeyEnabled: z.boolean() }).strict();

/**
 * 鍵を1本発行する（システム全体管理者のみ）。
 *
 * 生の鍵を返すのはこの応答1回だけ。保存もログ出力もしないので、
 * 閉じたあとに同じ鍵を取り出す方法はない（別の鍵を発行することはできる）。
 *
 * 発行しても他の鍵は止めない。端末ごと・人ごとに配れることが目的なので、
 * 止めるのは失効の操作だけに寄せる（発行のついでに止まる道を作らない）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const input = issueSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    const labelError = agentKeyLabelError(input.label);
    if (labelError) throw new HttpError(400, labelError);

    const { raw, prefix } = await issueAgentKey(viewer.id, input.label);
    const origin = await appOrigin();
    return {
      // 生の鍵。画面はこれを1回だけ出し、保存しない。
      key: raw,
      prefix,
      exportLine: agentKeyExportLine(raw),
      prompt: agentPromptTextWithKey(origin, "", raw),
    };
  });
}

/**
 * 鍵を1本だけ失効させる（システム全体管理者のみ）。他の鍵は動き続ける。
 * すでに止まっている鍵を押されたときは、成功にせず理由を返す。
 */
export async function DELETE(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) throw new HttpError(400, "止める鍵が選ばれていません。");
    const revoked = await revokeAgentKey(viewer.id, id);
    if (!revoked) throw new HttpError(400, "この鍵はすでに止まっています。");
    return { message: "鍵を止めました。この鍵での受け取りはできなくなります。" };
  });
}

/**
 * サーバーの設定値の鍵を、受け付けるかどうかを切り替える（システム全体管理者のみ）。
 *
 * 設定値そのものはターミナルからしか消せない。画面の鍵を全部止めても
 * 設定値の鍵は残るため、画面だけで完全に止められる道をここで用意する。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const input = envSchema.parse(await readJsonBodyWithinLimit(req, 4_000));
    await setEnvKeyEnabled(viewer.id, input.envKeyEnabled);
    return {
      message: input.envKeyEnabled
        ? "サーバーの設定値の鍵を、また受け付けます。"
        : "サーバーの設定値の鍵での受け取りを止めました。",
    };
  });
}
