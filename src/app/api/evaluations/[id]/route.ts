import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { isOwnEvaluation, SELF_EVALUATION_BLOCK_REASON } from "@/lib/domain/evaluation-authority";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** finalize = 確定して本人に公開 / reopen = 確認中に戻す / comment = コメントのみ保存 */
  action: z.enum(["finalize", "reopen", "comment"]),
  comment: z.string().max(2000).nullish(),
});

/**
 * 評価の確定・差し戻し・コメント保存。
 * 確定すると本人の画面に結果が出る。確定を戻せるようにしてあるので、
 * 取り消しのきかない操作にはしていない。
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("MANAGER");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    const row = (
      await db
        .select()
        .from(s.evaluations)
        .where(and(eq(s.evaluations.id, id), eq(s.evaluations.companyId, viewer.companyId)))
        .limit(1)
    )[0];
    if (!row) throw new HttpError(404, "評価が見つかりませんでした。");

    // 自己承認を止める。画面でボタンを隠すだけだと、URLを直接叩けば通ってしまう。
    // 役割では判定しない（会社の管理者も自分自身の評価は同じく触れない）。
    if (isOwnEvaluation(viewer.id, row.employeeId)) throw new HttpError(403, SELF_EVALUATION_BLOCK_REASON);

    if (body.action === "comment") {
      await db.update(s.evaluations).set({ evaluatorComment: body.comment ?? null }).where(eq(s.evaluations.id, id));
      return { message: "コメントを保存しました。" };
    }

    if (body.action === "finalize") {
      if (row.status === "finalized") return { message: "すでに確定済みです。" };
      await db
        .update(s.evaluations)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          evaluatorId: viewer.id,
          evaluatorComment: body.comment ?? row.evaluatorComment,
        })
        .where(eq(s.evaluations.id, id));
      return { message: "確定しました。本人の画面に結果が表示されます。" };
    }

    await db
      .update(s.evaluations)
      .set({ status: "draft", finalizedAt: null })
      .where(eq(s.evaluations.id, id));
    return { message: "確認中に戻しました。本人の画面からは見えなくなります。" };
  });
}
