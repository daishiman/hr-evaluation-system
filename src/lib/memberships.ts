import { and, asc, eq, inArray, ne, notExists, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { alias } from "drizzle-orm/sqlite-core";
import { schema as s, type DB } from "@/lib/db";

/**
 * 1人が複数の会社に所属する（S7・D-004）。所属の読み方と書き方をここに集める。
 *
 * 会社ごとの値（役割・等級・事業所・上司・社員番号・部署・入社日・人物メモ）は所属の表
 * （company_memberships）が正本。利用者全体の値（氏名・メール・利用中か・資格情報）は users が正本。
 *
 * users に残る会社ごとの列は「元の所属（一番古い有効な所属）」の写し。アプリの版を戻したときに
 * 元の動きへ戻れるよう残している。写しを書くのはこのファイルだけで、ほかの場所は所属の表を読む
 * （src/lib/memberships-contract.test.ts が数える）。
 *
 * 有効な所属とは、停止中でもテンプレートでもない会社の所属のこと。
 * 全体管理者は所属を持たない（所属の表の role に SUPER_ADMIN を置けない）。
 */

type SqliteBatchItem = BatchItem<"sqlite">;
const m = s.companyMemberships;
/** 副問い合わせで外側の表と名前がぶつからないよう、別名を付けた表 */
const otherMembership = alias(s.companyMemberships, "other_membership");
const otherCompany = alias(s.companies, "other_company");

export type Membership = typeof m.$inferSelect;
export type MembershipRole = "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE";

/** 会社ごとの値の列。select に広げて使う（`...memberColumns`）。 */
export const memberColumns = {
  companyId: m.companyId,
  role: m.role,
  gradeId: m.gradeId,
  officeId: m.officeId,
  managerId: m.managerId,
  employeeCode: m.employeeCode,
  department: m.department,
  hiredAt: m.hiredAt,
  profileNote: m.profileNote,
};

/** 所属の表で書き換えられる、会社ごとの値 */
export type MembershipValues = Partial<{
  role: MembershipRole;
  gradeId: string | null;
  officeId: string | null;
  managerId: string | null;
  employeeCode: string | null;
  department: string | null;
  hiredAt: string | null;
  profileNote: string | null;
}>;

const VALUE_KEYS = [
  "role",
  "gradeId",
  "officeId",
  "managerId",
  "employeeCode",
  "department",
  "hiredAt",
  "profileNote",
] as const;

/**
 * users に所属を1つ結合する条件。companyId には会社の id か、会社の列（例: forms.companyId）を渡す。
 * 会社の条件を付けずに結合すると、所属の数だけ行が増え、他社の値が混ざる。
 */
export function joinMembership(companyId: string | SQLWrapper): SQL {
  return and(eq(m.userId, s.users.id), eq(m.companyId, companyId))!;
}

/** users に全ての所属を結合する条件（全体管理者の利用者一覧のように、所属ごとに1行出すとき） */
export function joinEveryMembership(): SQL {
  return eq(m.userId, s.users.id);
}

/** 有効な会社（停止中でもテンプレートでもない） */
export function activeCompanyCondition(): SQL {
  return and(eq(s.companies.isActive, true), eq(s.companies.isTemplate, false))!;
}

/**
 * 全体管理者を含めた役割の列。所属があれば所属の役割、無ければ users の役割（全体管理者）。
 * 所属を left join したときに使う。
 */
export const roleOrSuperAdmin = sql<"SUPER_ADMIN" | MembershipRole>`coalesce(${m.role}, ${s.users.role})`;

/** 全体管理者か（所属を持たない人）。users を読む条件はここだけに置く。 */
export function superAdminCondition(): SQL {
  return eq(s.users.role, "SUPER_ADMIN");
}

/** 全体管理者でない（会社に所属する側の）利用者 */
export function notSuperAdminCondition(): SQL {
  return ne(s.users.role, "SUPER_ADMIN");
}

/** その利用者が全体管理者か */
export async function isSuperAdmin(db: DB, userId: string): Promise<boolean> {
  const row = (await db.select({ role: s.users.role }).from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  return row?.role === "SUPER_ADMIN";
}

/**
 * その利用者の有効な所属を古い順に返す（会社の切り替えの一覧にも使う）。
 * 古い順の先頭が「元の所属」。同じ時刻なら id の順で決める（並びが毎回変わらないように）。
 */
export async function activeMembershipsOf(db: DB, userId: string) {
  return db
    .select({ ...membershipSelection(), companyName: s.companies.name })
    .from(m)
    .innerJoin(s.companies, eq(s.companies.id, m.companyId))
    .where(and(eq(m.userId, userId), activeCompanyCondition()))
    .orderBy(asc(m.createdAt), asc(m.id));
}

export type ActiveMembership = Awaited<ReturnType<typeof activeMembershipsOf>>[number];

/**
 * いま使う所属を決める。選んだ会社（cookie の会社）に有効な所属があればそれ、
 * 無ければ一番古い有効な所属。有効な所属が無ければ null（全体管理者もここでは null）。
 */
export async function activeMembershipFor(
  db: DB,
  userId: string,
  preferredCompanyId: string | null,
): Promise<ActiveMembership | null> {
  const all = await activeMembershipsOf(db, userId);
  return all.find((x) => x.companyId === preferredCompanyId) ?? all[0] ?? null;
}

/** その会社での所属（有効かどうかは問わない）。無ければ null */
export async function membershipIn(db: DB, userId: string, companyId: string): Promise<Membership | null> {
  const row = (
    await db
      .select()
      .from(m)
      .where(and(eq(m.userId, userId), eq(m.companyId, companyId)))
      .limit(1)
  )[0];
  return row ?? null;
}

/** その利用者が、指定した会社のほかにも所属を持つか（停止中の会社の所属も数える） */
export async function hasMembershipElsewhere(db: DB, userId: string, companyId: string): Promise<boolean> {
  const row = (
    await db
      .select({ id: m.id })
      .from(m)
      .where(and(eq(m.userId, userId), ne(m.companyId, companyId)))
      .limit(1)
  )[0];
  return Boolean(row);
}

/**
 * 上長の候補（その会社での所属と、利用中か）。上長は部下と同じ会社に所属している人だけ。
 * 利用中か・マネージャー以上かは呼び出し側（assertCompanyRefs）が見て、断る文を出し分ける。
 * 会社が使えるか（停止中・テンプレート）は見ない。それは部下の側の確かめ（assertCompanyAssignable）が受け持ち、
 * 停止中の会社にいる利用停止の人を直すときに、今の上長のままで保存できるようにする。
 */
export async function managerCandidateIn(db: DB, managerId: string, companyId: string) {
  const row = (
    await db
      .select({ id: s.users.id, role: m.role, isActive: s.users.isActive })
      .from(m)
      .innerJoin(s.users, eq(s.users.id, m.userId))
      .where(and(eq(m.userId, managerId), eq(m.companyId, companyId)))
      .limit(1)
  )[0];
  return row ?? null;
}

/** その会社で、指定した人を上長にしている所属の持ち主（部下）。名前を返す */
export async function reportsIn(db: DB, managerId: string, companyId: string, limit = 3) {
  return db
    .select({ id: s.users.id, name: s.users.name })
    .from(m)
    .innerJoin(s.users, eq(s.users.id, m.userId))
    .where(and(eq(m.managerId, managerId), eq(m.companyId, companyId)))
    .orderBy(asc(s.users.name))
    .limit(limit);
}

/** 上長の連鎖をたどるときの「この人の上長」。会社ごとに上長が違うので会社を必ず渡す */
export async function managerOfIn(db: DB, userId: string, companyId: string): Promise<string | null> {
  const row = (
    await db
      .select({ managerId: m.managerId })
      .from(m)
      .where(and(eq(m.userId, userId), eq(m.companyId, companyId)))
      .limit(1)
  )[0];
  return row?.managerId ?? null;
}

/** 所属の値を users の写しの形にする */
function copyOf(values: { companyId: string } & MembershipValues) {
  const copy: Record<string, unknown> = { companyId: values.companyId };
  for (const k of VALUE_KEYS) if (values[k] !== undefined) copy[k] = values[k];
  return copy;
}

function membershipSelection() {
  return {
    id: m.id,
    userId: m.userId,
    ...memberColumns,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/**
 * 新しい所属を作る文。最初の所属（ほかに有効な所属が無い）なら users の写しも同じ batch で書く。
 * 社員の発行では利用者の行を同じ batch の先頭で作り、writeCopy: true で写しも作る。
 */
export async function insertMembership(
  db: DB,
  values: { userId: string; companyId: string } & MembershipValues,
  opts: { writeCopy?: boolean; id?: string } = {},
): Promise<SqliteBatchItem[]> {
  const initial = {
    companyId: values.companyId,
    role: values.role ?? "EMPLOYEE",
    gradeId: values.gradeId ?? null,
    officeId: values.officeId ?? null,
    managerId: values.managerId ?? null,
    employeeCode: values.employeeCode ?? null,
    department: values.department ?? null,
    hiredAt: values.hiredAt ?? null,
    profileNote: values.profileNote ?? null,
  };
  const statements: SqliteBatchItem[] = [
    db.insert(m).values({
      id: opts.id ?? `mem_${crypto.randomUUID()}`,
      userId: values.userId,
      ...initial,
    }),
  ];
  const writeCopy = opts.writeCopy ?? (await activeMembershipsOf(db, values.userId)).length === 0;
  if (writeCopy) {
    statements.push(db.update(s.users).set(copyOf(initial)).where(eq(s.users.id, values.userId)));
  }
  return statements;
}

/**
 * その会社の所属の値を変える文。変える所属が元の所属（一番古い有効な所属）なら、users の写しも
 * 同じ値に書き換える文を足す。元でない所属を変えても写しは変えない。
 * 返した文は、呼び出し側がほかの書き込みと同じ batch に入れて実行する。
 */
export async function writeMembership(
  db: DB,
  userId: string,
  companyId: string,
  patch: MembershipValues,
): Promise<SqliteBatchItem[]> {
  const values: MembershipValues = {};
  for (const k of VALUE_KEYS) if (patch[k] !== undefined) (values as Record<string, unknown>)[k] = patch[k];
  if (Object.keys(values).length === 0) return [];

  const statements: SqliteBatchItem[] = [
    db
      .update(m)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(m.userId, userId), eq(m.companyId, companyId))),
  ];
  const primary = (await activeMembershipsOf(db, userId))[0];
  if (primary?.companyId === companyId) {
    statements.push(db.update(s.users).set(copyOf({ ...fullValues(primary), ...values })).where(eq(s.users.id, userId)));
  }
  return statements;
}

/** 会社を再開するとき、影響を受ける人の写しを再開後の最古の有効な所属へ戻す。利用停止は解除しない。 */
export async function resumeCompanyStatements(db: DB, companyId: string): Promise<SqliteBatchItem[]> {
  const rows = await db
    .select(membershipSelection())
    .from(m)
    .innerJoin(s.companies, eq(s.companies.id, m.companyId))
    .where(and(
      inArray(m.userId, db.select({ userId: otherMembership.userId }).from(otherMembership).where(eq(otherMembership.companyId, companyId))),
      eq(s.companies.isTemplate, false),
      or(eq(s.companies.isActive, true), eq(s.companies.id, companyId)),
    ))
    .orderBy(asc(m.createdAt), asc(m.id));
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.userId)) return [];
    seen.add(row.userId);
    return [db.update(s.users).set(copyOf(fullValues(row))).where(eq(s.users.id, row.userId))];
  });
}

