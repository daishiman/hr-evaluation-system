import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { formatDateTime, formatPercent, toCsv } from "@/lib/csv";

/**
 * これまでスプレッドシートで見ていた3種類の表を、そのままの列でCSVに書き出す。
 *
 *  1. 回答一覧   … アンケート1本ぶんの回答（設問文がそのまま列になる）
 *  2. 評価結果   … 1人1行の判定結果（23列）
 *  3. KPI明細   … 1人×1項目で1行の点数根拠（16列）
 *
 * 列の並びと見出しは現行のスプレッドシートに合わせてある。
 * 乗り換えたあとも、これまでと同じ形で保存・共有できるようにするため。
 */

export type CsvFile = { filename: string; csv: string };

/* ───────────────── 1. 回答一覧 ───────────────── */

export async function buildResponsesCsv(companyId: string, formId: string): Promise<CsvFile> {
  const db = await getDb();

  const form = (
    await db
      .select({
        id: s.forms.id,
        title: s.forms.title,
        gradeName: s.grades.name,
        cycleName: s.evaluationCycles.name,
      })
      .from(s.forms)
      .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
      .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
      .where(and(eq(s.forms.companyId, companyId), eq(s.forms.id, formId)))
      .limit(1)
  )[0];
  if (!form) return { filename: "回答一覧.csv", csv: toCsv(["結果"], [["対象のアンケートが見つかりませんでした"]]) };

  const questions = await db
    .select()
    .from(s.formQuestions)
    .where(and(eq(s.formQuestions.companyId, companyId), eq(s.formQuestions.formId, formId)))
    .orderBy(asc(s.formQuestions.displayOrder));

  const responses = await db
    .select({
      id: s.formResponses.id,
      submittedAt: s.formResponses.submittedAt,
      status: s.formResponses.status,
      importSource: s.formResponses.importSource,
      employeeName: s.users.name,
      employeeCode: s.users.employeeCode,
      officeName: s.offices.name,
    })
    .from(s.formResponses)
    .leftJoin(s.users, eq(s.users.id, s.formResponses.employeeId))
    .leftJoin(s.offices, eq(s.offices.id, s.formResponses.officeId))
    .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.formId, formId)))
    .orderBy(asc(s.formResponses.submittedAt));

  const ids = responses.map((r) => r.id);
  const answers = ids.length
    ? await db
        .select()
        .from(s.formAnswers)
        .where(and(eq(s.formAnswers.companyId, companyId), inArray(s.formAnswers.responseId, ids)))
    : [];
  const byResponse = new Map<string, Map<string, string>>();
  for (const a of answers) {
    const m = byResponse.get(a.responseId) ?? new Map<string, string>();
    m.set(a.questionId, a.valueText ?? (a.valueNumber === null ? "" : String(a.valueNumber)));
    byResponse.set(a.responseId, m);
  }

  const headers = ["タイムスタンプ", "氏名（回答者）", "社員番号", "事業所", "提出状況", "取り込み元", ...questions.map((q) => q.title)];
  const rows = responses.map((r) => {
    const m = byResponse.get(r.id) ?? new Map<string, string>();
    return [
      formatDateTime(r.submittedAt),
      r.employeeName ?? "",
      r.employeeCode ?? "",
      r.officeName ?? "",
      r.status === "submitted" ? "提出済み" : "下書き",
      r.importSource ?? "",
      ...questions.map((q) => m.get(q.id) ?? ""),
    ];
  });

  return { filename: `回答一覧_${form.cycleName ?? ""}_${form.gradeName ?? ""}.csv`, csv: toCsv(headers, rows) };
}

/* ───────────────── 2. 評価結果（23列） ───────────────── */

const RESULT_HEADERS = [
  "回答ID", "回答日時", "氏名", "ユーザーキー", "等級", "評価対象半期",
  "等級要件達成数", "目標上限数", "等級要件達成率",
  "行動指針得点", "行動指針基準点", "行動指針判定",
  "昇格要件達成数", "昇格要件総数", "昇格要件実施状況（項目別）", "昇格要件判定", "昇格可否",
  "KPI合計点", "評価可能配点", "KPI達成率", "KPI評価内訳・点数根拠", "HTML評価票URL", "内部JSON",
];

