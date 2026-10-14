"use server";

import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { activeCompanyCondition, activeMembershipFor } from "@/lib/memberships";
import { COMPANY_SCOPE_COOKIE, crossesCompanies, FORBIDDEN_MESSAGE, HttpError } from "@/lib/session";

const switchSchema = z.object({ companyId: z.string().min(1) });

const NOT_FOUND = "その会社は見つかりませんでした。";

/**
 * 操作する会社を切り替える（S7・D-004）。
 *
 * - システム全体管理者: 有効でテンプレートでない会社なら、どこへでも切り替えられる。
 * - それ以外の役割: 自分に有効な所属がある会社だけ（複数の会社に所属する人が使う）。
 * 通らないときは cookie を置かない。全体管理者は会社が無ければ 404。それ以外の役割は、
 * 会社があるかどうかを区別せずに 403 で返す（所属していない会社の有無を、返事から読み取らせない）。
 *
 * cookie が残っていても、所属の無い会社は getViewer が使わない（session.ts）。ここでの確認は、
 * 切り替えたつもりで別の会社の画面のままになるのを防ぐためのもの。
 *
 * 切り替えた結果の画面（会社の名前・一覧・メニュー）は、runAction の refresh() で
 * この返事と一緒に描き直される。
 */
export async function switchCompanyScope(raw: unknown) {
  return runAction({ operation: "companyScope.switch", input: switchSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();
    let name: string;
    if (crossesCompanies(viewer.role)) {
      const hit = await db
        .select({ name: s.companies.name })
        .from(s.companies)
        .where(and(eq(s.companies.id, input.companyId), activeCompanyCondition()))
        .limit(1);
      if (!hit[0]) throw new HttpError(404, NOT_FOUND);
      name = hit[0].name;
    } else {
      const membership = await activeMembershipFor(db, viewer.id, input.companyId);
      if (membership?.companyId !== input.companyId) throw new HttpError(403, FORBIDDEN_MESSAGE);
      name = membership.companyName;
    }

    const jar = await cookies();
    jar.set(COMPANY_SCOPE_COOKIE, input.companyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { message: `${name} に切り替えました。` };
  });
}
