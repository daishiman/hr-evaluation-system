import { and, eq, ne } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Db } from "@/lib/form-build";
import { describeError } from "@/lib/api";
import { formDisplayTitle } from "@/lib/domain/grade-label";

export type FormRow = typeof s.forms.$inferSelect;
export type FormCandidate = { form: FormRow; cycle: typeof s.evaluationCycles.$inferSelect; gradeName: string | null };

/** 追従と整列が読む共通の候補。状態・回答の有無による処理の選択は呼ぶ側で決める。 */
export async function formCandidates(db: Db, companyId: string): Promise<FormCandidate[]> {
  return db
    .select({ form: s.forms, cycle: s.evaluationCycles, gradeName: s.grades.name })
    .from(s.forms)
    .innerJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.forms.cycleId))
    .leftJoin(s.grades, eq(s.grades.id, s.forms.gradeId))
    .where(and(eq(s.forms.companyId, companyId), ne(s.forms.status, "closed"), ne(s.evaluationCycles.status, "closed")));
}

/** 回答は下書きも含めて数える（formTransitions の hasResponses と同じ）。 */
export async function answeredFormIds(db: Db, companyId: string): Promise<Set<string>> {
  const rows = await db.select({ formId: s.formResponses.formId }).from(s.formResponses).where(eq(s.formResponses.companyId, companyId));
  return new Set(rows.map((row) => row.formId));
}

/** 結果の文に出すアンケートの名前（期・等級から作る）。 */
export function displayName(row: { form: FormRow; cycle: { name: string }; gradeName: string | null }): string {
  return formDisplayTitle(row.form, row.cycle, { name: row.gradeName });
}

export function compareFormCandidates(a: FormCandidate, b: FormCandidate): number {
  return a.cycle.periodStart.localeCompare(b.cycle.periodStart) || displayName(a).localeCompare(displayName(b)) || a.form.version - b.form.version;
}

/** 理由は結果の文の括弧に入れるので、文末の句点を落とす。 */
export const reasonOf = (error: unknown) => describeError(error).message.replace(/。$/, "");
