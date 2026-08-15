import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/lib/db";
import { isImprovementStatus } from "@/lib/domain/improvement";
import {
  HANDOUT_HISTORY_MAX,
  handoutNote,
  handoutState,
  improvementFingerprint,
  type HandoutEvent,
} from "@/lib/domain/improvement-handout";
import { isImprovementKind } from "@/lib/domain/improvement-instruction";
import { canSeeCriteria, type Viewer } from "@/lib/session";
import {
  employeePromotionBlockedReason,
  employeeRaiseReason,
  scopeEvaluationItem,
  scopeEvaluationRow,
} from "@/lib/domain/evaluation-view";
import { rangeLabel } from "@/lib/domain/scoring";
import { currentVersionRows } from "@/lib/domain/versioned-master";

/**
 * 読み取り。すべての関数が company_id での絞り込みを前提にする。
 * 「見せてよい列だけ返す」判断もここで行い、画面側の書き忘れで漏れないようにする。
 */

const s = schema;

/* ───────────────── 会社・等級 ───────────────── */

/** 実在会社の一覧。管理画面で停止会社も確認できるよう、ひな形だけを除く。 */
export async function listCompanies() {
  const db = await getDb();
  return db.select().from(s.companies).where(eq(s.companies.isTemplate, false)).orderBy(asc(s.companies.name));
}

/**
 * 制度のひな形（システム標準テンプレート）の中身の件数。
 * 会社を追加したときに、ここに入っている制度がそのまま複製される。
 */
export async function getTemplateSummary() {
  const db = await getDb();
  const co = (await db.select().from(s.companies).where(eq(s.companies.isTemplate, true)).limit(1))[0];
  if (!co) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: any): Promise<number> => {
    const r = await db.select({ n: sql<number>`count(*)` }).from(table).where(eq(table.companyId, co.id));
    return Number(r[0]?.n ?? 0);
  };
  return {
    company: co,
    grades: await count(s.grades),
    gradeRequirements: currentVersionRows(
      await db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.companyId, co.id)),
    ).length,
    promotionRequirements: currentVersionRows(
      await db.select().from(s.promotionRequirements).where(eq(s.promotionRequirements.companyId, co.id)),
    ).length,
    kpiItems: await count(s.kpiItems),
    rankCriteria: await count(s.kpiRankCriteria),
    kpiQuestions: await count(s.kpiQuestions),
    raiseSettings: await count(s.raiseSettings),
    raiseExceptions: await count(s.raiseExceptions),
  };
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

/** 会社が持っている行動指針の基準セット。使用を止めたものも「もう一度使う」ために返す。 */
export async function listBehaviorBandSets(companyId: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.behaviorBandSets)
    .where(eq(s.behaviorBandSets.companyId, companyId))
    .orderBy(asc(s.behaviorBandSets.displayOrder), asc(s.behaviorBandSets.code));
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
  const rows = await db
    .select({ criterion: s.kpiRankCriteria, unit: s.kpiItems.unit, direction: s.kpiItems.direction })
    .from(s.kpiRankCriteria)
    .innerJoin(s.kpiItems, eq(s.kpiItems.id, s.kpiRankCriteria.kpiItemId))
    .where(where)
    .orderBy(asc(s.kpiRankCriteria.rank));

  /* display_label は既存DBとの互換性のため残しているが、表示の正本にはしない。
     判定に使う境界と別々に読むと、古い行だけ説明文が実際の判定と食い違うため、
     すべての読取で数値境界・単位・向きから導出する。 */
  return rows.map(({ criterion, unit, direction }) => ({
    ...criterion,
    displayLabel: rangeLabel(criterion, unit, direction === "lower" ? "lower" : "higher"),
  }));
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

/** 昇給の判定ルール（半期ごと・8項目すべてA、など）。会社に1件。 */
export async function getRaisePolicy(companyId: string) {
  const db = await getDb();
  return (await db.select().from(s.raisePolicies).where(eq(s.raisePolicies.companyId, companyId)).limit(1))[0] ?? null;
}

/** ランクの組み合わせごとの判定と扱い（元シートの「昇給ルール（仮）」の表）。 */
export async function listRaisePatterns(companyId: string) {
  const db = await getDb();
  return db.select().from(s.raisePatterns).where(eq(s.raisePatterns.companyId, companyId)).orderBy(asc(s.raisePatterns.seq));
}

/** 中途入職・産育休・時短などの特例。条件式ではなく行として持ち、画面で読める形にしておく。 */
export async function listRaiseExceptions(companyId: string) {
  const db = await getDb();
  return db.select().from(s.raiseExceptions).where(eq(s.raiseExceptions.companyId, companyId)).orderBy(asc(s.raiseExceptions.seq));
}

