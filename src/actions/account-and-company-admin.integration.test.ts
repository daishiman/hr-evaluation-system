import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { COMPANY_SCOPE_COOKIE, type Viewer } from "@/lib/session";
import { UNEXPECTED_ERROR_MESSAGE } from "@/lib/api";
import { FORBIDDEN_MESSAGE as FORBIDDEN } from "@/test-support/action-mocks";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * アカウント設定と会社管理の保存（backlog SECURITY-001）。
 *
 * API の口から Server Action へ移した書き込みのうち、試験が無かった5つを監査する。
 * 確かめるのは次の3つ。
 *  - 認可: 役割が足りない呼び出しは、どの表も書かず、画面も描き直さない。
 *    本人の登録内容は本人の行だけで、他人・役割・所属を指す項目は受け取らない。
 *  - 漏えい: 応答に仮パスワード・ハッシュ・控えの値が入らない。想定外の失敗は中身を伏せる。
 *  - 別のサイトからの送信: 入口（apiViewer → assertSameOrigin）が断る。ここでは apiViewer を
 *    差し替えるので、その確認は src/lib/action-origin.test.ts が受け持つ。
 */

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)));
const OTHER_COMPANY = "cmp_other";
const PASSWORD = "temp-pass-for-audit-0001";
const DAY_MS = 24 * 60 * 60 * 1000;

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
    set: (name: string, value: string, options: Record<string, unknown>) => mocked.jar.set(name, { value, options }),
  }),
}));

// 役割の判定は本物の atLeast で行う（入口が求める役割を、テストで取り違えないため）
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

// 登録内容の変更は認証ライブラリを使わない。呼ばれたら試験の前提が崩れているので落とす
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("この試験では認証ライブラリを使わない");
  },
}));

import { createMember, updateMember } from "@/actions/members";
import { updateOwnProfile } from "@/actions/account";
import { updateCompany } from "@/actions/companies";
import { switchCompanyScope } from "@/actions/company-scope";
import { createSystemUser, updateSystemUser } from "@/actions/system-users";

let t: TestDatabase;

function as(role: Viewer["role"], id: string, companyId: string | null = IDS.company): Viewer {
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
    companyName: "テスト社",
    mustChangePassword: false,
  } as Viewer;
}

/** 書き込みの有無を見る表。断られた呼び出しの前後で、1行も変わっていないことを比べる。 */
const WATCHED_TABLES = ["users", "companies", "accounts", "initial_credential_memos", "sessions", "profile_field_policies"];

function snapshot() {
  return Object.fromEntries(
    WATCHED_TABLES.map((name) => [name, t.raw.prepare(`select * from ${name} order by 1`).all()]),
  );
}

