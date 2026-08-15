/**
 * 要望1件を、開発の記録票（GitHub Issue）へ反映する。
 *
 * 呼ばれ方は2つあり、どちらもここを通る。
 *  - 詳細画面の「開発の記録票を作る」（1件）
 *  - 一覧の一括送信（画面が1件ずつ順番に呼ぶ）
 * 同じ処理を2箇所に書くと、片方だけ更新に対応した状態が生まれるので集約する。
 *
 * 二重に立てないための境界はサーバー側に置く。画面の二度押し抑止は補助にすぎず、
 * 2つの端末・2つのタブから同時に押される場面では効かない。ここでは
 * improvement_issue_links の主キーで「席取り」をしてから GitHub を呼ぶ。
 */

import { and, eq, lt, or } from "drizzle-orm";
import { getDb, schema as s, type DB } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { getImprovementForSync, listRelatedIssueLinks } from "@/lib/queries";
import { buildImprovementIssueDraft, improvementFingerprintOf } from "@/lib/improvement-issue-draft";
import {
  commentOnGithubIssue,
  createGithubIssue,
  IssueMaybeCreatedError,
  updateGithubIssue,
  type GithubIssueSettings,
} from "@/lib/github-issue";
import {
  changedFieldLabels,
  issueSyncNote,
  issueSyncState,
  issueUpdateComment,
  plannedAction,
  type BulkAction,
} from "@/lib/domain/improvement-sync";

export interface SyncResult {
  id: string;
  /** 一覧に出す見出し（要望の1行目）。押した人がどの行の結果かを見分けるため。 */
  label: string;
  action: BulkAction;
  issueNumber: number | null;
  issueUrl: string | null;
  reason: string;
}

/**
 * 席取りが古すぎて捨ててよいと判断するまでの時間。
 *
 * GitHub への1回の往復は長くても数秒。同時押しはその中で起きるので、
 * ここを短くしすぎると二重に立つ。長くしすぎると、失敗した行の送り直しが
 * その時間だけ待たされる。20秒はその間を取った値。
 */
const SEAT_STALE_MS = 20_000;

const SEAT_BUSY = "いま別の送信が進んでいます。20秒ほど待ってから送り直してください。";

function headline(body: string): string {
  const head = body.split("\n")[0].trim();
  return head.length > 40 ? `${head.slice(0, 40)}…` : head;
}

/** 例外を、押した人が次の一手を選べる文へ直す。 */
function failureReason(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return "予期しない失敗です。時間をおいて、この行だけ送り直してください。";
}

/**
 * 要望1件を記録票へ反映する。外へ出す前に必ず席を取り、取れた者だけが送る。
 */