/**
 * ある会社の所属を使えなくなる（外す・会社を止める）とき、users の写しを残る所属へ移す文。
 * 写しがその会社を指していないなら何もしない。残る有効な所属が無ければ remaining は null。
 */
export async function moveCopyAway(db: DB, userId: string, leavingCompanyId: string) {
  const remaining = (await activeMembershipsOf(db, userId)).filter((x) => x.companyId !== leavingCompanyId);
  const next = remaining[0] ?? null;
  const current = (
    await db.select({ companyId: s.users.companyId }).from(s.users).where(eq(s.users.id, userId)).limit(1)
  )[0];
  const statements: SqliteBatchItem[] = [];
  if (next && current?.companyId === leavingCompanyId) {
    statements.push(db.update(s.users).set(copyOf(fullValues(next))).where(eq(s.users.id, userId)));
  }
  return { statements, remaining: next };
}

/**
 * 会社を止めるときの文。会社の停止と同じ batch に、会社の停止より後ろへ入れる。
 *  1. 写しがその会社を指していて、ほかに有効な所属がある人は、写しを残る一番古い所属へ移す。
 *  2. その会社に所属し（または写しがその会社を指し）、ほかに有効な所属が1つも残らない人を止める。
 * 所属の行は消さない（会社を再開したときに戻せるように）。
 * 人数が多くても D1 の引数の上限（100個）に当たらないよう、2 は副問い合わせで書く。
 */
