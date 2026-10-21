import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { resolveSchemeForCycle } from "@/lib/domain/scheme-resolution";

/**
 * 評価期間ごとに、使う評価セットの id を決める（DD-024）。
 *
 * 公開・受付開始の判定（loadSchemeReadiness）と、設問の古さの判定（loadStaleAsking）に渡す前に、ここを通す。
 * 期間に評価セットが付いていないとき、cycle.schemeId をそのまま渡すと「評価セットがありません」になり、
 * アンケートの作成・点数の計算は会社の使用中の評価セットで進むのに、公開だけが止まる。
 * 選び方は resolveSchemeForCycle の1か所に任せ、ここでは会社の評価セットを1回だけ読んで渡す。
 */
export async function schemeIdsForCycles(
  companyId: string,
  cycles: readonly { id: string; schemeId: string | null }[],
): Promise<Map<string, string | null>> {
  if (cycles.length === 0) return new Map();
  const db = await getDb();
  const schemes = await db
    .select({ id: s.evaluationSchemes.id, status: s.evaluationSchemes.status })
    .from(s.evaluationSchemes)
    .where(eq(s.evaluationSchemes.companyId, companyId));
  return new Map(cycles.map((cycle) => [cycle.id, resolveSchemeForCycle(cycle, schemes)?.id ?? null]));
}

/** 1つの評価期間の評価セットの id。選び方は schemeIdsForCycles と同じ。 */
export async function schemeIdForCycle(
  companyId: string,
  cycle: { id: string; schemeId: string | null },
): Promise<string | null> {
  return (await schemeIdsForCycles(companyId, [cycle])).get(cycle.id) ?? null;
}
