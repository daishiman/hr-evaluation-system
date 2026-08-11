import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError, ROLES } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { assertNoManagerCycle } from "@/lib/user-integrity";

export const dynamic = "force-dynamic";

const roleSchema = z.enum(["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]);

const createSchema = z.object({
  name: z.string().min(1, "氏名を入力してください").max(60),
  email: z.string().email("メールアドレスの形式を確認してください"),
  password: z.string().min(8, "パスワードは8文字以上にしてください").max(72),
  role: roleSchema,
  gradeId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  hiredAt: z.iso.date().nullable().optional(),
});

/** 社員アカウントの発行。会社の管理者のみ。自社にしか作れない。 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = createSchema.parse(await req.json());
    const db = await getDb();

    const email = body.email.trim().toLowerCase();
    const dup = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email)).limit(1);
    if (dup.length > 0) throw new HttpError(400, "このメールアドレスはすでに登録されています。");

    await assertCompanyRefs(companyId, body.gradeId, body.managerId);

    const userId = crypto.randomUUID();
    const password = await hashPassword(body.password);
    await db.batch([
      db.insert(s.users).values({
        id: userId,
        name: body.name.trim(),
        email,
        emailVerified: true,
        companyId,
        role: body.role,
        gradeId: body.gradeId ?? null,
        managerId: body.managerId ?? null,
        employeeCode: body.employeeCode ?? null,
        department: body.department ?? null,
        hiredAt: body.hiredAt ?? null,
        isActive: true,
        mustChangePassword: true,
      }),
      db.insert(s.accounts).values({
        id: newId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password,
      }),
    ]);

    return { id: userId, message: `${body.name}さんのアカウントを作りました。ログイン用のメールアドレスとパスワードをご本人にお伝えください。` };
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(60).optional(),
  role: roleSchema.optional(),
  gradeId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  hiredAt: z.iso.date().nullable().optional(),
  profileNote: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  /** パスワードの再発行 */
  password: z.string().min(8).max(72).optional(),
});

/** 社員情報の変更。退職はデータを消さず「利用停止」で扱う（過去の評価は残す）。 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const target = (
      await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.id, body.userId), eq(s.users.companyId, companyId)))
        .limit(1)
    )[0];
    if (!target) throw new HttpError(404, "対象の社員が見つかりませんでした。");
    if (target.id === viewer.id && body.isActive === false) {
      throw new HttpError(400, "自分自身を利用停止にはできません。");
    }
    const nextGradeId = body.gradeId === undefined ? target.gradeId : body.gradeId;
    const nextManagerId = body.managerId === undefined ? target.managerId : body.managerId;
    const nextRole = body.role ?? target.role;
    const nextIsActive = body.isActive ?? target.isActive;
    if (nextManagerId === body.userId) throw new HttpError(400, "自分自身を上長にはできません。");
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
      if (body[k] !== undefined) patch[k] = body[k];
    }

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
      await db.batch([
        db.update(s.users).set(patch).where(eq(s.users.id, target.id)),
        credentialMutation,
        db.delete(s.sessions).where(eq(s.sessions.userId, target.id)),
      ]);
    } else if (Object.keys(patch).length > 0) {
      await db.update(s.users).set(patch).where(eq(s.users.id, target.id));
    }

    return {
      message:
        body.isActive === false
          ? `${target.name}さんを利用停止にしました。過去の評価の記録は残っています。`
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
