"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { userNameSchema } from "@/lib/user-name-schema";
import { prepareCredential } from "@/lib/credential-issue";
import { memoNotice } from "@/lib/credential-vault";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { assertCompanyChosen, HttpError, ROLES } from "@/lib/session";
import { assertCompanyAssignable, assertEmailAvailable, assertNoManagerCycle } from "@/lib/user-integrity";

/**
 * 自社の社員アカウントの発行・変更（会社の管理者のみ）。
 *
 * 画面専用の書き込みなので Server Action に置く。成功すると runAction が
 * refresh() を呼び、社員の一覧は保存の応答と同時に新しくなる。
 * 仮パスワードは暗号化した控えとして残し、一覧の行から開き直せる。
 */

const roleSchema = z.enum(["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]);

const createSchema = z.object({
  name: userNameSchema,
  email: z.string().email("メールアドレスの形式を確認してください"),
  password: z.string().min(10, "パスワードは10文字以上にしてください").max(72),
  role: roleSchema,
  gradeId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  hiredAt: z.iso.date().nullable().optional(),
});

/** 社員アカウントの発行。自社にしか作れない。 */
export async function createMember(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: createSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const email = input.email.trim().toLowerCase();
    await assertEmailAvailable(db, email);

    await assertCompanyAssignable(companyId, true);
    await assertCompanyRefs(companyId, input.gradeId, input.managerId);

    const userId = crypto.randomUUID();
    const credential = await prepareCredential(db, { userId, password: input.password, issuedBy: viewer.id });
    // 利用者・ログイン用アカウント・控えを1つの batch で書く（どれか1つだけが残らない）
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: input.name,
        email,
        emailVerified: true,
        companyId,
        role: input.role,
        gradeId: input.gradeId ?? null,
        managerId: input.managerId ?? null,
        employeeCode: input.employeeCode ?? null,
        department: input.department ?? null,
        hiredAt: input.hiredAt ?? null,
        isActive: true,
        mustChangePassword: true,
      }),
      db.insert(s.accounts).values({
        id: newId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password: credential.hashed,
      }),
      ...credential.memo,
    ]);

    return {
      id: userId,
      // 控えを残せたか（値そのものは返さない）。残せなかったときだけ、画面は発行した値を開いたままにする
      memoStored: credential.stored,
      message:
        `${input.name}さんのアカウントを作りました。` +
        `ログイン用のメールアドレスとパスワードをご本人にお伝えください。${memoNotice(credential.stored)}`,
    };
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: userNameSchema.optional(),
  role: roleSchema.optional(),
  gradeId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  hiredAt: z.iso.date().nullable().optional(),
  profileNote: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  /**
   * パスワードの再発行。
   * 下限は本人の変更画面（PasswordChangeForm の MIN_LENGTH）と揃える。
   * 画面から送られるのは生成された12文字だが、直接呼ばれても
   * 本人の変更画面より弱い値が入らないようにここで止める。
   */
  password: z.string().min(10, "パスワードは10文字以上にしてください").max(72).optional(),
});

/** 社員情報の変更。退職はデータを消さず「利用停止」で扱う（過去の評価は残す）。 */
export async function updateMember(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: patchSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const target = (
      await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.id, input.userId), eq(s.users.companyId, companyId)))
        .limit(1)
    )[0];
    if (!target) throw new HttpError(404, "対象の社員が見つかりませんでした。");
    if (target.id === viewer.id && input.isActive === false) {
      throw new HttpError(400, "自分自身を利用停止にはできません。");
    }
    const nextGradeId = input.gradeId === undefined ? target.gradeId : input.gradeId;
    const nextManagerId = input.managerId === undefined ? target.managerId : input.managerId;
    const nextRole = input.role ?? target.role;
    const nextIsActive = input.isActive ?? target.isActive;
    if (nextManagerId === input.userId) throw new HttpError(400, "自分自身を上長にはできません。");
    await assertCompanyAssignable(companyId, nextIsActive);
    await assertCompanyRefs(companyId, nextGradeId, nextManagerId);
    await assertNoManagerCycle(target.id, nextManagerId);

    if (!nextIsActive || nextRole === "EMPLOYEE") {
      const report = await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(and(eq(s.users.managerId, target.id), eq(s.users.companyId, companyId)))
        .limit(1);
      if (report[0]) {
        throw new HttpError(400, "上長に設定されている社員がいます。先にその社員の上長を変更してください。");
      }
    }

    const patch: Record<string, unknown> = {};
    for (const k of ["name", "role", "gradeId", "managerId", "employeeCode", "department", "hiredAt", "profileNote", "isActive"] as const) {
      if (input[k] !== undefined) patch[k] = input[k];
    }

    let notice = "";
    if (input.password) {
      const acc = (
        await db
          .select()
          .from(s.accounts)
          .where(and(eq(s.accounts.userId, target.id), eq(s.accounts.providerId, "credential")))
          .limit(1)
      )[0];
      const credential = await prepareCredential(db, { userId: target.id, password: input.password, issuedBy: viewer.id });
      patch.mustChangePassword = true;
      const credentialMutation = acc
        ? db.update(s.accounts).set({ password: credential.hashed }).where(eq(s.accounts.id, acc.id))
        : db.insert(s.accounts).values({
            id: newId("acc"),
            accountId: target.id,
            providerId: "credential",
            userId: target.id,
            password: credential.hashed,
          });
      // 利用者・アカウント・控え・ログインの解除を1つの batch で書く
      await db.batch([
        db.update(s.users).set(patch).where(eq(s.users.id, target.id)),
        credentialMutation,
        ...credential.memo,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      ]);
      notice = memoNotice(credential.stored);
    } else if (Object.keys(patch).length > 0) {
      await db.update(s.users).set(patch).where(eq(s.users.id, target.id));
    }

    // 発行した値そのものは返さない（画面が自分で送った値を控えとして持っている）。
    // ここで返すと、通信の記録や運用のログに平文で残る経路を増やしてしまう。
    return {
      message:
        input.isActive === false
          ? `${target.name}さんを利用停止にしました。過去の評価の記録は残っています。`
          : input.password
            ? `${target.name}さんの仮パスワードを発行しました。いまのログインはすべて解除されています。` +
              `この画面に出ている値をご本人にお伝えください。${notice}`
            : "社員情報を保存しました。",
    };
  });
}

/** 等級・上長が自社のものであることを確かめる（他社のIDを混ぜられないようにする）。 */
async function assertCompanyRefs(companyId: string, gradeId?: string | null, managerId?: string | null) {
  const db = await getDb();
  if (gradeId) {
    const g = await db
      .select({ id: s.grades.id })
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1);
    if (g.length === 0) throw new HttpError(400, "この会社に登録されていない等級です。");
  }
  if (managerId) {
    const m = await db
      .select({ id: s.users.id, role: s.users.role, isActive: s.users.isActive })
      .from(s.users)
      .where(and(eq(s.users.id, managerId), eq(s.users.companyId, companyId)))
      .limit(1);
    if (m.length === 0) throw new HttpError(400, "この会社に登録されていない上長です。");
    if (!m[0].isActive) throw new HttpError(400, "利用停止中の方は上長に指定できません。");
    if (!(ROLES as readonly string[]).includes(m[0].role) || m[0].role === "EMPLOYEE") {
      throw new HttpError(400, "上長にはマネージャー以上の方を指定してください。");
    }
  }
}
