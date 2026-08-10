import { requireRole } from "@/lib/session";
import { getActiveScheme, listKpiCategories, listKpiItems, listSchemeItems } from "@/lib/queries";
import { EmptyState, PageTitle, ReasonNote } from "@/components/ui";
import { SchemeEditor } from "@/components/SchemeEditor";

export const dynamic = "force-dynamic";

/**
 * 評価セット（8項目・配点）の設定。会社の管理者のみ。
 * 選べる項目・カテゴリ・満点はすべてDBから読む。ここに点数を書かない。
 */
export default async function AdminSchemePage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [scheme, categories, kpiItems] = await Promise.all([
    getActiveScheme(companyId),
    listKpiCategories(companyId),
    listKpiItems(companyId),
  ]);

  if (!scheme) {
    return (
      <>
        <PageTitle title="評価セット（8項目・配点）" />
        <ReasonNote>
          有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。
        </ReasonNote>
      </>
    );
  }

  const items = await listSchemeItems(companyId, scheme.id);

  return (
    <>
      <PageTitle
        title="評価セット（8項目・配点）"
        lede={`固定枠1つ + カテゴリ${categories.length}種から1つずつ、合計${categories.length + 1}項目・${scheme.totalPoints}点で設定します。ここで決めた内容が評価の計算に使われます。`}
      />
      <SchemeEditor
        schemeId={scheme.id}
        totalPoints={scheme.totalPoints}
        categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description }))}
        kpiItems={kpiItems.map((k) => ({
          id: k.id,
          no: k.no,
          name: k.name,
          unit: k.unit,
          categoryId: k.categoryId,
          isFixedSlot: k.isFixedSlot,
          isProvisional: k.isProvisional,
          intent: k.intent,
          aStandard: k.aStandard,
        }))}
        initial={items.map((i) => ({
          kpiItemId: i.kpiItemId,
          categoryId: i.categoryId,
          weight: i.weight,
          isFixedSlot: i.isFixedSlot,
        }))}
        raiseRequiresAllA={scheme.raiseRequiresAllA}
      />
    </>
  );
}
