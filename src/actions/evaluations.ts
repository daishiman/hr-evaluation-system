"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, canManageEmployee, HttpError } from "@/lib/session";
import { isOwnEvaluation, SELF_EVALUATION_BLOCK_REASON } from "@/lib/domain/evaluation-authority";
import { commentProblem, DECISION_KINDS, validateDecisionInput } from "@/lib/domain/final-decision";
import { buildEvaluationsForCycle } from "@/lib/evaluate";
import { summarizeBuildResults } from "@/lib/domain/build-summary";
import { joinMembership } from "@/lib/memberships";

/** 会社ごとの値（上長など）の正本。users の同じ列は読まない（src/lib/memberships.ts） */
const mem = s.companyMemberships;

/**
 * 評価の確定・差し戻し・コメント保存と、提出済みの回答からの評価づくり（マネージャー以上）。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、評価の一覧と詳細は保存の応答と同時に新しくなる。
 */

const updateSchema = z.object({
  evaluationId: z.string().min(1),
  /** finalize = 確定して本人に公開 / reopen = 確認中に戻す / comment = コメントのみ保存 */
  action: z.enum(["finalize", "reopen", "comment"]),
  comment: z.string().max(2000).nullish(),
  /* 昇給と昇格への上司の判断（DD-024）。確定（finalize）のときだけ読む。
     中身の検査（選んだか・理由・長さ・本人に見せられない語）は validateDecisionInput に任せ、
     画面の「押せない理由」と同じ文で 400 を返す。ここで長さを切ると、画面と違う文になる。 */
  raiseDecision: z.enum(DECISION_KINDS).nullish(),
  raiseDecisionReason: z.string().nullish(),
  promotionDecision: z.enum(DECISION_KINDS).nullish(),
  promotionDecisionReason: z.string().nullish(),
});

/**
 * 評価の確定・差し戻し・コメント保存。
 * 確定すると本人の画面に結果が出る。確定を戻せるようにしてあるので、
 * 取り消しのきかない操作にはしていない。
 *
 * どの分岐も評価の1行だけを書き換える（1文）ので、batch にまとめるものはない。
 * 上司の判断は確定と同じ1文で書く。別々に書くと、確定だけ通って判断の無い確定が残りうる。
 * 確定を戻しても判断は消さない（もう一度確定するときの入力の初期値になる。qa-y12 (19)）。
 */
export async function updateEvaluation(raw: unknown) {
  return runAction({ operation: "evaluations.update", input: updateSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const id = input.evaluationId;
    const db = await getDb();

    const row = (
      await db
        .select()
        .from(s.evaluations)
        .where(and(eq(s.evaluations.id, id), eq(s.evaluations.companyId, viewer.companyId)))
        .limit(1)
    )[0];
    if (!row) throw new HttpError(404, "評価が見つかりませんでした。");

    // 自己承認を止める。画面でボタンを隠すだけだと、Server Action を直接呼べば通ってしまう。
    // 役割では判定しない（会社の管理者も自分自身の評価は同じく触れない）。
    if (isOwnEvaluation(viewer.id, row.employeeId)) throw new HttpError(403, SELF_EVALUATION_BLOCK_REASON);
    if (!(await canManageEmployee(viewer, row.employeeId))) {
      throw new HttpError(403, "この方の評価を変更する権限がありません。直属メンバーの評価を選んでください。");
    }

    /* 上長からのコメントは本人にもそのまま見える。本人向けの網に触れる語があれば保存せず、
       語を名指しして書き直してもらう（DD-023。表示のときに黙って差し替えない）。 */
    const evaluatorComment = input.action === "finalize" ? input.comment ?? row.evaluatorComment : input.comment ?? null;
    const commentIssue = input.action === "reopen" ? null : commentProblem(evaluatorComment);
    if (commentIssue) throw new HttpError(400, commentIssue);

    if (input.action === "comment") {
      await db.update(s.evaluations).set({ evaluatorComment }).where(eq(s.evaluations.id, id));
      return { message: "コメントを保存しました。" };
    }

    if (input.action === "finalize") {
      if (row.status === "finalized") return { message: "すでに確定済みです。" };
      const decision = validateDecisionInput(input);
      if (!decision.ok) throw new HttpError(400, decision.problems.join("\n"));
      const now = new Date();
      await db
        .update(s.evaluations)
        .set({
          status: "finalized",
          finalizedAt: now,
          evaluatorId: viewer.id,
          evaluatorComment,
          ...decision.value,
          decisionRecordedBy: viewer.id,
          decisionRecordedAt: now,
        })
        .where(eq(s.evaluations.id, id));
      return { message: "確定しました。本人の画面に結果が表示されます。" };
    }

    await db
      .update(s.evaluations)
      .set({ status: "draft", finalizedAt: null })
      .where(eq(s.evaluations.id, id));
    return { message: "確認中に戻しました。本人の画面からは見えなくなります。" };
  });
}

const buildSchema = z.object({
  cycleId: z.string().min(1),
  /** 指定するとその人だけ集計し直す。省略するとサイクル全員（提出済みの回答があるひと）。 */
  employeeIds: z.array(z.string().min(1)).max(500).optional(),
});

/**
 * 提出済みの回答から評価を作る／作り直す。
 *
 * 集計そのものは `buildEvaluationsForCycle` に任せる（ここに計算を書かない）。
 * その中で、確定済みの評価は計算せず据え置き、理由を結果に載せて返す。
 * 確定済みを動かさないのは制度上の約束なので、ここでも結果の件数を数えて画面に出す。
 * 1人ぶんの書き込み（古い評価の削除・評価本体・根拠行）は、集計処理の中で
 * 1つの batch にまとめてある。ある人の途中で止まっても、その人の書きかけは残らない。
 *
 * 誰が実行できるか: マネージャー以上。評価を作るのは評価する側の仕事で、
 * 画面（/manager/cycles、/manager/evaluations/[id]）と同じ範囲にそろえている。
 * 会社の境界は viewer.companyId で閉じる（サイクルIDを他社のものにしても届かない）。
 *
 * 管理者は自社分、マネージャーは直属メンバーだけを集計する。集計は提出済みの回答と
 * 会社のマスタから機械的に決まるが、裁量が入る「確定して本人に公開する」は、
 * どの役割でも自分自身の分を塞いである（src/lib/domain/evaluation-authority.ts）。
 */
export async function buildEvaluations(raw: unknown) {
  return runAction({ operation: "evaluations.build", input: buildSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const db = await getDb();

    const cycle = (
      await db
        .select()
        .from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.id, input.cycleId), eq(s.evaluationCycles.companyId, viewer.companyId)))
        .limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "その評価期間は見つかりませんでした。");

    let employeeIds = input.employeeIds;
    if (viewer.role === "MANAGER") {
      // 直属メンバー＝この会社での所属の上長が自分の人（上長は会社ごとに違う）
      const assigned = await db
        .select({ id: s.users.id })
        .from(s.users)
        .innerJoin(mem, joinMembership(viewer.companyId))
        .where(eq(mem.managerId, viewer.id));
      const assignedIds = new Set(assigned.map((employee) => employee.id));
      if (employeeIds?.some((employeeId) => !assignedIds.has(employeeId))) {
        throw new HttpError(403, "直属メンバー以外の評価は集計できません。");
      }
      employeeIds = employeeIds ?? [...assignedIds];
    }

    const results = await buildEvaluationsForCycle(viewer.companyId, cycle.id, viewer.id, {
      employeeIds,
    });

    return { message: summarizeBuildResults(results), results };
  });
}
