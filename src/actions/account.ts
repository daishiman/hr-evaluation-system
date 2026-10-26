"use server";

import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { userNameSchema } from "@/lib/user-name-schema";
import { getAuth } from "@/lib/auth";
import { rollForward } from "@/lib/compensation";
import { memoDelete } from "@/lib/credential-vault";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb, schema as s } from "@/lib/db";
import { selfEditableFieldsForCompany, type SelfEditableField } from "@/lib/domain/profile-fields";
import { writeMembership, type MembershipValues } from "@/lib/memberships";
import { getSelfProfile, listProfileFieldPolicies } from "@/lib/queries";
import { AUTH_ATTEMPT_RATE_LIMIT, consumeRateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/session";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/security/password";

type SqliteBatchItem = BatchItem<"sqlite">;

/**
 * 本人による自分のアカウントの変更（パスワード・登録内容）。
 *
 * 変更できるのは本人だけ（ログイン中の本人しか対象にしない）。
 * 成功すると runAction が refresh() を呼び、ヘッダーの名前や「仮パスワードのまま」の
 * 案内は保存の応答と同時に新しくなる。
 */

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "いまのパスワードを入力してください"),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`)
    .max(PASSWORD_MAX_LENGTH, "新しいパスワードが長すぎます"),
});

const WRONG_PASSWORD = "いまのパスワードが違います。もう一度お試しください。";
const PASSWORD_CHANGED_BUT_UNSETTLED =
  "パスワードは変更済みです。お知らせが残るときは管理者に連絡してください。";

/**
 * 自分のパスワードを変更する。
 *
 * 変更が済んだら「仮パスワードのまま」の印と、管理者が発行した仮パスワードの控えを消す。
 * 他の端末のログインは切る（発行時のパスワードを知っている人が入ったままにならないようにするため）。
 */
export async function changeOwnPassword(raw: unknown) {
  return runAction({ operation: "account.changePassword", input: passwordSchema }, raw, async ({ viewer, input }) => {
    // ログイン試行と同じ制限（10秒に3回まで）を「いまのパスワード」欄にもかける。
    // Better Auth のルーター（auth.handler）を経由しない呼び出しなので、
    // Better Auth 既定の制限は素通りしてしまう（src/lib/rate-limit.ts 参照）。
    const rateLimit = consumeRateLimit(`account-password:${viewer.id}`, AUTH_ATTEMPT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      // 待ち時間や「制限に達した」とは言わず、通常の言い方にする（総当たりの手掛かりを増やさない）
      throw new HttpError(429, WRONG_PASSWORD);
    }

    if (input.newPassword === input.currentPassword) {
      throw new HttpError(400, "いまのパスワードと違うものにしてください。");
    }

    const auth = await getAuth();
    let issued: Headers;
    try {
      const result = await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
        returnHeaders: true,
      });
      issued = result.headers;
    } catch {
      // Better Auth からの詳しい理由はそのまま出さない（総当たりの手掛かりになるため）
      throw new HttpError(400, WRONG_PASSWORD);
    }

    // 他の端末を切るとき、Better Auth はこの端末のログインも作り直す。
    // 作り直したログインの印（cookie）をこの応答で渡さないと、この端末まで締め出される。
    const setCookie = issued.get("set-cookie");
    if (setCookie) {
      const jar = await cookies();
      for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
        if (name) jar.set(name, attributes.value, toCookieOptions(attributes));
      }
    }

    // 印を消すのと控えを消すのは1つの batch で書く（控えだけ残る状態を作らない）。
    // パスワードはもう変わっていて戻せないので、ここは取り消さずに前へ進めて揃える。
    const db = await getDb();
    const settled = await rollForward("account.password", { userId: viewer.id }, () =>
      db.batch([
        db.update(s.users).set({ mustChangePassword: false }).where(eq(s.users.id, viewer.id)),
        memoDelete(db, viewer.id),
      ]),
    );
    if (!settled) {
      // 「保存できませんでした」と返すと、変わったのに古いパスワードで入ろうとしてしまう。
      return { message: PASSWORD_CHANGED_BUT_UNSETTLED };
    }

    return { message: "パスワードを変更しました。次からは新しいパスワードでログインしてください。" };
  });
}

/**
 * 自分の登録内容を変更する。
 *
 * 変えられるのは、会社が「本人に開放する」と決めた項目だけ。
 * 役割・等級・上長はそもそもこの入口に無い（自分を管理者に昇格させる経路を作らない）。
 * 画面で入力欄を隠すだけでは足りないので、許可の判定はここで必ずやり直す。
 */
const profileSchema = z
  .object({
    name: userNameSchema.optional(),
    department: z.string().max(60).nullable().optional(),
    employeeCode: z.string().max(30).nullable().optional(),
    hiredAt: z.iso.date("入社日は 2024-04-01 のような実在する日付で入力してください").nullable().optional(),
  })
  .strict();

export async function updateOwnProfile(raw: unknown) {
  return runAction({ operation: "account.updateProfile", input: profileSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    // SUPER_ADMIN の viewer.companyId は「操作対象の会社」なので、本人の所属会社とは限らない。
    // 画面と同じく、いま使っている会社の所属を読み、その所属の会社の設定だけを使う
    // （全体管理者は所属を持たないので me.companyId は null）。
    const me = await getSelfProfile(viewer.id, viewer.companyId);
    if (!me) throw new HttpError(404, "利用者情報が見つかりませんでした。");
    const rows = me.companyId ? await listProfileFieldPolicies(me.companyId) : [];
    // 所属会社が無い場合は既定値（氏名のみ可）も適用しない。会社ポリシーの適用元が無いため。
    const allowed = new Set<SelfEditableField>(selfEditableFieldsForCompany(me.companyId, rows));

    const patch: Record<string, unknown> = {};
    const rejected: string[] = [];
    for (const key of ["name", "department", "employeeCode", "hiredAt"] as const) {
      if (input[key] === undefined) continue;
      if (!allowed.has(key)) {
        rejected.push(key);
        continue;
      }
      // 空文字は「消した」とみなす。氏名だけは空にできない（誰の記録か分からなくなるため）
      const value = typeof input[key] === "string" ? input[key].trim() : input[key];
      patch[key] = value === "" ? null : value;
    }

    // 許可項目と禁止項目を混ぜた要求を部分適用すると、呼び出し側が全件保存できたと誤認する。
    if (rejected.length > 0) {
      throw new HttpError(403, "この項目は会社の管理者だけが変更できます。変更が必要なときは会社の管理者にご相談ください。");
    }
    if (Object.keys(patch).length === 0) {
      return { message: "変更はありませんでした。" };
    }

    // 氏名は利用者全体の値、部署・社員番号・入社日はいまの会社の所属の値
    const { name, ...memberPatch } = patch;
    const statements: SqliteBatchItem[] = [];
    if (typeof name === "string") statements.push(db.update(s.users).set({ name }).where(eq(s.users.id, viewer.id)));
    if (me.companyId) {
      statements.push(...(await writeMembership(db, viewer.id, me.companyId, memberPatch as MembershipValues)));
    }
    const [first, ...rest] = statements;
    if (first) await db.batch([first, ...rest]);
    return { message: "あなたの登録内容を保存しました。" };
  });
}
