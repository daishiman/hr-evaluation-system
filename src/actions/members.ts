"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { userNameSchema } from "@/lib/user-name-schema";
import { prepareCredential } from "@/lib/credential-issue";
import { memoNotice } from "@/lib/credential-vault";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { hasMembershipElsewhere, insertMembership, membershipIn, reportsIn, writeMembership } from "@/lib/memberships";
import { assertCompanyChosen, atLeast, crossesCompanies, FORBIDDEN_MESSAGE, HttpError, type Role } from "@/lib/session";
import {
  assertCompanyAssignable,
  assertCompanyRefs,
  assertEmailAvailable,
  assertNoManagerCycle,
  managerLookupIn,
} from "@/lib/user-integrity";

/**
 * 自社の社員アカウントの発行・変更（会社の管理者のみ）。
 *
 * 画面専用の書き込みなので Server Action に置く。成功すると runAction が
 * refresh() を呼び、社員の一覧は保存の応答と同時に新しくなる。
 * 仮パスワードは暗号化した控えとして残し、一覧の行から開き直せる。
 *
 * 会社ごとの値（役割・等級・上長・社員番号・部署・入社日・メモ）は、いまの会社の所属の行に書く。
 * 利用者全体の値（氏名・パスワード・利用の停止）は、ほかの会社にも所属している人なら
 * 全体管理者だけが変えられる（ある会社の管理者が、別の会社でのログインまで止めないように）。
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
  return runAction({ operation: "members.create", input: createSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const email = input.email.trim().toLowerCase();
    await assertEmailAvailable(db, email);

    await assertCompanyAssignable(companyId, true);
    await assertCompanyRefs(db, companyId, input.gradeId, input.managerId);

    const userId = crypto.randomUUID();
    const credential = await prepareCredential(db, { userId, password: input.password, issuedBy: viewer.id });
    // 利用者・所属・ログイン用アカウント・控えを1つの batch で書く（どれか1つだけが残らない）。
    // 会社ごとの値は所属の行に書き、users の写しは所属の文が同じ batch の中で書く
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: input.name,
        email,
        emailVerified: true,
        isActive: true,
        mustChangePassword: true,
      }),
      ...(await insertMembership(
        db,
        {
          userId,
          companyId,
          role: input.role,
          gradeId: input.gradeId ?? null,
          managerId: input.managerId ?? null,
          employeeCode: input.employeeCode ?? null,
          department: input.department ?? null,
          hiredAt: input.hiredAt ?? null,
        },
        { writeCopy: true },
      )),
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
  return runAction({ operation: "members.update", input: patchSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const membership = await membershipIn(db, input.userId, companyId);
    const target = membership
      ? (
          await db
            .select({ id: s.users.id, name: s.users.name, isActive: s.users.isActive })
            .from(s.users)
            .where(eq(s.users.id, input.userId))
            .limit(1)
        )[0]
      : undefined;
    if (!membership || !target) throw new HttpError(404, "対象の社員が見つかりませんでした。");

    // 画面は氏名をいつも送るので、今と同じ値は「変えていない」と数える
    const changesUser =
      (input.name !== undefined && input.name !== target.name) ||
      (input.isActive !== undefined && input.isActive !== target.isActive) ||
      input.password !== undefined;
    if (changesUser && !crossesCompanies(viewer.role) && (await hasMembershipElsewhere(db, target.id, companyId))) {
      throw new HttpError(403, FORBIDDEN_MESSAGE);
    }
    if (target.id === viewer.id && input.isActive === false) {
      throw new HttpError(400, "自分自身を利用停止にはできません。");
    }
    const nextGradeId = input.gradeId === undefined ? membership.gradeId : input.gradeId;
    const nextManagerId = input.managerId === undefined ? membership.managerId : input.managerId;
    const nextRole = (input.role ?? membership.role) as Role;
    const nextIsActive = input.isActive ?? target.isActive;
    if (nextManagerId === input.userId) throw new HttpError(400, "自分自身を上長にはできません。");
    await assertCompanyAssignable(companyId, nextIsActive);
    await assertCompanyRefs(db, companyId, nextGradeId, nextManagerId);
    await assertNoManagerCycle(target.id, nextManagerId, managerLookupIn(companyId));

    if (!nextIsActive || !atLeast(nextRole, "MANAGER")) {
      if ((await reportsIn(db, target.id, companyId, 1)).length > 0) {
        throw new HttpError(400, "上長に設定されている社員がいます。先にその社員の上長を変更してください。");
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    const membershipStatements = await writeMembership(db, target.id, companyId, {
      role: input.role,
      gradeId: input.gradeId,
      managerId: input.managerId,
      employeeCode: input.employeeCode,
      department: input.department,
      hiredAt: input.hiredAt,
      profileNote: input.profileNote,
    });

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
      // 利用者・所属・アカウント・控え・ログインの解除を1つの batch で書く
      await db.batch([
        db.update(s.users).set(patch).where(eq(s.users.id, target.id)),
        ...membershipStatements,
        credentialMutation,
        ...credential.memo,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      ]);
      notice = memoNotice(credential.stored);
    } else {
      const statements = [
        ...(Object.keys(patch).length > 0 ? [db.update(s.users).set(patch).where(eq(s.users.id, target.id))] : []),
        ...membershipStatements,
      ];
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
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
