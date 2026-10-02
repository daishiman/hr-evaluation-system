"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { userNameSchema } from "@/lib/user-name-schema";
import { prepareCredential } from "@/lib/credential-issue";
import { memoNotice } from "@/lib/credential-vault";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { HttpError, ROLES } from "@/lib/session";
import { assertCompanyAssignable, assertEmailAvailable, assertNoManagerCycle } from "@/lib/user-integrity";

/**
 * システム全体管理者による利用者の追加・変更。
 *
 * 社員の管理（actions/members）は「自社の社員」しか触れない（会社の管理者向け）。
 * システム全体管理者・会社に属さない利用者はそこから漏れ、
 * 一度作ったら誰も直せない状態になっていたので、この入口を分けて用意する。
 *
 * 自分を降格・停止できないようにするのと、
 * 最後のシステム全体管理者を落とせないようにするのが要点
 * （誰もログインできない箱になると、DBを直接触るしか復旧手段が無くなる）。
 */

const patchSchema = z
  .object({
    userId: z.string().min(1),
    name: userNameSchema.optional(),
    email: z.string().trim().email("メールアドレスの形式を確認してください").optional(),
    role: z.enum(ROLES).optional(),
    companyId: z.string().nullable().optional(),
    gradeId: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
    employeeCode: z.string().max(30).nullable().optional(),
    department: z.string().max(60).nullable().optional(),
    hiredAt: z.iso.date("入社日は実在する日付を入力してください").nullable().optional(),
    isActive: z.boolean().optional(),
    /**
     * パスワードの再発行。
     * 下限は本人の変更画面（PasswordChangeForm の MIN_LENGTH）と揃える。
     * 画面から送られるのは生成された12文字だが、直接呼ばれても
     * 本人の変更画面より弱い値が入らないようにここで止める。
     */
    password: z.string().min(10, "パスワードは10文字以上にしてください").max(72).optional(),
  })
  .strict();

const LAST_SUPER_ADMIN = "最後のシステム全体管理者です。先に別の方をシステム全体管理者にしてください。";

