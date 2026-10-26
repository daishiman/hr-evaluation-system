import { requireRoute } from "@/lib/session";
import { EmptyState, PageTitle } from "@/components/ui";
import { KpiCategoryEditor } from "@/components/KpiCategoryEditor";
import { listKpiCategories } from "@/lib/queries";
import { kpiCategoryUsage } from "@/lib/master-usage";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * KPIカテゴリ（KPI項目の分類）の追加と削除。会社の管理者のみ。
 *
 * KPI項目の分類を直すのに別の設定の画面群へ行き来しないよう、KPI・評価セットの下に置く（DD-027）。
 * 旧い /admin/masters/kpi-categories は、ここへ転送している。
 */
export default async function AdminSchemeCategoriesPage() {
  const viewer = await requireRoute("/admin/scheme/categories");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const db = await getDb();
  const [categories, usage] = await Promise.all([
    listKpiCategories(viewer.companyId),
    kpiCategoryUsage(db, viewer.companyId),
  ]);

  return (
    <>
      <PageTitle title="KPIカテゴリ" lede="KPI項目の分類を足したり、消したりします。" />
      <KpiCategoryEditor categories={categories} usage={usage} />
    </>
  );
}
