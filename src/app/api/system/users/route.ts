import { and, eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError, ROLES } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { assertNoManagerCycle } from "@/lib/user-integrity";

export const dynamic = "force-dynamic";

/**
 * システム全体管理者による利用者の変更。
 *
 * /api/members は「自社の社員」しか触れない（会社の管理者向け）。
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
    name: z.string().trim().min(1, "氏名を入力してください").max(60).optional(),
    email: z.string().trim().email("メールアドレスの形式を確認してください").optional(),
    role: z.enum(ROLES).optional(),
    companyId: z.string().nullable().optional(),
    gradeId: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
    employeeCode: z.string().max(30).nullable().optional(),
    department: z.string().max(60).nullable().optional(),
    hiredAt: z.iso.date("入社日は実在する日付を入力してください").nullable().optional(),
    isActive: z.boolean().optional(),
    /** パスワードの再発行 */
    password: z.string().min(8, "パスワードは8文字以上にしてください").max(72).optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("SUPER_ADMIN");
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const target = (await db.select().from(s.users).where(eq(s.users.id, body.userId)).limit(1))[0];
    if (!target) throw new HttpError(404, "対象の利用者が見つかりませんでした。");

    // 自分自身に対する危険な操作は、派生する所属エラーより先に意図を明確に伝える。
    if (target.id === viewer.id) {
      if (body.isActive === false) throw new HttpError(400, "自分自身を利用停止にはできません。");
      if (body.role !== undefined && body.role !== "SUPER_ADMIN") {
        throw new HttpError(400, "自分自身の役割は下げられません。別のシステム全体管理者に変更してもらってください。");
      }
    }

    const effectiveRole = body.role ?? target.role;
    const effectiveIsActive = body.isActive ?? target.isActive;
    let effectiveCompanyId = body.companyId !== undefined ? body.companyId : target.companyId;
    let effectiveGradeId = body.gradeId !== undefined ? body.gradeId : target.gradeId;
    let effectiveManagerId = body.managerId !== undefined ? body.managerId : target.managerId;

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
    if (losesSuperAdmin && body.password) {
      throw new HttpError(400, "役割・利用状態の変更とパスワード再発行は、分けて実行してください。");
    }

    if (body.email) {
      const email = body.email.trim().toLowerCase();
      const dup = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1);
      if (dup[0] && dup[0].id !== target.id) {
        throw new HttpError(400, "このメールアドレスはすでに別の方が使っています。");
      }
    }

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
      if (body[k] !== undefined) patch[k] = k === "email" ? body.email?.toLowerCase() : body[k];
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

    if (body.password) {
      const acc = (
        await db
          .select()
          .from(s.accounts)
          .where(and(eq(s.accounts.userId, target.id), eq(s.accounts.providerId, "credential")))
          .limit(1)
      )[0];
      const hashed = await hashPassword(body.password);
      patch.mustChangePassword = true;
      const credentialMutation = acc
        ? db.update(s.accounts).set({ password: hashed }).where(eq(s.accounts.id, acc.id))
        : db.insert(s.accounts).values({
            id: newId("acc"),
            accountId: target.id,
            providerId: "credential",
            userId: target.id,
            password: hashed,
          });
      const [updated] = await db.batch([
        db.update(s.users).set(patch).where(userWhere).returning({ id: s.users.id }),
        credentialMutation,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      ]);
      if (losesSuperAdmin && updated.length === 0) {
        throw new HttpError(400, "最後のシステム全体管理者です。先に別の方をシステム全体管理者にしてください。");
      }
    } else if (Object.keys(patch).length > 0) {
      const updated = await db.update(s.users).set(patch).where(userWhere).returning({ id: s.users.id });
      if (losesSuperAdmin && updated.length === 0) {
        throw new HttpError(400, "最後のシステム全体管理者です。先に別の方をシステム全体管理者にしてください。");
      }
    }

    return {
      message:
        body.isActive === false
          ? `${target.name}さんを利用停止にしました。これまでの記録は残っています。`
          : "利用者の情報を保存しました。",
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

/** 利用中のアカウントは、利用中かつテンプレートではない会社だけに所属できる。 */
async function assertCompanyAssignable(companyId: string, isActiveUser: boolean) {
  const db = await getDb();
  const companies = await db
    .select({ id: s.companies.id, isActive: s.companies.isActive, isTemplate: s.companies.isTemplate })
    .from(s.companies)
    .where(eq(s.companies.id, companyId))
    .limit(1);
  const company = companies[0];
  if (!company) throw new HttpError(400, "所属会社が見つかりませんでした。");
  if (company.isTemplate || (isActiveUser && !company.isActive)) {
    throw new HttpError(400, "利用中の方は、利用中の実在会社に所属させてください。");
  }
}

const createSchema = z
  .object({
    name: z.string().trim().min(1, "氏名を入力してください").max(60),
    email: z.string().trim().email("メールアドレスの形式を確認してください"),
    password: z.string().min(8, "パスワードは8文字以上にしてください").max(72),
    role: z.enum(ROLES),
    companyId: z.string().nullable().optional(),
  })
  .strict();

/** 利用者の追加。システム全体管理者そのものを増やせるのはここだけ。 */
export async function POST(req: Request) {
  return handle(async () => {
    await apiViewer("SUPER_ADMIN");
    const body = createSchema.parse(await req.json());
    const db = await getDb();

    const email = body.email.trim().toLowerCase();
    const dup = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1);
    if (dup.length > 0) throw new HttpError(400, "このメールアドレスはすでに登録されています。");
    if (body.role !== "SUPER_ADMIN" && !body.companyId) {
      throw new HttpError(400, "システム全体管理者以外は、所属する会社を選んでください。");
    }
    if (body.role !== "SUPER_ADMIN") await assertCompanyAssignable(body.companyId!, true);

    const userId = crypto.randomUUID();
    const hashed = await hashPassword(body.password);
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: body.name,
        email,
        emailVerified: true,
        companyId: body.role === "SUPER_ADMIN" ? null : body.companyId,
        role: body.role,
        isActive: true,
        mustChangePassword: true,
      }),
      db.insert(s.accounts).values({
        id: newId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
      }),
    ]);

    return {
      id: userId,
      message: `${body.name}さんのアカウントを作りました。メールアドレスと仮パスワードをご本人にお伝えください。`,
    };
  });
}
