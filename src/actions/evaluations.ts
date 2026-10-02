"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, canManageEmployee, HttpError } from "@/lib/session";
import { isOwnEvaluation, SELF_EVALUATION_BLOCK_REASON } from "@/lib/domain/evaluation-authority";
import { buildEvaluationsForCycle } from "@/lib/evaluate";
import { summarizeBuildResults } from "@/lib/domain/build-summary";

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
});

/**
 * 評価の確定・差し戻し・コメント保存。
 * 確定すると本人の画面に結果が出る。確定を戻せるようにしてあるので、
 * 取り消しのきかない操作にはしていない。
 *
 * どの分岐も評価の1行だけを書き換える（1文）ので、batch にまとめるものはない。
 */
export async function updateEvaluation(raw: unknown) {
  return runAction({ role: "MANAGER", input: updateSchema }, raw, async ({ viewer, input }) => {
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

    if (input.action === "comment") {
      await db.update(s.evaluations).set({ evaluatorComment: input.comment ?? null }).where(eq(s.evaluations.id, id));
      return { message: "コメントを保存しました。" };
    }

    if (input.action === "finalize") {
      if (row.status === "finalized") return { message: "すでに確定済みです。" };
      await db
        .update(s.evaluations)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          evaluatorId: viewer.id,
          evaluatorComment: input.comment ?? row.evaluatorComment,
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
 * 自分自身の評価も集計の対象に含める。集計は提出済みの回答と会社のマスタから
 * 機械的に決まるもので、本人の裁量が入らないため。裁量が入る「確定して本人に公開する」
 * だけは、自分自身の分を塞いである（src/lib/domain/evaluation-authority.ts）。
 */
export async function buildEvaluations(raw: unknown) {
  return runAction({ role: "MANAGER", input: buildSchema }, raw, async ({ viewer, input }) => {
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
      const assigned = await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(and(eq(s.users.companyId, viewer.companyId), eq(s.users.managerId, viewer.id)));
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
