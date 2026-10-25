"use server";

import { z } from "zod";
import { runAction, runRead } from "@/lib/action";
import { getDb } from "@/lib/db";
import { assertCompanyChosen } from "@/lib/session";
import { alignDraftForms } from "@/lib/form-align";

/**
 * 設定とずれた回答の無い下書きの一覧を見る（DD-028 の6）。何も書かない。
 * 返した planKey を、そろえるときに渡す。
 */
export async function previewFormAlignment(raw?: unknown) {
  return runRead({ operation: "forms.align", input: z.object({}).optional() }, raw, async ({ viewer }) => {
    assertCompanyChosen(viewer);
    const db = await getDb();
    const r = await alignDraftForms(db, { companyId: viewer.companyId, dryRun: true, actorId: viewer.id });
    return { message: r.message, planKey: r.planKey, items: r.items, failed: r.failed };
  });
}

/** 内容を見たときの一覧のとおりに、下書きと設定をそろえる。間に保存が入っていたら 409 で断る */
export async function applyFormAlignment(raw: unknown) {
  return runAction({ operation: "forms.align", input: z.object({ planKey: z.string().min(1) }) }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const db = await getDb();
    const r = await alignDraftForms(db, {
      companyId: viewer.companyId,
      dryRun: false,
      actorId: viewer.id,
      expectedPlanKey: input.planKey,
    });
    return { message: r.message };
  });
}
