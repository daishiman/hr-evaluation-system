"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { getDb, schema as s } from "@/lib/db";
import { constitutionEventStatements } from "@/lib/domain/constitution-events";
import {
  activeCompanyCondition,
  insertMembership,
  isSuperAdmin,
  membershipIn,
  moveCopyAway,
  reportsIn,
} from "@/lib/memberships";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import { assertCompanyRefs } from "@/lib/user-integrity";

/**
 * 会社の所属を足す・外す（S7・D-004）。
 *
 * 足すのは全体管理者だけ（/system/users/[id]）。会社の管理者が足せると、自社の招待で
 * 他社の社員を取り込めてしまうため。足しても氏名・パスワード・資格情報の控えは変えない
 * （その人は今のパスワードのまま、足した会社にも入れる）。
 *
 * 外すのは、いまの会社の管理者（/admin/members/[id]）。自分の会社の所属だけを外せる。
 * ほかに有効な所属が無い人は外さずに「利用の停止」を使う（ログインできない人を残さない）。
 *
 * どちらも監査を constitution_events に残す（entityType は membership、entityId は所属の id）。
 */

const roleSchema = z.enum(["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]);

const addSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
  role: roleSchema,
  gradeId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  employeeCode: z.string().max(30).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  hiredAt: z.iso.date().nullable().optional(),
});

/** 既存の利用者に、別の会社の所属を足す（全体管理者だけ） */
export async function addMembership(raw: unknown) {
  return runAction({ operation: "memberships.add", input: addSchema }, raw, async ({ viewer, input }) => {
    const db = await getDb();

    if (await isSuperAdmin(db, input.userId)) throw new HttpError(400, "この利用者には所属を足せません。");
    const user = (
      await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.id, input.userId)).limit(1)
    )[0];
    if (!user) throw new HttpError(404, "対象の利用者が見つかりませんでした。");

    const company = (
      await db
        .select({ name: s.companies.name })
        .from(s.companies)
        .where(and(eq(s.companies.id, input.companyId), activeCompanyCondition()))
        .limit(1)
    )[0];
    if (!company) throw new HttpError(400, "この会社には所属を足せません。停止中の会社とテンプレートは選べません。");
    if (await membershipIn(db, user.id, input.companyId)) {
      throw new HttpError(409, `${user.name}さんは、すでに${company.name}に所属しています。`);
    }

    await assertCompanyRefs(db, input.companyId, input.gradeId, input.managerId);

    const membershipId = `mem_${crypto.randomUUID()}`;
    const values = {
      userId: user.id,
      companyId: input.companyId,
      role: input.role,
      gradeId: input.gradeId ?? null,
      managerId: input.managerId ?? null,
      employeeCode: input.employeeCode ?? null,
      department: input.department ?? null,
      hiredAt: input.hiredAt ?? null,
    };
    // 所属・（最初の所属なら）users の写し・監査を1つの batch で書く
    const [first, ...rest] = [
      ...(await insertMembership(db, values, { id: membershipId })),
      ...(await constitutionEventStatements({
        db,
        companyId: input.companyId,
        entityType: "membership",
        entityId: membershipId,
        eventType: "created",
        actorId: viewer.id,
        after: values,
      })),
    ];
    if (first) await db.batch([first, ...rest]);

    return { message: `${user.name}さんを${company.name}に所属させました。今のパスワードのまま、会社を切り替えて使えます。` };
  });
}

const removeSchema = z.object({ userId: z.string().min(1) });

/** いまの会社の所属を外す。利用者と、ほかの会社の所属はそのまま残す */
export async function removeMembership(raw: unknown) {
  return runAction({ operation: "memberships.remove", input: removeSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    if (input.userId === viewer.id) throw new HttpError(400, "自分の所属は外せません。");

    const db = await getDb();
    const membership = await membershipIn(db, input.userId, companyId);
    if (!membership) throw new HttpError(404, "この会社に所属している方が見つかりませんでした。");

    const reports = await reportsIn(db, input.userId, companyId);
    if (reports.length > 0) {
      const names = reports.map((r) => `${r.name}さん`).join("、");
      throw new HttpError(409, `${names}の上長になっているため、この会社の所属を外せません。先に上長を変えてください。`);
    }

    const { statements: copyStatements, remaining } = await moveCopyAway(db, input.userId, companyId);
    if (!remaining) {
      throw new HttpError(
        400,
        "ほかの会社に所属していないため、所属は外せません。使わなくなったときは、利用を停止してください。",
      );
    }

    const before = {
      userId: membership.userId,
      role: membership.role,
      gradeId: membership.gradeId,
      officeId: membership.officeId,
      managerId: membership.managerId,
      employeeCode: membership.employeeCode,
      department: membership.department,
      hiredAt: membership.hiredAt,
    };
    const [first, ...rest] = [
      db.delete(s.companyMemberships).where(eq(s.companyMemberships.id, membership.id)),
      ...copyStatements,
      ...(await constitutionEventStatements({
        db,
        companyId,
        entityType: "membership",
        entityId: membership.id,
        eventType: "deleted",
        actorId: viewer.id,
        before,
      })),
    ];
    await db.batch([first, ...rest]);

    const name = (await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, input.userId)).limit(1))[0]?.name;
    return { message: `${name ?? "この方"}さんの、この会社の所属を外しました。ほかの会社の所属はそのまま残っています。` };
  });
}
