import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";

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
