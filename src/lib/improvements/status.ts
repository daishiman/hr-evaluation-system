/**
 * 要望の状態を変える。会社の管理者とシステム全体管理者だけ。
 *
 * 入口は2つあり、どちらもここを通る。
 *  - 詳細画面の「対応状況」（Server Action: src/actions/improvements.ts）
 *  - 公開前の確かめ（scripts/verify-improvement-preview.mjs が PATCH /api/improvements/[id] を呼ぶ）
 *
 * 対象が自社のものかは WHERE 句で絞る。見つからないときは、
 * 他社のものか存在しないかを言い分けない（IDの当てずっぽうに答えない）。
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, HttpError, type Role } from "@/lib/session";
import {
  IMPROVEMENT_STATUSES,
  canHandleImprovements,
  improvementHandlingError,
  isImprovementStatus,
} from "@/lib/domain/improvement";
import { newId } from "@/lib/id";

export const improvementStatusSchema = z
  .object({
    status: z.enum(IMPROVEMENT_STATUSES),
    note: z.string().max(1000).nullish(),
  })
  .strict();

export type ImprovementStatusInput = z.output<typeof improvementStatusSchema>;

/** 1回に受け取る上限（バイト）。メモ1000文字に余裕を持たせた大きさ。 */
export const IMPROVEMENT_STATUS_MAX_BYTES = 16_000;

export interface Handler {
  id: string;
  companyId: string;
}

/** 状態を変えられる人か。役割と会社の両方を確かめる。 */
export function handlerOf(viewer: { id: string; role: Role; companyId: string | null }): Handler {
  if (!canHandleImprovements(viewer.role)) throw new HttpError(403, "この操作を行う権限がありません。");
  assertCompanyChosen(viewer);
  return { id: viewer.id, companyId: viewer.companyId };
}

export async function updateImprovementStatus(
  handler: Handler,
  id: string,
  input: ImprovementStatusInput,
): Promise<{ message: string }> {
  const db = await getDb();
  const where = and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, handler.companyId));

  const row = (
    await db
      .select({
        id: s.improvementRequests.id,
        status: s.improvementRequests.status,
        handledNote: s.improvementRequests.handledNote,
      })
      .from(s.improvementRequests)
      .where(where)
      .limit(1)
  )[0];
  if (!row) throw new HttpError(404, "対象の要望が見つかりませんでした。");

  const from = isImprovementStatus(row.status) ? row.status : "open";
  const note = input.note?.trim() ?? "";
  const ruleError = improvementHandlingError(from, row.handledNote, input.status, note || null);
  if (ruleError) throw new HttpError(400, ruleError);

  // 状態の更新と履歴の追記は1回の batch で書く。
  // 片方だけ残ると、状態は変わったのに経緯が読めない（またはその逆の）行ができる。
  // 誰がいつ状態を変えたかは、この画面からの更新でも残す。
  // まとめ操作のときだけ履歴があると、経緯が途中で切れて読めなくなる。
  await db.batch([
    db
      .update(s.improvementRequests)
      .set({ status: input.status, handledNote: note || null, handledById: handler.id })
      .where(where),
    db.insert(s.improvementStatusEvents).values({
      id: newId("ise"),
      requestId: id,
      action: "status",
      fromStatus: from,
      toStatus: input.status,
      reasonCode: null,
      reason: note || null,
      actorId: handler.id,
    }),
  ]);

  return { message: "対応状況を更新しました。" };
}
