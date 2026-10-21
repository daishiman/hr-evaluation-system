"use server";

import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { assertCompanyChosen, canManageEmployee, HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import {
  NOTE_VISIBILITIES,
  NOTE_VISIBILITY_BLOCK_REASON,
  readableNoteVisibilities,
} from "@/lib/domain/evaluation-authority";

const noteSchema = z.object({
  employeeId: z.string().min(1),
  body: z.string().min(1, "内容を入力してください").max(4000),
  // 取る値は読み出しの絞り込み（readableNoteVisibilities）と同じ1か所から引く
  visibility: z.enum(NOTE_VISIBILITIES).default("manager"),
  cycleId: z.string().nullish(),
});

/**
 * 評価メモを残す。マネージャー以上のみ。社員本人には見せない（社員は個人詳細を開けない）。
 * 自分の個人詳細を開いた管理者・マネージャーに、自分についてのメモが見える件は SECURITY-013。
 */
export async function createNote(raw: unknown) {
  return runAction({ operation: "notes.create", input: noteSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    // 書ける公開範囲は読める公開範囲と同じ（自分が読めない段階のメモは書けない）。
    // 画面は選べない段階を出さないので、ここに来るのは古い画面か直接の呼び出し
    if (!readableNoteVisibilities(viewer.role).includes(input.visibility)) {
      throw new HttpError(403, NOTE_VISIBILITY_BLOCK_REASON);
    }
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
