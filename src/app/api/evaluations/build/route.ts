import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { buildEvaluationsForCycle } from "@/lib/evaluate";
import { summarizeBuildResults } from "@/lib/domain/build-summary";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  cycleId: z.string().min(1),
  /** 指定するとその人だけ集計し直す。省略するとサイクル全員（提出済みの回答があるひと）。 */
  employeeIds: z.array(z.string().min(1)).max(500).optional(),
});

/**
 * 提出済みの回答から評価を作る／作り直す。
 *
 * 集計そのものは `buildEvaluationsForCycle` に任せる（ここに計算を書かない）。
 * その中で、確定済みの評価は計算せず据え置き、理由を結果に載せて返す。
 * 確定済みを動かさないのは制度上の約束なので、ここでも結果の件数を数えて画面に出す。
 *
 * 誰が実行できるか: マネージャー以上。評価を作るのは評価する側の仕事で、
 * 画面（/manager/cycles、/manager/evaluations/[id]）と同じ範囲にそろえている。
 * 会社の境界は viewer.companyId で閉じる（サイクルIDを他社のものにしても届かない）。
 *
 * 自分自身の評価も集計の対象に含める。集計は提出済みの回答と会社のマスタから
 * 機械的に決まるもので、本人の裁量が入らないため。裁量が入る「確定して本人に公開する」
 * だけは、自分自身の分を塞いである（src/lib/domain/evaluation-authority.ts）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("MANAGER");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    const cycle = (
      await db
        .select()
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.id, body.cycleId), eq(s.evaluationCycles.companyId, viewer.companyId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "その期（サイクル）は見つかりませんでした。");

    const results = await buildEvaluationsForCycle(viewer.companyId, cycle.id, viewer.id, {
      employeeIds: body.employeeIds,
    });

    return { message: summarizeBuildResults(results), results };
  });
}
