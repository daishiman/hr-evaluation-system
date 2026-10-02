"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { COMPANY_SCOPE_COOKIE, HttpError } from "@/lib/session";

const switchSchema = z.object({ companyId: z.string().min(1) });

/**
 * システム全体管理者が操作対象の会社を切り替える。
 *
 * 切り替えられるのはシステム全体管理者だけ。他のロールは入口（runAction の role）で 403 になる。
 * 仮に cookie が置かれても、他のロールは自分の会社に固定される（会社の絞り込みは session.ts 側で決めている）。
 *
 * 切り替えた結果の画面（会社の名前・一覧・メニュー）は、runAction の refresh() で
 * この返事と一緒に描き直される。
 */
export async function switchCompanyScope(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: switchSchema }, raw, async ({ input }) => {
    const db = await getDb();
    const hit = await db
      .select({ id: s.companies.id, name: s.companies.name })
      .from(s.companies)
      .where(eq(s.companies.id, input.companyId))
      .limit(1);
    if (!hit[0]) throw new HttpError(404, "その会社は見つかりませんでした。");

    const jar = await cookies();
    jar.set(COMPANY_SCOPE_COOKIE, input.companyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { message: `${hit[0].name} に切り替えました。` };
  });
}
