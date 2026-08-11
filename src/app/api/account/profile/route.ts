import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { getSelfProfile, listProfileFieldPolicies } from "@/lib/queries";
import { selfEditableFieldsForCompany, type SelfEditableField } from "@/lib/domain/profile-fields";

export const dynamic = "force-dynamic";

/**
 * 自分の登録内容を変更する。
 *
 * 変えられるのは、会社が「本人に開放する」と決めた項目だけ。
 * 役割・等級・上長はそもそもこの入口に無い（自分を管理者に昇格させる経路を作らない）。
 * 画面で入力欄を隠すだけでは足りないので、許可の判定はここで必ずやり直す。
 */
const bodySchema = z
  .object({
    name: z.string().min(1, "氏名を入力してください").max(60).optional(),
    department: z.string().max(60).nullable().optional(),
    employeeCode: z.string().max(30).nullable().optional(),
    hiredAt: z.iso.date("入社日は 2024-04-01 のような実在する日付で入力してください").nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    // SUPER_ADMIN の viewer.companyId は「操作対象の会社」なので、本人の所属会社とは限らない。
    // 画面と同じく users.company_id を読み、本人の実所属会社の設定だけを使う。
    const me = await getSelfProfile(viewer.id);
    if (!me) throw new HttpError(404, "利用者情報が見つかりませんでした。");
    const rows = me.companyId ? await listProfileFieldPolicies(me.companyId) : [];
    // 所属会社が無い場合は既定値（氏名のみ可）も適用しない。会社ポリシーの適用元が無いため。
    const allowed = new Set<SelfEditableField>(selfEditableFieldsForCompany(me.companyId, rows));

    const patch: Record<string, unknown> = {};
    const rejected: string[] = [];
    for (const key of ["name", "department", "employeeCode", "hiredAt"] as const) {
      if (body[key] === undefined) continue;
      if (!allowed.has(key)) {
        rejected.push(key);
        continue;
      }
      // 空文字は「消した」とみなす。氏名だけは空にできない（誰の記録か分からなくなるため）
      const value = typeof body[key] === "string" ? body[key].trim() : body[key];
      patch[key] = value === "" ? null : value;
    }

    // 許可項目と禁止項目を混ぜた要求を部分適用すると、呼び出し側が全件保存できたと誤認する。
    if (rejected.length > 0) {
      throw new HttpError(403, "この項目は会社の管理者だけが変更できます。変更が必要なときは会社の管理者にご相談ください。");
    }
    if (patch.name === null) throw new HttpError(400, "氏名を入力してください。");
    if (Object.keys(patch).length === 0) {
      return { message: "変更はありませんでした。" };
    }

    await db.update(s.users).set(patch).where(eq(s.users.id, viewer.id));
    return { message: "あなたの登録内容を保存しました。" };
  });
}