export async function buildResultsCsv(companyId: string, cycleId: string, origin: string): Promise<CsvFile> {
  const db = await getDb();

  const evals = await db
    .select({
      id: s.evaluations.id,
      responseId: s.evaluations.responseId,
      computedAt: s.evaluations.computedAt,
      finalizedAt: s.evaluations.finalizedAt,
      employeeName: s.users.name,
      employeeCode: s.users.employeeCode,
      email: s.users.email,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      cycleName: s.evaluationCycles.name,
      requirementAchieved: s.evaluations.requirementAchieved,
      requirementTotal: s.evaluations.requirementTotal,
      requirementRate: s.evaluations.requirementRate,
      behaviorTotal: s.evaluations.behaviorTotal,
      requiredBehavior: s.evaluations.requiredBehaviorPointsSnapshot,
      requiredKpi: s.evaluations.requiredKpiPointsSnapshot,
      totalScore: s.evaluations.totalScore,
      maxScore: s.evaluations.maxScore,
      promotionEligible: s.evaluations.promotionEligible,
      promotionBlockedReason: s.evaluations.promotionBlockedReason,
      raiseEligible: s.evaluations.raiseEligible,
      status: s.evaluations.status,
    })
    .from(s.evaluations)
    .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.cycleId, cycleId)))
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name));

  const evalIds = evals.map((e) => e.id);
  const items = evalIds.length
    ? await db
        .select()
        .from(s.evaluationItems)
        .where(and(eq(s.evaluationItems.companyId, companyId), inArray(s.evaluationItems.evaluationId, evalIds)))
        .orderBy(asc(s.evaluationItems.displayOrder))
    : [];
  const gates = evalIds.length
    ? await db
        .select()
        .from(s.evaluationGates)
        .where(and(eq(s.evaluationGates.companyId, companyId), inArray(s.evaluationGates.evaluationId, evalIds)))
    : [];

  const itemsOf = (id: string) => items.filter((i) => i.evaluationId === id);
  const gatesOf = (id: string) => gates.filter((g) => g.evaluationId === id);

  const rows = evals.map((e) => {
    const its = itemsOf(e.id);
    const gs = gatesOf(e.id);
    const gateDone = gs.filter((g) => g.achieved).length;
    const behaviorJudge =
      e.behaviorTotal === null || e.requiredBehavior === null
        ? "判定対象外"
        : e.behaviorTotal >= e.requiredBehavior
          ? "基準達成"
          : "基準未達";
    return [
      e.responseId ?? e.id,
      formatDateTime(e.finalizedAt ?? e.computedAt),
      e.employeeName ?? "",
      e.employeeCode ?? e.email ?? "",
      e.gradeName ?? "",
      e.cycleName ?? "",
      e.requirementAchieved ?? 0,
      e.requirementTotal ?? 0,
      formatPercent(e.requirementRate),
      e.behaviorTotal ?? "",
      e.requiredBehavior ?? "",
      behaviorJudge,
      gateDone,
      gs.length,
      gs.map((g) => `${g.text}｜${g.achieved ? "実施済み（○）" : "未実施（×）"}`).join("\n"),
      gs.length === 0 ? "対象なし" : gateDone === gs.length ? "すべて達成" : "未達あり",
      e.promotionEligible ? "昇格可" : `昇格不可${e.promotionBlockedReason ? `（${e.promotionBlockedReason}）` : ""}`,
      e.totalScore,
      e.maxScore,
      formatPercent(e.maxScore ? (e.totalScore / e.maxScore) * 100 : null),
      its.map((i) => `${i.itemName}：${i.rank ?? "-"}（${i.points}/${i.maxPoints}点｜${i.thresholdLabel ?? ""}）`).join("\n"),
      `${origin}/manager/evaluations/${e.id}`,
      JSON.stringify({
        evaluationId: e.id,
        status: e.status,
        raiseEligible: e.raiseEligible,
        requiredKpiPoints: e.requiredKpi,
        items: its.map((i) => ({ name: i.itemName, rank: i.rank, points: i.points, max: i.maxPoints, value: i.actualValue })),
      }),
    ];
  });

  const cycleName = evals[0]?.cycleName ?? "";
  return { filename: `評価結果_${cycleName}.csv`, csv: toCsv(RESULT_HEADERS, rows) };
}

/* ───────────────── 3. KPI明細（16列） ───────────────── */

