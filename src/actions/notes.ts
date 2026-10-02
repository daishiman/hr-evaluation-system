"use server";

import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, canManageEmployee, HttpError } from "@/lib/session";
import { newId } from "@/lib/id";

const noteSchema = z.object({
  employeeId: z.string().min(1),
  body: z.string().min(1, "内容を入力してください").max(4000),
  visibility: z.enum(["manager", "admin"]).default("manager"),
  cycleId: z.string().nullish(),
});

/** 評価メモを残す。マネージャー以上のみ。本人には見せない。 */
export async function createNote(raw: unknown) {
  return runAction({ role: "MANAGER", input: noteSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    if (!(await canManageEmployee(viewer, input.employeeId))) {
      throw new HttpError(403, "この方のメモを書く権限がありません。");
    }

    const db = await getDb();
    const id = newId("note");
    await db.insert(s.employeeNotes).values({
      id,
      companyId: viewer.companyId,
      employeeId: input.employeeId,
      authorId: viewer.id,
      cycleId: input.cycleId ?? null,
      body: input.body,
      visibility: input.visibility,
    });
    return { id, message: "メモを保存しました。" };
  });
}