async function userRow(id: string) {
  return (await t.db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0];
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "別の会社", slug: "other" });
  await t.db.insert(s.users).values([
    { id: "usr_super", name: "システム管理者", email: "super@example.com", companyId: null, role: "SUPER_ADMIN" },
    { id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: "usr_other", name: "別の会社の社員", email: "other@example.com", companyId: OTHER_COMPANY, role: "EMPLOYEE" },
  ]);
  await t.db.insert(s.accounts).values({
    id: "acc_emp",
    accountId: IDS.employee,
    providerId: "credential",
    userId: IDS.employee,
    password: "old-hash",
  });
  await t.db.insert(s.sessions).values({
    id: "ses_emp",
    token: "tok_emp",
    userId: IDS.employee,
    expiresAt: new Date(Date.now() + DAY_MS),
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.jar.clear();
  mocked.env = { CREDENTIAL_ENC_KEY: KEY };
  mocked.viewer = as("SUPER_ADMIN", "usr_super", OTHER_COMPANY);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("システム全体管理者だけの入口は、ほかの役割を書く前に断る", () => {
  const LOWER_ROLES = [
    { role: "EMPLOYEE", id: IDS.employee },
    { role: "MANAGER", id: IDS.evaluator },
    { role: "COMPANY_ADMIN", id: "usr_admin" },
  ] as const;

  // 断られるべき中身を選ぶ: どれも通れば被害が大きい（会社の停止・他社への切替・自分の昇格・管理者の追加）
  const SUPER_ONLY = [
    { name: "updateCompany（会社の停止）", call: () => updateCompany({ companyId: IDS.company, isActive: false }) },
    { name: "switchCompanyScope（他社への切替）", call: () => switchCompanyScope({ companyId: OTHER_COMPANY }) },
    {
      name: "updateSystemUser（自分を昇格）",
      call: () => updateSystemUser({ userId: mocked.viewer.id, role: "SUPER_ADMIN" }),
    },
    {
      name: "createSystemUser（全体管理者の追加）",
      call: () =>
        createSystemUser({ name: "追加", email: "new@example.com", password: PASSWORD, role: "SUPER_ADMIN", companyId: null }),
    },
  ];

  const cases = SUPER_ONLY.flatMap((action) => LOWER_ROLES.map((who) => ({ ...action, ...who })));

  it.each(cases)("$name を $role が呼ぶと 403 で、表も cookie も変わらず、描き直さない", async ({ call, role, id }) => {
    mocked.viewer = as(role, id);
    const before = snapshot();

    const result = await call();

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
    expect(snapshot()).toEqual(before);
    expect(mocked.jar.size).toBe(0);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("本人の登録内容（updateOwnProfile）", () => {
  beforeEach(() => {
    mocked.viewer = as("EMPLOYEE", IDS.employee);
  });

  it("本人の行だけが変わり、ほかの人の行は変わらない", async () => {
    const othersBefore = await t.db.select().from(s.users).where(eq(s.users.id, IDS.evaluator));

    const result = await updateOwnProfile({ name: "  新しい名前  " });

    expect(result).toEqual({ ok: true, message: "あなたの登録内容を保存しました。" });
    expect((await userRow(IDS.employee)).name).toBe("新しい名前");
    expect(await t.db.select().from(s.users).where(eq(s.users.id, IDS.evaluator))).toEqual(othersBefore);
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: "他人の id", input: { userId: IDS.evaluator, name: "乗っ取り" } },
    { label: "役割", input: { role: "COMPANY_ADMIN" } },
    { label: "等級", input: { gradeId: IDS.gradeTo } },
    { label: "上長", input: { managerId: null } },
    { label: "利用状態", input: { isActive: false } },
    { label: "所属会社", input: { companyId: OTHER_COMPANY } },
  ])("$label を混ぜた入力は形で断り、何も書かない", async ({ input }) => {
    const before = snapshot();

    const result = await updateOwnProfile(input);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/^入力内容を確認してください/);
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("会社が開放していない項目を混ぜると、開放している項目も含めて全体を断る（部分保存しない）", async () => {
    const before = snapshot();

    const result = await updateOwnProfile({ name: "新しい名前", department: "営業" });

    expect(result).toEqual({
      ok: false,
      message: "この項目は会社の管理者だけが変更できます。変更が必要なときは会社の管理者にご相談ください。",
    });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("会社が開放した項目は本人が変えられる", async () => {
    await t.db.insert(s.profileFieldPolicies).values({ id: "pfp_dept", companyId: IDS.company, field: "department", selfEditable: true });

    const result = await updateOwnProfile({ department: "営業" });

    expect(result.ok).toBe(true);
    expect((await userRow(IDS.employee)).department).toBe("営業");
  });

  it("全体管理者の判定は、切り替えた先の会社ではなく本人の所属で行う", async () => {
    // 切り替えた先の会社は所属の欄を開放しているが、全体管理者はどの会社にも属さない
    await t.db.insert(s.profileFieldPolicies).values({ id: "pfp_other_dept", companyId: OTHER_COMPANY, field: "department", selfEditable: true });
    mocked.viewer = as("SUPER_ADMIN", "usr_super", OTHER_COMPANY);
    const before = snapshot();

    const result = await updateOwnProfile({ department: "営業" });

    expect(result.ok).toBe(false);
    expect(snapshot()).toEqual(before);
  });
});

describe("会社の変更（updateCompany）", () => {
  it("止めると、その会社の利用者だけが同じ batch で止まり、応答は文面だけ", async () => {
    const result = await updateCompany({ companyId: OTHER_COMPANY, isActive: false });

    expect(result).toEqual({
      ok: true,
      message: "別の会社を利用停止にしました。データは残っています。再開すると社員の再有効化が必要です。",
    });
    expect((await userRow("usr_other")).isActive).toBe(false);
    for (const id of [IDS.employee, IDS.evaluator, "usr_admin", "usr_super"]) {
      expect((await userRow(id)).isActive, `${id} は止まらない`).toBe(true);
    }
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("形の外の項目（ひな形の印・識別子）は捨てて、書かない", async () => {
    const result = await updateCompany({ companyId: OTHER_COMPANY, name: "改めた名前", isTemplate: true, slug: "hijack" });

    expect(result.ok).toBe(true);
    const co = (await t.db.select().from(s.companies).where(eq(s.companies.id, OTHER_COMPANY)))[0];
    expect(co).toMatchObject({ name: "改めた名前", isTemplate: false, slug: "other" });
  });

  it("無い会社は 404 で、描き直さない", async () => {
    const result = await updateCompany({ companyId: "cmp_missing", name: "x" });

    expect(result).toEqual({ ok: false, message: "会社が見つかりませんでした。" });
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("会社の切り替え（switchCompanyScope）", () => {
  it("切り替えの印は、スクリプトから読めず別サイトの送信に付かない cookie で置く", async () => {
    const result = await switchCompanyScope({ companyId: OTHER_COMPANY });

    expect(result).toEqual({ ok: true, message: "別の会社 に切り替えました。" });
    expect(mocked.jar.get(COMPANY_SCOPE_COOKIE)).toEqual({
      value: OTHER_COMPANY,
      options: expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true, path: "/" }),
    });
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("無い会社へは切り替えず、cookie を置かない", async () => {
    const result = await switchCompanyScope({ companyId: "cmp_missing" });

    expect(result).toEqual({ ok: false, message: "その会社は見つかりませんでした。" });
    expect(mocked.jar.size).toBe(0);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("システム全体の利用者（createSystemUser / updateSystemUser）", () => {
  /** 応答・ハッシュ・控えのどこにも、発行した値がそのまま無いこと */
  async function expectNoPlainPassword(result: unknown) {
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    for (const row of t.raw.prepare("select password from accounts").all()) {
      expect(String(row.password)).not.toContain(PASSWORD);
    }
    for (const row of t.raw.prepare("select ciphertext, iv from initial_credential_memos").all()) {
      expect(`${row.ciphertext}${row.iv}`).not.toContain(PASSWORD);
    }
  }

  it("追加の応答は id・控えを残せたか・文面だけで、値を返さない", async () => {
    const result = await createSystemUser({
      name: "新しい管理者",
      email: "New@Example.com",
      password: PASSWORD,
      role: "COMPANY_ADMIN",
      companyId: IDS.company,
    });

    expect(result.ok).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["id", "memoStored", "message", "ok"]);
    if (!result.ok) return;
    expect(result.memoStored).toBe(true);
    await expectNoPlainPassword(result);
    const created = await userRow(result.id);
    expect(created).toMatchObject({ email: "new@example.com", role: "COMPANY_ADMIN", mustChangePassword: true });
  });

  it("再発行の応答は文面だけで、いまのログインを解除し、値はどこにも平文で残さない", async () => {
    const result = await updateSystemUser({ userId: IDS.employee, password: PASSWORD });

    expect(result.ok).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["message", "ok"]);
    await expectNoPlainPassword(result);
    expect(await t.db.select().from(s.sessions).where(eq(s.sessions.userId, IDS.employee))).toEqual([]);
    expect((await userRow(IDS.employee)).mustChangePassword).toBe(true);
    const account = (await t.db.select().from(s.accounts).where(eq(s.accounts.userId, IDS.employee)))[0];
    expect(account.password).not.toBe("old-hash");
  });

  it("想定外の失敗は文面を伏せ、送った値も書きかけも残さない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(t.db, "batch").mockRejectedValue(new Error(`D1_ERROR: insert into accounts ... '${PASSWORD}'`));
    const before = snapshot();

    const result = await createSystemUser({
      name: "新しい管理者",
      email: "new@example.com",
      password: PASSWORD,
      role: "SUPER_ADMIN",
      companyId: null,
    });

    expect(result).toEqual({ ok: false, message: UNEXPECTED_ERROR_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("全体管理者でも、自分の役割は下げられない", async () => {
    const before = snapshot();

    const result = await updateSystemUser({ userId: "usr_super", role: "COMPANY_ADMIN", companyId: IDS.company });

    expect(result).toEqual({
      ok: false,
      message: "自分自身の役割は下げられません。別のシステム全体管理者に変更してもらってください。",
    });
    expect(snapshot()).toEqual(before);
  });
});


describe("利用者検証の共通契約", () => {
  const creation = { email: "new@example.com", password: PASSWORD, role: "EMPLOYEE" };
  const entries = [
    { label: "社員追加", call: (name: string) => createMember({ ...creation, name }) },
    { label: "社員更新", call: (name: string) => updateMember({ userId: IDS.employee, name }) },
    { label: "全体管理追加", call: (name: string) => createSystemUser({ ...creation, companyId: IDS.company, name }) },
    { label: "全体管理更新", call: (name: string) => updateSystemUser({ userId: IDS.employee, name }) },
    { label: "本人更新", call: (name: string) => {
      mocked.viewer = as("EMPLOYEE", IDS.employee);
      return updateOwnProfile({ name });
    } },
  ];

  beforeEach(() => { mocked.viewer = as("SUPER_ADMIN", "usr_super", IDS.company); });

  it.each(entries)("$label は空白だけの氏名を拒否し、何も変更しない", async ({ call }) => {
    const before = snapshot();
    expect((await call(" \t　 ")).ok).toBe(false);
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it.each(entries)("$label は前後空白を除いて保存する", async ({ call }) => {
    expect((await call("  新しい名前  ")).ok).toBe(true);
    const saved = t.raw.prepare("select name from users where name = ?").all("新しい名前");
    expect(saved).toHaveLength(1);
  });

  const companyCases = [
    { label: "停止会社", patch: { isActive: false } },
    { label: "ひな形会社", patch: { isTemplate: true } },
  ];
  it.each(companyCases)("$label への社員追加・再有効化を拒否し、何も変更しない", async ({ patch }) => {
    await t.db.update(s.companies).set(patch).where(eq(s.companies.id, IDS.company));
    await t.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, IDS.employee));
    const before = snapshot();
    expect((await createMember({ ...creation, name: "追加" })).ok).toBe(false);
    expect((await updateMember({ userId: IDS.employee, isActive: true })).ok).toBe(false);
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it.each([updateMember, updateSystemUser])("停止会社のinactive利用者の編集は許可する", async (call) => {
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, IDS.company));
    await t.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, IDS.employee));
    expect((await call({ userId: IDS.employee, name: "変更" })).ok).toBe(true);
    expect(await userRow(IDS.employee)).toMatchObject({ name: "変更", isActive: false });
  });

  it("存在しない会社への社員追加は何も変更しない", async () => {
    mocked.viewer = as("SUPER_ADMIN", "usr_super", "cmp_missing");
    const before = snapshot();
    expect((await createMember({ ...creation, name: "追加" })).ok).toBe(false);
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("社員管理は他社の利用者を書き換えない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin", IDS.company);
    const before = snapshot();
    expect((await updateMember({ userId: "usr_other", name: "変更" })).ok).toBe(false);
    expect(snapshot()).toEqual(before);
  });
});
