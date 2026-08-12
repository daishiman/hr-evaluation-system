import { and, desc, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { newId } from "@/lib/id";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * 制度マスタの実体種別。既存の各テーブルと1対1で対応する。
 * 等級要件・昇格要件は previous_version_id の版チェーンを持つが、
 * entityId には系譜の起点ID（lineageRootId）を使い、チェーン全体を1つの実体として追う。
 */
export type ConstitutionEntityType =
  | "grade"
  | "gradeRequirement"
  | "promotionRequirement"
  | "behaviorBandSet"
  | "behaviorGuideline"
  | "behaviorLevel"
  | "promotionThreshold"
  | "raiseSetting"
  | "raisePolicy"
  | "office"
  | "kpiRankCriteria"
  | "kgiCoefficient";

export type ConstitutionEventType =
  | "created"
  | "updated"
  | "activated"
  | "deactivated"
  | "revised"
  | "restored"
  | "reordered"
  | "deleted";

type Snapshot = Record<string, unknown>;

/** 変わった列だけを取り出す。null は「差分なし」を表す。 */
function diffColumns(before: Snapshot | null, after: Snapshot | null): [Snapshot | null, Snapshot | null] {
  if (!before) return [null, after];
  if (!after) return [before, null];
  const beforeDiff: Snapshot = {};
  const afterDiff: Snapshot = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    const changed = b instanceof Date || a instanceof Date ? String(b) !== String(a) : b !== a;
    if (changed) {
      beforeDiff[key] = b;
      afterDiff[key] = a;
    }
  }
  const hasBefore = Object.keys(beforeDiff).length > 0;
  const hasAfter = Object.keys(afterDiff).length > 0;
  return [hasBefore ? beforeDiff : null, hasAfter ? afterDiff : null];
}

/**
 * 制度マスタ1件の変更を、不変のイベントとして記録する。
 *
 * 呼び出し側は「変更前の全体」「変更後の全体」を渡すだけでよい。実際に変わった列だけを
 * このなかで抜き出して保存する（丸ごとの複製は持たない）。before/after のどちらも
 * 変わっていない場合（created/deleted を除く）は、意味のない行を増やさないため何もしない。
 */
export async function recordConstitutionEvent(args: {
  db: Db;
  companyId: string;
  entityType: ConstitutionEntityType;
  entityId: string;
  eventType: ConstitutionEventType;
  actorId: string | null;
  before?: Snapshot | null;
  after?: Snapshot | null;
}): Promise<void> {
  const { db, companyId, entityType, entityId, eventType, actorId } = args;
  const [beforeDiff, afterDiff] = diffColumns(args.before ?? null, args.after ?? null);

  if (eventType !== "created" && eventType !== "deleted" && beforeDiff === null && afterDiff === null) {
    return;
  }

  const last = (
    await db
      .select({ seq: s.constitutionEvents.seq })
      .from(s.constitutionEvents)
      .where(
        and(
          eq(s.constitutionEvents.companyId, companyId),
          eq(s.constitutionEvents.entityType, entityType),
          eq(s.constitutionEvents.entityId, entityId),
        ),
      )
      .orderBy(desc(s.constitutionEvents.seq))
      .limit(1)
  )[0];

  await db.insert(s.constitutionEvents).values({
    id: newId("cevt"),
    companyId,
    entityType,
    entityId,
    eventType,
    actorId,
    beforeJson: beforeDiff ? JSON.stringify(beforeDiff) : null,
    afterJson: afterDiff ? JSON.stringify(afterDiff) : null,
    seq: (last?.seq ?? 0) + 1,
  });
}

/**
 * イベント列を時系列に再生し、現在状態を導出する。
 *
 * 差分イベントを古い順に重ね合わせるだけで、対象の「いま」の内容を組み立てられることを
 * 保証する（＝スナップショットのテーブルを読まずに、イベントだけから状態を再構築できる）。
 * 最後のイベントが `deleted` なら、その実体はもう存在しないとして null を返す。
 */
export async function replayConstitutionEntity(args: {
  db: Db;
  companyId: string;
  entityType: ConstitutionEntityType;
  entityId: string;
}): Promise<Snapshot | null> {
  const { db, companyId, entityType, entityId } = args;
  const rows = await db
    .select()
    .from(s.constitutionEvents)
    .where(
      and(
        eq(s.constitutionEvents.companyId, companyId),
        eq(s.constitutionEvents.entityType, entityType),
        eq(s.constitutionEvents.entityId, entityId),
      ),
    )
    .orderBy(s.constitutionEvents.seq);

  if (rows.length === 0) return null;

  let state: Snapshot = {};
  let deleted = false;
  for (const row of rows) {
    if (row.eventType === "deleted") {
      deleted = true;
      continue;
    }
    deleted = false;
    if (row.afterJson) {
      state = { ...state, ...(JSON.parse(row.afterJson) as Snapshot) };
    }
  }
  return deleted ? null : state;
}

/** 会社の制度マスタ全体の変更履歴（画面の「変更履歴」表示や監査に使う）。新しい順。 */
export async function listConstitutionEvents(args: {
  db: Db;
  companyId: string;
  entityType?: ConstitutionEntityType;
  entityId?: string;
  limit?: number;
}) {
  const { db, companyId, entityType, entityId, limit = 200 } = args;
  const conditions = [eq(s.constitutionEvents.companyId, companyId)];
  if (entityType) conditions.push(eq(s.constitutionEvents.entityType, entityType));
  if (entityId) conditions.push(eq(s.constitutionEvents.entityId, entityId));
  return db
    .select()
    .from(s.constitutionEvents)
    .where(and(...conditions))
    .orderBy(desc(s.constitutionEvents.occurredAt), desc(s.constitutionEvents.seq))
    .limit(limit);
}
