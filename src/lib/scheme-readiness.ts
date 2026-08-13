import { and, asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { computeGroupProgress } from "@/lib/domain/scheme-steps";
import { setupReadiness } from "@/lib/domain/setup-readiness";
import { targetsPointGroup, type GradePointRule } from "@/lib/domain/grade-points";

/** computeGroupProgressをDB行へ適用する唯一の読み取り。setup/dashboard/APIで共有する。 */
export async function loadSchemeReadiness(companyId: string, schemeId: string | null) {
  if (!schemeId) return { ...setupReadiness({ hasScheme: false, groups: [] }), groups: [] };
  const db = await getDb();
  const [rules, criteria, items] = await Promise.all([
    db.select().from(s.gradePointRules).where(eq(s.gradePointRules.companyId, companyId)).orderBy(asc(s.gradePointRules.displayOrder)),
    db.select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
      .from(s.kpiRankCriteria).where(eq(s.kpiRankCriteria.companyId, companyId)),
    db.select({ kpiItemId: s.schemeItems.kpiItemId, pointGroup: s.schemeItems.pointGroup, isFixedSlot: s.schemeItems.isFixedSlot, isMajorSlot: s.schemeItems.isMajorSlot })
      .from(s.schemeItems).where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, schemeId))),
  ]);
  const groups = rules.map((row) => {
    const rule: GradePointRule = {
      pointGroup: row.pointGroup, totalPoints: row.totalPoints, fixedSlotPoints: row.fixedSlotPoints,
      majorSlotPoints: row.majorSlotPoints, majorSlotCount: row.majorSlotCount,
      minorSlotPoints: row.minorSlotPoints, minorSlotCount: row.minorSlotCount,
    };
    const saved = items.filter((item) => item.pointGroup === row.pointGroup);
    const ratedItemIds = [...new Set(
      criteria.filter((criterion) => targetsPointGroup(criterion.targetGrades, row.pointGroup))
        .map((criterion) => criterion.kpiItemId),
    )];
    return { rule, saved, ratedItemIds: [...ratedItemIds], progress: computeGroupProgress({ rule, saved, ratedItemIds }) };
  });
  return { ...setupReadiness({ hasScheme: true, groups: groups.map((group) => group.progress) }), groups };
}
