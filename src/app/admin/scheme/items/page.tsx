import { requireRoute } from "@/lib/session";
import { EmptyState, PageTitle } from "@/components/ui";
import { detectStaleCycles } from "@/lib/impact";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { KpiItemEditor } from "@/components/KpiItemEditor";
import { listKpiCategories, listKpiItems, listKpiQuestions } from "@/lib/queries";
import { kpiItemCollectingForms, kpiItemUsage } from "@/lib/master-usage";
import { askingView } from "@/lib/domain/kpi-asking";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * KPI項目の追加と修正。会社の管理者のみ。
 *
 * 以前は KPI・評価セットの入口の下のほうに一覧を積んでいた。作業ごとに画面を分け、
 * 比べる警告の「聞き方を決める」はここへ項目を指して来る（scheme-steps.ts の kpiItemPath。DD-027）。
 * 入口の /admin/scheme?item=<id> は、旧いリンクのためにここへ転送している。
 */
export default async function AdminSchemeItemsPage({
  searchParams,
}: {
  /** item は入力欄を開いておくKPI項目（scheme-steps.ts の KPI_ITEM_PARAM。比べる警告の「聞き方を決める」から来る） */
  searchParams: Promise<{ item?: string }>;
}) {
  const viewer = await requireRoute("/admin/scheme/items");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const [staleCycles, categories, kpiItems, kpiQuestions] = await Promise.all([
    detectStaleCycles(viewer.companyId),
    listKpiCategories(viewer.companyId),
    listKpiItems(viewer.companyId),
    listKpiQuestions(viewer.companyId),
  ]);
  const db = await getDb();
  const openItemId = (await searchParams).item ?? null;
  const [itemUsage, collecting] = await Promise.all([
    kpiItemUsage(db, viewer.companyId),
    kpiItemCollectingForms(db, viewer.companyId),
  ]);
  const itemRows = kpiItems.map((i) => ({
    id: i.id,
    no: i.no,
    name: i.name,
    categoryId: i.categoryId,
    categoryName: categories.find((c) => c.id === i.categoryId)?.name ?? null,
    measureType: i.measureType,
    unit: i.unit,
    direction: i.direction === "lower" ? ("lower" as const) : ("higher" as const),
    formula: i.formula,
    formulaNote: i.formulaNote,
    remarks: i.remarks,
    isMonetary: i.isMonetary,
    isProvisional: i.isProvisional,
    isActive: i.isActive,
    isFixedSlot: i.isFixedSlot,
    asking: askingView(i, kpiQuestions.filter((q) => q.kpiItemId === i.id)),
    keySetLockedBy: collecting[i.id] ?? null,
  }));

  return (
    <>
      <PageTitle title="KPI項目" lede="評価に使うKPI項目を足したり、直したりします。" />
      <StaleCyclesNotice cycles={staleCycles} />
      <KpiItemEditor
        items={itemRows}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        usage={itemUsage}
        openItemId={openItemId}
      />
    </>
  );
}
