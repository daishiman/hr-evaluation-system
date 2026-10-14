import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { COMPANY_SCOPE_COOKIE, type Viewer } from "@/lib/session";
import { FORBIDDEN_MESSAGE as FORBIDDEN } from "@/test-support/action-mocks";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";
import { activeMembershipFor } from "@/lib/memberships";

/*
 * 1人が複数の会社に所属する（S7・A6・D-004）。
 *
 * 会社ごとの値（役割・等級・事業所・上司・社員番号・部署・入社日・人物メモ）は所属の表が正本。
 * 利用者全体の値（氏名・メール・利用中か・資格情報）は users が正本。
 * 確かめるのは次のとおり。
 *  - 会社の選び方: cookie の会社に有効な所属があればそれ、無ければ一番古い有効な所属。停止中・テンプレートの会社は選ばない。
 *  - 切り替え: 全ての役割が使える。所属の無い会社・停止中の会社へは 403 で、cookie を置かない。
 *  - 所属の追加: 全体管理者だけ。パスワードを変えず、初期パスワードも発行しない。全体管理者には足せない。
 *  - 会社の管理者の限界: 他社にもいる人の氏名・パスワード・利用の停止・控えは 403。自社の所属の行は扱える。
 *  - 漏れ: B社の社員番号・人物メモが A社の一覧に出ない。等級の結合は会社の条件付き。
 *  - 上司: 同じ会社に有効な所属がある人だけ。部下が残る所属を外すと 409。
 *  - 会社の停止: 有効な所属が1つも残らない人だけを止める。
 *  - 古い画面: 画面を描いた会社（__scope）と今の会社が違えば 409 で、何も書かない。
 */

const COMPANY_B = "cmp_b";
const COMPANY_C = "cmp_c";
const TEMPLATE = "cmp_template";
const DUAL = "usr_dual";
const SOLO = "usr_solo";
const ADMIN_A = "usr_admin_a";
const ADMIN_B = "usr_admin_b";
const MGR_B = "usr_mgr_b";
const SUPER = "usr_super";
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const SCOPE_CONFLICT = "別の画面で会社を切り替えたため、この画面の内容は古くなっています。再読み込みしてください。";

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (mocked.jar.has(name) ? { name, value: mocked.jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => mocked.jar.set(name, { value, options }),
  }),
}));
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: mocked.env }) }));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("この試験では認証ライブラリを使わない");
  },
}));

import { addMembership, removeMembership } from "@/actions/memberships";
import { switchCompanyScope } from "@/actions/company-scope";
import { createMember, updateMember } from "@/actions/members";
import { updateCompany } from "@/actions/companies";
import { revealCredentialMemo } from "@/actions/credential-memos";
import { listAllUsers, listMembers } from "@/lib/queries";

let t: TestDatabase;

function as(role: Viewer["role"], id: string, companyId: string | null): Viewer {
  return {
    id,
    name: "操作する人",
    email: `${id}@example.com`,
    role,
    companyId,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: null,
    mustChangePassword: false,
  } as Viewer;
}

const WATCHED_TABLES = ["users", "company_memberships", "accounts", "initial_credential_memos", "sessions", "companies"];

function snapshot() {
  return Object.fromEntries(
    WATCHED_TABLES.map((name) => [name, t.raw.prepare(`select * from ${name} order by 1`).all()]),
  );
}

async function membership(userId: string, companyId: string) {
  return (
    await t.db
      .select()
      .from(s.companyMemberships)
      .where(and(eq(s.companyMemberships.userId, userId), eq(s.companyMemberships.companyId, companyId)))
      .limit(1)
  )[0];
}

