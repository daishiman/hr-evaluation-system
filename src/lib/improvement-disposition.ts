/**
 * 要望を落とす（対応しない・重複・廃棄）／戻す。
 *
 * 詳細画面の1件ずつの操作も、一覧のまとめ操作も、ここ1本を通る。
 * 2箇所に書くと、片方だけ理由を必須にし忘れた、片方だけ履歴を残さない、
 * といったずれが必ず出る。
 *
 * 落とす判断は「行を消す」ではなく印を立てるだけにしてある。誤って落としても
 * 元に戻せるようにするためで、戻す先は履歴から読む（statusBeforeDiscard）。
 */

import { and, eq } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { getImprovementForHandout } from "@/lib/queries";
import { isImprovementStatus, type ImprovementStatus } from "@/lib/domain/improvement";
import {
  dispositionActionLabel,
  dispositionNeedsReason,
  dispositionReasonError,
  reasonText,
  type DispositionAction,
} from "@/lib/domain/improvement-disposition";
import type { HandoutResult } from "@/lib/improvement-handout-write";
import type { BulkAction } from "@/lib/domain/improvement-handout";

export interface DispositionInput {
  action: DispositionAction;
  reasonCode: string;
  reasonNote: string;
  /** 重複のときの統合先。 */
  duplicateOfId: string | null;
}

function headline(body: string): string {
  const head = body.split("\n")[0].trim();
  return head.length > 40 ? `${head.slice(0, 40)}…` : head;
}

/** 履歴は追記だけ。ここを更新にすると、前に落とした理由が上書きで消える。 */
async function addEvent(
  db: DB,
  requestId: string,
  event: {
    action: string;
    fromStatus: string;
    toStatus: string;
    reasonCode: string | null;
    reason: string | null;
    actorId: string;
  },
) {
  await db.insert(s.improvementStatusEvents).values({ id: newId("ise"), requestId, ...event });
}

/** 廃棄を戻すときの行き先。廃棄したときの記録から読む。 */
async function statusBeforeDiscard(db: DB, requestId: string, fallback: ImprovementStatus): Promise<ImprovementStatus> {
  const rows = await db
    .select({ fromStatus: s.improvementStatusEvents.fromStatus, action: s.improvementStatusEvents.action })
    .from(s.improvementStatusEvents)
    .where(eq(s.improvementStatusEvents.requestId, requestId))
    .orderBy(s.improvementStatusEvents.createdAt);
  const last = [...rows].reverse().find((r) => r.action === "discard" || r.action === "reject" || r.action === "duplicate");
  if (last && isImprovementStatus(last.fromStatus)) return last.fromStatus;
  return fallback;
}

/**
 * 落とす・戻す操作を1件ぶん行う。
 *
 * 結果は一覧の結果表に並ぶ形（HandoutResult）で返す。1件の失敗で例外を投げると、
 * まとめて実行したときに続きの行が動かないまま止まる。
 */
export async function applyDisposition(
  viewer: { id: string; companyId: string },
  id: string,
  input: DispositionInput,
): Promise<HandoutResult> {
  const reasonError = dispositionReasonError(input.action, input.reasonCode, input.reasonNote);
  if (reasonError) throw new HttpError(400, reasonError);

  const found = await getImprovementForHandout(viewer.companyId, id);
  if (!found) throw new HttpError(404, "対象の要望が見つかりませんでした。");

  const { item } = found;
  const label = headline(item.body);
  const status: ImprovementStatus = isImprovementStatus(item.status) ? item.status : "open";
  const reason = reasonText(input.action, input.reasonCode, input.reasonNote);
  const db = await getDb();
  const where = and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, viewer.companyId));

  const done = (action: BulkAction, text: string): HandoutResult => ({ id, label, action, reason: text });

  if (input.action === "restore") {
    if (item.discarded) {
      const back = await statusBeforeDiscard(db, id, status);
      await db.update(s.improvementRequests).set({ discardedAt: null, discardedById: null, discardReason: null, status: back }).where(where);
      await addEvent(db, id, {
        action: "restore",
        fromStatus: status,
        toStatus: back,
        reasonCode: null,
        reason: "廃棄を取り消しました。",
        actorId: viewer.id,
      });
      return done("restored", "廃棄を取り消し、元の状態に戻しました。");
    }
    if (item.duplicateOfId || status === "dropped") {
      const back = await statusBeforeDiscard(db, id, "open");
      await db.update(s.improvementRequests).set({ duplicateOfId: null, status: back }).where(where);
      await addEvent(db, id, {
        action: "restore",
        fromStatus: status,
        toStatus: back,
        reasonCode: null,
        reason: "落とした判断を取り消しました。",
        actorId: viewer.id,
      });
      return done("restored", "元の状態に戻しました。");
    }
    return done("skipped", "戻す操作はありません。");
  }

  /* ここから先は「落とす」操作（対応しない・重複・廃棄）。 */

  if (input.action === "duplicate") {
    if (!input.duplicateOfId) throw new HttpError(400, "統合先の要望を選んでください。");
    if (input.duplicateOfId === id) throw new HttpError(400, "同じ要望を統合先にはできません。");
    const target = await getImprovementForHandout(viewer.companyId, input.duplicateOfId);
    if (!target) throw new HttpError(404, "統合先の要望が見つかりませんでした。");
  }

  if (input.action === "discard") {
    if (item.discarded) return done("skipped", "すでに廃棄しています。");
    await db
      .update(s.improvementRequests)
      .set({ discardedAt: new Date(), discardedById: viewer.id, discardReason: reason })
      .where(where);
  } else {
    await db
      .update(s.improvementRequests)
      .set({
        status: "dropped",
        handledById: viewer.id,
        duplicateOfId: input.action === "duplicate" ? input.duplicateOfId : null,
      })
      .where(where);
  }

  await addEvent(db, id, {
    action: input.action,
    fromStatus: status,
    toStatus: input.action === "discard" ? status : "dropped",
    reasonCode: dispositionNeedsReason(input.action) ? input.reasonCode : null,
    reason,
    actorId: viewer.id,
  });

  const appResult: BulkAction = input.action === "discard" ? "discarded" : input.action === "duplicate" ? "duplicated" : "rejected";
  return done(appResult, `${dispositionActionLabel(input.action)}にしました（${reason}）`);
}
