import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, COMPANY_SCOPE_COOKIE, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ companyId: z.string().min(1) });

/**
 * システム全体管理者が操作対象の会社を切り替える。
 *
 * 切り替えられるのはシステム全体管理者だけ。他のロールは自分の会社に固定されるので、
 * このAPIを直接叩いても表示は変わらない（会社の絞り込みは session.ts 側で決めている）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    if (viewer.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "会社を切り替えられるのはシステム全体管理者だけです。");
    }
    const { companyId } = bodySchema.parse(await req.json());

    const db = await getDb();
    const hit = await db
      .select({ id: s.companies.id, name: s.companies.name })
      .from(s.companies)
      .where(eq(s.companies.id, companyId))
      .limit(1);
    if (!hit[0]) throw new HttpError(404, "その会社は見つかりませんでした。");

    const jar = await cookies();
    jar.set(COMPANY_SCOPE_COOKIE, companyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { message: `${hit[0].name} に切り替えました。` };
  });
}