const KPI_HEADERS = [
  "回答ID", "回答日時", "氏名", "等級", "評価対象半期", "KPI項目", "実績・計算",
  "分子", "分母", "算出値", "評価ランク（A〜E）", "獲得点数", "最大配点",
  "点数根拠（適用基準）", "計算根拠", "注記",
];

export async function buildKpiDetailCsv(companyId: string, cycleId: string): Promise<CsvFile> {
  const db = await getDb();

  const rows = await db
    .select({
      evaluationId: s.evaluations.id,
      responseId: s.evaluations.responseId,
      finalizedAt: s.evaluations.finalizedAt,
      computedAt: s.evaluations.computedAt,
      employeeName: s.users.name,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      cycleName: s.evaluationCycles.name,
      itemName: s.evaluationItems.itemName,
      unit: s.evaluationItems.unit,
      numerator: s.evaluationItems.numerator,
      denominator: s.evaluationItems.denominator,
      actualValue: s.evaluationItems.actualValue,
      rank: s.evaluationItems.rank,
      points: s.evaluationItems.points,
      maxPoints: s.evaluationItems.maxPoints,
      thresholdLabel: s.evaluationItems.thresholdLabel,
      rationale: s.evaluationItems.rationale,
      calcNote: s.evaluationItems.calcNote,
      displayOrder: s.evaluationItems.displayOrder,
    })
    .from(s.evaluationItems)
    .innerJoin(s.evaluations, eq(s.evaluations.id, s.evaluationItems.evaluationId))
    .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .where(and(eq(s.evaluationItems.companyId, companyId), eq(s.evaluations.cycleId, cycleId)))
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name), asc(s.evaluationItems.displayOrder));

  const body = rows.map((r) => [
    r.responseId ?? r.evaluationId,
    formatDateTime(r.finalizedAt ?? r.computedAt),
    r.employeeName ?? "",
    r.gradeName ?? "",
    r.cycleName ?? "",
    r.itemName,
    r.numerator !== null && r.denominator !== null ? `${r.numerator}／${r.denominator}` : (r.actualValue ?? ""),
    r.numerator ?? "",
    r.denominator ?? "",
    r.actualValue ?? "",
    r.rank ?? "",
    r.points,
    r.maxPoints,
    r.thresholdLabel ?? "",
    r.rationale ?? "",
    r.calcNote ?? "",
  ]);

  const cycleName = rows[0]?.cycleName ?? "";
  return { filename: `KPI明細_${cycleName}.csv`, csv: toCsv(KPI_HEADERS, body) };
}

/* ───────────────── 4. 社員一覧（取り込みと同じ列） ───────────────── */

/**
 * 社員一覧の列。ここに書き出したCSVを、そのまま取り込みに使える（列名も並びも同じ）。
 * 上長は氏名で書く（社員番号がまだ無い会社でも読めるようにするため）。
 */
export const MEMBER_HEADERS = [
  "氏名", "メールアドレス", "社員番号", "役割", "等級", "事業所", "所属", "上長", "入社日", "利用状態",
] as const;

const ROLE_TO_LABEL: Record<string, string> = {
  SUPER_ADMIN: "システム管理者",
  COMPANY_ADMIN: "会社管理者",
  MANAGER: "マネージャー",
  EMPLOYEE: "社員",
};

export async function buildMembersCsv(companyId: string): Promise<CsvFile> {
  const db = await getDb();

  const rows = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      employeeCode: s.users.employeeCode,
      role: s.users.role,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      officeName: s.offices.name,
      department: s.users.department,
      managerId: s.users.managerId,
      hiredAt: s.users.hiredAt,
      isActive: s.users.isActive,
    })
    .from(s.users)
    .leftJoin(s.grades, eq(s.grades.id, s.users.gradeId))
    .leftJoin(s.offices, eq(s.offices.id, s.users.officeId))
    .where(eq(s.users.companyId, companyId))
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name));

  const nameById = new Map(rows.map((r) => [r.id, r.name]));

  const body = rows.map((r) => [
    r.name,
    r.email,
    r.employeeCode ?? "",
    ROLE_TO_LABEL[r.role] ?? r.role,
    r.gradeName ?? "",
    r.officeName ?? "",
    r.department ?? "",
    (r.managerId && nameById.get(r.managerId)) ?? "",
    r.hiredAt ?? "",
    r.isActive ? "在籍中" : "利用停止",
  ]);

  return { filename: "社員一覧.csv", csv: toCsv([...MEMBER_HEADERS], body) };
}
