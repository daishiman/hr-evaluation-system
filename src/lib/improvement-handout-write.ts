/**
 * 要望1件を「払い出し済み」として記録する。
 *
 * 呼ばれ方は3つあり、どれもここを通る。
 *  - 詳細画面の「指示文を払い出す」（1件）
 *  - 一覧のまとめて払い出し（画面が1件ずつ順番に呼ぶ）
 *  - 作業する側が API で受け取ったとき（実際に渡った瞬間）
 * 同じ処理を分けて書くと、片方だけ日時が入る状態が生まれるので集約する。
 *
 * 外へ出す通信が無くなったので、席取りも作り直しも要らない。
 * 控えの保存と状態の更新は同じ1回の保存で終わり、途中で止まる隙間がない。
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { getImprovementForHandout } from "@/lib/queries";
import { improvementFingerprintOf, type FingerprintSource } from "@/lib/improvement-instruction-draft";
import {
  HANDOUT_HISTORY_MAX,
  handoutNote,
  handoutState,
  plannedAction,
  type BulkAction,
} from "@/lib/domain/improvement-handout";

/**
 * 誰が渡したのか。画面から押したときと、API で取りに来たときで別物にする。
 * 同じ1件として記録すると、コピーしただけと実際に渡ったのが区別できなくなる。
 */
export type HandoutSource =
  | { via: "screen"; actorId: string }
  | { via: "api"; keyId: string | null; keyLabel: string | null };

export interface HandoutResult {
  id: string;
  /** 一覧に出す見出し（要望の1行目）。押した人がどの行の結果かを見分けるため。 */
  label: string;
  action: BulkAction;
  reason: string;
}

function headline(body: string): string {
  const head = body.split("\n")[0].trim();
  return head.length > 40 ? `${head.slice(0, 40)}…` : head;
}

/**
 * 履歴を積み、あふれた古い行を落とす。
 *
 * 上限は「1件の要望につき何行残すか」で決める。全体の行数で切ると、
 * よく直す要望の履歴が、無関係な要望の増加で消えることになる。
 */
async function pushHistory(
  db: DB,
  requestId: string,
  source: HandoutSource,
): Promise<void> {
  await db.insert(s.improvementHandoutEvents).values({
    id: newId("ihe"),
    requestId,
    via: source.via,
    keyId: source.via === "api" ? source.keyId : null,
    keyLabel: source.via === "api" ? source.keyLabel : null,
    actorId: source.via === "screen" ? source.actorId : null,
  });

  const stale = await db
    .select({ id: s.improvementHandoutEvents.id })
    .from(s.improvementHandoutEvents)
    .where(eq(s.improvementHandoutEvents.requestId, requestId))
    .orderBy(desc(s.improvementHandoutEvents.createdAt), desc(s.improvementHandoutEvents.id))
    .limit(HANDOUT_HISTORY_MAX * 10)
    .offset(HANDOUT_HISTORY_MAX);
  if (stale.length > 0) {
    await db.delete(s.improvementHandoutEvents).where(
      inArray(
        s.improvementHandoutEvents.id,
        stale.map((r) => r.id),
      ),
    );
  }
}

/**
 * 控えを残し、履歴を1件積み、未対応なら対応中へ進める。
 *
 * 指紋は「進めたあとの状態」で作る。送信前の状態のまま残すと、渡した直後に
 * 「更新あり」と表示され、中身が同じものを何度も渡すことになる。
 * 「更新あり」は、この最後の払い出し時点の内容とだけ比べる。
 *
 * source は渡した経路。API で受け取ったときは人と結び付かないので、
 * 代わりに使われた鍵を残す（誰も分からない、にはしない）。
 */
export async function recordHandout(
  db: DB,
  item: FingerprintSource & { id: string },
  source: HandoutSource,
): Promise<void> {
  const advanced = item.status === "open" ? { ...item, status: "doing" } : item;
  const fingerprint = improvementFingerprintOf(advanced);
  const now = new Date();
  const byId = source.via === "screen" ? source.actorId : null;

  await db
    .insert(s.improvementHandouts)
    .values({
      requestId: item.id,
      contentFingerprint: fingerprint,
      handedOutAt: now,
      handedOutById: byId,
      handoutCount: 1,
    })
    .onConflictDoUpdate({
      target: s.improvementHandouts.requestId,
      set: {
        contentFingerprint: fingerprint,
        handedOutAt: now,
        handedOutById: byId,
        // 通算の回数は積み上げる。履歴は古い分を丸めるので、行数からは数えられない。
        handoutCount: sql`${s.improvementHandouts.handoutCount} + 1`,
      },
    });

  await pushHistory(db, item.id, source);

  // 未対応のまま置き去りにしないよう、渡した時点で「対応中」へ進める。
  if (item.status === "open") {
    await db
      .update(s.improvementRequests)
      .set(byId ? { status: "doing", handledById: byId } : { status: "doing" })
      .where(and(eq(s.improvementRequests.id, item.id), eq(s.improvementRequests.status, "open")));
  }
}

/**
 * 画面から1件を払い出す。廃棄済みと、内容が変わっていないものは渡さない。
 */
export async function handOutImprovement(
  viewer: { id: string; companyId: string },
  id: string,
): Promise<HandoutResult> {
  const found = await getImprovementForHandout(viewer.companyId, id);
  if (!found) throw new HttpError(404, "対象の要望が見つかりませんでした。");

  const { item, handout } = found;
  const label = headline(item.body);

  // 廃棄したものは渡さない。まとめて選んだ中に混じっていても、
  // ここで必ず落とす（画面側の絞り込みだけに頼らない）。
  if (item.discarded) {
    return { id, label, action: "skipped", reason: "廃棄したものは払い出しません。" };
  }

  const state = handoutState(handout, improvementFingerprintOf(item));
  const plan = plannedAction(state);
  if (plan === "skip") {
    return { id, label, action: "skipped", reason: handoutNote(state) };
  }

  const db = await getDb();
  await recordHandout(db, item, { via: "screen", actorId: viewer.id });
  return {
    id,
    label,
    action: plan === "handout" ? "handed" : "rehanded",
    reason: plan === "handout" ? "指示文を払い出しました。" : "最新の内容で払い出し直しました。",
  };
}
