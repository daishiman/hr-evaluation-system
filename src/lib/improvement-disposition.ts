/**
 * 要望を落とす（対応しない・重複・廃棄）／戻す／記録票とのひも付けを直す。
 *
 * 詳細画面の1件ずつの操作も、一覧のまとめ操作も、ここ1本を通る。
 * 2箇所に書くと、片方だけ理由を必須にし忘れた、片方だけ履歴を残さない、
 * といったずれが必ず出る。
 *
 * 順番は「先にアプリ側を確定 → そのあと GitHub」で固定する。
 * 外への操作が失敗しても、押した人の判断（対応しないと決めたこと）は残す。
 * 逆にすると、GitHub が混んでいるあいだ要望を1件も片付けられない。
 * ずれは一覧の記録票の列に出るので、あとから記録票だけ閉じ直せる。
 */

import { and, eq } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import { getImprovementForSync } from "@/lib/queries";
import { isImprovementStatus, type ImprovementStatus } from "@/lib/domain/improvement";
import {
  dispositionActionLabel,
  dispositionComment,
  dispositionNeedsReason,
  dispositionReasonError,
  reasonText,
  type DispositionAction,
} from "@/lib/domain/improvement-disposition";
import { closeGithubIssue, readGithubIssueState, type GithubIssueSettings } from "@/lib/github-issue";
import type { SyncResult } from "@/lib/improvement-issue-sync";
import type { BulkAction } from "@/lib/domain/improvement-sync";

export interface DispositionInput {
  action: DispositionAction;
  reasonCode: string;
  reasonNote: string;
  /** 記録票も一緒に閉じるか。既定は閉じない（外へ出る操作は選んだときだけ）。 */
  closeIssue: boolean;
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
 * 結果は一覧の結果表に並ぶ形（SyncResult）で返す。1件の失敗で例外を投げると、
 * まとめて実行したときに続きの行が動かないまま止まる。
 */
export async function applyDisposition(
  settings: GithubIssueSettings | null,
  viewer: { id: string; companyId: string },
  id: string,
  input: DispositionInput,
): Promise<SyncResult> {
  const reasonError = dispositionReasonError(input.action, input.reasonCode, input.reasonNote);
  if (reasonError) throw new HttpError(400, reasonError);

  const found = await getImprovementForSync(viewer.companyId, id);
  if (!found) throw new HttpError(404, "対象の要望が見つかりませんでした。");

  const { item, link } = found;
  const label = headline(item.body);
  const status: ImprovementStatus = isImprovementStatus(item.status) ? item.status : "open";
  const reason = reasonText(input.action, input.reasonCode, input.reasonNote);
  const db = await getDb();
  const where = and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, viewer.companyId));

  const done = (action: BulkAction, text: string): SyncResult => ({
    id,
    label,
    action,
    issueNumber: link?.issueNumber ?? null,
    issueUrl: link?.issueUrl ?? null,
    reason: text,
  });

  if (input.action === "unlink") {
    if (!link) return done("skipped", "記録票とのひも付けはありません。");
    await db.delete(s.improvementIssueLinks).where(eq(s.improvementIssueLinks.requestId, id));
    await addEvent(db, id, {
      action: "unlink",
      fromStatus: status,
      toStatus: status,
      reasonCode: null,
      reason: input.reasonNote.trim() || "記録票とのひも付けを外しました。",
      actorId: viewer.id,
    });
    // 記録票そのものは GitHub 側に残る（消せない）。作り直せる状態に戻すだけ。
    return {
      id,
      label,
      action: "unlinked",
      issueNumber: null,
      issueUrl: null,
      reason: `#${link.issueNumber} とのひも付けを外しました。`,
    };
  }

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

  if (input.action === "refresh" || input.action === "close-issue") {
    if (!link || link.issueNumber === 0) return done("skipped", "まだ記録票がありません。");
    if (!settings) throw new HttpError(503, "記録票の設定がありません。");

    if (input.action === "close-issue") {
      const result = await closeGithubIssue(settings, link.issueNumber, dispositionComment("reject", reason, true));
      if (result.missing) {
        await db.update(s.improvementIssueLinks).set({ linkState: "missing" }).where(eq(s.improvementIssueLinks.requestId, id));
        return done("failed", "GitHub 側に記録票がありません。ひも付けを外してください。");
      }
      await db.update(s.improvementIssueLinks).set({ issueState: "closed" }).where(eq(s.improvementIssueLinks.requestId, id));
      await addEvent(db, id, {
        action: "close-issue",
        fromStatus: status,
        toStatus: status,
        reasonCode: null,
        reason: `記録票 #${link.issueNumber} を閉じました。`,
        actorId: viewer.id,
      });
      return done("closed", `記録票 #${link.issueNumber} を閉じました。`);
    }

    const state = await readGithubIssueState(settings, link.issueNumber);
    if (state.missing) {
      await db.update(s.improvementIssueLinks).set({ linkState: "missing" }).where(eq(s.improvementIssueLinks.requestId, id));
      return done("failed", "GitHub 側に記録票がありません。ひも付けを外してください。");
    }
    await db
      .update(s.improvementIssueLinks)
      .set({ issueState: state.closed ? "closed" : "open" })
      .where(eq(s.improvementIssueLinks.requestId, id));

    // GitHub 側で先に閉じられていたら、アプリの対応状況もそこへ追いつかせる。
    // 追いついた事実は履歴に残るので、違っていれば「元に戻す」で戻せる。
    if (state.closed && (status === "open" || status === "doing")) {
      await db.update(s.improvementRequests).set({ status: "done", handledById: viewer.id }).where(where);
      await addEvent(db, id, {
        action: "refresh",
        fromStatus: status,
        toStatus: "done",
        reasonCode: null,
        reason: "記録票が閉じていたので完了にしました。",
        actorId: viewer.id,
      });
      return done("refreshed", "記録票が閉じていたので完了にしました。");
    }
    return done("refreshed", state.closed ? "記録票は閉じています。" : "記録票は開いています。");
  }

  /* ここから先は「落とす」操作（対応しない・重複・廃棄）。 */

  if (input.action === "duplicate") {
    if (!input.duplicateOfId) throw new HttpError(400, "統合先の要望を選んでください。");
    if (input.duplicateOfId === id) throw new HttpError(400, "同じ要望を統合先にはできません。");
    const target = await getImprovementForSync(viewer.companyId, input.duplicateOfId);
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
  const appReason = `${dispositionActionLabel(input.action)}にしました（${reason}）`;

  // ここから先の失敗は、アプリ側の判断を巻き戻さない（上のコメントの通り）。
  if (!input.closeIssue || !link || link.issueNumber === 0) return done(appResult, appReason);
  if (!settings) return done(appResult, `${appReason}。記録票は閉じていません。`);
  try {
    const closed = await closeGithubIssue(settings, link.issueNumber, dispositionComment(input.action, reason, true));
    if (closed.missing) {
      await db.update(s.improvementIssueLinks).set({ linkState: "missing" }).where(eq(s.improvementIssueLinks.requestId, id));
      return done(appResult, `${appReason}。記録票は見つかりませんでした。`);
    }
    await db.update(s.improvementIssueLinks).set({ issueState: "closed" }).where(eq(s.improvementIssueLinks.requestId, id));
    return done(appResult, `${appReason}。記録票 #${link.issueNumber} も閉じました。`);
  } catch (error) {
    const detail = error instanceof HttpError ? error.message : "記録票を閉じられませんでした。";
    return done(appResult, `${appReason}。${detail}`);
  }
}