async function userRow(id: string) {
  return (await t.db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0];
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.companies).values([
    { id: COMPANY_B, name: "B社", slug: "b" },
    { id: COMPANY_C, name: "C社", slug: "c" },
    { id: TEMPLATE, name: "標準テンプレート", slug: "template", isTemplate: true },
  ]);
  await t.db.insert(s.grades).values({
    id: "grd_b",
    companyId: COMPANY_B,
    code: "regular",
    name: "等級2",
    pointGroup: "Regular",
    displayOrder: 2,
    targetCap: 5,
  });
  await t.db.insert(s.users).values([
    { id: SUPER, name: "システム管理者", email: "super@example.com", companyId: null, role: "SUPER_ADMIN" },
    { id: ADMIN_A, name: "A社の管理者", email: "admin-a@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: ADMIN_B, name: "B社の管理者", email: "admin-b@example.com", companyId: COMPANY_B, role: "COMPANY_ADMIN" },
    { id: MGR_B, name: "B社の上長", email: "mgr-b@example.com", companyId: COMPANY_B, role: "MANAGER" },
    {
      id: DUAL,
      name: "2社に所属する人",
      email: "dual@example.com",
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      employeeCode: "A-001",
      profileNote: "A社のメモ",
    },
    { id: SOLO, name: "A社だけの人", email: "solo@example.com", companyId: IDS.company, role: "EMPLOYEE" },
  ]);
  await t.db.insert(s.companyMemberships).values([
    { id: "mem_emp", userId: IDS.employee, companyId: IDS.company, role: "EMPLOYEE", gradeId: IDS.gradeFrom, managerId: IDS.evaluator, createdAt: day(1) },
    { id: "mem_mgr", userId: IDS.evaluator, companyId: IDS.company, role: "MANAGER", gradeId: IDS.gradeTo, createdAt: day(1) },
    { id: "mem_admin_a", userId: ADMIN_A, companyId: IDS.company, role: "COMPANY_ADMIN", createdAt: day(1) },
    { id: "mem_admin_b", userId: ADMIN_B, companyId: COMPANY_B, role: "COMPANY_ADMIN", createdAt: day(1) },
    { id: "mem_mgr_b", userId: MGR_B, companyId: COMPANY_B, role: "MANAGER", createdAt: day(1) },
    {
      id: "mem_dual_a",
      userId: DUAL,
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      employeeCode: "A-001",
      profileNote: "A社のメモ",
      createdAt: day(2),
    },
    {
      id: "mem_dual_b",
      userId: DUAL,
      companyId: COMPANY_B,
      role: "MANAGER",
      gradeId: "grd_b",
      employeeCode: "B-777",
      department: "B社の営業部",
      profileNote: "B社だけのメモ",
      createdAt: day(3),
    },
    { id: "mem_solo", userId: SOLO, companyId: IDS.company, role: "EMPLOYEE", createdAt: day(2) },
  ]);
  await t.db.insert(s.accounts).values({
    id: "acc_dual",
    accountId: DUAL,
    providerId: "credential",
    userId: DUAL,
    password: "dual-hash",
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.jar.clear();
  mocked.env = { CREDENTIAL_ENC_KEY: KEY };
  mocked.viewer = as("SUPER_ADMIN", SUPER, IDS.company);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("どの所属を使うか（activeMembershipFor）", () => {
  it("選んだ会社に有効な所属があれば、その会社の役割・等級・社員番号を使う", async () => {
    const m = await activeMembershipFor(t.db, DUAL, COMPANY_B);
    expect(m).toMatchObject({ companyId: COMPANY_B, role: "MANAGER", gradeId: "grd_b", employeeCode: "B-777" });
  });

  it("選んだ会社が無い・所属していないときは、一番古い有効な所属", async () => {
    expect(await activeMembershipFor(t.db, DUAL, null)).toMatchObject({ companyId: IDS.company, role: "EMPLOYEE" });
    expect(await activeMembershipFor(t.db, DUAL, COMPANY_C)).toMatchObject({ companyId: IDS.company });
  });

  it("停止中の会社とテンプレートの会社の所属は選ばない。有効な所属が無ければ null", async () => {
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, IDS.company));
    expect(await activeMembershipFor(t.db, DUAL, IDS.company)).toMatchObject({ companyId: COMPANY_B });
    expect(await activeMembershipFor(t.db, SOLO, IDS.company)).toBeNull();

    await t.db.insert(s.companyMemberships).values({ id: "mem_solo_tpl", userId: SOLO, companyId: TEMPLATE, role: "EMPLOYEE" });
    expect(await activeMembershipFor(t.db, SOLO, TEMPLATE)).toBeNull();
  });

  it("全体管理者は所属を持たない", async () => {
    expect(await activeMembershipFor(t.db, SUPER, IDS.company)).toBeNull();
  });
});

describe("会社の切り替え（switchCompanyScope）", () => {
  it("所属が2つある一般の社員も、所属している会社へ切り替えられる", async () => {
    mocked.viewer = as("EMPLOYEE", DUAL, IDS.company);

    const result = await switchCompanyScope({ companyId: COMPANY_B });

    expect(result).toMatchObject({ ok: true });
    expect(mocked.jar.get(COMPANY_SCOPE_COOKIE)?.value).toBe(COMPANY_B);
  });

  it.each([
    { label: "所属していない会社", companyId: COMPANY_C },
    { label: "存在しない会社", companyId: "cmp_missing" },
    { label: "テンプレートの会社", companyId: TEMPLATE },
  ])("$label へは 403 で、cookie を置かない", async ({ companyId }) => {
    mocked.viewer = as("EMPLOYEE", DUAL, IDS.company);

    const result = await switchCompanyScope({ companyId });

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
    expect(mocked.jar.size).toBe(0);
  });

  it("停止中の会社の所属へは切り替えられない", async () => {
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, COMPANY_B));
    mocked.viewer = as("EMPLOYEE", DUAL, IDS.company);

    expect(await switchCompanyScope({ companyId: COMPANY_B })).toMatchObject({ ok: false });
    expect(mocked.jar.size).toBe(0);
  });

  it("全体管理者は、有効でテンプレートでない会社ならどこへでも切り替えられる", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, IDS.company);
    expect(await switchCompanyScope({ companyId: COMPANY_C })).toMatchObject({ ok: true });
    expect(mocked.jar.get(COMPANY_SCOPE_COOKIE)?.value).toBe(COMPANY_C);
  });
});

