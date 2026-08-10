import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { canSeeCriteria, type Viewer } from "@/lib/session";

/**
 * 読み取り。すべての関数が company_id での絞り込みを前提にする。
 * 「見せてよい列だけ返す」判断もここで行い、画面側の書き忘れで漏れないようにする。
 */

const s = schema;

/* ───────────────── 会社・等級 ───────────────── */

export async function listCompanies() {
  const db = await getDb();
  return db.select().from(s.companies).orderBy(asc(s.companies.name));
}

export async function getCompany(companyId: string) {
  const db = await getDb();
  const r = await db.select().from(s.companies).where(eq(s.companies.id, companyId)).limit(1);
  return r[0] ?? null;
}

export async function listGrades(companyId: string) {
  const db = await getDb();
  return db.select().from(s.grades).where(eq(s.grades.companyId, companyId)).orderBy(asc(s.grades.displayOrder));
}

export async function listGradeRequirements(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.gradeRequirements)
    .where(eq(s.gradeRequirements.companyId, companyId))
    .orderBy(asc(s.gradeRequirements.gradeId), asc(s.gradeRequirements.category), asc(s.gradeRequirements.seq));
}

export async function listPromotionRequirements(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.promotionRequirements)
    .where(eq(s.promotionRequirements.companyId, companyId))
    .orderBy(asc(s.promotionRequirements.gradeId), asc(s.promotionRequirements.kind), asc(s.promotionRequirements.seq));
}

export async function listBehaviorGuidelines(companyId: string) {
  const db = await getDb();
  const guidelines = await db
    .select()
    .from(s.behaviorGuidelines)
    .where(eq(s.behaviorGuidelines.companyId, companyId))
    .orderBy(asc(s.behaviorGuidelines.band), asc(s.behaviorGuidelines.seq));
  const levels = await db
    .select()
    .from(s.behaviorLevels)
    .where(eq(s.behaviorLevels.companyId, companyId))
    .orderBy(desc(s.behaviorLevels.score));
  return guidelines.map((g) => ({ ...g, levels: levels.filter((l) => l.guidelineId === g.id) }));
}

/* ───────────────── KPI・評価セット ───────────────── */

export async function listKpiCategories(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.kpiCategories)
    .where(eq(s.kpiCategories.companyId, companyId))
    .orderBy(asc(s.kpiCategories.displayOrder));
}

export async function listKpiItems(companyId: string) {
  const db = await getDb();
  return db.select().from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId)).orderBy(asc(s.kpiItems.no));
}

export async function listRankCriteria(companyId: string, kpiItemIds?: string[]) {
  const db = await getDb();
  const where = kpiItemIds
    ? and(eq(s.kpiRankCriteria.companyId, companyId), inArray(s.kpiRankCriteria.kpiItemId, kpiItemIds))
    : eq(s.kpiRankCriteria.companyId, companyId);
  return db.select().from(s.kpiRankCriteria).where(where).orderBy(asc(s.kpiRankCriteria.rank));
}

export async function getActiveScheme(companyId: string) {
  const db = await getDb();
  const r = await db
    .select()
    .from(s.evaluationSchemes)
    .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.status, "active")))
    .limit(1);
  return r[0] ?? null;
}

/** 評価セットの8項目（固定枠 + 7カテゴリ）。 */
export async function listSchemeItems(companyId: string, schemeId: string) {
  const db = await getDb();
  return db
    .select({
      id: s.schemeItems.id,
      kpiItemId: s.schemeItems.kpiItemId,
      categoryId: s.schemeItems.categoryId,
      weight: s.schemeItems.weight,
      isFixedSlot: s.schemeItems.isFixedSlot,
      displayOrder: s.schemeItems.displayOrder,
      no: s.kpiItems.no,
      name: s.kpiItems.name,
      unit: s.kpiItems.unit,
      direction: s.kpiItems.direction,
      formula: s.kpiItems.formula,
      intent: s.kpiItems.intent,
      aStandard: s.kpiItems.aStandard,
      isProvisional: s.kpiItems.isProvisional,
      categoryName: s.kpiCategories.name,
    })
    .from(s.schemeItems)
    .innerJoin(s.kpiItems, eq(s.kpiItems.id, s.schemeItems.kpiItemId))
    .leftJoin(s.kpiCategories, eq(s.kpiCategories.id, s.schemeItems.categoryId))
    .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, schemeId)))
    .orderBy(asc(s.schemeItems.displayOrder));
}

export async function listRankRatios(companyId: string, schemeId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.schemeRankRatios)
    .where(and(eq(s.schemeRankRatios.companyId, companyId), eq(s.schemeRankRatios.schemeId, schemeId)))
    .orderBy(asc(s.schemeRankRatios.rank));
}

export async function listPromotionThresholds(companyId: string) {
  const db = await getDb();
  return db.select().from(s.promotionThresholds).where(eq(s.promotionThresholds.companyId, companyId));
}

