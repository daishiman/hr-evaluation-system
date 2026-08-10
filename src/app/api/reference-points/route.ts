import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 元の配点表の写し（参考値）。評価セット画面で「参考にする」を開いたときだけ読む。
 *
 * 全件は 33項目 × 5等級区分 × 5ランク ＝ 800件を超え、画面を開くたびに
 * すべてHTMLへ埋め込むと数十KBになる。参考にするのは選んでいる等級区分の
 * 1つだけなので、その区分ぶんに絞って返す。
 *
 * これは計算には使わない値で、あくまで「元の表ではこうだった」を見せるためのもの。
 */
const querySchema = z.object({ group: z.string().min(1).max(50) });

export async function GET(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const { group } = querySchema.parse({ group: new URL(req.url).searchParams.get("group") ?? "" });
    const db = await getDb();

    const rows = await db
      .select({
        kpiItemId: s.kpiReferencePoints.kpiItemId,
        pointGroup: s.kpiReferencePoints.pointGroup,
        rank: s.kpiReferencePoints.rank,
        points: s.kpiReferencePoints.points,
      })
      .from(s.kpiReferencePoints)
      .where(
        and(eq(s.kpiReferencePoints.companyId, viewer.companyId), eq(s.kpiReferencePoints.pointGroup, group)),
      );

    return { group, rows };
  });
}
