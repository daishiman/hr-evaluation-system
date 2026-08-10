import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { getActiveScheme, listRankCriteria, listRankRatios, listSchemeItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * KPIのランク基準（A〜Eの線引き）を、制度マスタ画面の折りたたみを開いたときに読む。
 *
 * 8項目 × 5ランク ＝ 40件ぶんの入力欄があり、画面を開いた瞬間に全部を
 * HTMLへ埋め込むと重い。ここは「基準を直したいときだけ開く」場所なので、
 * 開いたときに初めて取りに行く（src/components/RankCriteriaPanel.tsx）。
 */
export async function GET() {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;

    const scheme = await getActiveScheme(companyId);
    if (!scheme) return { scheme: null, ratios: [], items: [] };

    const items = await listSchemeItems(companyId, scheme.id);
    const [criteria, ratios] = await Promise.all([
      items.length > 0 ? listRankCriteria(companyId, items.map((i) => i.kpiItemId)) : Promise.resolve([]),
      listRankRatios(companyId, scheme.id),
    ]);

    return {
      ratios: ratios.map((r) => ({ rank: r.rank, ratio: r.ratio, isProvisional: r.isProvisional })),
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        weight: i.weight,
        direction: i.direction,
        formula: i.formula,
        criteria: criteria
          .filter((c) => c.kpiItemId === i.kpiItemId)
          .sort((a, b) => a.rank.localeCompare(b.rank))
          .map((c) => ({
            id: c.id,
            rank: c.rank,
            lowerBound: c.lowerBound,
            upperBound: c.upperBound,
            displayLabel: c.displayLabel,
          })),
      })),
    };
  });
}
