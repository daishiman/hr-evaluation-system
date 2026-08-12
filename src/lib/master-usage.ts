import { and, eq, isNotNull } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { versionFamilyIds, type VersionedMasterRow } from "@/lib/domain/versioned-master";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * 制度設定の項目が「どこで使われているか」を数える。
 *
 * 画面（消せるかどうかの出し分け）と API（消してよいかの判定）が同じ根拠を見るために、
 * 数え方をここ1箇所に置く。画面側だけで判定すると、ボタンを出していないだけで
 * API を直接叩けば消せてしまう。
 *
 * 「使った」とみなすのは次の2つ。どちらも過去の記録なので、消すと中身が変わる。
 *   1. アンケートの設問になっている（下書きのアンケートも含む。作った設問は写しなので消せない）
 *   2. 評価の記録に残っている
 */

/** 項目のid → 使っている場所の呼び名。載っていない id は「どこでも使っていない」。 */
export type UsageMap = Record<string, string[]>;

/* evaluation_* は確認中の評価にも作られる。確定済みだけと誤解させない。 */
const EVALUATION_LABEL = "評価の記録";

function add(map: UsageMap, key: string | null, label: string) {
  if (!key) return;
  const list = (map[key] ??= []);
  if (!list.includes(label)) list.push(label);
}

const formLabel = (title: string) => `アンケート「${title}」`;

/** 版ごとの参照を、同じ論理項目の系譜全体へ広げる。 */
function usageByVersionFamily<T extends VersionedMasterRow>(rows: T[], exact: UsageMap): UsageMap {
  const out: UsageMap = {};
  for (const row of rows) {
    const labels: string[] = [];
    for (const id of versionFamilyIds(rows, row.id)) {
      for (const label of exact[id] ?? []) if (!labels.includes(label)) labels.push(label);
    }
    if (labels.length > 0) out[row.id] = labels;
  }
  return out;
}

/** 行動指針の観点の使用状況 */
export async function behaviorGuidelineUsage(db: Db, companyId: string): Promise<UsageMap> {
  const inForms = await db
    .select({ key: s.formQuestions.behaviorGuidelineId, title: s.forms.title })
    .from(s.formQuestions)
    .innerJoin(s.forms, eq(s.formQuestions.formId, s.forms.id))
    .where(and(eq(s.formQuestions.companyId, companyId), isNotNull(s.formQuestions.behaviorGuidelineId)));
  const inEvaluations = await db
    .select({ key: s.evaluationBehaviors.guidelineId })
    .from(s.evaluationBehaviors)
    .where(and(eq(s.evaluationBehaviors.companyId, companyId), isNotNull(s.evaluationBehaviors.guidelineId)));

  const map: UsageMap = {};
  for (const row of inForms) add(map, row.key, formLabel(row.title));
  for (const row of inEvaluations) add(map, row.key, EVALUATION_LABEL);
  return map;
}

/** 等級要件の使用状況 */
export async function gradeRequirementUsage(db: Db, companyId: string): Promise<UsageMap> {
  const [rows, inForms, inEvaluations] = await Promise.all([
    db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.companyId, companyId)),
    db
      .select({ key: s.formQuestions.gradeRequirementId, title: s.forms.title })
      .from(s.formQuestions)
      .innerJoin(s.forms, eq(s.formQuestions.formId, s.forms.id))
      .where(and(eq(s.formQuestions.companyId, companyId), isNotNull(s.formQuestions.gradeRequirementId))),
    db
      .select({ key: s.evaluationRequirements.gradeRequirementId })
      .from(s.evaluationRequirements)
      .where(and(eq(s.evaluationRequirements.companyId, companyId), isNotNull(s.evaluationRequirements.gradeRequirementId))),
  ]);

  const exact: UsageMap = {};
  for (const row of inForms) add(exact, row.key, formLabel(row.title));
  for (const row of inEvaluations) add(exact, row.key, EVALUATION_LABEL);
  return usageByVersionFamily(rows, exact);
}

/** 昇格要件の使用状況 */
export async function promotionRequirementUsage(db: Db, companyId: string): Promise<UsageMap> {
  const [rows, inForms, inEvaluations] = await Promise.all([
    db.select().from(s.promotionRequirements).where(eq(s.promotionRequirements.companyId, companyId)),
    db
      .select({ key: s.formQuestions.promotionRequirementId, title: s.forms.title })
      .from(s.formQuestions)
      .innerJoin(s.forms, eq(s.formQuestions.formId, s.forms.id))
      .where(and(eq(s.formQuestions.companyId, companyId), isNotNull(s.formQuestions.promotionRequirementId))),
    db
      .select({ key: s.evaluationGates.promotionRequirementId })
      .from(s.evaluationGates)
      .where(and(eq(s.evaluationGates.companyId, companyId), isNotNull(s.evaluationGates.promotionRequirementId))),
  ]);

  const exact: UsageMap = {};
  for (const row of inForms) add(exact, row.key, formLabel(row.title));
  for (const row of inEvaluations) add(exact, row.key, EVALUATION_LABEL);
  return usageByVersionFamily(rows, exact);
}

/**
 * 基準セットの使用状況（そのセットに入っている観点のどれかが使われていれば、セットも使用中）。
 *
 * 基準セットは外部キーではなく code の文字列で結ばれているため、データベースは
 * 削除を止めてくれない。数えるのはこちらの仕事になる。
 */
export function bandSetUsedBy(guidelineIds: readonly string[], usage: UsageMap): string[] {
  const places: string[] = [];
  for (const id of guidelineIds) {
    for (const place of usage[id] ?? []) if (!places.includes(place)) places.push(place);
  }
  return places;
}