describe("所属の追加（addMembership）", () => {
  it("停止会社だけに所属する人へ有効な所属を足すと、新所属で未指定の会社別値も写しから消す", async () => {
    await t.db.update(s.users).set({ officeId: IDS.office, profileNote: "停止会社だけのメモ" }).where(eq(s.users.id, SOLO));
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, IDS.company));
    expect(await addMembership({ userId: SOLO, companyId: COMPANY_B, role: "EMPLOYEE" })).toMatchObject({ ok: true });
    expect(await userRow(SOLO)).toMatchObject({ companyId: COMPANY_B, role: "EMPLOYEE", officeId: null, profileNote: null });
  });

  it("全体管理者は既存の利用者に所属を足せる。パスワードは変えず、初期パスワードも発行しない", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);
    const accountsBefore = t.raw.prepare("select * from accounts order by 1").all();
    const memosBefore = t.raw.prepare("select * from initial_credential_memos order by 1").all();
    const userBefore = await userRow(SOLO);

    const result = await addMembership({ userId: SOLO, companyId: COMPANY_B, role: "EMPLOYEE" });

    expect(result).toMatchObject({ ok: true });
    expect(await membership(SOLO, COMPANY_B)).toMatchObject({ role: "EMPLOYEE" });
    expect(t.raw.prepare("select * from accounts order by 1").all()).toEqual(accountsBefore);
    expect(t.raw.prepare("select * from initial_credential_memos order by 1").all()).toEqual(memosBefore);
    expect(await userRow(SOLO)).toEqual(userBefore);
  });

  it.each([
    { role: "COMPANY_ADMIN" as const, id: ADMIN_B, companyId: COMPANY_B },
    { role: "MANAGER" as const, id: MGR_B, companyId: COMPANY_B },
    { role: "EMPLOYEE" as const, id: DUAL, companyId: COMPANY_B },
  ])("$role は 403 で、何も書かない", async ({ role, id, companyId }) => {
    mocked.viewer = as(role, id, companyId);
    const before = snapshot();

    const result = await addMembership({ userId: SOLO, companyId: COMPANY_B, role: "EMPLOYEE" });

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
    expect(snapshot()).toEqual(before);
  });

  it("全体管理者には所属を足せない", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);
    const before = snapshot();

    const result = await addMembership({ userId: SUPER, companyId: COMPANY_B, role: "COMPANY_ADMIN" });

    expect(result).toEqual({ ok: false, message: "この利用者には所属を足せません。" });
    expect(snapshot()).toEqual(before);
  });

  it("すでに所属している会社・テンプレートの会社・停止中の会社へは足さない", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, COMPANY_C));
    const before = snapshot();

    for (const companyId of [COMPANY_B, TEMPLATE, COMPANY_C]) {
      expect(await addMembership({ userId: DUAL, companyId, role: "EMPLOYEE" })).toMatchObject({ ok: false });
    }
    expect(snapshot()).toEqual(before);
  });

  it("上司は、足す先の会社に有効な所属がある人だけ", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);

    const wrong = await addMembership({ userId: SOLO, companyId: COMPANY_B, role: "EMPLOYEE", managerId: IDS.evaluator });
    expect(wrong).toMatchObject({ ok: false });
    expect(await membership(SOLO, COMPANY_B)).toBeUndefined();

    const right = await addMembership({ userId: SOLO, companyId: COMPANY_B, role: "EMPLOYEE", managerId: MGR_B });
    expect(right).toMatchObject({ ok: true });
  });

  it("会社の管理者が、登録済みのメールで社員を作ろうとすると、これまでと同じ言い方で断る（他社の存在を漏らさない）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_B, COMPANY_B);
    const before = snapshot();

    const result = await createMember({
      name: "同じメールの人",
      email: "SOLO@example.com",
      password: "temp-pass-for-audit-0001",
      role: "EMPLOYEE",
    });

    expect(result).toEqual({ ok: false, message: "このメールアドレスはすでに登録されています。" });
    expect(snapshot()).toEqual(before);
  });

  it("会社の管理者が社員を作ると、その会社の所属も同じ batch で作る", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_B, COMPANY_B);

    const result = await createMember({
      name: "新しい人",
      email: "new@example.com",
      password: "temp-pass-for-audit-0001",
      role: "EMPLOYEE",
      employeeCode: "B-100",
    });

    expect(result).toMatchObject({ ok: true });
    const created = (await t.db.select().from(s.users).where(eq(s.users.email, "new@example.com")))[0];
    expect(await membership(created.id, COMPANY_B)).toMatchObject({ role: "EMPLOYEE", employeeCode: "B-100" });
  });
});

