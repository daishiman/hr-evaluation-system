import { and, asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { getActiveScheme, listGrades, listKpiCategories, listKpiItems } from "@/lib/queries";
import { EmptyState, PageTitle, ReasonNote } from "@/components/ui";
import { SchemeEditor, type GroupSetup } from "@/components/SchemeEditor";

export const dynamic = "force-dynamic";

/**
 * 評価セット（等級区分ごとの項目）の設定。会社の管理者のみ。
 * 選べる項目・項目数・配点はすべてDBから読む。ここに点数を書かない。
 */
export default async function AdminSchemePage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [scheme, categories, kpiItems, grades] = await Promise.all([
    getActiveScheme(companyId),
    listKpiCategories(companyId),
    listKpiItems(companyId),
    listGrades(companyId),
  ]);

  if (!scheme) {
    return (
      <>
        <PageTitle title="評価セット（等級区分ごとの項目）" />
        <ReasonNote>
          有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。
        </ReasonNote>
      </>
    );
  }

  const db = await getDb();
  /* scheme_items は等級区分と20点枠のフラグまで要るので、ここで直接読む。
     元の配点表（kpi_reference_points）は「その等級区分で評価対象になる項目」の正本でもあるため、
     項目IDと等級区分だけを引いて選択肢の絞り込みに使う（点数は計算に使わない）。 */
  const [rules, items, refs] = await Promise.all([
    db
      .select()
      .from(s.gradePointRules)
      .where(eq(s.gradePointRules.companyId, companyId))
      .orderBy(asc(s.gradePointRules.displayOrder)),
    db
      .select({
        kpiItemId: s.schemeItems.kpiItemId,
        pointGroup: s.schemeItems.pointGroup,
        isFixedSlot: s.schemeItems.isFixedSlot,
        isMajorSlot: s.schemeItems.isMajorSlot,
      })
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, scheme.id)))
      .orderBy(asc(s.schemeItems.displayOrder)),
    db
      .select({ kpiItemId: s.kpiReferencePoints.kpiItemId, pointGroup: s.kpiReferencePoints.pointGroup })
      .from(s.kpiReferencePoints)
      .where(eq(s.kpiReferencePoints.companyId, companyId)),
  ]);

  // AMⅠ/Ⅱ・ManagerⅠ/Ⅱ は同じ等級区分なので、等級名をまとめて1タブにする
  const groups: GroupSetup[] = rules.map((r) => ({
    pointGroup: r.pointGroup,
    gradeLabel:
      grades
        .filter((g) => g.pointGroup === r.pointGroup)
        .map((g) => g.name)
        .join("・") || "この等級区分の等級は未登録",
    rule: {
      pointGroup: r.pointGroup,
      totalPoints: r.totalPoints,
      fixedSlotPoints: r.fixedSlotPoints,
      majorSlotPoints: r.majorSlotPoints,
      majorSlotCount: r.majorSlotCount,
      minorSlotPoints: r.minorSlotPoints,
      minorSlotCount: r.minorSlotCount,
    },
    selectableItemIds: [...new Set(refs.filter((x) => x.pointGroup === r.pointGroup).map((x) => x.kpiItemId))],
    initial: items
      .filter((i) => i.pointGroup === r.pointGroup)
      .map((i) => ({ kpiItemId: i.kpiItemId, isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot })),
  }));

  return (
    <>
      <PageTitle
        title="評価セット（等級区分ごとの項目）"
        lede="等級区分ごとに、評価に使うKPIを選びます。選ぶ項目数と配点は等級区分ごとに決まっているため、この画面では変更できません。ここで決めた内容が、次に作るアンケートと集計に使われます。"
      />
      <SchemeEditor
        schemeId={scheme.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description }))}
        kpiItems={kpiItems.map((k) => ({
          id: k.id,
          no: k.no,
          name: k.name,
          unit: k.unit,
          categoryId: k.categoryId,
          isFixedSlot: k.isFixedSlot,
          isMonetary: k.isMonetary,
          isProvisional: k.isProvisional,
          intent: k.intent,
          aStandard: k.aStandard,
        }))}
        groups={groups}
        raiseRequiresAllA={scheme.raiseRequiresAllA}
      />
    </>
  );
}
