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
  | "kgiCoefficient"
  | "kpiCategory"
  | "kpiItem";

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

type ConstitutionEventArgs = {
  db: Db;
  companyId: string;
  entityType: ConstitutionEntityType;
  entityId: string;
  eventType: ConstitutionEventType;
  actorId: string | null;
  before?: Snapshot | null;
  after?: Snapshot | null;
};

/**
 * 制度マスタ1件の変更を、append-only の監査記録として残すための INSERT 文を作る（まだ実行しない）。
 *
 * 呼び出し側は「変更前の全体」「変更後の全体」を渡すだけでよい。実際に変わった列だけを
 * このなかで抜き出して保存する（丸ごとの複製は持たない）。before/after のどちらも
 * 変わっていない場合（created/deleted を除く）は、意味のない行を増やさないため空の配列を返す。
 * 現在状態の正本は各制度マスタテーブルであり、この記録を状態復元の正本にしない。
 *
 * 返した文は、呼び出し側が本体の書き込みと同じ D1 batch に入れて実行する
 * （本体だけ書かれて記録が欠ける、を作らないため）。
 * 配列で返すのは、Drizzle の文が thenable で、async 関数から素のまま返すと実行されてしまうため。
 * seq は文を作る時点の最新値から採番するので、同じ実体の記録を1つの batch に2つ入れない
 * （入れると一意索引 uq_ce_entity_seq で batch ごと失敗する）。
 */
export async function constitutionEventStatements(args: ConstitutionEventArgs) {
  const { db, companyId, entityType, entityId, eventType, actorId } = args;
  const [beforeDiff, afterDiff] = diffColumns(args.before ?? null, args.after ?? null);

  if (eventType !== "created" && eventType !== "deleted" && beforeDiff === null && afterDiff === null) {
    return [];
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

  return [
    db.insert(s.constitutionEvents).values({
      id: newId("cevt"),
      companyId,
      entityType,
      entityId,
      eventType,
      actorId,
      beforeJson: beforeDiff ? JSON.stringify(beforeDiff) : null,
      afterJson: afterDiff ? JSON.stringify(afterDiff) : null,
      seq: (last?.seq ?? 0) + 1,
    }),
  ];
}

/**
 * D1/SQLite が返す原因チェーンから、監査記録の番号の一意索引（uq_ce_entity_seq）だけを判別する。
 * 同じ実体を2人が同時に保存したときに起きる。ほかの一意制約や通信エラーとは区別する。
 */
export function isConstitutionSeqConflict(error: unknown): boolean {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    } else {
      messages.push(String(current));
      break;
    }
  }
  const message = messages.join(" ");
  return (
    message.includes("uq_ce_entity_seq") ||
    (/unique constraint failed/i.test(message) &&
      message.includes("constitution_events.entity_id") &&
      message.includes("constitution_events.seq"))
  );
}

/**
 * 監査記録だけを単独で書く。本体の書き込みと原子的にしたいときは
 * constitutionEventStatements の文を同じ batch に入れる。
 */
export async function recordConstitutionEvent(args: ConstitutionEventArgs): Promise<void> {
  for (const statement of await constitutionEventStatements(args)) await statement;
}

/**
 * 監査記録を時系列に重ね、記録上の状態を診断用に導出する。
 *
 * 監査欠落や同一seqの競合があり得るため、返り値を現在状態の正本や復旧処理には使わない。
 * 最後の記録が `deleted` なら、記録上は存在しないものとして null を返す。
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