export async function listRaiseSettings(companyId: string) {
  const db = await getDb();
  return db.select().from(s.raiseSettings).where(eq(s.raiseSettings.companyId, companyId));
}

export async function listKgiCoefficients(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.kgiCoefficients)
    .where(eq(s.kgiCoefficients.companyId, companyId))
    .orderBy(asc(s.kgiCoefficients.displayOrder));
}

/* ───────────────── サイクル・フォーム ───────────────── */

export async function listCycles(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.evaluationCycles)
    .where(eq(s.evaluationCycles.companyId, companyId))
    .orderBy(desc(s.evaluationCycles.periodStart));
}

export async function getOpenCycle(companyId: string) {
  const db = await getDb();
  const r = await db
    .select()
    .from(s.evaluationCycles)
    .where(and(eq(s.evaluationCycles.companyId, companyId), eq(s.evaluationCycles.status, "open")))
    .orderBy(desc(s.evaluationCycles.periodStart))
    .limit(1);
  return r[0] ?? null;
}

export async function listForms(companyId: string, cycleId?: string) {
  const db = await getDb();
  const where = cycleId ? and(eq(s.forms.companyId, companyId), eq(s.forms.cycleId, cycleId)) : eq(s.forms.companyId, companyId);
  return db
    .select({
      id: s.forms.id,
      title: s.forms.title,
      status: s.forms.status,
      version: s.forms.version,
      publicToken: s.forms.publicToken,
      opensAt: s.forms.opensAt,
      closesAt: s.forms.closesAt,
      gradeId: s.forms.gradeId,
      cycleId: s.forms.cycleId,
      gradeName: s.grades.name,
      cycleName: s.evaluationCycles.name,
      questionCount: sql<number>`(SELECT COUNT(*) FROM form_questions q WHERE q.form_id = ${s.forms.id})`,
      responseCount: sql<number>`(SELECT COUNT(*) FROM form_responses r WHERE r.form_id = ${s.forms.id})`,
    })
    .from(s.forms)
    .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
    .where(where)
    .orderBy(desc(s.forms.cycleId), asc(s.grades.displayOrder));
}

export async function getForm(companyId: string, formId: string) {
  const db = await getDb();
  const r = await db
    .select({
      id: s.forms.id,
      companyId: s.forms.companyId,
      title: s.forms.title,
      description: s.forms.description,
      status: s.forms.status,
      version: s.forms.version,
      publicToken: s.forms.publicToken,
      opensAt: s.forms.opensAt,
      closesAt: s.forms.closesAt,
      gradeId: s.forms.gradeId,
      cycleId: s.forms.cycleId,
      gradeName: s.grades.name,
      cycleName: s.evaluationCycles.name,
    })
    .from(s.forms)
    .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
    .where(and(eq(s.forms.companyId, companyId), eq(s.forms.id, formId)))
    .limit(1);
  return r[0] ?? null;
}

/**
 * アンケートの設問。
 * 評価される側に返すときは、配点・ランク基準につながる列を落とす
 * （設問文と入力欄だけ返す）。
 */
export async function listFormQuestions(companyId: string, formId: string, viewerRole: Viewer["role"]) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.formQuestions)
    .where(and(eq(s.formQuestions.companyId, companyId), eq(s.formQuestions.formId, formId)))
    .orderBy(asc(s.formQuestions.displayOrder));

  if (canSeeCriteria(viewerRole)) return rows;
  return rows.map((q) => ({
    ...q,
    // 昇格の必須要件かどうかは、点数の推測につながるため回答者には出さない
    isGate: false,
  }));
}

export async function getResponse(companyId: string, formId: string, employeeId: string) {
  const db = await getDb();
  const r = await db
    .select()
    .from(s.formResponses)
    .where(
      and(
        eq(s.formResponses.companyId, companyId),
        eq(s.formResponses.formId, formId),
        eq(s.formResponses.employeeId, employeeId),
      ),
    )
    .limit(1);
  if (!r[0]) return null;
  const answers = await db.select().from(s.formAnswers).where(eq(s.formAnswers.responseId, r[0].id));
  return { ...r[0], answers };
}

/* ───────────────── 利用者 ───────────────── */

export async function listMembers(companyId: string, opts?: { managerId?: string }) {
  const db = await getDb();
  const where = opts?.managerId
    ? and(eq(s.users.companyId, companyId), eq(s.users.managerId, opts.managerId))
    : eq(s.users.companyId, companyId);
  return db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      role: s.users.role,
      department: s.users.department,
      employeeCode: s.users.employeeCode,
      hiredAt: s.users.hiredAt,
      isActive: s.users.isActive,
      gradeId: s.users.gradeId,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      managerId: s.users.managerId,
      profileNote: s.users.profileNote,
    })
    .from(s.users)
    .leftJoin(s.grades, eq(s.grades.id, s.users.gradeId))
    .where(where)
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name));
}

export async function getMember(companyId: string, userId: string) {
  const rows = await listMembers(companyId);
  return rows.find((r) => r.id === userId) ?? null;
}