export async function stopCompanyStatements(db: DB, companyId: string): Promise<SqliteBatchItem[]> {
  const moving = await db
    .select(membershipSelection())
    .from(m)
    .innerJoin(s.users, eq(s.users.id, m.userId))
    .innerJoin(s.companies, eq(s.companies.id, m.companyId))
    .where(and(eq(s.users.companyId, companyId), ne(m.companyId, companyId), activeCompanyCondition()))
    .orderBy(asc(m.createdAt), asc(m.id));

  const statements: SqliteBatchItem[] = [];
  const seen = new Set<string>();
  for (const row of moving) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    statements.push(db.update(s.users).set(copyOf(fullValues(row))).where(eq(s.users.id, row.userId)));
  }

  statements.push(
    db
      .update(s.users)
      .set({ isActive: false })
      .where(
        and(
          or(
            inArray(s.users.id, db.select({ id: m.userId }).from(m).where(eq(m.companyId, companyId))),
            eq(s.users.companyId, companyId),
          ),
          notExists(
            db
              .select({ one: sql`1` })
              .from(otherMembership)
              .innerJoin(otherCompany, eq(otherCompany.id, otherMembership.companyId))
              .where(
                and(
                  eq(otherMembership.userId, s.users.id),
                  ne(otherMembership.companyId, companyId),
                  eq(otherCompany.isActive, true),
                  eq(otherCompany.isTemplate, false),
                ),
              ),
          ),
        ),
      ),
  );
  return statements;
}