/** 昇給額の改定履歴。金額をいつ・いくらから・いくらに変えたかを残す。 */
export async function listRaiseRevisions(companyId: string) {
  const db = await getDb();
  return db
    .select({
      id: s.raiseRevisions.id,
      gradeId: s.raiseRevisions.gradeId,
      gradeName: s.grades.name,
      beforeAmount: s.raiseRevisions.beforeAmount,
      afterAmount: s.raiseRevisions.afterAmount,
      effectiveFrom: s.raiseRevisions.effectiveFrom,
      reason: s.raiseRevisions.reason,
      revisedByName: s.users.name,
      createdAt: s.raiseRevisions.createdAt,
    })
    .from(s.raiseRevisions)
    .leftJoin(s.grades, eq(s.grades.id, s.raiseRevisions.gradeId))
    .leftJoin(s.users, eq(s.users.id, s.raiseRevisions.revisedById))
    .where(eq(s.raiseRevisions.companyId, companyId))
    .orderBy(desc(s.raiseRevisions.createdAt));
}

/** 事業所。昇給額の事業所ごとの調整率をここで持つ。 */
export async function listOffices(companyId: string) {
  const db = await getDb();
  return db.select().from(s.offices).where(eq(s.offices.companyId, companyId)).orderBy(asc(s.offices.name));
}

/**
 * 事業所KGIの達成率（事業所 × サイクル）。
 * 行が無い＝未登録。0% と未登録は意味が違うので、行を作って埋めない。
 */
export async function listOfficeKgiResults(companyId: string, cycleId?: string) {
  const db = await getDb();
  const where = cycleId
    ? and(eq(s.officeKgiResults.companyId, companyId), eq(s.officeKgiResults.cycleId, cycleId))
    : eq(s.officeKgiResults.companyId, companyId);
  return db
    .select({
      id: s.officeKgiResults.id,
      officeId: s.officeKgiResults.officeId,
      officeName: s.offices.name,
      cycleId: s.officeKgiResults.cycleId,
      achievementRate: s.officeKgiResults.achievementRate,
      note: s.officeKgiResults.note,
      recordedByName: s.users.name,
      updatedAt: s.officeKgiResults.updatedAt,
    })
    .from(s.officeKgiResults)
    .leftJoin(s.offices, eq(s.offices.id, s.officeKgiResults.officeId))
    .leftJoin(s.users, eq(s.users.id, s.officeKgiResults.recordedById))
    .where(where)
    .orderBy(asc(s.offices.name));
}

/** 達成率の変更履歴。賞与額の根拠なので「誰がいつ何％から何％に」を残す。 */
export async function listOfficeKgiRevisions(companyId: string, cycleId?: string) {
  const db = await getDb();
  const where = cycleId
    ? and(eq(s.officeKgiRevisions.companyId, companyId), eq(s.officeKgiRevisions.cycleId, cycleId))
    : eq(s.officeKgiRevisions.companyId, companyId);
  return db
    .select({
      id: s.officeKgiRevisions.id,
      officeId: s.officeKgiRevisions.officeId,
      officeName: s.offices.name,
      cycleId: s.officeKgiRevisions.cycleId,
      cycleName: s.evaluationCycles.name,
      beforeRate: s.officeKgiRevisions.beforeRate,
      afterRate: s.officeKgiRevisions.afterRate,
      reason: s.officeKgiRevisions.reason,
      revisedByName: s.users.name,
      createdAt: s.officeKgiRevisions.createdAt,
    })
    .from(s.officeKgiRevisions)
    .leftJoin(s.offices, eq(s.offices.id, s.officeKgiRevisions.officeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.officeKgiRevisions.cycleId))
    .leftJoin(s.users, eq(s.users.id, s.officeKgiRevisions.revisedById))
    .where(where)
    .orderBy(desc(s.officeKgiRevisions.createdAt));
}

/**
 * サイクル内の評価を事業所ごとに数える。
 * 達成率を入れると誰の賞与が算出されるのか（確定済みで据え置かれるのは何件か）を
 * 登録する前に画面で見せるために使う。
 */
export async function countEvaluationsByOffice(companyId: string, cycleId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      status: s.evaluations.status,
      personalPoints: s.evaluations.personalPoints,
      evalOfficeId: s.evaluations.officeId,
      responseOfficeId: s.formResponses.officeId,
      userOfficeId: s.users.officeId,
    })
    .from(s.evaluations)
    .leftJoin(s.formResponses, eq(s.formResponses.id, s.evaluations.responseId))
    .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.cycleId, cycleId)));

  const byOffice = new Map<string, { draft: number; finalized: number; withBonus: number }>();
  let unknownOffice = 0;
  for (const r of rows) {
    const officeId = r.evalOfficeId ?? r.responseOfficeId ?? r.userOfficeId ?? null;
    if (!officeId) {
      unknownOffice++;
      continue;
    }
    const cur = byOffice.get(officeId) ?? { draft: 0, finalized: 0, withBonus: 0 };
    if (r.status === "finalized") cur.finalized++;
    else cur.draft++;
    if (r.personalPoints !== null) cur.withBonus++;
    byOffice.set(officeId, cur);
  }
  return { byOffice, unknownOffice, total: rows.length };
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
      cycleStatus: s.evaluationCycles.status,
      questionCount: sql<number>`(SELECT COUNT(*) FROM form_questions q WHERE q.form_id = ${s.forms.id})`,
      responseCount: sql<number>`(SELECT COUNT(*) FROM form_responses r WHERE r.form_id = ${s.forms.id})`,
    })
    .from(s.forms)
    .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
    .where(where)
    .orderBy(desc(s.forms.cycleId), asc(s.grades.displayOrder));
}

