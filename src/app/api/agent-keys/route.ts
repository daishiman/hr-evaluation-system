import { handle } from "@/lib/api";
import { apiViewer, HttpError } from "@/lib/session";
import { issueAgentKey, revokeAgentKeys } from "@/lib/agent-keys";
import { agentPromptTextWithKey } from "@/lib/domain/agent-api";
import { agentKeyExportLine } from "@/lib/domain/agent-keys";
import { appOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * 作業指示文を受け取るための鍵を発行する（システム全体管理者のみ）。
 *
 * 生の鍵を返すのはこの応答1回だけ。保存もログ出力もしないので、
 * 閉じたあとに同じ鍵を取り出す方法はない（作り直すことはできる）。
 *
 * 押した時点で前の鍵は失効する。「発行」と「作り直し」を別の操作にすると、
 * 止めたつもりの鍵が残る道ができる。
 */
export async function POST() {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const { raw, prefix } = await issueAgentKey(viewer.id);
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
 * いま使える鍵を失効させる（システム全体管理者のみ）。
 * 止める鍵が無いのに押されたときは、成功にせず理由を返す。
 */
export async function DELETE() {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const revoked = await revokeAgentKeys(viewer.id);
    if (!revoked) throw new HttpError(400, "いま使える鍵はありません。");
    return { message: "鍵を失効させました。次の鍵を発行するまで、受け取りは止まります。" };
  });
}
