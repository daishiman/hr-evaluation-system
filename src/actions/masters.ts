"use server";

import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { SELF_EDITABLE_FIELDS } from "@/lib/domain/profile-fields";
import { newId } from "@/lib/id";
import { applyMasterUpdate } from "@/lib/masters/apply-master-update";
import { bodySchema, deleteBodySchema } from "@/lib/masters/body-schema";
import { deleteMasterItem as removeMasterItem } from "@/lib/masters/delete-master-item";
import { assertCompanyChosen } from "@/lib/session";

/**
 * 制度マスタの変更・削除と、「本人が変更してよい項目」の設定（会社の管理者以上）。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、制度設定の画面は保存の応答と同時に新しくなる。
 */

/**
 * 制度マスタの変更（等級・昇格条件・昇給・要件・行動指針・ランク基準・KGI係数）。
 *
 * 制度の値をコードに書かないための入口。ここで保存した値が評価の計算に使われる。
 * 確定済みの評価は判定当時の値を持っているため、ここを変えても過去の結果は動かない。
 * 入力は kind ごとに分かれる1つの形（bodySchema）で受け、振り分けは applyMasterUpdate が行う。
 */
export async function saveMaster(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: bodySchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const db = await getDb();
    return applyMasterUpdate({
      db,
      companyId: viewer.companyId,
      viewerId: viewer.id,
      body: input,
    });
  });
}

/**
 * 制度マスタの項目を完全に消す。
 *
 * 消せるのは「一度もアンケートに出しておらず、評価の記録にも残っていないもの」だけ。
 * 一度でも使ったものは消さず「使わない」に留める（公開したアンケートと確定済みの
 * 評価を1文字も変えないため）。この判定はサーバー側で必ず行う。
 * 権限は変更と同じく制度設定を扱える人だけ。会社の境界は対象の取り出しで担保する。
 */
export async function deleteMasterItem(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: deleteBodySchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const db = await getDb();
    return removeMasterItem({ db, companyId: viewer.companyId, viewerId: viewer.id, body: input });
  });
}

/**
 * 「本人が変更してよい項目」の設定。会社の管理者以上だけが変えられる。
 *
 * 受け付けるのは SELF_EDITABLE_FIELDS にあるキーだけ。
 * 役割・等級・上長を混ぜて送られても、ここで存在しない項目として弾かれる。
 */
const profilePolicySchema = z
  .object({
    field: z.enum(SELF_EDITABLE_FIELDS),
    selfEditable: z.boolean(),
  })
  .strict();

export async function saveProfilePolicy(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: profilePolicySchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    await db
      .insert(s.profileFieldPolicies)
      .values({
        id: newId("pfp"),
        companyId,
        field: input.field,
        selfEditable: input.selfEditable,
      })
      .onConflictDoUpdate({
        target: [s.profileFieldPolicies.companyId, s.profileFieldPolicies.field],
        set: { selfEditable: input.selfEditable, updatedAt: new Date() },
      });

    return {
      message: input.selfEditable
        ? "この項目は、本人も自分で変更できるようになりました。"
        : "この項目は、会社の管理者だけが変更できるようになりました。",
    };
  });
}
