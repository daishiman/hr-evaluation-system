import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { copyCompanyMasters, findTemplateCompany } from "@/lib/template";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1, "会社名を入力してください").max(60),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンで入力してください"),
  businessType: z.string().max(40).optional(),
  adminName: z.string().min(1).max(60),
  adminEmail: z.string().email("メールアドレスの形式を確認してください"),
  adminPassword: z.string().min(8, "パスワードは8文字以上にしてください").max(72),
});

/**
 * 会社の追加（システム全体管理者のみ）。
 * 会社と同時に、その会社の管理者アカウントを1つ作り、
 * システム標準テンプレートの制度（等級・KPI・ランク基準・配点・昇給ルール）を丸ごと複製する。
 * 複製後は会社ごとに自由に書き換えられる（テンプレート側は変わらない）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    await apiViewer("SUPER_ADMIN");
    const body = createSchema.parse(await req.json());
    const db = await getDb();

    const dupSlug = await db.select({ id: s.companies.id }).from(s.companies).where(eq(s.companies.slug, body.slug)).limit(1);
    if (dupSlug.length > 0) throw new HttpError(400, "この会社IDはすでに使われています。別の文字にしてください。");
    const email = body.adminEmail.trim().toLowerCase();
    const dupUser = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1);
    if (dupUser.length > 0) throw new HttpError(400, "このメールアドレスはすでに登録されています。");

    const template = await findTemplateCompany(db);

    const companyId = newId("co");
    await db.insert(s.companies).values({
      id: companyId,
      name: body.name.trim(),
      slug: body.slug,
      businessType: body.businessType?.trim() || "給付事業",
      isActive: true,
      templateSourceId: template?.id ?? null,
    });

    // 制度のひな形を複製する（ひな形が無いときは空のまま作り、その旨を返す）
    const copied = template ? await copyCompanyMasters(db, template.id, companyId) : null;

    const userId = crypto.randomUUID();
    await db.insert(s.users).values({
      id: userId,
      name: body.adminName.trim(),
      email,
      emailVerified: true,
      companyId,
      role: "COMPANY_ADMIN",
      isActive: true,
    });
    await db.insert(s.accounts).values({
      id: newId("acc"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(body.adminPassword),
    });

    return {
      id: companyId,
      copied,
      message: copied
        ? `${body.name}を追加し、管理者アカウントを作りました。` +
          `標準の制度（等級${copied["等級"]}件・KPI項目${copied["KPI項目"]}件・ランク基準${copied["ランク基準"]}件・昇給額${copied["昇給額"]}件ほか）を写してあります。` +
          `内容は「等級・昇格・行動指針」の画面から、この会社だけ変更できます。`
        : `${body.name}を追加し、管理者アカウントを作りました。標準の制度が登録されていないため、制度（等級・KPI・配点）は管理者の画面から登録してください。`,
    };
  });
}

const patchSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(60).optional(),
  businessType: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
});

/** 会社の情報変更・利用停止。データは消さず停止で扱う。 */
export async function PATCH(req: Request) {
  return handle(async () => {
    await apiViewer("SUPER_ADMIN");
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const co = (await db.select().from(s.companies).where(eq(s.companies.id, body.companyId)).limit(1))[0];
    if (!co) throw new HttpError(404, "会社が見つかりませんでした。");

    const patch: Record<string, unknown> = {};
    for (const k of ["name", "businessType", "isActive"] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    await db.update(s.companies).set(patch).where(eq(s.companies.id, co.id));

    // 会社を止めたら、その会社の利用者もログインできない状態にする
    if (body.isActive === false) {
      await db.update(s.users).set({ isActive: false }).where(eq(s.users.companyId, co.id));
    }

    return {
      message:
        body.isActive === false
          ? `${co.name}を利用停止にしました。データは残っています。再開すると社員の再有効化が必要です。`
          : "会社の情報を保存しました。",
    };
  });
}
