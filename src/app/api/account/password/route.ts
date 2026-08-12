import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { AUTH_ATTEMPT_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "いまのパスワードを入力してください"),
  newPassword: z
    .string()
    .min(10, "新しいパスワードは10文字以上にしてください")
    .max(200, "新しいパスワードが長すぎます"),
});

/**
 * 自分のパスワードを変更する。
 *
 * 変更できるのは本人だけ（ログイン中の本人のパスワードしか対象にしない）。
 * 変更が済んだら「仮パスワードのまま」の印を消し、他の端末のログインは切る
 * （発行時のパスワードを知っている人が入ったままにならないようにするため）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("EMPLOYEE");

    // ログイン試行と同じ制限（10秒に3回まで）を「いまのパスワード」欄にもかける。
    // ログイン済みの本人しか来ない画面だが、総当たりで現在のパスワードを
    // 当てにいく攻撃を防ぐため念のため。Better Auth のルーター（auth.handler）を
    // 経由しない呼び出しなので、Better Auth 既定の制限は素通りしてしまう
    // （src/lib/rate-limit.ts 参照）。
    const rateLimit = consumeRateLimit(`account-password:${viewer.id}`, AUTH_ATTEMPT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      // ログイン画面と同じく、待ち時間や「制限に達した」とは言わず、
      // 通常の「いまのパスワードが違います」と同じ言い方にする
      // （総当たりの手掛かりを増やさないため）。
      throw new HttpError(429, "いまのパスワードが違います。もう一度お試しください。");
    }

    const body = bodySchema.parse(await req.json());

    if (body.newPassword === body.currentPassword) {
      throw new HttpError(400, "いまのパスワードと違うものにしてください。");
    }

    const auth = await getAuth();
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch {
      // Better Auth からの詳しい理由はそのまま出さない（総当たりの手掛かりになるため）
      throw new HttpError(400, "いまのパスワードが違います。もう一度お試しください。");
    }

    const db = await getDb();
    await db.update(s.users).set({ mustChangePassword: false }).where(eq(s.users.id, viewer.id));

    return { message: "パスワードを変更しました。次からは新しいパスワードでログインしてください。" };
  });
}
