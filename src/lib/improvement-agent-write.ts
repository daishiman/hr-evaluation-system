/**
 * 作業する側（Claude Code）が、終わったことを書き戻す。
 *
 * 書き戻せるのは自分が受け取った要望だけで、判断は全部サーバー側で行う。
 * 呼ぶ側が「この鍵で取った」と名乗っても信じない（名乗りは当てられる）。
 * 受け取った証跡は improvement_handout_events に既にあるので、それを唯一の
 * 根拠にする。ここが「自分のものか」を決める1箇所。
 *
 * 「対応済み」にするには公開先を必ず書かせる。直しただけ・テストが通っただけで
 * 完了にすると、直っていないものが一覧から消える。公開まで届かなかったときは
 * 「対応中」のまま理由だけを積む。
 */

import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/session";
import type { AgentCaller } from "@/lib/agent-api";
import { isImprovementStatus, type ImprovementStatus } from "@/lib/domain/improvement";
import {
  AGENT_NOT_FOUND_MESSAGE,
  agentResultAction,
  agentResultNote,
  canWriteImprovement,
  failedNoteError,
  releaseRefError,
  type AgentResult,
} from "@/lib/domain/agent-scope";

export interface AgentResultInput {
  result: AgentResult;
  /** done なら公開先、failed なら直しきれなかった理由。どちらも必須。 */
  detail: string;
}

export interface AgentResultOutcome {
  id: string;
  status: ImprovementStatus;
  message: string;
}

/** その鍵がこの要望を受け取っているか。払い出しの履歴だけを根拠にする。 */
async function claimedByKey(requestId: string, keyId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: s.improvementHandoutEvents.id })
    .from(s.improvementHandoutEvents)
    .where(
      and(eq(s.improvementHandoutEvents.requestId, requestId), eq(s.improvementHandoutEvents.keyId, keyId)),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * 結果を書き戻す。通すのは、権限・会社・受け取り済みの3つが揃ったときだけ。
 *
 * 記録は追記だけ（誰が＝どの鍵が・いつ・どの公開で）。あとから人が画面で
 * 差し戻せるように、変える前の状態も一緒に残す。
 */
export async function applyAgentResult(
  caller: AgentCaller,
  id: string,
  input: AgentResultInput,
): Promise<AgentResultOutcome> {
  const detailError =
    input.result === "done" ? releaseRefError(input.detail) : failedNoteError(input.detail);
  if (detailError) throw new HttpError(400, detailError);

  const db = await getDb();
  const row = (
    await db
      .select({
        id: s.improvementRequests.id,
        companyId: s.improvementRequests.companyId,
        status: s.improvementRequests.status,
        discardedAt: s.improvementRequests.discardedAt,
      })
      .from(s.improvementRequests)
      .where(eq(s.improvementRequests.id, id))
      .limit(1)
  )[0];
  // 見つからないのと他社のものとを言い分けない。IDの当てずっぽうに答えない。
  if (!row || row.discardedAt !== null) throw new HttpError(404, AGENT_NOT_FOUND_MESSAGE);

  const claimed = caller.keyId ? await claimedByKey(id, caller.keyId) : false;
  const gate = canWriteImprovement(caller, { companyId: row.companyId, claimedByThisKey: claimed });
  if (!gate.ok) throw new HttpError(gate.status, gate.message);

  const from: ImprovementStatus = isImprovementStatus(row.status) ? row.status : "open";
  const detail = input.detail.trim();
  const note = agentResultNote(input.result, detail, caller.keyLabel);

  // 公開まで届かなかったときは「対応済み」にしない。対応中のまま理由だけ残す。
  const to: ImprovementStatus = input.result === "done" ? "done" : "doing";

  await db
    .update(s.improvementRequests)
    .set({ status: to, handledNote: note })
    .where(and(eq(s.improvementRequests.id, id), eq(s.improvementRequests.companyId, row.companyId)));

  await db.insert(s.improvementStatusEvents).values({
    id: newId("ise"),
    requestId: id,
    action: agentResultAction(input.result),
    fromStatus: from,
    toStatus: to,
    reasonCode: null,
    reason: note,
    // 人ではなく鍵が変えたので、押した人は入らない。代わりに鍵を残す。
    actorId: null,
    keyId: caller.keyId,
    keyLabel: caller.keyLabel,
    releaseRef: input.result === "done" ? detail : null,
  });

  return {
    id,
    status: to,
    message:
      input.result === "done"
        ? "対応済みにしました。取り消すときは画面から差し戻せます。"
        : "対応中のまま、直しきれなかった理由を残しました。",
  };
}
