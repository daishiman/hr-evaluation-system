import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { summarizeSubmissions, type SubmissionCounts } from "@/lib/domain/submission-status";
import { joinMembership } from "@/lib/memberships";

/**
 * 提出状況（S8・A7）の読み取り。対象者と回答を読み、突き合わせは submission-status.ts に任せる。
 *
 * 対象者は「その等級に在籍している（利用停止でない）人」。利用停止の人を外すのは表示だけで、
 * 提出済みの回答・作った評価はそのまま残る。
 * 会社・等級・事業所・社員番号・部署は、その会社の所属（company_memberships）から読む。
 * 1人が複数の会社に所属するので、users の同じ列（元の所属の写し）は読まない（src/lib/memberships.ts）。
 * 利用停止かどうかは利用者全体の値なので users から読む。
 */

/** 会社ごとの値の正本 */
const mem = s.companyMemberships;

/** アンケート1本の対象者全員の行（回答一覧の画面用）。アンケートが無ければ null */
export async function listFormSubmissionRows(companyId: string, formId: string) {
  const db = await getDb();
  const form = (
    await db
      .select({ id: s.forms.id, gradeId: s.forms.gradeId })
      .from(s.forms)
      .where(and(eq(s.forms.companyId, companyId), eq(s.forms.id, formId)))
      .limit(1)
  )[0];
  if (!form) return null;

  const [targets, responses] = await Promise.all([
    db
      .select({
        employeeId: s.users.id,
        name: s.users.name,
        employeeCode: mem.employeeCode,
        department: mem.department,
        officeName: s.offices.name,
      })
      .from(s.users)
      .innerJoin(mem, joinMembership(companyId))
      .leftJoin(s.offices, and(eq(s.offices.id, mem.officeId), eq(s.offices.companyId, mem.companyId)))
      .where(and(eq(mem.gradeId, form.gradeId), eq(s.users.isActive, true)))
      .orderBy(asc(s.users.name)),
    db
      .select({
        id: s.formResponses.id,
        employeeId: s.formResponses.employeeId,
        status: s.formResponses.status,
        submittedAt: s.formResponses.submittedAt,
        importSource: s.formResponses.importSource,
      })
      .from(s.formResponses)
      .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.formId, form.id))),
  ]);
  return summarizeSubmissions(targets, responses);
}

/** 評価期間のアンケートごとの件数（アンケートの一覧の画面用）。キーはアンケートのID */
export async function listFormSubmissionCounts(
  companyId: string,
  cycleId: string,
): Promise<Map<string, SubmissionCounts>> {
  const db = await getDb();
  const forms = await db
    .select({ id: s.forms.id, gradeId: s.forms.gradeId })
    .from(s.forms)
    .where(and(eq(s.forms.companyId, companyId), eq(s.forms.cycleId, cycleId)));
  if (forms.length === 0) return new Map();

  const [members, responses] = await Promise.all([
    db
      .select({ employeeId: s.users.id, gradeId: mem.gradeId })
      .from(s.users)
      .innerJoin(mem, joinMembership(companyId))
      .where(and(inArray(mem.gradeId, [...new Set(forms.map((f) => f.gradeId))]), eq(s.users.isActive, true))),
    db
      .select({
        formId: s.formResponses.formId,
        employeeId: s.formResponses.employeeId,
        status: s.formResponses.status,
        submittedAt: s.formResponses.submittedAt,
      })
      .from(s.formResponses)
      .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.cycleId, cycleId))),
  ]);
  return new Map(
    forms.map((form) => [
      form.id,
      summarizeSubmissions(
        members.filter((m) => m.gradeId === form.gradeId),
        responses.filter((r) => r.formId === form.id),
      ).counts,
    ]),
  );
}

/**
 * 評価期間の対象者全員の行（マネージャーの評価期間の画面用）。
 * 対象者は、その期間にアンケートがある等級の人。回答はどの版のアンケートへのものでも数え、
 * 提出済みがあれば最後に提出したものを状態の元にする（評価に使う回答と同じ考え方）。
 */
export async function listCycleSubmissionRows(companyId: string, cycleId: string) {
  const db = await getDb();
  const forms = await db
    .select({ gradeId: s.forms.gradeId })
    .from(s.forms)
    .where(and(eq(s.forms.companyId, companyId), eq(s.forms.cycleId, cycleId)));
  if (forms.length === 0) return summarizeSubmissions([], []);

  const [targets, responses] = await Promise.all([
    db
      .select({ employeeId: s.users.id, name: s.users.name, gradeName: s.grades.name })
      .from(s.users)
      .innerJoin(mem, joinMembership(companyId))
      .leftJoin(s.grades, and(eq(s.grades.id, mem.gradeId), eq(s.grades.companyId, mem.companyId)))
      .where(and(inArray(mem.gradeId, [...new Set(forms.map((f) => f.gradeId))]), eq(s.users.isActive, true)))
      .orderBy(asc(s.users.name)),
    db
      .select({
        id: s.formResponses.id,
        employeeId: s.formResponses.employeeId,
        status: s.formResponses.status,
        submittedAt: s.formResponses.submittedAt,
      })
      .from(s.formResponses)
      .where(and(eq(s.formResponses.companyId, companyId), eq(s.formResponses.cycleId, cycleId))),
  ]);
  return summarizeSubmissions(targets, responses);
}
