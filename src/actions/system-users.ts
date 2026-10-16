"use server";

import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { accountSecurityEventStatements, noLongerActiveSuperAdmin } from "@/lib/account-security-events";
import { userNameSchema } from "@/lib/user-name-schema";
import { prepareCredential } from "@/lib/credential-issue";
import { memoNotice } from "@/lib/credential-vault";
import { getDb, schema as s, type DB } from "@/lib/db";
import type { AccountAccess } from "@/lib/domain/account-security-events";
import { newId } from "@/lib/id";
import {
  activeMembershipsOf,
  demoteFromSuperAdminStatements,
  hasReportsAnywhere,
  insertMembership,
  isSuperAdmin,
  membershipsOf,
  moveOnlyMembershipStatements,
  promoteToSuperAdminStatements,
  reportsIn,
  writeMembership,
  type MembershipRole,
} from "@/lib/memberships";
import { HttpError, ROLES } from "@/lib/session";
import {
  assertCompanyAssignable,
  assertCompanyRefs,
  assertEmailAvailable,
  assertNoManagerCycle,
  managerLookupIn,
} from "@/lib/user-integrity";

type SqliteBatchItem = BatchItem<"sqlite">;

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
const HAS_REPORTS = "上長に設定されている利用者がいます。先にその利用者の上長を変更してください。";

/**
 * 利用者の変更。利用者全体の値（氏名・メール・利用中か・パスワード）は users に、
 * 会社ごとの値（役割・等級・上長・社員番号・部署・入社日）は所属の表に書く（S7）。
 *
 * 会社の指定は「どの会社の所属を変えるか」。所属がその会社にあればその所属を変える。
 * 所属が1つだけの人に別の会社を指定したら、その所属ごと会社を移す。
 * 所属が2つ以上の人の会社を移すことはしない（どの所属を移すのか決まらないため。足す・外すを使う）。
 * 全体管理者は所属を持たないので、上げるときは所属を消し、下げるときは所属を1つ作る。
 */
