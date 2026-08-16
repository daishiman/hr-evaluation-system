import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";
import { consumeRateLimit, USAGE_INGEST_RATE_LIMIT } from "@/lib/rate-limit";
import { apiViewer, HttpError } from "@/lib/session";
import { readJsonBodyWithinLimit } from "@/lib/request-body";
import { recordUsageBatch, USAGE_BATCH_MAX_BYTES, usageBatchSchema } from "@/lib/usage";

export const dynamic = "force-dynamic";

/**
 * 画面側でまとめた利用状況を受け取る。
 *
 * 送ってよいのは「どの画面を何回・どれだけ見たか」だけ。会社と役割は本文から
 * 受け取らず、検証済みセッションから決める（→ src/lib/usage.ts）。
 *
 * 記録が取れなくても業務は続けられるので、ここで失敗しても画面には何も出さない。
 * 送る側は応答を読まない（sendBeacon）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer();

    // 会社に紐づかない記録は置き場所が無い（会社を選んでいない全体管理者など）
    if (!viewer.companyId) return { message: "記録しませんでした。" };

    /* 1人が短時間に何度も送ってくるのは、貯めずに送っているか、細工されているか
       のどちらか。どちらの場合も書き込みが増えるだけなので、ここで頭を打つ。 */
    const limit = consumeRateLimit(`usage:${viewer.id}`, USAGE_INGEST_RATE_LIMIT);
    if (!limit.allowed) {
      throw new HttpError(429, "記録の送信が続いています。時間をおいて再度お試しください。", {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    const batch = usageBatchSchema.parse(await readJsonBodyWithinLimit(req, USAGE_BATCH_MAX_BYTES));
    const db = await getDb();
    const saved = await recordUsageBatch(db, { companyId: viewer.companyId, role: viewer.role }, batch);
    return { message: "記録しました。", ...saved };
  });
}