export async function updateSystemUser(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: patchSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    const target = (await db.select().from(s.users).where(eq(s.users.id, input.userId)).limit(1))[0];
    if (!target) throw new HttpError(404, "対象の利用者が見つかりませんでした。");

    // 自分自身に対する危険な操作は、派生する所属エラーより先に意図を明確に伝える。
    if (target.id === viewer.id) {
      if (input.isActive === false) throw new HttpError(400, "自分自身を利用停止にはできません。");
      if (input.role !== undefined && input.role !== "SUPER_ADMIN") {
        throw new HttpError(400, "自分自身の役割は下げられません。別のシステム全体管理者に変更してもらってください。");
      }
    }

    const effectiveRole = input.role ?? target.role;
    const effectiveIsActive = input.isActive ?? target.isActive;
    let effectiveCompanyId = input.companyId !== undefined ? input.companyId : target.companyId;
    let effectiveGradeId = input.gradeId !== undefined ? input.gradeId : target.gradeId;
    let effectiveManagerId = input.managerId !== undefined ? input.managerId : target.managerId;

    // システム全体管理者は会社別の所属・等級・上長を持たず、操作対象会社はscope cookieで選ぶ。
    if (effectiveRole === "SUPER_ADMIN") {
      effectiveCompanyId = null;
      effectiveGradeId = null;
      effectiveManagerId = null;
    } else {
      if (!effectiveCompanyId) throw new HttpError(400, "システム全体管理者以外は、所属する会社を選んでください。");
      await assertCompanyAssignable(effectiveCompanyId, effectiveIsActive);
    }

    if (effectiveManagerId === target.id) throw new HttpError(400, "自分自身を上長にはできません。");
    await assertRefsBelongTo(effectiveCompanyId, effectiveGradeId, effectiveManagerId);
    await assertNoManagerCycle(target.id, effectiveManagerId);

    // 上長として参照されている間は、参照が不正になる会社変更・降格・停止を先に止める。
    const canRemainManager =
      effectiveIsActive && (effectiveRole === "MANAGER" || effectiveRole === "COMPANY_ADMIN");
    if (!canRemainManager || effectiveCompanyId !== target.companyId) {
      const report = await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(eq(s.users.managerId, target.id))
        .limit(1);
      if (report[0]) {
        throw new HttpError(400, "上長に設定されている利用者がいます。先にその利用者の上長を変更してください。");
      }
    }

    const losesSuperAdmin =
      target.role === "SUPER_ADMIN" && target.isActive && (effectiveRole !== "SUPER_ADMIN" || !effectiveIsActive);
    if (losesSuperAdmin && input.password) {
      throw new HttpError(400, "役割・利用状態の変更とパスワード再発行は、分けて実行してください。");
    }

    if (input.email) await assertEmailAvailable(db, input.email.trim().toLowerCase(), target.id);

    const patch: Record<string, unknown> = {};
    for (const k of [
      "name",
      "email",
      "role",
      "companyId",
      "gradeId",
      "managerId",
      "employeeCode",
      "department",
      "hiredAt",
      "isActive",
    ] as const) {
      if (input[k] !== undefined) patch[k] = k === "email" ? input.email?.toLowerCase() : input[k];
    }
    if (effectiveRole === "SUPER_ADMIN") {
      patch.companyId = null;
      patch.gradeId = null;
      patch.managerId = null;
    }

    // UPDATE自身の原子的な条件に残存管理者の存在を含め、相互同時降格を防ぐ。
    const userWhere = losesSuperAdmin
      ? and(
          eq(s.users.id, target.id),
          sql`exists (
            select 1 from ${s.users} as other
            where other.role = 'SUPER_ADMIN'
              and other.is_active = 1
              and other.id <> ${target.id}
          )`,
        )
      : eq(s.users.id, target.id);

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
      const [updated] = await db.batch([
        db.update(s.users).set(patch).where(userWhere).returning({ id: s.users.id }),
        credentialMutation,
        ...credential.memo,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      ]);
      if (losesSuperAdmin && updated.length === 0) throw new HttpError(400, LAST_SUPER_ADMIN);
      notice = memoNotice(credential.stored);
    } else if (Object.keys(patch).length > 0) {
      const updated = await db.update(s.users).set(patch).where(userWhere).returning({ id: s.users.id });
      if (losesSuperAdmin && updated.length === 0) throw new HttpError(400, LAST_SUPER_ADMIN);
    }

    // 発行した値そのものは返さない（画面が自分で送った値を控えとして持っている）。
    // ここで返すと、通信の記録や運用のログに平文で残る経路を増やしてしまう。
    return {
      message:
        input.isActive === false
          ? `${target.name}さんを利用停止にしました。これまでの記録は残っています。`
          : input.password
            ? `${target.name}さんの仮パスワードを発行しました。いまのログインはすべて解除されています。` +
              `この画面に出ている値をご本人にお伝えください。${notice}`
            : "利用者の情報を保存しました。",
    };
  });
}

const createSchema = z
  .object({
    name: userNameSchema,
    email: z.string().trim().email("メールアドレスの形式を確認してください"),
    password: z.string().min(10, "パスワードは10文字以上にしてください").max(72),
    role: z.enum(ROLES),
    companyId: z.string().nullable().optional(),
  })
  .strict();

/** 利用者の追加。システム全体管理者そのものを増やせるのはここだけ。 */
export async function createSystemUser(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: createSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    const email = input.email.trim().toLowerCase();
    await assertEmailAvailable(db, email);
    if (input.role !== "SUPER_ADMIN" && !input.companyId) {
      throw new HttpError(400, "システム全体管理者以外は、所属する会社を選んでください。");
    }
    if (input.role !== "SUPER_ADMIN") await assertCompanyAssignable(input.companyId!, true);

    const userId = crypto.randomUUID();
    const credential = await prepareCredential(db, { userId, password: input.password, issuedBy: viewer.id });
    // 利用者・ログイン用アカウント・控えを1つの batch で書く（どれか1つだけが残らない）
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: input.name,
        email,
        emailVerified: true,
        companyId: input.role === "SUPER_ADMIN" ? null : input.companyId,
        role: input.role,
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
        `メールアドレスと仮パスワードをご本人にお伝えください。${memoNotice(credential.stored)}`,
    };
  });
}

/** 等級・上長が、その利用者の所属会社のものであることを確かめる。 */
async function assertRefsBelongTo(companyId: string | null, gradeId?: string | null, managerId?: string | null) {
  if (!gradeId && !managerId) return;
  if (!companyId) throw new HttpError(400, "会社に所属していない利用者には、等級・上長を設定できません。");
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
    if (m[0].role !== "MANAGER" && m[0].role !== "COMPANY_ADMIN") {
      throw new HttpError(400, "上長には有効なマネージャー以上の方を指定してください。");
    }
  }
}

