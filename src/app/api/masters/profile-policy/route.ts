import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { SELF_EDITABLE_FIELDS } from "@/lib/domain/profile-fields";

export const dynamic = "force-dynamic";

/**
 * 「本人が変更してよい項目」の設定。会社の管理者以上だけが変えられる。
 *
 * 受け付けるのは SELF_EDITABLE_FIELDS にあるキーだけ。
 * 役割・等級・上長を混ぜて送られても、ここで存在しない項目として弾かれる。
 */
const bodySchema = z
  .object({
    field: z.enum(SELF_EDITABLE_FIELDS),
    selfEditable: z.boolean(),
  })
  .strict();

export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "対象の会社が選ばれていません。");
    const companyId = viewer.companyId;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    await db
      .insert(s.profileFieldPolicies)
      .values({
        id: newId("pfp"),
        companyId,
        field: body.field,
        selfEditable: body.selfEditable,
      })
      .onConflictDoUpdate({
        target: [s.profileFieldPolicies.companyId, s.profileFieldPolicies.field],
        set: { selfEditable: body.selfEditable, updatedAt: new Date() },
      });

    return {
      message: body.selfEditable
        ? "この項目は、本人も自分で変更できるようになりました。"
        : "この項目は、会社の管理者だけが変更できるようになりました。",
    };
  });
}
