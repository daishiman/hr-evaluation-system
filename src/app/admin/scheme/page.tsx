import { requireRole } from "@/lib/session";
import {
  getActiveScheme,
  listGrades,
  listKpiCategories,
  listKpiItems,
  listSchemeItems,
} from "@/lib/queries";
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

  /* 元の配点表（参考値・800件超）はここでは読まない。
     画面で「元の配点を表示する」を押したときに、選んだ等級区分のぶんだけ
     /api/reference-points から読む。 */
  const [scheme, categories, kpiItems, grades] = await Promise.all([
    getActiveScheme(companyId),
    listKpiCategories(companyId),
    listKpiItems(companyId),
    listGrades(companyId),
  ]);

  // 元の配点表は「等級区分」ごとの列だった（AMⅠ/Ⅱ、MgrⅠ/Ⅱは同じ列）。等級の並び順のまま重複を除く
  const pointGroups: string[] = [];
  for (const g of grades) if (!pointGroups.includes(g.pointGroup)) pointGroups.push(g.pointGroup);

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
        scoringMode={scheme.scoringMode === "absolute" ? "absolute" : "ratio"}
        pointGroups={pointGroups}
      />
    </>
  );
}
