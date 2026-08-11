import { and, asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import {
  getActiveScheme,
  listGrades,
  listKpiCategories,
  listKpiItems,
  listRankCriteria,
  listRankRatios,
} from "@/lib/queries";
import { targetsPointGroup, type GradePointRule } from "@/lib/domain/grade-points";
import { computeGroupProgress, type GroupProgress } from "@/lib/domain/scheme-steps";

/**
 * KPI・評価セットの3画面（入口・手順1・手順2）が共通で使う読み取り。
 *
 * 同じ問い合わせを画面ごとに書き起こすと、片方だけ会社の絞り込みを落とす事故が起きる。
 * 会社の絞り込み（マルチテナント境界）はこの1箇所に閉じ込める。
 * 呼び出し側は必ず requireRole で通した viewer.companyId を渡すこと。
 */

export interface SchemeGroup {
  pointGroup: string;
  /** その等級区分に属する等級名（「等級４：AM Ⅰ・等級４：AM Ⅱ」のような表示用の文字列） */
  gradeLabel: string;
  rule: GradePointRule;
  /** その等級区分を対象としてランク基準（A〜E）が用意されている項目のID */
  ratedItemIds: string[];
  /** 保存済みの選択 */
  saved: { kpiItemId: string; isFixedSlot: boolean; isMajorSlot: boolean }[];
  progress: GroupProgress;
}

export interface SchemeSetup {
  scheme: { id: string; raiseRequiresAllA: boolean } | null;
  groups: SchemeGroup[];
  /** 等級区分の表示順。手順の「次はどこか」の判断に使う */
  order: string[];
}

export async function loadSchemeSetup(companyId: string): Promise<SchemeSetup> {
  const scheme = await getActiveScheme(companyId);
  const db = await getDb();

  const [rules, grades, criteria, items] = await Promise.all([
    db
      .select()
      .from(s.gradePointRules)
      .where(eq(s.gradePointRules.companyId, companyId))
      .orderBy(asc(s.gradePointRules.displayOrder)),
    listGrades(companyId),
    db
      .select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
      .from(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.companyId, companyId)),
    scheme
      ? db
          .select({
            kpiItemId: s.schemeItems.kpiItemId,
            pointGroup: s.schemeItems.pointGroup,
            isFixedSlot: s.schemeItems.isFixedSlot,
            isMajorSlot: s.schemeItems.isMajorSlot,
          })
          .from(s.schemeItems)
          .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, scheme.id)))
          .orderBy(asc(s.schemeItems.displayOrder))
      : Promise.resolve([]),
  ]);

  const groups: SchemeGroup[] = rules.map((r) => {
    const rule: GradePointRule = {
      pointGroup: r.pointGroup,
      totalPoints: r.totalPoints,
      fixedSlotPoints: r.fixedSlotPoints,
      majorSlotPoints: r.majorSlotPoints,
      majorSlotCount: r.majorSlotCount,
      minorSlotPoints: r.minorSlotPoints,
      minorSlotCount: r.minorSlotCount,
    };
    const ratedItemIds = [
      ...new Set(criteria.filter((x) => targetsPointGroup(x.targetGrades, r.pointGroup)).map((x) => x.kpiItemId)),
    ];
    const saved = items
      .filter((i) => i.pointGroup === r.pointGroup)
      .map((i) => ({ kpiItemId: i.kpiItemId, isFixedSlot: i.isFixedSlot, isMajorSlot: i.isMajorSlot }));

    return {
      pointGroup: r.pointGroup,
      // AMⅠ/Ⅱ・ManagerⅠ/Ⅱ は同じ等級区分なので、等級名をまとめて1つにする
      gradeLabel:
        grades
          .filter((g) => g.pointGroup === r.pointGroup)
          .map((g) => g.name)
          .join("・") || "この等級区分の等級は未登録",
      rule,
      ratedItemIds,
      saved,
      progress: computeGroupProgress({ rule, saved, ratedItemIds }),
    };
  });

  return {
    scheme: scheme ? { id: scheme.id, raiseRequiresAllA: scheme.raiseRequiresAllA } : null,
    groups,
    order: groups.map((g) => g.pointGroup),
  };
}

/**
 * 手順2で読む「その等級区分で選んだ項目だけ」の基準。
 *
 * ここで pointGroup による絞り込みを必ず掛ける。掛け忘れると、5つの等級区分ぶんの
 * 行が並び、同じ項目の同じ基準を編集するカードが5枚出る（実際にそうなっていた）。
 */
export async function loadGroupCriteria(companyId: string, schemeId: string, pointGroup: string) {
  const db = await getDb();
  const items = await db
    .select({
      kpiItemId: s.schemeItems.kpiItemId,
      weight: s.schemeItems.weight,
      isFixedSlot: s.schemeItems.isFixedSlot,
      isMajorSlot: s.schemeItems.isMajorSlot,
      displayOrder: s.schemeItems.displayOrder,
      name: s.kpiItems.name,
      unit: s.kpiItems.unit,
      direction: s.kpiItems.direction,
      formula: s.kpiItems.formula,
      isProvisional: s.kpiItems.isProvisional,
    })
    .from(s.schemeItems)
    .innerJoin(s.kpiItems, eq(s.kpiItems.id, s.schemeItems.kpiItemId))
    .where(
      and(
        eq(s.schemeItems.companyId, companyId),
        eq(s.schemeItems.schemeId, schemeId),
        eq(s.schemeItems.pointGroup, pointGroup),
      ),
    )
    .orderBy(asc(s.schemeItems.displayOrder));

  const [criteria, ratios] = await Promise.all([
    items.length > 0 ? listRankCriteria(companyId, [...new Set(items.map((i) => i.kpiItemId))]) : Promise.resolve([]),
    listRankRatios(companyId, schemeId),
  ]);

  return {
    ratios: ratios.map((r) => ({ rank: r.rank, ratio: r.ratio, isProvisional: r.isProvisional })),
    items: items.map((i) => ({
      ...i,
      /* 固定枠（等級要件達成率）は計算式を通らない。実績は「アンケートで出した等級要件のうち
         達成した数 ÷ 出した数」で出す（src/lib/evaluate.ts）。
         マスタに残っている旧計算式を出すと、実装と食い違う説明になる。 */
      formula: i.isFixedSlot ? null : i.formula,
      criteria: criteria
        .filter((c) => c.kpiItemId === i.kpiItemId)
        .sort((a, b) => a.rank.localeCompare(b.rank))
        .map((c) => ({
          id: c.id,
          rank: c.rank,
          lowerBound: c.lowerBound,
          upperBound: c.upperBound,
          displayLabel: c.displayLabel,
          targetGrades: c.targetGrades,
        })),
    })),
  };
}

/** 選ぶ候補（全KPI項目と分類）。手順1でだけ読む。 */
export async function loadKpiChoices(companyId: string) {
  const [categories, kpiItems] = await Promise.all([listKpiCategories(companyId), listKpiItems(companyId)]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    kpiItems: kpiItems.map((k) => ({
      id: k.id,
      no: k.no,
      name: k.name,
      unit: k.unit,
      categoryId: k.categoryId,
      isFixedSlot: k.isFixedSlot,
      isProvisional: k.isProvisional,
      intent: k.intent,
      aStandard: k.aStandard,
    })),
  };
}
