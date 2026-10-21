import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { formatDateTime, formatPercent, toCsv } from "@/lib/csv";
import { canReviewEmployeeEvaluation } from "@/lib/domain/evaluation-authority";
import { decisionCsvCells, finalDecisionOf } from "@/lib/domain/final-decision";
import { joinMembership } from "@/lib/memberships";
import type { Viewer } from "@/lib/session";

/**
 * これまでスプレッドシートで見ていた3種類の表を、そのままの列でCSVに書き出す。
 *
 *  1. 回答一覧   … アンケート1本ぶんの回答（設問文がそのまま列になる）
 *  2. 評価結果   … 1人1行の判定結果（現行の23列＋上司の判断の7列）
 *  3. KPI明細   … 1人×1項目で1行の点数根拠（16列）
 *
 * 列の並びと見出しは現行のスプレッドシートに合わせてある。
 * 乗り換えたあとも、これまでと同じ形で保存・共有できるようにするため。
 *
 * 社員番号・役割・等級・事業所・部署・上長・入社日は、その会社の所属（company_memberships）から読む。
 * 1人が複数の会社に所属するので、users の同じ列（元の所属の写し）は読まない（src/lib/memberships.ts）。
 */

/** 会社ごとの値の正本 */
const mem = s.companyMemberships;

export type CsvFile = { filename: string; csv: string };

/** 評価結果・KPI明細を書き出す人。行の範囲を決めるのに使う */
export type ExportViewer = Pick<Viewer, "id" | "role">;

/**
 * 書き出す評価期間。呼び出し側（/api/export）が会社で絞って読んだものを渡す。
 * ファイル名の期の名前はここから取る。行から取ると、載る行が0件のとき「評価結果_.csv」になる
 * （マネージャーは直属の部下の分だけなので、0件は珍しくない）。
 */
export type ExportCycle = { id: string; name: string };

/**
 * 評価結果・KPI明細に、その人の行を載せてよいか。
 *
 * マネージャーの評価の画面（/manager/evaluations/[id]。/manager/cycles の一覧も同じ直属の範囲）と
 * 同じ canReviewEmployeeEvaluation で決め、画面と CSV で見える人をそろえる。
 * 会社の管理者以上は会社の全員、マネージャーは直属の部下だけ。マネージャー自身の評価は載せない
 * （本人の結果は /me/results から確定済みだけを読む。CSV に載せると確認中の自分の評価まで出る）。
 * 会社の管理者以上は本人を除かないので、自分の行も載る（扱いは SECURITY-013 で決める）。
 * 以前は会社の全員分を返しており、マネージャーが担当外の人の評価結果を書き出せた。
 */
function inReviewScope(viewer: ExportViewer, row: { employeeId: string; managerId: string | null }): boolean {
  return canReviewEmployeeEvaluation(viewer.id, viewer.role, { employeeId: row.employeeId, managerId: row.managerId });
}

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
      employeeCode: mem.employeeCode,
      officeName: s.offices.name,
    })
    .from(s.formResponses)
    .leftJoin(s.users, eq(s.users.id, s.formResponses.employeeId))
    .leftJoin(mem, joinMembership(s.formResponses.companyId))
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

/* ───────────────── 2. 評価結果（23列＋7列） ───────────────── */

/**
 * 先頭の23列は現行のスプレッドシートの並びのまま（位置で読んでいる表を壊さない）。
 * 「昇格可否」は上司の判断を合わせた最終の結論にし、昇給の結論と、点数の判定・上司の判断・判断の理由を
 * 末尾に足す（backend の (20)・DD-024）。値は finalDecision を通した decisionCsvCells だけで作る。
 */
const RESULT_HEADERS = [
  "回答ID", "回答日時", "氏名", "ユーザーキー", "等級", "評価対象半期",
  "等級要件達成数", "目標上限数", "等級要件達成率",
  "行動指針得点", "行動指針基準点", "行動指針判定",
  "昇格要件達成数", "昇格要件総数", "昇格要件実施状況（項目別）", "昇格要件判定", "昇格可否",
  "KPI合計点", "評価可能配点", "KPI達成率", "KPI評価内訳・点数根拠", "HTML評価票URL", "内部JSON",
  "昇給", "昇給の点数の判定", "昇給の上司の判断", "昇給の判断の理由",
  "昇格の点数の判定", "昇格の上司の判断", "昇格の判断の理由",
];

