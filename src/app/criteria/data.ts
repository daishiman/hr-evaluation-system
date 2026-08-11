import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { targetsPointGroup } from "@/lib/domain/grade-points";

/**
 * 「採点基準」画面だけが使う読み取り。
 *
 * 共通の読み取り（src/lib/queries.ts）に足さず、この画面の中で完結させている。
 * 理由は2つ。
 *  1. ここで読む値（等級区分ごとの持ち点の型・選べる項目の一覧）は、この画面でしか使わない。
 *  2. 数字は1つもコードに書かず、必ずDBのマスタから読む（schema.ts 冒頭の「ハードコード禁止」）。
 *     どのテーブルが「正」なのかを、この1ファイルを読めば追えるようにしておく。
 *
 * すべての関数は company_id で絞り込む（他社の制度が混ざらないようにするため）。
 */

const s = schema;

/* ───────────────── 等級区分ごとの持ち点の型 ───────────────── */

/**
 * 等級区分ごとの配点の型（grade_point_rules）。
 * 「合計何点／等級要件に何点／20点枠がいくつ／10点枠がいくつ」の正本。
 */
export async function listGradePointRules(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.gradePointRules)
    .where(eq(s.gradePointRules.companyId, companyId))
    .orderBy(asc(s.gradePointRules.displayOrder));
}

export type GradePointRule = Awaited<ReturnType<typeof listGradePointRules>>[number];

/** 等級区分で選ぶ項目の数（固定枠1 ＋ 20点枠 ＋ 10点枠）。 */
export function slotCountOf(rule: GradePointRule): number {
  return 1 + rule.majorSlotCount + rule.minorSlotCount;
}

/* ───────────────── 等級区分ごとの項目一覧 ───────────────── */

export interface SelectableItem {
  /** その等級区分でランク基準（A〜E）が定義されているか。false でも選ぶことはできる。 */
  hasCriteria: boolean;
  kpiItemId: string;
  no: number;
  name: string;
  unit: string;
  direction: string;
  formula: string | null;
  formulaNote: string | null;
  intent: string | null;
  aStandard: string | null;
  measureType: string;
  /* 定義書（KPI基準定義_項目マスタ）の各列。画面に出さないと
     「なぜこの水準がAなのか」を管理者が説明できない。 */
  dataSource: string | null;
  judgeTiming: string | null;
  aType: string | null;
  controllability: string | null;
  aRationale: string | null;
  remarks: string | null;
  categoryName: string | null;
  isFixedSlot: boolean;
  isMonetary: boolean;
  isProvisional: boolean;
}

/**
 * 等級区分ごとの項目一覧。
 *
 * 2026-08-11 の自由化まではここで候補を絞っていた（kpi_reference_points に行がある項目だけ）。
 * いまはどの等級区分でも全項目を選べるため、一覧は全項目を返し、
 * 「その等級区分でランク基準が定義済みか」を hasCriteria で添える。
 *
 * 絞らずに添えるだけにしたのは、基準が未設定の項目を一覧から消すと
 * 「なぜ出てこないのか」が画面のどこにも書かれない状態になるため。
 * 見えないものは直せない。
 */