export async function updateSystemUser(raw: unknown) {
  return runAction({ operation: "systemUsers.update", input: patchSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    const target = (
      await db
        .select({ id: s.users.id, name: s.users.name, isActive: s.users.isActive })
        .from(s.users)
        .where(eq(s.users.id, input.userId))
        .limit(1)
    )[0];
    if (!target) throw new HttpError(404, "対象の利用者が見つかりませんでした。");

    // 自分自身に対する危険な操作は、派生する所属エラーより先に意図を明確に伝える。
    if (target.id === viewer.id) {
      if (input.isActive === false) throw new HttpError(400, "自分自身を利用停止にはできません。");
      if (input.role !== undefined && input.role !== "SUPER_ADMIN") {
        throw new HttpError(400, "自分自身の役割は下げられません。別のシステム全体管理者に変更してもらってください。");
      }
    }

    const wasSuperAdmin = await isSuperAdmin(db, target.id);
    const becomesSuperAdmin = input.role === undefined ? wasSuperAdmin : input.role === "SUPER_ADMIN";
    const effectiveIsActive = input.isActive ?? target.isActive;
    const losesSuperAdmin = wasSuperAdmin && target.isActive && (!becomesSuperAdmin || !effectiveIsActive);
    if (losesSuperAdmin && input.password) {
      throw new HttpError(400, "役割・利用状態の変更とパスワード再発行は、分けて実行してください。");
    }
    if (input.email) await assertEmailAvailable(db, input.email.trim().toLowerCase(), target.id);

    // 上長として参照されている間は、参照が不正になる停止・全体管理者への変更を先に止める。
    if ((input.isActive === false || (becomesSuperAdmin && !wasSuperAdmin)) && (await hasReportsAnywhere(db, target.id))) {
      throw new HttpError(400, HAS_REPORTS);
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    // 再発行は仮パスワード扱いにし、いまのログインを切る。
    // アカウント・控え・ログインの解除は、利用者と所属の書き換えのあとに同じ batch へ入れる
    let notice = "";
    const credentialStatements: SqliteBatchItem[] = [];
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
      credentialStatements.push(
        acc
          ? db.update(s.accounts).set({ password: credential.hashed }).where(eq(s.accounts.id, acc.id))
          : db.insert(s.accounts).values({
              id: newId("acc"),
              accountId: target.id,
              providerId: "credential",
              userId: target.id,
              password: credential.hashed,
            }),
        ...credential.memo,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      );
      notice = memoNotice(credential.stored);
    }

    // 最後の全体管理者を落とさない条件。UPDATE 自身の条件に入れて、相互の同時降格を防ぐ。
    const lastSuperAdminGuard = sql`exists (
      select 1 from ${s.users} as other
      where other.role = 'SUPER_ADMIN'
        and other.is_active = 1
        and other.id <> ${target.id}
    )`;

    const statements: SqliteBatchItem[] = [];
    // 監査記録（E7）の変更前と変更後。所属は「この保存で触った所属」だけを比べる
    let beforeMembership: AccountAccess["membership"] = null;
    let afterMembership: AccountAccess["membership"] = null;
    if (becomesSuperAdmin) {
      if (Object.keys(patch).length > 0) {
        const where = losesSuperAdmin ? and(eq(s.users.id, target.id), lastSuperAdminGuard) : eq(s.users.id, target.id);
        statements.push(db.update(s.users).set(patch).where(where).returning({ id: s.users.id }));
      }
      if (!wasSuperAdmin) {
        // 所属をすべて外すので、記録には元の所属（有効な所属のうち一番古いもの）を残す
        const primary = (await activeMembershipsOf(db, target.id))[0] ?? (await membershipsOf(db, target.id))[0];
        beforeMembership = primary ? { companyId: primary.companyId, role: primary.role } : null;
        statements.push(...promoteToSuperAdminStatements(db, target.id));
      }
    } else {
      const membership = await planMembership(db, {
        userId: target.id,
        wasSuperAdmin,
        isActive: effectiveIsActive,
        input,
      });
      beforeMembership = membership.base ? { companyId: membership.base.companyId, role: membership.base.role } : null;
      afterMembership = { companyId: membership.values.companyId, role: membership.values.role };
      if (wasSuperAdmin) {
        const guard = losesSuperAdmin ? lastSuperAdminGuard : sql`1 = 1`;
        statements.push(...demoteFromSuperAdminStatements(db, membership.values, guard, patch));
      } else {
        if (Object.keys(patch).length > 0) {
          statements.push(db.update(s.users).set(patch).where(eq(s.users.id, target.id)));
        }
        statements.push(...membership.statements);
      }
    }

    statements.push(...credentialStatements);

    // 監査記録は batch の末尾に置く（1つ目の文の結果で最後の全体管理者を判定するため）。
    // 全体管理者を外す・止める保存は、条件に止められたときに記録しない
    statements.push(
      ...accountSecurityEventStatements(db, {
        userId: target.id,
        actorId: viewer.id,
        source: "system_users",
        before: { superAdmin: wasSuperAdmin, isActive: target.isActive, membership: beforeMembership },
        after: { superAdmin: becomesSuperAdmin, isActive: effectiveIsActive, membership: afterMembership },
        passwordReissued: input.password !== undefined,
        when: losesSuperAdmin ? noLongerActiveSuperAdmin(target.id) : undefined,
      }),
    );

    // 利用者・所属・アカウント・控え・ログインの解除・監査記録を1つの batch で書く。
    // 全体管理者を外す変更では、1つ目の文が条件付きの UPDATE で、更新した行を返す。
    const [first, ...rest] = statements;
    if (first) {
      const results = await db.batch([first, ...rest]);
      if (losesSuperAdmin && (results[0] as unknown as unknown[]).length === 0) {
        throw new HttpError(400, LAST_SUPER_ADMIN);
      }
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

type PatchInput = z.infer<typeof patchSchema>;

/**
 * 会社の役割の人について、どの会社の所属をどう書くかを決め、確かめてから文を返す。
 *  - 指定の会社に所属がある: その所属を変える
 *  - 所属が無い（全体管理者から下げる・所属を失った人）: 指定の会社に所属を作る
 *  - 所属が1つだけで、別の会社を指定: その所属ごと会社を移す（事業所は会社のものなので外す）
 *  - 所属が2つ以上で、所属の無い会社を指定: 断る
 */
async function planMembership(
  db: DB,
  args: { userId: string; wasSuperAdmin: boolean; isActive: boolean; input: PatchInput },
) {
  const { userId, wasSuperAdmin, isActive, input } = args;
  const all = wasSuperAdmin ? [] : await membershipsOf(db, userId);
  const primary = wasSuperAdmin ? undefined : (await activeMembershipsOf(db, userId))[0] ?? all[0];
  const companyId = input.companyId !== undefined ? input.companyId : (primary?.companyId ?? null);
  if (!companyId) throw new HttpError(400, "システム全体管理者以外は、所属する会社を選んでください。");
  await assertCompanyAssignable(companyId, isActive);

  const current = all.find((x) => x.companyId === companyId);
  const moving = !current && all.length === 1 ? all[0] : undefined;
  if (!current && all.length > 1) {
    throw new HttpError(
      400,
      "この方は複数の会社に所属しています。会社を変えるときは、所属を足してから、元の会社で所属を外してください。",
    );
  }
  const base = current ?? moving;
  const pick = <K extends "gradeId" | "managerId" | "employeeCode" | "department" | "hiredAt">(key: K) =>
    input[key] !== undefined ? (input[key] ?? null) : (base?.[key] ?? null);
  const values = {
    userId,
    companyId,
    role: (input.role ?? base?.role ?? "EMPLOYEE") as MembershipRole,
    gradeId: pick("gradeId"),
    managerId: pick("managerId"),
    employeeCode: pick("employeeCode"),
    department: pick("department"),
    hiredAt: pick("hiredAt"),
  };

  if (values.managerId === userId) throw new HttpError(400, "自分自身を上長にはできません。");
  await assertCompanyRefs(db, companyId, values.gradeId, values.managerId);
  await assertNoManagerCycle(userId, values.managerId, managerLookupIn(companyId));

  // 部下が残るのに、その会社でマネージャー未満へ下げる・会社を移すのは止める
  const leaving = moving?.companyId ?? (values.role === "EMPLOYEE" && current ? companyId : null);
  if (leaving && (await reportsIn(db, userId, leaving, 1)).length > 0) throw new HttpError(400, HAS_REPORTS);

  let statements: SqliteBatchItem[] = [];
  if (current) {
    statements = await writeMembership(db, userId, companyId, {
      role: input.role as MembershipRole | undefined,
      gradeId: input.gradeId,
      managerId: input.managerId,
      employeeCode: input.employeeCode,
      department: input.department,
      hiredAt: input.hiredAt,
    });
  } else if (moving) {
    statements = moveOnlyMembershipStatements(db, moving.id, userId, { ...values, officeId: null });
  } else if (!wasSuperAdmin) {
    statements = await insertMembership(db, values, { writeCopy: true });
  }
  return { values, statements, base };
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
  return runAction({ operation: "systemUsers.create", input: createSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    const email = input.email.trim().toLowerCase();
    await assertEmailAvailable(db, email);
    if (input.role !== "SUPER_ADMIN" && !input.companyId) {
      throw new HttpError(400, "システム全体管理者以外は、所属する会社を選んでください。");
    }
    if (input.role !== "SUPER_ADMIN") await assertCompanyAssignable(input.companyId!, true);

    const userId = crypto.randomUUID();
    const credential = await prepareCredential(db, { userId, password: input.password, issuedBy: viewer.id });
    // 全体管理者は所属を持たない。それ以外は最初の所属を作り、users の写しも同じ batch で書く。
    const membership =
      input.role === "SUPER_ADMIN"
        ? []
        : await insertMembership(db, { userId, companyId: input.companyId!, role: input.role }, { writeCopy: true });
    // 利用者・所属・ログイン用アカウント・控え・監査記録を1つの batch で書く（どれか1つだけが残らない）
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: input.name,
        email,
        emailVerified: true,
        ...(input.role === "SUPER_ADMIN" ? { role: "SUPER_ADMIN" } : {}),
        isActive: true,
        mustChangePassword: true,
      }),
      ...membership,
      db.insert(s.accounts).values({
        id: newId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password: credential.hashed,
      }),
      ...credential.memo,
      ...accountSecurityEventStatements(db, {
        userId,
        actorId: viewer.id,
        source: "system_users",
        before: null,
        after:
          input.role === "SUPER_ADMIN"
            ? { superAdmin: true, isActive: true, membership: null }
            : { superAdmin: false, isActive: true, membership: { companyId: input.companyId!, role: input.role } },
      }),
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
