import * as s from "@/db/schema";
import type { TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 評価の集計を通しで確かめるための、最小の会社1社ぶんの下ごしらえ。
 *
 * 「計算は合っているのに保存されていない」「保存されているのに画面に出ていない」を
 * 見つけるには、本物の表に本物の行を入れて集計を1周させるしかない。
 * ここではその1周に必要な行だけを、テストから読める形で作る。
 */

export const IDS = {
  company: "cmp_test",
  office: "ofc_test",
  gradeFrom: "grd_regular",
  gradeTo: "grd_chief",
  category: "cat_test",
  scheme: "sch_test",
  cycle: "cyc_test",
  form: "frm_test",
  employee: "usr_emp",
  evaluator: "usr_mgr",
  /** 等級要件達成率（固定枠） */
  itemFixed: "kpi_fixed",
  /** 稼働率（高いほど良い） */
  itemHigher: "kpi_higher",
  /** 残業率（低いほど良い＝逆転指標） */
  itemLower: "kpi_lower",
  guideline: "bg_test",
} as const;

/** A〜E の下限・上限。下限は含み、上限は含まない。 */
export const HIGHER_BOUNDS: { rank: string; lower: number | null; upper: number | null }[] = [
  { rank: "A", lower: 100, upper: null },
  { rank: "B", lower: 90, upper: 100 },
  { rank: "C", lower: 80, upper: 90 },
  { rank: "D", lower: 70, upper: 80 },
  { rank: "E", lower: null, upper: 70 },
];

/** 逆転指標（低いほど良い）。上限を含み、下限は含まない。 */
export const LOWER_BOUNDS: { rank: string; lower: number | null; upper: number | null }[] = [
  { rank: "A", lower: null, upper: 5 },
  { rank: "B", lower: 5, upper: 10 },
  { rank: "C", lower: 10, upper: 15 },
  { rank: "D", lower: 15, upper: 20 },
  { rank: "E", lower: 20, upper: null },
];

export interface SeedOptions {
  /** 評価セットの配点（固定枠 / 稼働率 / 残業率）。合計100点になるようにする */
  weights?: [number, number, number];
  raiseRequiresAllA?: boolean;
  requiredKpiPoints?: number;
  requiredBehaviorPoints?: number;
  /** 事業所KGI達成率（%）。null なら登録しない */
  officeKgiRate?: number | null;
  /** 個人Pt 1点あたりの金額 */
  yenPerPoint?: number;
}

export async function seedCompany(t: TestDatabase, opts: SeedOptions = {}) {
  const {
    weights = [20, 50, 30],
    raiseRequiresAllA = true,
    requiredKpiPoints = 80,
    requiredBehaviorPoints = 3,
    officeKgiRate = 100,
    yenPerPoint = 3200,
  } = opts;
  const db = t.db;

  await db.insert(s.companies).values({ id: IDS.company, name: "テスト社", slug: "test" });
  await db
    .insert(s.offices)
    .values({ id: IDS.office, companyId: IDS.company, code: "O1", name: "第一事業所" });

  await db.insert(s.grades).values([
    {
      id: IDS.gradeFrom,
      companyId: IDS.company,
      code: "regular",
      name: "等級２：Regular",
      pointGroup: "Regular",
      displayOrder: 2,
      targetCap: 5,
      behaviorBand: "g1_2",
    },
    {
      id: IDS.gradeTo,
      companyId: IDS.company,
      code: "chief",
      name: "等級３：Chief",
      pointGroup: "Chief",
      displayOrder: 3,
      targetCap: 5,
      behaviorBand: "g3_4",
    },
  ]);

  await db.insert(s.users).values([
    {
      id: IDS.evaluator,
      name: "上長",
      email: "mgr@example.com",
      companyId: IDS.company,
      role: "MANAGER",
      gradeId: IDS.gradeTo,
      officeId: IDS.office,
    },
    {
      id: IDS.employee,
      name: "本人",
      email: "emp@example.com",
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      officeId: IDS.office,
      managerId: IDS.evaluator,
    },
  ]);

  await db
    .insert(s.kpiCategories)
    .values({ id: IDS.category, companyId: IDS.company, code: "ops", name: "運営", displayOrder: 1 });

  await db.insert(s.kpiItems).values([
    {
      id: IDS.itemFixed,
      companyId: IDS.company,
      no: 1,
      name: "等級要件達成率",
      categoryId: IDS.category,
      measureType: "個人実績",
      unit: "%",
      direction: "higher",
      formula: null,
      isFixedSlot: true,
    },
    {
      id: IDS.itemHigher,
      companyId: IDS.company,
      no: 2,
      name: "稼働率",
      categoryId: IDS.category,
      measureType: "事業所実績",
      unit: "%",
      direction: "higher",
      formula: "q2_1 ÷ q2_2 × 100",
    },
    {
      id: IDS.itemLower,
      companyId: IDS.company,
      no: 3,
      name: "残業率",
      categoryId: IDS.category,
      measureType: "個人実績",
      unit: "%",
      direction: "lower",
      formula: "q3_1",
    },
  ]);

  const crit = (kpiItemId: string, rows: typeof HIGHER_BOUNDS) =>
    rows.map((r) => ({
      id: `krc_${kpiItemId}_${r.rank}`,
      companyId: IDS.company,
      kpiItemId,
      rank: r.rank,
      displayLabel: `${r.rank}の範囲`,
      lowerBound: r.lower,
      upperBound: r.upper,
    }));
  await db
    .insert(s.kpiRankCriteria)
    .values([
      ...crit(IDS.itemFixed, HIGHER_BOUNDS),
      ...crit(IDS.itemHigher, HIGHER_BOUNDS),
      ...crit(IDS.itemLower, LOWER_BOUNDS),
    ]);

  await db.insert(s.evaluationSchemes).values({
    id: IDS.scheme,
    companyId: IDS.company,
    name: "2026年度",
    status: "active",
    raiseRequiresAllA,
  });

  await db.insert(s.schemeItems).values([
    {
      id: "si_1",
      companyId: IDS.company,
      schemeId: IDS.scheme,
      pointGroup: "Regular",
      kpiItemId: IDS.itemFixed,
      categoryId: IDS.category,
      weight: weights[0],
      isFixedSlot: true,
      displayOrder: 1,
    },
    {
      id: "si_2",
      companyId: IDS.company,
      schemeId: IDS.scheme,
      pointGroup: "Regular",
      kpiItemId: IDS.itemHigher,
      categoryId: IDS.category,
      weight: weights[1],
      displayOrder: 2,
    },
    {
      id: "si_3",
      companyId: IDS.company,
      schemeId: IDS.scheme,
      pointGroup: "Regular",
      kpiItemId: IDS.itemLower,
      categoryId: IDS.category,
      weight: weights[2],
      displayOrder: 3,
    },
  ]);

  await db.insert(s.schemeRankRatios).values(
    [
      ["A", 1],
      ["B", 0.8],
      ["C", 0.6],
      ["D", 0.4],
      ["E", 0],
    ].map(([rank, ratio]) => ({
      id: `srr_${rank}`,
      companyId: IDS.company,
      schemeId: IDS.scheme,
      rank: rank as string,
      ratio: ratio as number,
    })),
  );

  await db.insert(s.promotionThresholds).values({
    id: "pth_1",
    companyId: IDS.company,
    fromGradeId: IDS.gradeFrom,
    toGradeId: IDS.gradeTo,
    label: "Regular→Chief",
    requiredBehaviorPoints,
    requiredKpiPoints,
  });

  await db.insert(s.evaluationCycles).values({
    id: IDS.cycle,
    companyId: IDS.company,
    name: "2026年度上期",
    periodStart: "2026-04-01",
    periodEnd: "2026-09-30",
    schemeId: IDS.scheme,
    status: "open",
  });

  await db.insert(s.forms).values({
    id: IDS.form,
    companyId: IDS.company,
    gradeId: IDS.gradeFrom,
    cycleId: IDS.cycle,
    title: "2026年度上期 Regular",
    status: "published",
    publicToken: "tok_test",
  });

  await db.insert(s.behaviorGuidelines).values({
    id: IDS.guideline,
    companyId: IDS.company,
    band: "g1_2",
    aspect: "creativity",
    aspectName: "創造性について",
    seq: 1,
  });

  await db.insert(s.kgiCoefficients).values(
    [
      ["121%以上", 121, null, 1.5, 1],
      ["111%以上121%未満", 111, 121, 1.2, 2],
      ["100%以上111%未満", 100, 111, 1.0, 3],
      ["95%以上100%未満", 95, 100, 0.6, 4],
      ["90%以上95%未満", 90, 95, 0.4, 5],
      ["90%未満", null, 90, 0.2, 6],
    ].map(([label, lo, hi, co, order], i) => ({
      id: `kgi_${i}`,
      companyId: IDS.company,
      label: label as string,
      lowerBound: lo as number | null,
      upperBound: hi as number | null,
      coefficient: co as number,
      displayOrder: order as number,
    })),
  );

  await db
    .insert(s.raisePolicies)
    .values({ id: "rp_1", companyId: IDS.company, bonusYenPerPoint: yenPerPoint });

  if (officeKgiRate !== null) {
    await db.insert(s.officeKgiResults).values({
      id: "okr_1",
      companyId: IDS.company,
      officeId: IDS.office,
      cycleId: IDS.cycle,
      achievementRate: officeKgiRate,
    });
  }
}

export interface QuestionSpec {
  id: string;
  section: string;
  questionType: string;
  title: string;
  displayOrder: number;
  gradeRequirementId?: string | null;
  behaviorGuidelineId?: string | null;
  kpiQuestionKey?: string | null;
  isGate?: boolean;
}

/** 設問とその回答をまとめて入れ、提出済みの回答1件を作る。 */
export async function seedResponse(
  t: TestDatabase,
  questions: (QuestionSpec & { answer: number | null; answerText?: string })[],
  opts: { responseId?: string; status?: string; officeId?: string | null } = {},
) {
  const db = t.db;
  const responseId = opts.responseId ?? "res_1";

  // 等級要件・昇格要件のマスタ行（設問から参照するため先に作る）
  const reqIds = [...new Set(questions.map((q) => q.gradeRequirementId).filter(Boolean))] as string[];
  if (reqIds.length > 0) {
    await db.insert(s.gradeRequirements).values(
      reqIds.map((id, i) => ({
        id,
        companyId: IDS.company,
        gradeId: IDS.gradeFrom,
        category: "support",
        seq: i + 1,
        text: `等級要件${i + 1}`,
      })),
    );
  }

  await db.insert(s.formQuestions).values(
    questions.map((q) => ({
      id: q.id,
      companyId: IDS.company,
      formId: IDS.form,
      section: q.section,
      questionType: q.questionType,
      title: q.title,
      displayOrder: q.displayOrder,
      gradeRequirementId: q.gradeRequirementId ?? null,
      behaviorGuidelineId: q.behaviorGuidelineId ?? null,
      kpiQuestionKey: q.kpiQuestionKey ?? null,
      isGate: q.isGate ?? false,
    })),
  );

  await db.insert(s.formResponses).values({
    id: responseId,
    companyId: IDS.company,
    formId: IDS.form,
    cycleId: IDS.cycle,
    employeeId: IDS.employee,
    gradeId: IDS.gradeFrom,
    officeId: opts.officeId === undefined ? IDS.office : opts.officeId,
    status: opts.status ?? "submitted",
    submittedAt: new Date("2026-09-30T00:00:00Z"),
  });

  const answered = questions.filter((q) => q.answer !== null || q.answerText !== undefined);
  if (answered.length > 0) {
    await db.insert(s.formAnswers).values(
      answered.map((q) => ({
        id: `fa_${q.id}`,
        companyId: IDS.company,
        responseId,
        questionId: q.id,
        valueNumber: q.answer,
        valueText: q.answerText ?? null,
      })),
    );
  }
  return responseId;
}