/**
 * アンケートごとに「そのアンケートが実績を聞いているKPI項目」と
 * 「いまの評価セットがその等級区分で選んでいるKPI項目」を並べて返す。
 *
 * アンケートは作った時点の評価セットを焼き付けたもの（form-build.ts）なので、
 * あとから項目を選び直すと静かにズレる。判定は src/lib/domain/form-sync.ts で行う。
 *
 * 有効な評価セットが無い会社では比較のしようがないため、scheme を null で返し、
 * 呼び出し側は何も表示しない（無いことを「ズレ」と言わない）。
 */
export async function listFormKpiCoverage(companyId: string, cycleId: string) {
  const db = await getDb();
  const schemes = await db
    .select({ id: s.evaluationSchemes.id })
    .from(s.evaluationSchemes)
    .where(and(eq(s.evaluationSchemes.companyId, companyId), eq(s.evaluationSchemes.status, "active")))
    .limit(1);
  const scheme = schemes[0] ?? null;
  if (!scheme) return null;

  const [schemeItems, asked, itemNames] = await Promise.all([
    db
      .select({
        pointGroup: s.schemeItems.pointGroup,
        kpiItemId: s.schemeItems.kpiItemId,
        isFixedSlot: s.schemeItems.isFixedSlot,
      })
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, scheme.id))),
    db
      .select({
        formId: s.formQuestions.formId,
        kpiItemId: s.formQuestions.kpiItemId,
        gradeRequirementId: s.formQuestions.gradeRequirementId,
      })
      .from(s.formQuestions)
      .innerJoin(s.forms, eq(s.forms.id, s.formQuestions.formId))
      .where(and(eq(s.forms.companyId, companyId), eq(s.forms.cycleId, cycleId))),
    db
      .select({ id: s.kpiItems.id, name: s.kpiItems.name })
      .from(s.kpiItems)
      .where(eq(s.kpiItems.companyId, companyId)),
  ]);

  const selectedByGroup = new Map<string, string[]>();
  for (const r of schemeItems) {
    selectedByGroup.set(r.pointGroup, [...(selectedByGroup.get(r.pointGroup) ?? []), r.kpiItemId]);
  }
  const askedByForm = new Map<string, string[]>();
  /* 固定枠（等級要件達成率）の実績は等級要件の「はい／いいえ」から出す。
     KPI設問が無くても聞けているので、その事実を別に持っておく（form-sync.ts で合流させる）。 */
  const fixedSlotItemIds = schemeItems.filter((r) => r.isFixedSlot).map((r) => r.kpiItemId);
  const requirementFormIds = new Set<string>();
  for (const r of asked) {
    if (r.gradeRequirementId) requirementFormIds.add(r.formId);
    if (!r.kpiItemId) continue; // 等級要件・行動指針の設問はKPI項目に紐づかない
    askedByForm.set(r.formId, [...(askedByForm.get(r.formId) ?? []), r.kpiItemId]);
  }
  return {
    selectedByGroup,
    askedByForm,
    fixedSlotItemIds,
    hasRequirementQuestions: (formId: string) => requirementFormIds.has(formId),
    nameOf: (id: string) => itemNames.find((x) => x.id === id)?.name ?? id,
  };
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
      cycleStatus: s.evaluationCycles.status,
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
 * 一般の方に返すときは、配点・ランク基準につながる列を落とす
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

/**
 * アンケート1本の回答状況。
 *
 * 対象等級に在籍している人を全員並べ、提出済み・下書き・未回答を1行ずつ返す。
 * 「誰がまだ出していないか」を数えなくても分かるようにするため、
 * 回答が無い人も行として残す（左外部結合）。
 */
