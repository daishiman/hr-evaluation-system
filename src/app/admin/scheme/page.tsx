import { and, asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getDb, schema as s } from "@/lib/db";
import { getActiveScheme, listGrades, listKpiCategories, listKpiItems } from "@/lib/queries";
import { EmptyState, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { SchemeEditor, type GroupSetup } from "@/components/SchemeEditor";
import { RankCriteriaPanel } from "@/components/RankCriteriaPanel";
import { targetsPointGroup } from "@/lib/domain/grade-points";
import { detectStaleCycles } from "@/lib/impact";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";

export const dynamic = "force-dynamic";

/**
 * 評価セット（等級区分ごとの項目）の設定。会社の管理者のみ。
 * 選べる項目・項目数・配点はすべてDBから読む。ここに点数を書かない。
 */
export default async function AdminSchemePage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [scheme, categories, kpiItems, grades, staleCycles] = await Promise.all([
    getActiveScheme(companyId),
    listKpiCategories(companyId),
    listKpiItems(companyId),
    listGrades(companyId),
    detectStaleCycles(companyId),
  ]);

  if (!scheme) {
    return (
      <>
        <PageTitle title="KPI・評価セット" />
        <StaleCyclesNotice cycles={staleCycles} />
        <ReasonNote>
          有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。
        </ReasonNote>
      </>
    );
  }

  const db = await getDb();
  /* scheme_items は等級区分と20点枠のフラグまで要るので、ここで直接読む。
     選択肢は絞らない（どの項目も、どの分類からも選べる）。
     ランク基準（kpi_rank_criteria）は「その等級区分で点が付く項目か」を画面で知らせるために引く。
     ここに無い項目を選ぶとアンケートに設問が出ないため、選べないのではなく注意を出す。 */
  const [rules, items, criteria] = await Promise.all([
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
      .select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
      .from(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.companyId, companyId)),
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
    ratedItemIds: [
      ...new Set(criteria.filter((x) => targetsPointGroup(x.targetGrades, r.pointGroup)).map((x) => x.kpiItemId)),
    ],
    initial: items
      .filter((i) => i.pointGroup === r.pointGroup)
      .map((i) => ({ kpiItemId: i.kpiItemId, isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot })),
  }));

  return (
    <>
      <PageTitle
        sticky
        title="KPI・評価セット"
        lede="等級区分ごとに、評価に使うKPIを選びます。選ぶ項目数と配点は等級区分ごとに決まっているため、この画面では変更できません。ここで決めた内容が、次に作るアンケートと集計に使われます。"
      />
      <StaleCyclesNotice cycles={staleCycles} />
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

      {/* A〜Eの線引きは「どのKPIを使うか」と同じ持ち場の話なので、この画面に置く。
          等級ごとの設定ではないため、等級の画面には出さない */}
      <SectionHeading>KPIのランク基準（会社全体）</SectionHeading>
      {items.length === 0 ? (
        <ReasonNote>評価セットに項目がないため、ランク基準を表示できません。</ReasonNote>
      ) : (
        <>
          <p className="footnote">
            選んだKPIごとに、実績値がどこからどこまでならA〜Eのどれになるかを決めます。開いたときに読み込むため、直したいときだけ開いてください。
          </p>
          <RankCriteriaPanel itemCount={items.length} />
        </>
      )}
    </>
  );
}