export async function listSelectableItemsByGroup(companyId: string): Promise<Map<string, SelectableItem[]>> {
  const db = await getDb();
  const [items, criteria, rules] = await Promise.all([
    db
      .select({
        kpiItemId: s.kpiItems.id,
        no: s.kpiItems.no,
        name: s.kpiItems.name,
        unit: s.kpiItems.unit,
        direction: s.kpiItems.direction,
        formula: s.kpiItems.formula,
        formulaNote: s.kpiItems.formulaNote,
        intent: s.kpiItems.intent,
        aStandard: s.kpiItems.aStandard,
        measureType: s.kpiItems.measureType,
        dataSource: s.kpiItems.dataSource,
        judgeTiming: s.kpiItems.judgeTiming,
        aType: s.kpiItems.aType,
        controllability: s.kpiItems.controllability,
        aRationale: s.kpiItems.aRationale,
        remarks: s.kpiItems.remarks,
        categoryName: s.kpiCategories.name,
        isFixedSlot: s.kpiItems.isFixedSlot,
        isMonetary: s.kpiItems.isMonetary,
        isProvisional: s.kpiItems.isProvisional,
      })
      .from(s.kpiItems)
      .leftJoin(s.kpiCategories, eq(s.kpiCategories.id, s.kpiItems.categoryId))
      .where(and(eq(s.kpiItems.companyId, companyId), eq(s.kpiItems.isActive, true)))
      .orderBy(asc(s.kpiItems.no)),
    db
      .select({ kpiItemId: s.kpiRankCriteria.kpiItemId, targetGrades: s.kpiRankCriteria.targetGrades })
      .from(s.kpiRankCriteria)
      .where(eq(s.kpiRankCriteria.companyId, companyId)),
    db
      .select({ pointGroup: s.gradePointRules.pointGroup })
      .from(s.gradePointRules)
      .where(eq(s.gradePointRules.companyId, companyId)),
  ]);

  const byGroup = new Map<string, SelectableItem[]>();
  for (const { pointGroup } of rules) {
    const rated = new Set(
      criteria.filter((c) => targetsPointGroup(c.targetGrades, pointGroup)).map((c) => c.kpiItemId),
    );
    byGroup.set(
      pointGroup,
      items.map((i) => ({ ...i, hasCriteria: rated.has(i.kpiItemId) })),
    );
  }
  return byGroup;
}

/* ───────────────── 採点の流れ（設問・閾値・割合） ───────────────── */

/** 実績値を出すために聞いている設問。分子・分母がどれかまで出す。 */
export async function listQuestionsFor(companyId: string, kpiItemIds: string[]) {
  if (kpiItemIds.length === 0) return [];
  const db = await getDb();
  return db
    .select({
      id: s.kpiQuestions.id,
      kpiItemId: s.kpiQuestions.kpiItemId,
      questionKey: s.kpiQuestions.questionKey,
      text: s.kpiQuestions.text,
      unit: s.kpiQuestions.unit,
      role: s.kpiQuestions.role,
      targetGrades: s.kpiQuestions.targetGrades,
    })
    .from(s.kpiQuestions)
    .where(and(eq(s.kpiQuestions.companyId, companyId), inArray(s.kpiQuestions.kpiItemId, kpiItemIds)))
    .orderBy(asc(s.kpiQuestions.displayOrder));
}

/** ランク基準（A〜Eの下限・上限と表示ラベル）。判定式はコードに書かず必ずここを引く。 */
export async function listRankCriteriaFor(companyId: string, kpiItemIds: string[]) {
  if (kpiItemIds.length === 0) return [];
  const db = await getDb();
  return db
    .select()
    .from(s.kpiRankCriteria)
    .where(and(eq(s.kpiRankCriteria.companyId, companyId), inArray(s.kpiRankCriteria.kpiItemId, kpiItemIds)))
    .orderBy(asc(s.kpiRankCriteria.rank));
}

/* ───────────────── 評価セット（いま採用している項目） ───────────────── */

export async function getActiveScheme(companyId: string) {
  const db = await getDb();
  const r = await db
    .select()
    .from(s.evaluationSchemes)
    .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.status, "active")))
    .limit(1);
  return r[0] ?? null;
}

/** 評価セットで実際に選ばれている項目。等級区分ごとに選び直せるので point_group も返す。 */
export async function listSchemeItemsAllGroups(companyId: string, schemeId: string) {
  const db = await getDb();
  return db
    .select({
      id: s.schemeItems.id,
      pointGroup: s.schemeItems.pointGroup,
      kpiItemId: s.schemeItems.kpiItemId,
      weight: s.schemeItems.weight,
      isFixedSlot: s.schemeItems.isFixedSlot,
      isMajorSlot: s.schemeItems.isMajorSlot,
      displayOrder: s.schemeItems.displayOrder,
    })
    .from(s.schemeItems)
    .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, schemeId)))
    .orderBy(asc(s.schemeItems.displayOrder));
}

/** ランク→点数の割合（A=100% など）。会社ごとに変更できるので必ずDBから読む。 */
export async function listRankRatios(companyId: string, schemeId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.schemeRankRatios)
    .where(and(eq(s.schemeRankRatios.companyId, companyId), eq(s.schemeRankRatios.schemeId, schemeId)))
    .orderBy(asc(s.schemeRankRatios.rank));
}