export async function listNotes(companyId: string, employeeId: string) {
  const db = await getDb();
  return db
    .select({
      id: s.employeeNotes.id,
      body: s.employeeNotes.body,
      visibility: s.employeeNotes.visibility,
      createdAt: s.employeeNotes.createdAt,
      authorName: s.users.name,
    })
    .from(s.employeeNotes)
    .leftJoin(s.users, eq(s.users.id, s.employeeNotes.authorId))
    .where(and(eq(s.employeeNotes.companyId, companyId), eq(s.employeeNotes.employeeId, employeeId)))
    .orderBy(desc(s.employeeNotes.createdAt));
}

/* ───────────────── 評価結果 ───────────────── */

export async function listEvaluations(companyId: string, opts?: { employeeId?: string; cycleId?: string }) {
  const db = await getDb();
  const conds = [eq(s.evaluations.companyId, companyId)];
  if (opts?.employeeId) conds.push(eq(s.evaluations.employeeId, opts.employeeId));
  if (opts?.cycleId) conds.push(eq(s.evaluations.cycleId, opts.cycleId));

  return db
    .select({
      id: s.evaluations.id,
      cycleId: s.evaluations.cycleId,
      cycleName: s.evaluationCycles.name,
      periodStart: s.evaluationCycles.periodStart,
      periodEnd: s.evaluationCycles.periodEnd,
      employeeId: s.evaluations.employeeId,
      employeeName: s.users.name,
      department: s.users.department,
      gradeId: s.evaluations.gradeId,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      totalScore: s.evaluations.totalScore,
      maxScore: s.evaluations.maxScore,
      requirementRate: s.evaluations.requirementRate,
      requirementAchieved: s.evaluations.requirementAchieved,
      requirementTotal: s.evaluations.requirementTotal,
      behaviorTotal: s.evaluations.behaviorTotal,
      raiseEligible: s.evaluations.raiseEligible,
      promotionEligible: s.evaluations.promotionEligible,
      promotionBlockedReason: s.evaluations.promotionBlockedReason,
      status: s.evaluations.status,
      finalizedAt: s.evaluations.finalizedAt,
      evaluatorComment: s.evaluations.evaluatorComment,
      requiredKpiPointsSnapshot: s.evaluations.requiredKpiPointsSnapshot,
      requiredBehaviorPointsSnapshot: s.evaluations.requiredBehaviorPointsSnapshot,
    })
    .from(s.evaluations)
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .where(and(...conds))
    .orderBy(desc(s.evaluationCycles.periodStart), asc(s.grades.displayOrder), asc(s.users.name));
}

export type EvaluationRow = Awaited<ReturnType<typeof listEvaluations>>[number];

/**
 * 評価の中身。
 * 評価される側には、昇格に必要な点数と各項目の閾値を返さない
 * （画面にもレスポンスにも出さない、という要件の実装箇所）。
 */
export async function getEvaluationDetail(companyId: string, evaluationId: string, viewerRole: Viewer["role"]) {
  const db = await getDb();
  const head = (await listEvaluations(companyId)).find((e) => e.id === evaluationId);
  if (!head) return null;

  const rawItems = await db
    .select()
    .from(s.evaluationItems)
    .where(and(eq(s.evaluationItems.companyId, companyId), eq(s.evaluationItems.evaluationId, evaluationId)))
    .orderBy(asc(s.evaluationItems.displayOrder));
  const behaviors = await db
    .select()
    .from(s.evaluationBehaviors)
    .where(and(eq(s.evaluationBehaviors.companyId, companyId), eq(s.evaluationBehaviors.evaluationId, evaluationId)));
  const requirements = await db
    .select()
    .from(s.evaluationRequirements)
    .where(and(eq(s.evaluationRequirements.companyId, companyId), eq(s.evaluationRequirements.evaluationId, evaluationId)));
  const gates = await db
    .select()
    .from(s.evaluationGates)
    .where(and(eq(s.evaluationGates.companyId, companyId), eq(s.evaluationGates.evaluationId, evaluationId)));

  const full = canSeeCriteria(viewerRole);

  // 評価される側には、配点・閾値・昇格に必要な点数を「空」にして返す。
  // ランクと実績値と判定理由は本人にも見せる（なぜその評価かは説明できる必要がある）。
  const items = rawItems.map((i) => ({
    ...i,
    points: full ? i.points : null,
    maxPoints: full ? i.maxPoints : null,
    thresholdLabel: full ? i.thresholdLabel : null,
    thresholdLower: full ? i.thresholdLower : null,
    thresholdUpper: full ? i.thresholdUpper : null,
  }));

  return {
    head: {
      ...head,
      totalScore: full ? head.totalScore : null,
      maxScore: full ? head.maxScore : null,
      requiredKpiPointsSnapshot: full ? head.requiredKpiPointsSnapshot : null,
      requiredBehaviorPointsSnapshot: full ? head.requiredBehaviorPointsSnapshot : null,
    },
    items,
    behaviors,
    requirements,
    gates,
    showsCriteria: full,
  };
}