export async function listResponseStatus(companyId: string, formId: string) {
  const db = await getDb();
  const form = (
    await db
      .select({ id: s.forms.id, gradeId: s.forms.gradeId })
      .from(s.forms)
      .where(and(eq(s.forms.companyId, companyId), eq(s.forms.id, formId)))
      .limit(1)
  )[0];
  if (!form) return [];

  return db
    .select({
      employeeId: s.users.id,
      name: s.users.name,
      employeeCode: s.users.employeeCode,
      department: s.users.department,
      isActive: s.users.isActive,
      responseId: s.formResponses.id,
      status: s.formResponses.status,
      submittedAt: s.formResponses.submittedAt,
      importSource: s.formResponses.importSource,
      officeName: s.offices.name,
    })
    .from(s.users)
    .leftJoin(
      s.formResponses,
      and(eq(s.formResponses.employeeId, s.users.id), eq(s.formResponses.formId, form.id)),
    )
    .leftJoin(s.offices, eq(s.offices.id, s.users.officeId))
    .where(and(eq(s.users.companyId, companyId), eq(s.users.gradeId, form.gradeId)))
    .orderBy(asc(s.users.name));
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
    .leftJoin(s.grades, and(eq(s.grades.id, s.users.gradeId), eq(s.grades.companyId, s.users.companyId)))
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

/**
 * 評価の一覧。
 *
 * viewerRole を必ず受け取る。以前は合計点・満点・昇格に必要な点数・昇格できない理由を
 * 誰にでも返しており、画面が描いていないだけでレスポンスには載っていた。
 * 引数を省略できるようにすると渡し忘れが起きるため、位置引数の必須にして
 * 呼び出し漏れを型で検出できるようにしている。
 */
export async function listEvaluations(
  companyId: string,
  viewerRole: Viewer["role"],
  opts?: { employeeId?: string; cycleId?: string },
) {
  const db = await getDb();
  const conds = [eq(s.evaluations.companyId, companyId)];
  if (opts?.employeeId) conds.push(eq(s.evaluations.employeeId, opts.employeeId));
  if (opts?.cycleId) conds.push(eq(s.evaluations.cycleId, opts.cycleId));

  const rows = await db
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
      /** 等級要件達成率の分母（半期の目標設定上限数）。評価票に「◯件達成／上限◯件」と出すために持つ */
      gradeTargetCap: s.grades.targetCap,
      totalScore: s.evaluations.totalScore,
      maxScore: s.evaluations.maxScore,
      requirementRate: s.evaluations.requirementRate,
      requirementAchieved: s.evaluations.requirementAchieved,
      requirementTotal: s.evaluations.requirementTotal,
      behaviorTotal: s.evaluations.behaviorTotal,
      /* 個人Pt・賞与額はここでは読まない。この一覧は一般の方の画面
         （/me・/me/results）でも使っており、個人Pt ÷ 達成係数 で、
         隠しているKPI評価点合計が逆算できてしまうため。
         賞与の欄が要るのは評価票1枚の詳細だけ（getEvaluationDetail）。 */
      raiseEligible: s.evaluations.raiseEligible,
      promotionEligible: s.evaluations.promotionEligible,
      promotionBlockedReason: s.evaluations.promotionBlockedReason,
      status: s.evaluations.status,
      computedAt: s.evaluations.computedAt,
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

  /* 配点・必要点数・評価者向けの理由文は、ここで落としてから返す。
     画面に出さないだけでは、APIの返り値として残ってしまうため。 */
  const full = canSeeCriteria(viewerRole);
  return rows.map((r) => scopeEvaluationRow(r, full));
}

export type EvaluationRow = Awaited<ReturnType<typeof listEvaluations>>[number];

/**
 * 評価の中身。
 * 一般の方には、昇格に必要な点数と各項目の閾値を返さない
 * （画面にもレスポンスにも出さない、という要件の実装箇所）。
 */
export async function getEvaluationDetail(companyId: string, evaluationId: string, viewerRole: Viewer["role"]) {
  const db = await getDb();
  const head = (await listEvaluations(companyId, viewerRole)).find((e) => e.id === evaluationId);
  if (!head) return null;

  /* 賞与と理由文は評価票1枚を開いたときだけ読む。
     一覧（listEvaluations）は一般の方の画面でも使うため、そちらには載せない。 */
  const extra = (
    await db
      .select({
        officeAchievementRate: s.evaluations.officeAchievementRate,
        kgiCoefficient: s.evaluations.kgiCoefficient,
        personalPoints: s.evaluations.personalPoints,
        bonusYen: s.evaluations.bonusYen,
        bonusRationale: s.evaluations.bonusRationale,
        raiseReason: s.evaluations.raiseReason,
        raiseReasonEmployee: s.evaluations.raiseReasonEmployee,
        promotionBlockedReason: s.evaluations.promotionBlockedReason,
        promotionBlockedReasonEmployee: s.evaluations.promotionBlockedReasonEmployee,
        /* この評価のもとになったアンケート回答。本人にも返してよい（自分が書いたもの）。
           これが無いと「なぜこの実績値なのか」を回答まで遡って確かめられない。 */
        responseId: s.evaluations.responseId,
      })
      .from(s.evaluations)
      .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.id, evaluationId)))
      .limit(1)
  )[0] ?? {
    officeAchievementRate: null,
    kgiCoefficient: null,
    personalPoints: null,
    bonusYen: null,
    bonusRationale: null,
    raiseReason: null,
    raiseReasonEmployee: null,
    promotionBlockedReason: null,
    promotionBlockedReasonEmployee: null,
    responseId: null,
  };

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

  /* 一般の方には、配点・閾値・昇格に必要な点数を「空」にして返す。
     ランクと実績値と判定理由は本人にも見せる（なぜその評価かは説明できる必要がある）が、
     根拠文は本人向けの1本だけに差し替える（scopeEvaluationItem 参照）。 */
  const items = rawItems.map((i) => scopeEvaluationItem(i, full));

  /* 判定範囲（A〜Eの閾値）は評価者だけが見る。保存済みのスナップショットは
     「当たったランクの範囲」しか持っていないため、帯として並べるぶんは基準表から読む。 */
  const rankCriteria = full
    ? await listRankCriteria(companyId, [...new Set(rawItems.map((i) => i.kpiItemId))])
    : [];

  // 行動指針の点数も本人には出さない（水準ラベルだけ見せる）。理由は scopeEvaluationRow のコメント。
  const scopedBehaviors = behaviors.map((b) => ({ ...b, score: full ? b.score : null }));

  return {
    head: {
      ...head,
      /* 個人Pt・賞与額も一般の方には返さない。
         個人Pt ＝ KPI評価点合計 × 達成係数 なので、係数（管理画面で誰でも見られる表）と
         突き合わせると、隠しているはずのKPI評価点合計が逆算できてしまうため。 */
      responseId: extra.responseId,
      officeAchievementRate: full ? extra.officeAchievementRate : null,
      kgiCoefficient: full ? extra.kgiCoefficient : null,
      personalPoints: full ? extra.personalPoints : null,
      bonusYen: full ? extra.bonusYen : null,
      bonusRationale: full ? extra.bonusRationale : null,
      /* 昇給・昇格の理由は、評価者には点数入りの原文を、本人には数値を含まない言い換えを返す。
         本人向けの列が空でも評価者向けの文へは落とさない（それが漏洩の元だった）。 */
      raiseReason: full
        ? extra.raiseReason
        : employeeRaiseReason(extra.raiseReasonEmployee, head.raiseEligible),
      promotionBlockedReason: full
        ? extra.promotionBlockedReason
        : employeePromotionBlockedReason(
            extra.promotionBlockedReasonEmployee,
            Boolean(extra.promotionBlockedReason),
          ),
    },
    items,
    rankCriteria,
    behaviors: scopedBehaviors,
    requirements,
    gates,
    showsCriteria: full,
  };
}

