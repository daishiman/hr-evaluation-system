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
import { newId } from "@/lib/id";
import { requireGithubSettings } from "@/lib/github-issue";
import { syncImprovementIssue } from "@/lib/improvement-issue-sync";

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

    // 誰がいつ状態を変えたかは、この画面からの更新でも残す。
    // まとめ操作のときだけ履歴があると、経緯が途中で切れて読めなくなる。
    await db.insert(s.improvementStatusEvents).values({
      id: newId("ise"),
      requestId: id,
      action: "status",
      fromStatus: from,
      toStatus: input.status,
      reasonCode: null,
      reason: note || null,
      actorId: viewer.id,
    });

    return { message: "対応状況を更新しました。" };
  });
}

/**
 * 届いた要望1件から、開発の記録票（GitHub Issue）を作る。
 *
 * できるのはシステム全体管理者だけ。記録票の置き場所は会社ごとではなく
 * このシステムを作っている側のリポジトリなので、会社の管理者が押せると
 * 「自社の中の操作」のつもりで社外へ文章が出ることになる。
 *
 * 二重に立てない。すでに作ってあれば、内容が変わっていれば同じ記録票を更新し、
 * 変わっていなければ何もしない。判断の中身は improvement-issue-sync.ts。
 *
 * 置き場所を `/issue` に分けず、この要望1件の入口（PATCH と同じファイル）へ
 * 同居させている。道を1本増やすと、同じ依存一式（DB・ログイン・検査）を
 * もう一度束ねた塊が配布物に増え、無料枠の上限まで約0.5MB食う。
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "操作する会社が選ばれていません。");

    const { id } = await ctx.params;
    // 設定の不足は、外へ送る前に確かめる（送ってから気づくと二重投稿になる）。
    const settings = await requireGithubSettings();
    const result = await syncImprovementIssue(settings, { id: viewer.id, companyId: viewer.companyId }, id);

    // 1件だけの操作では、失敗をそのまま失敗として返す（画面が赤く出す）。
    // 一覧の一括送信は同じ関数の結果を行ごとに並べるので、そちらでは止めない。
    if (result.action === "failed") throw new HttpError(502, result.reason);

    return {
      issueNumber: result.issueNumber,
      issueUrl: result.issueUrl,
      action: result.action,
      message: result.reason,
    };
  });
}
