import { getDb } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { bodySchema } from "./body-schema";
import { applyMasterUpdate } from "./apply-master-update";

export const dynamic = "force-dynamic";

/**
 * 制度マスタの変更（等級・昇格条件・昇給・要件・行動指針・ランク基準・KGI係数）。
 *
 * 制度の値をコードに書かないための入口。ここで保存した値が評価の計算に使われる。
 * 確定済みの評価は判定当時の値を持っているため、ここを変えても過去の結果は動かない。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const body = bodySchema.parse(await req.json());
    const db = await getDb();
    return applyMasterUpdate({
      db,
      companyId: viewer.companyId,
      viewerId: viewer.id,
      body,
    });
  });
}
