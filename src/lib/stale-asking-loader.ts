import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { staleAskingItems, type StaleAsking } from "@/lib/domain/form-sync";

/**
 * 公開の前に、版の設問がいまの計算式の変数をそろえているかを読む（DD-016）。
 *
 * アンケートの一覧（公開ボタンを出すか）と公開の処理（actions/forms.ts の 409）は、ここだけを使う。
 * 片方だけ読み方が変わると、一覧では押せるのに公開で断る（またはその逆）ことになるため。判定は form-sync.ts。
 *
 * 評価セットは、公開の判定（loadSchemeReadiness）と同じく schemeIdForCycle で決めたものを受け取る（DD-024）。
 * 決まらなければ評価セットの不足として公開が止まるので、ここでは何も返さない。
 * 読み出しはすべて会社で絞る。
 */
export async function loadStaleAsking(
  companyId: string,
  schemeId: string | null,
  forms: readonly { id: string; gradeId: string }[],
): Promise<Map<string, StaleAsking[]>> {
  const out = new Map<string, StaleAsking[]>();
  if (!schemeId || forms.length === 0) return out;
  const db = await getDb();
  const [grades, schemeItems, formQuestions, kpiItems, templates] = await Promise.all([
    db
      .select({ id: s.grades.id, pointGroup: s.grades.pointGroup })
      .from(s.grades)
      .where(and(eq(s.grades.companyId, companyId), inArray(s.grades.id, forms.map((f) => f.gradeId)))),
    db
      .select({ pointGroup: s.schemeItems.pointGroup, kpiItemId: s.schemeItems.kpiItemId, isFixedSlot: s.schemeItems.isFixedSlot })
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.companyId, companyId), eq(s.schemeItems.schemeId, schemeId))),
    db
      .select({ formId: s.formQuestions.formId, kpiItemId: s.formQuestions.kpiItemId, kpiQuestionKey: s.formQuestions.kpiQuestionKey })
      .from(s.formQuestions)
      .where(and(eq(s.formQuestions.companyId, companyId), inArray(s.formQuestions.formId, forms.map((f) => f.id)))),
    db
      .select({ id: s.kpiItems.id, name: s.kpiItems.name, formula: s.kpiItems.formula })
      .from(s.kpiItems)
      .where(eq(s.kpiItems.companyId, companyId)),
    db
      .select({ kpiItemId: s.kpiQuestions.kpiItemId, questionKey: s.kpiQuestions.questionKey, targetGrades: s.kpiQuestions.targetGrades })
      .from(s.kpiQuestions)
      .where(eq(s.kpiQuestions.companyId, companyId)),
  ]);

  for (const form of forms) {
    const pointGroup = grades.find((g) => g.id === form.gradeId)?.pointGroup;
    if (!pointGroup) continue;
    const stale = staleAskingItems({
      pointGroup,
      schemeItems: schemeItems.filter((item) => item.pointGroup === pointGroup),
      formQuestions: formQuestions.filter((q) => q.formId === form.id),
      kpiItems,
      templates,
    });
    if (stale.length > 0) out.set(form.id, stale);
  }
  return out;
}