describe("会社の管理者は、他社にもいる人の利用者全体の値を変えられない", () => {
  it.each([
    { label: "氏名", input: { name: "勝手に変える" } },
    { label: "パスワードの再発行", input: { password: "another-pass-0001" } },
    { label: "利用の停止", input: { isActive: false } },
  ])("$label は 403 で、何も書かない", async ({ input }) => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    const before = snapshot();

    const result = await updateMember({ userId: DUAL, ...input });

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
    expect(snapshot()).toEqual(before);
  });

  it("初期パスワードの控えも開けない（全体管理者だけ）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);

    const result = await revealCredentialMemo({ userId: DUAL });

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
  });

  it("自社の所属の行（役割・社員番号・人物メモ）は扱え、他社の所属の行は変わらない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    const otherBefore = await membership(DUAL, COMPANY_B);

    const result = await updateMember({ userId: DUAL, role: "MANAGER", employeeCode: "A-002", profileNote: "A社の新しいメモ" });

    expect(result).toMatchObject({ ok: true });
    expect(await membership(DUAL, IDS.company)).toMatchObject({
      role: "MANAGER",
      employeeCode: "A-002",
      profileNote: "A社の新しいメモ",
    });
    expect(await membership(DUAL, COMPANY_B)).toEqual(otherBefore);
  });

  it("元の所属（一番古い所属）を変えたときは、users の写しも同じ値になる。元でない所属を変えても写しは変わらない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    await updateMember({ userId: DUAL, employeeCode: "A-003" });
    expect((await userRow(DUAL)).employeeCode).toBe("A-003");

    mocked.viewer = as("COMPANY_ADMIN", ADMIN_B, COMPANY_B);
    await updateMember({ userId: DUAL, employeeCode: "B-999" });
    expect((await userRow(DUAL)).employeeCode).toBe("A-003");
    expect((await membership(DUAL, COMPANY_B)).employeeCode).toBe("B-999");
  });

  it("その会社だけに所属する人なら、これまでどおり氏名と利用の停止を扱える", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);

    expect(await updateMember({ userId: SOLO, name: "改名した人" })).toMatchObject({ ok: true });
    expect((await userRow(SOLO)).name).toBe("改名した人");
  });

  it("他社の上司は指せない（同じ会社に有効な所属がある人だけ）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    const before = snapshot();

    const result = await updateMember({ userId: SOLO, managerId: MGR_B });

    expect(result).toEqual({ ok: false, message: "この会社に登録されていない上長です。" });
    expect(snapshot()).toEqual(before);
  });
});