export async function syncImprovementIssue(
  settings: GithubIssueSettings,
  viewer: { id: string; companyId: string },
  id: string,
): Promise<SyncResult> {
  const found = await getImprovementForSync(viewer.companyId, id);
  if (!found) throw new HttpError(404, "対象の要望が見つかりませんでした。");

  const { item, link } = found;
  const label = headline(item.body);

  // 廃棄したものは外へ出さない。まとめて選んだ中に混じっていても、
  // ここで必ず落とす（画面側の絞り込みだけに頼らない）。
  if (item.discarded) {
    return {
      id,
      label,
      action: "skipped",
      issueNumber: link?.issueNumber ?? null,
      issueUrl: link?.issueUrl ?? null,
      reason: "廃棄したものは記録票へ送りません。",
    };
  }

  const fingerprint = improvementFingerprintOf(item);
  const state = issueSyncState(link, fingerprint);
  const plan = plannedAction(state);

  if (plan === "skip") {
    return {
      id,
      label,
      action: "skipped",
      issueNumber: link?.issueNumber ?? null,
      issueUrl: link?.issueUrl ?? null,
      reason: issueSyncNote(state, link),
    };
  }

  const db = await getDb();

  if (plan === "update") {
    // link は state が update のときだけ通るので必ずある（issueSyncState の定義より）。
    const current = link as NonNullable<typeof link>;
    const draft = await buildImprovementIssueDraft(item, []);
    const changed = changedFieldLabels(current.contentFingerprint, fingerprint);
    try {
      const result = await updateGithubIssue(settings, current.issueNumber, {
        title: draft.title,
        body: draft.body,
        labels: draft.labels,
      });
      if (result.missing) {
        // 消された記録票をここで黙って作り直さない。番号が変わることは
        // 押した人に見えるべき事実なので、印だけ付けてもう一度押してもらう。
        await db
          .update(s.improvementIssueLinks)
          .set({ linkState: "missing" })
          .where(eq(s.improvementIssueLinks.requestId, id));
        return {
          id,
          label,
          action: "failed",
          issueNumber: current.issueNumber,
          issueUrl: current.issueUrl,
          reason: "GitHub 側に記録票がありません。もう一度送ると作り直します。",
        };
      }
      await commentOnGithubIssue(settings, current.issueNumber, issueUpdateComment(changed, new Date(), result.closed));
      await db
        .update(s.improvementIssueLinks)
        .set({ contentFingerprint: fingerprint, syncedAt: new Date(), issueUrl: result.url })
        .where(eq(s.improvementIssueLinks.requestId, id));
      return {
        id,
        label,
        action: "updated",
        issueNumber: current.issueNumber,
        issueUrl: result.url,
        reason: `変わったところ：${changed.join("・")}`,
      };
    } catch (error) {
      return {
        id,
        label,
        action: "failed",
        issueNumber: current.issueNumber,
        issueUrl: current.issueUrl,
        reason: failureReason(error),
      };
    }
  }

  // ここから先は新規作成（作り直しを含む）。まず席を取る。
  const seat = await takeSeat(db, id, settings.repo, viewer.id, plan === "recreate");
  if (!seat) {
    return { id, label, action: "skipped", issueNumber: link?.issueNumber ?? null, issueUrl: null, reason: SEAT_BUSY };
  }

  /*
   * 作った時点で「未対応 → 対応中」へ進めるので、記録票の文面も指紋も
   * 進めたあとの状態で作る。ここを送信前の状態のまま残すと、作った直後に
   * 「更新あり」と表示され、中身が同じままコメントだけが積み上がる。
   */
  const advanced = item.status === "open" ? { ...item, status: "doing" } : item;
  const advancedFingerprint = improvementFingerprintOf(advanced);

  try {
    const related = await listRelatedIssueLinks(viewer.companyId, item.routePattern, item.kind, item.id);
    const draft = await buildImprovementIssueDraft(advanced, related);
    const created = await createGithubIssue(settings, {
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
    });
    await db
      .update(s.improvementIssueLinks)
      .set({
        issueNumber: created.number,
        issueUrl: created.url,
        contentFingerprint: advancedFingerprint,
        syncedAt: new Date(),
        linkState: "ok",
      })
      .where(eq(s.improvementIssueLinks.requestId, id));

    // 未対応のまま置き去りにしないよう、作った時点で「対応中」へ進める。
    if (item.status === "open") {
      await db
        .update(s.improvementRequests)
        .set({ status: "doing", handledById: viewer.id })
        .where(and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, viewer.companyId)));
    }

    return {
      id,
      label,
      action: "created",
      issueNumber: created.number,
      issueUrl: created.url,
      reason: `記録票 #${created.number} を作りました。`,
    };
  } catch (error) {
    // GitHub へ届かなかった／断られたときは、席を空けてすぐ送り直せるようにする。
    // 作られた可能性が残る失敗（返事が読めなかった）だけは席を残し、
    // 20秒後に作り直せる状態にする。ここで空けると同じ票が2枚立つ。
    if (!(error instanceof IssueMaybeCreatedError)) {
      await db
        .delete(s.improvementIssueLinks)
        .where(and(eq(s.improvementIssueLinks.requestId, id), eq(s.improvementIssueLinks.issueNumber, 0)));
    }
    return { id, label, action: "failed", issueNumber: null, issueUrl: null, reason: failureReason(error) };
  }
}

/**
 * 送る前に席を取る。取れた者だけが GitHub を呼ぶ。
 *
 * 新規は主キーの衝突で、作り直しは「壊れている席」への条件付き更新で決める。
 * どちらも1文で判定するので、2つのリクエストが同時に来ても片方しか通らない。
 */
async function takeSeat(
  db: DB,
  requestId: string,
  repo: string,
  viewerId: string,
  recreate: boolean,
): Promise<boolean> {
  if (recreate) {
    const stale = new Date(Date.now() - SEAT_STALE_MS);
    const taken = await db
      .update(s.improvementIssueLinks)
      .set({ issueNumber: 0, issueUrl: "", linkState: "ok", createdAt: new Date(), createdById: viewerId })
      .where(
        and(
          eq(s.improvementIssueLinks.requestId, requestId),
          or(
            eq(s.improvementIssueLinks.linkState, "missing"),
            and(eq(s.improvementIssueLinks.issueNumber, 0), lt(s.improvementIssueLinks.createdAt, stale)),
          ),
        ),
      )
      .returning({ requestId: s.improvementIssueLinks.requestId });
    return taken.length > 0;
  }

  const taken = await db
    .insert(s.improvementIssueLinks)
    .values({
      requestId,
      repo,
      issueNumber: 0,
      issueUrl: "",
      contentFingerprint: "",
      linkState: "ok",
      createdById: viewerId,
    })
    .onConflictDoNothing({ target: s.improvementIssueLinks.requestId })
    .returning({ requestId: s.improvementIssueLinks.requestId });
  return taken.length > 0;
}
