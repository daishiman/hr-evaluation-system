import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * ログインの設定。
 *
 * メールアドレス + パスワードで認証する。Google ログインは accounts テーブルを
 * そのまま使えるようにしてあるが、OAuth クライアントを用意できないため今回は未使用
 * （docs/product/backlog.md に残課題として記録）。
 */
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = drizzle(env.DB, { schema });

  // 秘密鍵が未設定のまま動くと、セッションを偽造できる状態になる。
  // 既定値で動かさず、はっきり止める。
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET が設定されていません。wrangler secret put で設定してください。");
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      // 社内利用のため、アカウントは管理者が発行する（本人登録は開けない）
      disableSignUp: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        companyId: { type: "string", required: false, input: false },
        role: { type: "string", required: false, input: false },
        gradeId: { type: "string", required: false, input: false },
        managerId: { type: "string", required: false, input: false },
        employeeCode: { type: "string", required: false, input: false },
        department: { type: "string", required: false, input: false },
        hiredAt: { type: "string", required: false, input: false },
        profileNote: { type: "string", required: false, input: false },
        isActive: { type: "boolean", required: false, input: false },
      },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },
  });
}
