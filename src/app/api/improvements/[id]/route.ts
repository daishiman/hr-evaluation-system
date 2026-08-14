import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import {
  IMPROVEMENT_STATUSES,
  canHandleImprovements,
  improvementHandlingError,
  isImprovementStatus,
} from "@/lib/domain/improvement";
import { readJsonBodyWithinLimit } from "@/lib/request-body";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(IMPROVEMENT_STATUSES),
  note: z.string().max(1000).nullish(),
}).strict();

/**
 * 要望の状態を変える。会社の管理者とシステム全体管理者だけ。
 *
 * 対象が自社のものかは WHERE 句で絞る。見つからないときは、
 * 他社のものか存在しないかを言い分けない（IDの当てずっぽうに答えない）。
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!canHandleImprovements(viewer.role)) throw new HttpError(403, "この操作を行う権限がありません。");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");

    const { id } = await ctx.params;
    const input = bodySchema.parse(await readJsonBodyWithinLimit(req, 16_000));
    const db = await getDb();

    const row = (
      await db
        .select({
          id: s.improvementRequests.id,
          status: s.improvementRequests.status,
          handledNote: s.improvementRequests.handledNote,
        })
        .from(s.improvementRequests)
        .where(and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, viewer.companyId)))
        .limit(1)
    )[0];
    if (!row) throw new HttpError(404, "対象の要望が見つかりませんでした。");

    const from = isImprovementStatus(row.status) ? row.status : "open";
    const note = input.note?.trim() ?? "";
    const ruleError = improvementHandlingError(from, row.handledNote, input.status, note || null);
    if (ruleError) throw new HttpError(400, ruleError);

    await db
      .update(s.improvementRequests)
      .set({ status: input.status, handledNote: note || null, handledById: viewer.id })
      .where(and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, viewer.companyId)));

    return { message: "対応状況を更新しました。" };
  });
}