function fullValues(row: Pick<Membership, "companyId" | (typeof VALUE_KEYS)[number]>) {
  return {
    companyId: row.companyId,
    role: row.role as MembershipRole,
    gradeId: row.gradeId,
    officeId: row.officeId,
    managerId: row.managerId,
    employeeCode: row.employeeCode,
    department: row.department,
    hiredAt: row.hiredAt,
    profileNote: row.profileNote,
  };
}

/** その利用者の所属を、会社が停止中かどうかを問わず古い順に返す（全体管理者の利用者画面で使う） */
export async function membershipsOf(db: DB, userId: string) {
  return db
    .select({ ...membershipSelection(), companyName: s.companies.name, companyActive: s.companies.isActive })
    .from(m)
    .innerJoin(s.companies, eq(s.companies.id, m.companyId))
    .where(eq(m.userId, userId))
    .orderBy(asc(m.createdAt), asc(m.id));
}

/** その利用者が、どこかの会社で上長に設定されているか（利用を止める前に確かめる） */
export async function hasReportsAnywhere(db: DB, managerId: string): Promise<boolean> {
  const row = (await db.select({ id: m.id }).from(m).where(eq(m.managerId, managerId)).limit(1))[0];
  return Boolean(row);
}

/**
 * 所属が1つだけの人の会社を移す文（全体管理者の利用者画面）。所属の行の会社と値を書き換え、
 * 元の所属なので users の写しも同じ値にする。所属が2つ以上ある人には使わない（足す・外すで扱う）。
 */
export function moveOnlyMembershipStatements(
  db: DB,
  membershipId: string,
  userId: string,
  values: { companyId: string } & MembershipValues,
): SqliteBatchItem[] {
  const patch: Record<string, unknown> = { companyId: values.companyId, updatedAt: new Date() };
  for (const k of VALUE_KEYS) if (values[k] !== undefined) patch[k] = values[k];
  return [
    db.update(m).set(patch).where(eq(m.id, membershipId)),
    db.update(s.users).set(copyOf(values)).where(eq(s.users.id, userId)),
  ];
}

/**
 * 全体管理者にする文。全体管理者は所属を持たないので、所属を全て消し、users の写しを空にする。
 * 上長に設定されている間は呼ばない（呼び出し側で hasReportsAnywhere を確かめる）。
 */
export function promoteToSuperAdminStatements(db: DB, userId: string): SqliteBatchItem[] {
  return [
    db.delete(m).where(eq(m.userId, userId)),
    db
      .update(s.users)
      .set({ role: "SUPER_ADMIN", companyId: null, gradeId: null, officeId: null, managerId: null })
      .where(eq(s.users.id, userId)),
  ];
}

/**
 * 全体管理者を会社の役割へ下げる文。users の更新は guard（最後の全体管理者を落とさない条件）を満たすときだけ行い、
 * 所属の行は「users がもう全体管理者でない」ときだけ作る。どちらも同じ batch に入れるので、
 * guard で更新が止まったときは所属も作られない。1つ目の文は更新した行を返す（0行なら降格していない）。
 * 氏名などの利用者全体の値も同じ条件で変えるときは userPatch に渡す（1つの更新にまとめる）。
 */
export function demoteFromSuperAdminStatements(
  db: DB,
  values: { userId: string; companyId: string; role: MembershipRole } & MembershipValues,
  guard: SQL,
  userPatch: Record<string, unknown> = {},
): SqliteBatchItem[] {
  const now = Date.now();
  const id = `mem_${crypto.randomUUID()}`;
  return [
    db
      .update(s.users)
      .set({ ...userPatch, ...copyOf(values) })
      .where(and(eq(s.users.id, values.userId), guard))
      .returning({ id: s.users.id }),
    db.run(sql`
      insert into ${m} (id, user_id, company_id, role, grade_id, office_id, manager_id, employee_code, department, hired_at, profile_note, created_at, updated_at)
      select ${id}, ${values.userId}, ${values.companyId}, ${values.role}, ${values.gradeId ?? null}, ${values.officeId ?? null},
             ${values.managerId ?? null}, ${values.employeeCode ?? null}, ${values.department ?? null}, ${values.hiredAt ?? null},
             ${values.profileNote ?? null}, ${now}, ${now}
      where exists (select 1 from ${s.users} as demoted where demoted.id = ${values.userId} and demoted.role <> 'SUPER_ADMIN')
    `),
  ];
}
