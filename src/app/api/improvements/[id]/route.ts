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
import { getImprovementRequest } from "@/lib/queries";
import { buildImprovementIssueDraft } from "@/lib/improvement-issue-draft";
import { createGithubIssue, requireGithubSettings } from "@/lib/github-issue";

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

/**
 * 届いた要望1件から、開発の記録票（GitHub Issue）を作る。
 *
 * できるのはシステム全体管理者だけ。記録票の置き場所は会社ごとではなく
 * このシステムを作っている側のリポジトリなので、会社の管理者が押せると
 * 「自社の中の操作」のつもりで社外へ文章が出ることになる。
 *
 * 二重に立てない。すでに作ってあれば、新しく作らずその行き先を返す
 * （押した人にとっては「もう作ってある」と分かればよい）。
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
    const item = await getImprovementRequest(viewer.companyId, id);
    if (!item) throw new HttpError(404, "対象の要望が見つかりませんでした。");

    if (item.issueUrl) {
      return {
        issueNumber: item.issueNumber,
        issueUrl: item.issueUrl,
        message: "この要望の記録票はすでに作られています。",
      };
    }

    // 設定の不足は、外へ送る前に確かめる（送ってから気づくと二重投稿になる）。
    const settings = await requireGithubSettings();
    const draft = await buildImprovementIssueDraft(item);
    const created = await createGithubIssue(settings, {
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
    });

    const db = await getDb();
    await db
      .insert(s.improvementIssueLinks)
      .values({
        requestId: item.id,
        repo: settings.repo,
        issueNumber: created.number,
        issueUrl: created.url,
        createdById: viewer.id,
      })
      .onConflictDoNothing({ target: s.improvementIssueLinks.requestId });

    // 未対応のまま置き去りにしないよう、作った時点で「対応中」へ進める。
    if (item.status === "open") {
      await db
        .update(s.improvementRequests)
        .set({ status: "doing", handledById: viewer.id })
        .where(and(eq(s.improvementRequests.id, item.id), eq(s.improvementRequests.companyId, viewer.companyId)));
    }

    return {
      issueNumber: created.number,
      issueUrl: created.url,
      message: `記録票 #${created.number} を作りました。`,
    };
  });
}