describe("会社ごとの値が他社に出ない", () => {
  it("A社の一覧には A社の所属の値だけが出て、B社の社員番号・部署・人物メモは出ない", async () => {
    const rowsA = await listMembers(IDS.company);
    const dualA = rowsA.find((r) => r.id === DUAL);
    expect(dualA).toMatchObject({ role: "EMPLOYEE", employeeCode: "A-001", profileNote: "A社のメモ", gradeId: IDS.gradeFrom });
    const text = JSON.stringify(rowsA);
    for (const leaked of ["B-777", "B社の営業部", "B社だけのメモ", "grd_b"]) expect(text).not.toContain(leaked);

    const rowsB = await listMembers(COMPANY_B);
    expect(rowsB.find((r) => r.id === DUAL)).toMatchObject({ role: "MANAGER", employeeCode: "B-777", gradeName: "等級2" });
    expect(JSON.stringify(rowsB)).not.toContain("A社のメモ");
  });

  it("一覧はその会社に所属する人だけを出す（所属を足していない会社には出ない）", async () => {
    expect((await listMembers(COMPANY_B)).map((r) => r.id).sort()).toEqual([ADMIN_B, DUAL, MGR_B].sort());
    expect(await listMembers(COMPANY_C)).toEqual([]);
  });

  it("所属の等級が他社の等級を指していても、等級名は出さない（結合に会社の条件がある）", async () => {
    await t.db.update(s.companyMemberships).set({ gradeId: IDS.gradeTo }).where(eq(s.companyMemberships.id, "mem_dual_b"));
    const dualB = (await listMembers(COMPANY_B)).find((r) => r.id === DUAL);
    expect(dualB?.gradeName ?? null).toBeNull();
  });

  it("全体管理者の利用者一覧は所属ごとに1行で、行ごとの会社の値を出す", async () => {
    const rows = (await listAllUsers()).filter((r) => r.id === DUAL);
    expect(rows.map((r) => [r.companyId, r.role, r.employeeCode]).sort()).toEqual(
      [
        [IDS.company, "EMPLOYEE", "A-001"],
        [COMPANY_B, "MANAGER", "B-777"],
      ].sort(),
    );
  });
});

describe("所属を外す（removeMembership）", () => {
  it("その会社で部下が残る所属を外すと 409 で、部下の名前を示し、何も書かない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    const before = snapshot();

    const result = await removeMembership({ userId: IDS.evaluator });

    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain("本人");
    expect(snapshot()).toEqual(before);
  });

  it("部下がいなければ外せる。他社の所属と利用者は残り、users の写しは残る所属へ書き換える", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);

    const result = await removeMembership({ userId: DUAL });

    expect(result).toMatchObject({ ok: true });
    expect(await membership(DUAL, IDS.company)).toBeUndefined();
    expect(await membership(DUAL, COMPANY_B)).toBeDefined();
    const user = await userRow(DUAL);
    expect(user.isActive).toBe(true);
    expect(user).toMatchObject({ companyId: COMPANY_B, role: "MANAGER", employeeCode: "B-777" });
  });

  it("会社の管理者は他社の所属を外せない（自社の所属だけを対象にする）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_B, COMPANY_B);
    const before = snapshot();

    const result = await removeMembership({ userId: SOLO });

    expect(result).toMatchObject({ ok: false });
    expect(snapshot()).toEqual(before);
  });

  it("自分の所属は外せない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    expect(await removeMembership({ userId: ADMIN_A })).toMatchObject({ ok: false });
    expect(await membership(ADMIN_A, IDS.company)).toBeDefined();
  });
});