/* ───────────────── 本人が変更してよい項目の設定 ───────────────── */

/**
 * 会社の「本人が変更してよい項目」設定。
 * 行が無い項目は既定値で埋める（→ src/lib/domain/profile-fields.ts）。
 */
export async function listProfileFieldPolicies(companyId: string) {
  const db = await getDb();
  return db
    .select({ field: s.profileFieldPolicies.field, selfEditable: s.profileFieldPolicies.selfEditable })
    .from(s.profileFieldPolicies)
    .where(eq(s.profileFieldPolicies.companyId, companyId));
}

/**
 * 自分自身の登録内容。
 *
 * listMembers と違い、会社に属さない利用者（システム全体管理者）でも読める。
 * 本人の情報なので、人物メモ以外はすべて返す。
 */
export async function getSelfProfile(userId: string) {
  const db = await getDb();
  const rows = await db
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
      managerId: s.users.managerId,
      companyId: s.users.companyId,
      companyName: s.companies.name,
      mustChangePassword: s.users.mustChangePassword,
      createdAt: s.users.createdAt,
    })
    .from(s.users)
    .leftJoin(s.grades, and(eq(s.grades.id, s.users.gradeId), eq(s.grades.companyId, s.users.companyId)))
    .leftJoin(s.companies, eq(s.companies.id, s.users.companyId))
    .where(eq(s.users.id, userId))
    .limit(1);
  const me = rows[0];
  if (!me) return null;

  // 上長の名前は、誰が自分の評価を確定するのかを本人に示すために添える
  let managerName: string | null = null;
  if (me.managerId && me.companyId) {
    const m = await db
      .select({ name: s.users.name })
      .from(s.users)
      .where(and(eq(s.users.id, me.managerId), eq(s.users.companyId, me.companyId)))
      .limit(1);
    managerName = m[0]?.name ?? null;
  }
  return { ...me, managerName };
}

/** システム全体管理者向け。会社に属さない利用者も含めた全利用者。 */
export async function listAllUsers() {
  const db = await getDb();
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
      managerId: s.users.managerId,
      companyId: s.users.companyId,
      companyName: s.companies.name,
    })
    .from(s.users)
    .leftJoin(s.grades, and(eq(s.grades.id, s.users.gradeId), eq(s.grades.companyId, s.users.companyId)))
    .leftJoin(s.companies, eq(s.companies.id, s.users.companyId))
    .orderBy(asc(s.companies.name), asc(s.users.name));
}

