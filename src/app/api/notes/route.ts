import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, canViewEmployee, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  employeeId: z.string().min(1),
  body: z.string().min(1, "内容を入力してください").max(4000),
  visibility: z.enum(["manager", "admin"]).default("manager"),
  cycleId: z.string().nullish(),
});

/** 評価メモを残す。マネージャー以上のみ。本人には見せない。 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("MANAGER");
    const body = bodySchema.parse(await req.json());
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    if (!(await canViewEmployee(viewer, body.employeeId))) {
      throw new HttpError(403, "この方のメモを書く権限がありません。");
    }

    const db = await getDb();
    const id = newId("note");
    await db.insert(s.employeeNotes).values({
      id,
      companyId: viewer.companyId,
      employeeId: body.employeeId,
      authorId: viewer.id,
      cycleId: body.cycleId ?? null,
      body: body.body,
      visibility: body.visibility,
    });
    return { id, message: "メモを保存しました。" };
  });
}