describe("会社の停止（updateCompany）", () => {
  it("元の所属の部分更新で、古い写しの他社の値も全て元の所属へ戻す", async () => {
    await t.db.update(s.users).set({ companyId: COMPANY_B, role: "MANAGER", gradeId: "grd_b", department: "B社の部署", profileNote: "B社のメモ" }).where(eq(s.users.id, DUAL));
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    expect(await updateMember({ userId: DUAL, employeeCode: "A-005" })).toMatchObject({ ok: true });
    expect(await userRow(DUAL)).toMatchObject({ companyId: IDS.company, role: "EMPLOYEE", gradeId: IDS.gradeFrom, employeeCode: "A-005", department: null, profileNote: "A社のメモ" });
  });

  it("最古の会社を再開すると所属の写しを全列戻し、その後の部分更新にも他社の値を混ぜない", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);
    await updateCompany({ companyId: IDS.company, isActive: false });
    expect(await userRow(DUAL)).toMatchObject({ companyId: COMPANY_B, role: "MANAGER", gradeId: "grd_b" });
    expect(await updateCompany({ companyId: IDS.company, isActive: true })).toMatchObject({ ok: true });
    expect(await userRow(DUAL)).toMatchObject({ companyId: IDS.company, role: "EMPLOYEE", gradeId: IDS.gradeFrom, employeeCode: "A-001", profileNote: "A社のメモ", department: null });
    expect((await userRow(SOLO)).isActive).toBe(false);
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    await updateMember({ userId: DUAL, employeeCode: "A-004" });
    expect(await userRow(DUAL)).toMatchObject({ companyId: IDS.company, role: "EMPLOYEE", gradeId: IDS.gradeFrom, employeeCode: "A-004", department: null });
  });

  it("有効な所属が1つも残らない人だけを止め、所属は残す。他社に所属が残る人は止めない", async () => {
    mocked.viewer = as("SUPER_ADMIN", SUPER, null);

    const result = await updateCompany({ companyId: IDS.company, isActive: false });

    expect(result).toMatchObject({ ok: true });
    expect((await userRow(SOLO)).isActive).toBe(false);
    expect((await userRow(IDS.employee)).isActive).toBe(false);
    const dual = await userRow(DUAL);
    expect(dual.isActive).toBe(true);
    expect(dual.companyId).toBe(COMPANY_B);
    expect(await membership(SOLO, IDS.company)).toBeDefined();
    expect(await membership(DUAL, IDS.company)).toBeDefined();
  });
});

describe("古い画面からの書き込み（__scope）", () => {
  it("画面を描いた会社と今の会社が違えば 409 で、何も書かない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    const before = snapshot();

    const result = await updateMember({ userId: SOLO, name: "古い画面から", __scope: COMPANY_B });

    expect(result).toEqual({ ok: false, message: SCOPE_CONFLICT });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("同じ会社なら __scope を取り除いてから入力を確かめ、保存する", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);

    const result = await updateMember({ userId: SOLO, name: "同じ画面から", __scope: IDS.company });

    expect(result).toMatchObject({ ok: true });
    expect((await userRow(SOLO)).name).toBe("同じ画面から");
  });

  it("__scope が無い呼び出し（画面の外から）は、これまでどおり通す", async () => {
    mocked.viewer = as("COMPANY_ADMIN", ADMIN_A, IDS.company);
    expect(await updateMember({ userId: SOLO, name: "そのまま" })).toMatchObject({ ok: true });
  });
});