/**
 * viewer は位置引数の必須にする（省略できると、渡し忘れたときに会社の全員分が出る。listEvaluations と同じ）。
 */
export async function buildResultsCsv(
  companyId: string,
  cycle: ExportCycle,
  origin: string,
  viewer: ExportViewer,
): Promise<CsvFile> {
  const db = await getDb();

  const all = await db
    .select({
      id: s.evaluations.id,
      employeeId: s.evaluations.employeeId,
      // 直属の上長かどうかは、この会社の所属で決める（canViewEmployee と同じ）
      managerId: mem.managerId,
      responseId: s.evaluations.responseId,
      computedAt: s.evaluations.computedAt,
      finalizedAt: s.evaluations.finalizedAt,
      employeeName: s.users.name,
      employeeCode: mem.employeeCode,
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
      raiseReason: s.evaluations.raiseReason,
      raiseDecision: s.evaluations.raiseDecision,
      raiseDecisionReason: s.evaluations.raiseDecisionReason,
      promotionDecision: s.evaluations.promotionDecision,
      promotionDecisionReason: s.evaluations.promotionDecisionReason,
      status: s.evaluations.status,
    })
    .from(s.evaluations)
    .leftJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .leftJoin(mem, joinMembership(s.evaluations.companyId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.cycleId, cycle.id)))
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name));
  // 範囲の外の人の評価は、項目・昇格要件を読む前に落とす
  const evals = all.filter((e) => inReviewScope(viewer, e));

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
    const finalized = e.status === "finalized";
    const [raise, raiseScore, raiseKind, raiseDecisionReason] = decisionCsvCells(finalDecisionOf("raise", e), {
      finalized,
      scoreReason: e.raiseReason,
      decisionReason: e.raiseDecisionReason,
    });
    const [promotion, promotionScore, promotionKind, promotionDecisionReason] = decisionCsvCells(
      finalDecisionOf("promotion", e),
      { finalized, scoreReason: e.promotionBlockedReason, decisionReason: e.promotionDecisionReason },
    );
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
      promotion,
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
      raise,
      raiseScore,
      raiseKind,
      raiseDecisionReason,
      promotionScore,
      promotionKind,
      promotionDecisionReason,
    ];
  });

  return { filename: `評価結果_${cycle.name}.csv`, csv: toCsv(RESULT_HEADERS, rows) };
}

/* ───────────────── 3. KPI明細（16列） ───────────────── */

const KPI_HEADERS = [
  "回答ID", "回答日時", "氏名", "等級", "評価対象半期", "KPI項目", "実績・計算",
  "分子", "分母", "算出値", "評価ランク（A〜E）", "獲得点数", "最大配点",
  "点数根拠（適用基準）", "計算根拠", "注記",
];

/** viewer は位置引数の必須（buildResultsCsv と同じ理由・同じ範囲）。 */
export async function buildKpiDetailCsv(companyId: string, cycle: ExportCycle, viewer: ExportViewer): Promise<CsvFile> {
  const db = await getDb();

  const all = await db
    .select({
      evaluationId: s.evaluations.id,
      employeeId: s.evaluations.employeeId,
      managerId: mem.managerId,
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
    .leftJoin(mem, joinMembership(s.evaluations.companyId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .where(and(eq(s.evaluationItems.companyId, companyId), eq(s.evaluations.cycleId, cycle.id)))
    .orderBy(asc(s.grades.displayOrder), asc(s.users.name), asc(s.evaluationItems.displayOrder));
  const rows = all.filter((r) => inReviewScope(viewer, r));

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

  return { filename: `KPI明細_${cycle.name}.csv`, csv: toCsv(KPI_HEADERS, body) };
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
      employeeCode: mem.employeeCode,
      role: mem.role,
      gradeName: s.grades.name,
      gradeOrder: s.grades.displayOrder,
      officeName: s.offices.name,
      department: mem.department,
      managerId: mem.managerId,
      hiredAt: mem.hiredAt,
      isActive: s.users.isActive,
    })
    .from(s.users)
    .innerJoin(mem, joinMembership(companyId))
    .leftJoin(s.grades, and(eq(s.grades.id, mem.gradeId), eq(s.grades.companyId, mem.companyId)))
    .leftJoin(s.offices, and(eq(s.offices.id, mem.officeId), eq(s.offices.companyId, mem.companyId)))
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