export async function getAnyUser(userId: string) {
  const db = await getDb();
  const rows = await db
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
      managerId: s.users.managerId,
      companyId: s.users.companyId,
      companyName: s.companies.name,
    })
    .from(s.users)
    .leftJoin(s.grades, and(eq(s.grades.id, s.users.gradeId), eq(s.grades.companyId, s.users.companyId)))
    .leftJoin(s.companies, eq(s.companies.id, s.users.companyId))
    .where(eq(s.users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/* ───────────────── 改善要望（各画面からの共有） ───────────────── */

/**
 * 会社に届いた改善要望の一覧。
 *
 * 画像（improvement_shots）はここで引かない。1件あたり数百KBあるため、
 * 一覧で全件ぶんを読むと応答が跳ね上がる。添付の有無だけを返す。
 */
export async function listImprovementRequests(companyId: string) {
  const db = await getDb();
  const reporter = alias(s.users, "improvement_reporter");
  const handler = alias(s.users, "improvement_handler");
  const rows = await db
    .select({
      id: s.improvementRequests.id,
      path: s.improvementRequests.path,
      routePattern: s.improvementRequests.routePattern,
      screenLabel: s.improvementRequests.screenLabel,
      body: s.improvementRequests.body,
      kind: s.improvementRequests.kind,
      // 記録票と食い違っていないかを一覧で判定するために読む（指紋の材料）。
      // 技術情報（大きなJSON）は送信時に確定して以後変わらないので読まない。
      expected: s.improvementRequests.expected,
      status: s.improvementRequests.status,
      viewport: s.improvementRequests.viewport,
      handledNote: s.improvementRequests.handledNote,
      duplicateOfId: s.improvementRequests.duplicateOfId,
      discardedAt: s.improvementRequests.discardedAt,
      discardReason: s.improvementRequests.discardReason,
      createdAt: s.improvementRequests.createdAt,
      updatedAt: s.improvementRequests.updatedAt,
      reporterName: reporter.name,
      handledByName: handler.name,
      shotBytes: s.improvementShots.bytes,
      handedOutAt: s.improvementHandouts.handedOutAt,
      handoutCount: s.improvementHandouts.handoutCount,
      contentFingerprint: s.improvementHandouts.contentFingerprint,
    })
    .from(s.improvementRequests)
    .leftJoin(reporter, eq(reporter.id, s.improvementRequests.reporterId))
    .leftJoin(handler, eq(handler.id, s.improvementRequests.handledById))
    .leftJoin(s.improvementShots, eq(s.improvementShots.requestId, s.improvementRequests.id))
    .leftJoin(s.improvementHandouts, eq(s.improvementHandouts.requestId, s.improvementRequests.id))
    .where(eq(s.improvementRequests.companyId, companyId))
    .orderBy(desc(s.improvementRequests.createdAt));

  return rows.map((r) => {
    const kind = isImprovementKind(r.kind) ? r.kind : ("usability" as const);
    const status = isImprovementStatus(r.status) ? r.status : ("open" as const);
    const snapshot =
      r.contentFingerprint === null
        ? null
        : { contentFingerprint: r.contentFingerprint, handedOutAt: r.handedOutAt };
    // 一覧の1行から「渡すとどうなるか」まで読めるようにする
    // （1件ずつ詳細を開かないと分からない状態を作らない）。
    const state = handoutState(
      snapshot,
      improvementFingerprint({
        kind,
        screenLabel: r.screenLabel,
        path: r.path,
        routePattern: r.routePattern,
        body: r.body,
        expected: r.expected,
        status,
        handledNote: r.handledNote,
      }),
    );
    return {
      ...r,
      status,
      kind,
      hasShot: r.shotBytes !== null,
      // 廃棄は行を消さずに印で表す。一覧はこの印で既定の見え方を切り替える。
      discarded: r.discardedAt !== null,
      handoutState: state,
      handoutNote: handoutNote(state),
    };
  });
}

/**
 * 指示文を組み立てるために要望1件を読む。画像そのものは読まない。
 *
 * 詳細画面用の getImprovementRequest は画像（data URL）を一緒に引く。
 * まとめて払い出すときは1件ごとにこれを呼ぶため、そのまま使うと
 * 使わない画像を件数ぶん読み込むことになる。ここでは有無だけを見る。
 */
export async function getImprovementForHandout(companyId: string, id: string) {
  const db = await getDb();
  const reporter = alias(s.users, "improvement_reporter");
  const rows = await db
    .select({
      id: s.improvementRequests.id,
      path: s.improvementRequests.path,
      routePattern: s.improvementRequests.routePattern,
      screenLabel: s.improvementRequests.screenLabel,
      body: s.improvementRequests.body,
      kind: s.improvementRequests.kind,
      expected: s.improvementRequests.expected,
      diagnostics: s.improvementRequests.diagnostics,
      status: s.improvementRequests.status,
      handledNote: s.improvementRequests.handledNote,
      discardedAt: s.improvementRequests.discardedAt,
      duplicateOfId: s.improvementRequests.duplicateOfId,
      createdAt: s.improvementRequests.createdAt,
      reporterRole: reporter.role,
      shotBytes: s.improvementShots.bytes,
      handedOutAt: s.improvementHandouts.handedOutAt,
      contentFingerprint: s.improvementHandouts.contentFingerprint,
    })
    .from(s.improvementRequests)
    .leftJoin(reporter, eq(reporter.id, s.improvementRequests.reporterId))
    .leftJoin(s.improvementShots, eq(s.improvementShots.requestId, s.improvementRequests.id))
    .leftJoin(s.improvementHandouts, eq(s.improvementHandouts.requestId, s.improvementRequests.id))
    .where(and(eq(s.improvementRequests.companyId, companyId), eq(s.improvementRequests.id, id)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    item: {
      id: r.id,
      path: r.path,
      routePattern: r.routePattern,
      screenLabel: r.screenLabel,
      body: r.body,
      kind: r.kind,
      expected: r.expected,
      diagnostics: r.diagnostics,
      status: r.status,
      handledNote: r.handledNote,
      discarded: r.discardedAt !== null,
      duplicateOfId: r.duplicateOfId,
      createdAt: r.createdAt,
      reporterRole: r.reporterRole,
      hasShot: r.shotBytes !== null,
    },
    handout:
      r.contentFingerprint === null
        ? null
        : { contentFingerprint: r.contentFingerprint, handedOutAt: r.handedOutAt },
  };
}

/** 要望1件。画像もここで一緒に読む（詳細画面だけが画像を要る）。 */
export async function getImprovementRequest(companyId: string, id: string) {
  const db = await getDb();
  const reporter = alias(s.users, "improvement_reporter");
  const handler = alias(s.users, "improvement_handler");
  const rows = await db
    .select({
      id: s.improvementRequests.id,
      path: s.improvementRequests.path,
      routePattern: s.improvementRequests.routePattern,
      screenLabel: s.improvementRequests.screenLabel,
      body: s.improvementRequests.body,
      kind: s.improvementRequests.kind,
      expected: s.improvementRequests.expected,
      diagnostics: s.improvementRequests.diagnostics,
      status: s.improvementRequests.status,
      viewport: s.improvementRequests.viewport,
      userAgent: s.improvementRequests.userAgent,
      handledNote: s.improvementRequests.handledNote,
      duplicateOfId: s.improvementRequests.duplicateOfId,
      discardedAt: s.improvementRequests.discardedAt,
      discardReason: s.improvementRequests.discardReason,
      createdAt: s.improvementRequests.createdAt,
      updatedAt: s.improvementRequests.updatedAt,
      reporterName: reporter.name,
      reporterRole: reporter.role,
      handledByName: handler.name,
      shot: s.improvementShots.dataUrl,
      handedOutAt: s.improvementHandouts.handedOutAt,
      handoutCount: s.improvementHandouts.handoutCount,
      contentFingerprint: s.improvementHandouts.contentFingerprint,
    })
    .from(s.improvementRequests)
    .leftJoin(reporter, eq(reporter.id, s.improvementRequests.reporterId))
    .leftJoin(handler, eq(handler.id, s.improvementRequests.handledById))
    .leftJoin(s.improvementShots, eq(s.improvementShots.requestId, s.improvementRequests.id))
    .leftJoin(s.improvementHandouts, eq(s.improvementHandouts.requestId, s.improvementRequests.id))
    .where(and(eq(s.improvementRequests.companyId, companyId), eq(s.improvementRequests.id, id)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    status: isImprovementStatus(r.status) ? r.status : ("open" as const),
    kind: isImprovementKind(r.kind) ? r.kind : ("usability" as const),
    hasShot: r.shot !== null,
    discarded: r.discardedAt !== null,
  };
}

/**
 * 払い出しの履歴。新しい順に、残っている分だけを読む。
 *
 * 行は古い分から丸めるので、ここに出る件数と通算の回数は一致しないことがある。
 * 通算は improvement_handouts.handout_count が正本。
 *
 * 画面から押したときは人の名前、API で取られたときは鍵の名前を出す。
 * どちらも空になり得るので、言い換えは domain 側（handoutEventWho）で行う。
 */
export async function listHandoutEvents(requestId: string): Promise<HandoutEvent[]> {
  const db = await getDb();
  const actor = alias(s.users, "handout_actor");
  const rows = await db
    .select({
      id: s.improvementHandoutEvents.id,
      via: s.improvementHandoutEvents.via,
      keyLabel: s.improvementHandoutEvents.keyLabel,
      actorName: actor.name,
      createdAt: s.improvementHandoutEvents.createdAt,
    })
    .from(s.improvementHandoutEvents)
    .leftJoin(actor, eq(actor.id, s.improvementHandoutEvents.actorId))
    .where(eq(s.improvementHandoutEvents.requestId, requestId))
    .orderBy(desc(s.improvementHandoutEvents.createdAt), desc(s.improvementHandoutEvents.id))
    .limit(HANDOUT_HISTORY_MAX);
  return rows.map((r) => ({
    id: r.id,
    via: r.via === "api" ? ("api" as const) : ("screen" as const),
    actorName: r.actorName,
    keyName: r.keyLabel,
    createdAt: r.createdAt,
  }));
}

/**
 * 作業する側（Claude Code）へ払い出すための読み取り。会社をまたいで読む。
 *
 * 画面から読むものと違い、鍵を持っているのは運営者だけなので会社で絞らない。
 * 代わりに、渡してはいけないもの（廃棄・重複・完了・見送り）をここで必ず落とす。
 * 画面側の絞り込みに任せると、URL を手で書き換えたときに素通りする。
 */
export async function listImprovementsForAgent(limit: number, companyId: string | null) {
  const db = await getDb();
  const rows = await db
    .select({
      id: s.improvementRequests.id,
      kind: s.improvementRequests.kind,
      screenLabel: s.improvementRequests.screenLabel,
      routePattern: s.improvementRequests.routePattern,
      body: s.improvementRequests.body,
      status: s.improvementRequests.status,
      createdAt: s.improvementRequests.createdAt,
      companyName: s.companies.name,
      handedOutAt: s.improvementHandouts.handedOutAt,
    })
    .from(s.improvementRequests)
    .leftJoin(s.companies, eq(s.companies.id, s.improvementRequests.companyId))
    .leftJoin(s.improvementHandouts, eq(s.improvementHandouts.requestId, s.improvementRequests.id))
    .where(
      and(
        isNull(s.improvementRequests.discardedAt),
        isNull(s.improvementRequests.duplicateOfId),
        inArray(s.improvementRequests.status, ["open", "doing"]),
        // 会社が焼き込まれた鍵では、その会社の分しか読めない。
        // 絞り込みを呼び出し側だけに置くと、書き忘れた入口が全社を返す。
        companyId ? eq(s.improvementRequests.companyId, companyId) : undefined,
      ),
    )
    .orderBy(desc(s.improvementRequests.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    kind: isImprovementKind(r.kind) ? r.kind : ("usability" as const),
    status: isImprovementStatus(r.status) ? r.status : ("open" as const),
    summary: r.body.split("\n")[0].slice(0, 60),
  }));
}

/**
 * 指示文にするための本体。指定のIDだけを読む。
 *
 * companyId を渡すと、その会社の分しか返らない。会社が焼き込まれていない
 * 古い鍵のときだけ null になり、これまでどおり会社をまたいで読める。
 */
export async function getImprovementsForAgent(ids: string[], companyId: string | null) {
  if (ids.length === 0) return [];
  const db = await getDb();
  const reporter = alias(s.users, "improvement_reporter");
  const rows = await db
    .select({
      id: s.improvementRequests.id,
      path: s.improvementRequests.path,
      routePattern: s.improvementRequests.routePattern,
      screenLabel: s.improvementRequests.screenLabel,
      body: s.improvementRequests.body,
      kind: s.improvementRequests.kind,
      expected: s.improvementRequests.expected,
      diagnostics: s.improvementRequests.diagnostics,
      status: s.improvementRequests.status,
      handledNote: s.improvementRequests.handledNote,
      createdAt: s.improvementRequests.createdAt,
      companyId: s.improvementRequests.companyId,
      reporterRole: reporter.role,
      shotBytes: s.improvementShots.bytes,
    })
    .from(s.improvementRequests)
    .leftJoin(reporter, eq(reporter.id, s.improvementRequests.reporterId))
    .leftJoin(s.improvementShots, eq(s.improvementShots.requestId, s.improvementRequests.id))
    .where(
      and(
        inArray(s.improvementRequests.id, ids),
        isNull(s.improvementRequests.discardedAt),
        companyId ? eq(s.improvementRequests.companyId, companyId) : undefined,
      ),
    )
    .limit(ids.length);
  return rows.map((r) => ({ ...r, hasShot: r.shotBytes !== null }));
}

/**
 * 要望1件の操作の履歴（新しい順）。
 *
 * 状態の列を上書きするだけでは「なぜ落としたか」が次の更新で消えるので、
 * ここを読めば経緯を追える形にしてある。誰が押したかも一緒に出す。
 */
export async function listImprovementEvents(requestId: string) {
  const db = await getDb();
  const actor = alias(s.users, "improvement_actor");
  return db
    .select({
      id: s.improvementStatusEvents.id,
      action: s.improvementStatusEvents.action,
      fromStatus: s.improvementStatusEvents.fromStatus,
      toStatus: s.improvementStatusEvents.toStatus,
      reason: s.improvementStatusEvents.reason,
      actorName: actor.name,
      // 人ではなく鍵が変えた行もある。空欄にすると「退職された方」に見えてしまう。
      keyLabel: s.improvementStatusEvents.keyLabel,
      releaseRef: s.improvementStatusEvents.releaseRef,
      createdAt: s.improvementStatusEvents.createdAt,
    })
    .from(s.improvementStatusEvents)
    .leftJoin(actor, eq(actor.id, s.improvementStatusEvents.actorId))
    .where(eq(s.improvementStatusEvents.requestId, requestId))
    .orderBy(desc(s.improvementStatusEvents.createdAt))
    .limit(50);
}
