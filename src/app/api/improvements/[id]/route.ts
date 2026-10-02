import { apiViewer } from "@/lib/session";
import { handle } from "@/lib/api";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import {
  handlerOf,
  IMPROVEMENT_STATUS_MAX_BYTES,
  improvementStatusSchema,
  updateImprovementStatus,
} from "@/lib/improvements/status";

export const dynamic = "force-dynamic";

/**
 * 要望の状態を変える。会社の管理者とシステム全体管理者だけ。
 *
 * 画面からの更新は Server Action（src/actions/improvements.ts の updateImprovementStatus）を通る。
 * この入口は、公開前の確かめ（scripts/verify-improvement-preview.mjs）のために残している。
 * 中身は src/lib/improvements/status.ts の1本で、どちらから届いても同じ検査を通る。
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    const handler = handlerOf(viewer);

    const { id } = await ctx.params;
    const input = improvementStatusSchema.parse(await readJsonBodyWithinLimit(req, IMPROVEMENT_STATUS_MAX_BYTES));
    return updateImprovementStatus(handler, id, input);
  });
}
