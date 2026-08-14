import { and, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { schema as s } from "@/lib/db";

export interface ImprovementWriteInput {
  companyId: string;
  reporterId: string;
  submissionKey: string;
  path: string;
  routePattern: string;
  screenLabel: string;
  body: string;
  viewport: string | null;
  userAgent: string | null;
  shot: string | null;
  shotBytes: number;
}

/** 同じ会社・投稿者・送信キーなら、並行再送でも同じ主キーになる。 */
export async function improvementRequestId(
  companyId: string,
  reporterId: string,
  submissionKey: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${companyId}\u0000${reporterId}\u0000${submissionKey}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  return `improve_${hex.slice(0, 20)}`;
}

/** 本文と画像を1つのD1 batchで保存する。batch失敗時は両方ロールバックされる。 */
export async function saveImprovementRequest(db: DB, input: ImprovementWriteInput): Promise<string> {
  const id = await improvementRequestId(input.companyId, input.reporterId, input.submissionKey);
  const requestStatement = db
    .insert(s.improvementRequests)
    .values({
      id,
      companyId: input.companyId,
      reporterId: input.reporterId,
      submissionKey: input.submissionKey,
      path: input.path,
      routePattern: input.routePattern,
      screenLabel: input.screenLabel,
      body: input.body,
      viewport: input.viewport,
      userAgent: input.userAgent,
      status: "open",
    })
    .onConflictDoNothing();

  if (!input.shot) {
    await requestStatement;
    return id;
  }

  const shotStatement = db
    .insert(s.improvementShots)
    .values({ requestId: id, dataUrl: input.shot, bytes: input.shotBytes })
    .onConflictDoNothing({ target: s.improvementShots.requestId });

  await db.batch([requestStatement, shotStatement]);
  return id;
}

export async function findImprovementBySubmission(
  db: DB,
  companyId: string,
  reporterId: string,
  submissionKey: string,
): Promise<string | null> {
  const row = (
    await db
      .select({ id: s.improvementRequests.id })
      .from(s.improvementRequests)
      .where(
        and(
          eq(s.improvementRequests.companyId, companyId),
          eq(s.improvementRequests.reporterId, reporterId),
          eq(s.improvementRequests.submissionKey, submissionKey),
        ),
      )
      .limit(1)
  )[0];
  return row?.id ?? null;
}
