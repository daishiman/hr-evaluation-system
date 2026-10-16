import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * アカウントの権限にかかわる操作の監査記録（E7・DD-013・移行 0037）。
 *
 * 全体管理者の付け外し・会社の役割・所属の会社・利用の停止と再開・パスワードの再発行・アカウントの作成を、
 * 4つの入口（システム全体の利用者・社員・会社の追加・社員CSVの取り込み）から保存したときに、
 * 本体と同じ batch で1件ずつ残ることを確かめる。
 *  - 起きなかった変更は残さない（何も変わらない保存・最後の全体管理者を落とせなかった保存・dry-run）
 *  - パスワードの本文と hash は、記録のどこにも入らない
 *  - 書いた記録は書き換えられない（操作した人を消したときの actor_id だけは外れる）
 */

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const OTHER_COMPANY = "cmp_other";
const PASSWORD = "temp-pass-for-audit-0002";
const LAST_SUPER_ADMIN = "最後のシステム全体管理者です。先に別の方をシステム全体管理者にしてください。";

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: () => {} }),
}));

vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

import { createMember, updateMember } from "@/actions/members";
import { createCompany } from "@/actions/companies";
import { createSystemUser, updateSystemUser } from "@/actions/system-users";
import { importMembersCsv } from "@/lib/import";
import { accountSecurityEventStatements } from "@/lib/account-security-events";

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

type EventRow = {
  id: string;
  userId: string;
  actorId: string | null;
  companyId: string | null;
  eventType: string;
  source: string;
  operationId: string;
  before: unknown;
  after: unknown;
};

/** 記録を書いた順（同じ保存の中は event_type の順）に読む。JSON は開いて返す。 */
function events(): EventRow[] {
  const rows = t.raw
    .prepare("select * from account_security_events order by occurred_at, rowid")
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    actorId: (r.actor_id as string | null) ?? null,
    companyId: (r.company_id as string | null) ?? null,
    eventType: String(r.event_type),
    source: String(r.source),
    operationId: String(r.operation_id),
    before: r.before_json ? JSON.parse(String(r.before_json)) : null,
    after: r.after_json ? JSON.parse(String(r.after_json)) : null,
  }));
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "別の会社", slug: "other" });
  await t.db.insert(s.users).values([
    { id: "usr_super", name: "システム管理者", email: "super@example.com", companyId: null, role: "SUPER_ADMIN" },
    { id: "usr_super2", name: "もう1人の管理者", email: "super2@example.com", companyId: null, role: "SUPER_ADMIN" },
    { id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: "usr_other", name: "別の会社の社員", email: "other@example.com", companyId: OTHER_COMPANY, role: "EMPLOYEE" },
  ]);
  seedMemberships(t);
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.env = { CREDENTIAL_ENC_KEY: KEY };
  mocked.viewer = as("SUPER_ADMIN", "usr_super", null);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("システム全体の利用者の画面（source = system_users）", () => {
  it("全体管理者にすると、元の所属の会社と役割を添えて1件残す", async () => {
    expect((await updateSystemUser({ userId: "usr_admin", role: "SUPER_ADMIN" })).ok).toBe(true);

    expect(events()).toEqual([
      expect.objectContaining({
        userId: "usr_admin",
        actorId: "usr_super",
        companyId: IDS.company,
        eventType: "super_admin_granted",
        source: "system_users",
        before: { role: "COMPANY_ADMIN", companyId: IDS.company },
        after: { role: "SUPER_ADMIN", companyId: null },
      }),
    ]);
  });

  it("全体管理者から外すと、作った所属の会社と役割を添えて1件残す", async () => {
    const result = await updateSystemUser({ userId: "usr_super2", role: "COMPANY_ADMIN", companyId: IDS.company });
    expect(result.ok).toBe(true);

    expect(events()).toEqual([
      expect.objectContaining({
        userId: "usr_super2",
        companyId: IDS.company,
        eventType: "super_admin_revoked",
        before: { role: "SUPER_ADMIN", companyId: null },
        after: { role: "COMPANY_ADMIN", companyId: IDS.company },
      }),
    ]);
  });

  it("最後の全体管理者を外せなかった保存は、記録を残さない", async () => {
    // 操作する人（画面の上では全体管理者）を止めておき、外す相手が最後の有効な全体管理者になるようにする
    await t.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, "usr_super"));

    const result = await updateSystemUser({ userId: "usr_super2", role: "COMPANY_ADMIN", companyId: IDS.company });

    expect(result).toEqual({ ok: false, message: LAST_SUPER_ADMIN });
    expect(events()).toEqual([]);
  });

  it("全体管理者を止めると、会社の無い記録として残す", async () => {
    expect((await updateSystemUser({ userId: "usr_super2", isActive: false })).ok).toBe(true);

    expect(events()).toEqual([
      expect.objectContaining({
        userId: "usr_super2",
        companyId: null,
        eventType: "deactivated",
        before: { isActive: true },
        after: { isActive: false },
      }),
    ]);
  });

  it("所属を別の会社へ移すと、移った先の会社で1件残す", async () => {
    expect((await updateSystemUser({ userId: "usr_other", companyId: IDS.company })).ok).toBe(true);

    expect(events()).toEqual([
      expect.objectContaining({
        userId: "usr_other",
        companyId: IDS.company,
        eventType: "company_moved",
        before: { companyId: OTHER_COMPANY },
        after: { companyId: IDS.company },
      }),
    ]);
  });

  it("1回の保存で変わったことは1件ずつ、同じ operation_id で残す。パスワードの値と hash は入れない", async () => {
    const result = await updateSystemUser({ userId: IDS.employee, role: "MANAGER", isActive: false, password: PASSWORD });
    expect(result.ok).toBe(true);

    const rows = events();
    expect(rows.map((r) => r.eventType)).toEqual(["role_changed", "deactivated", "password_reissued"]);
    expect(new Set(rows.map((r) => r.operationId)).size).toBe(1);
    expect(rows.find((r) => r.eventType === "password_reissued")).toMatchObject({ before: null, after: null });

    const stored = JSON.stringify(t.raw.prepare("select * from account_security_events").all());
    const hash = String((t.raw.prepare("select password from accounts where user_id = ?").get(IDS.employee) as { password: string }).password);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain(hash);
  });

  it("全体管理者の追加は、会社の無いアカウントの作成として残す", async () => {
    const result = await createSystemUser({
      name: "新しい全体管理者",
      email: "new-super@example.com",
      password: PASSWORD,
      role: "SUPER_ADMIN",
      companyId: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(events()).toEqual([
      expect.objectContaining({
        userId: result.id,
        companyId: null,
        eventType: "account_created",
        before: null,
        after: { role: "SUPER_ADMIN", companyId: null, isActive: true },
      }),
    ]);
  });
});

describe("社員の画面（source = members）", () => {
  beforeEach(() => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");
  });

  it("社員の追加は、自社のアカウントの作成として残す", async () => {
    const result = await createMember({ name: "新しい社員", email: "new@example.com", password: PASSWORD, role: "EMPLOYEE" });
    expect(result.ok).toBe(true);

    expect(events()).toEqual([
      expect.objectContaining({
        actorId: "usr_admin",
        companyId: IDS.company,
        eventType: "account_created",
        source: "members",
        after: { role: "EMPLOYEE", companyId: IDS.company, isActive: true },
      }),
    ]);
  });

  it("止めると deactivated、もう一度使えるようにすると reactivated を残す", async () => {
    expect((await updateMember({ userId: IDS.employee, isActive: false })).ok).toBe(true);
    expect((await updateMember({ userId: IDS.employee, isActive: true })).ok).toBe(true);

    expect(events().map((r) => [r.eventType, r.source, r.companyId])).toEqual([
      ["deactivated", "members", IDS.company],
      ["reactivated", "members", IDS.company],
    ]);
  });

  it("役割の変更とパスワードの再発行を残す", async () => {
    expect((await updateMember({ userId: IDS.employee, role: "MANAGER" })).ok).toBe(true);
    expect((await updateMember({ userId: IDS.employee, password: PASSWORD })).ok).toBe(true);

    const rows = events();
    expect(rows.map((r) => r.eventType)).toEqual(["role_changed", "password_reissued"]);
    expect(rows[0]).toMatchObject({ before: { role: "EMPLOYEE" }, after: { role: "MANAGER" } });
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
  });

  it("権限にかかわらない保存（氏名・部署・同じ役割）は、何も残さない", async () => {
    expect((await updateMember({ userId: IDS.employee, name: "名前を変えた", department: "別の部署" })).ok).toBe(true);
    expect((await updateMember({ userId: IDS.employee, role: "EMPLOYEE", isActive: true })).ok).toBe(true);

    expect(events()).toEqual([]);
  });
});

describe("会社の追加（source = company_create）", () => {
  it("会社と一緒に作る管理者を、新しい会社のアカウントの作成として残す", async () => {
    await t.db.update(s.companies).set({ isTemplate: true }).where(eq(s.companies.id, IDS.company));

    const result = await createCompany({
      name: "新しい会社",
      slug: "new-company",
      adminName: "新しい管理者",
      adminEmail: "new-admin@example.com",
      adminPassword: "first-pass-0001",
    });
    expect(result.ok).toBe(true);

    const created = (await t.db.select().from(s.companies).where(eq(s.companies.slug, "new-company")))[0];
    const admin = (await t.db.select().from(s.users).where(eq(s.users.email, "new-admin@example.com")))[0];
    expect(events()).toEqual([
      expect.objectContaining({
        userId: admin.id,
        actorId: "usr_super",
        companyId: created.id,
        eventType: "account_created",
        source: "company_create",
        after: { role: "COMPANY_ADMIN", companyId: created.id, isActive: true },
      }),
    ]);
  });
});

describe("社員CSVの取り込み（source = member_import）", () => {
  const CSV = ["氏名,メールアドレス,役割", "取り込みの新人,import-new@example.com,社員", "本人,emp@example.com,マネージャー"].join("\n");

  it("作った人と役割を変えた人を、取り込みの記録の id を operation_id にして残す", async () => {
    await importMembersCsv(IDS.company, CSV, { actorId: "usr_admin" });

    const batchId = String((t.raw.prepare("select id from import_batches where kind = 'members'").get() as { id: string }).id);
    const created = (await t.db.select().from(s.users).where(eq(s.users.email, "import-new@example.com")))[0];
    expect(events()).toEqual([
      expect.objectContaining({
        userId: created.id,
        actorId: "usr_admin",
        companyId: IDS.company,
        eventType: "account_created",
        source: "member_import",
        operationId: batchId,
        after: { role: "EMPLOYEE", companyId: IDS.company, isActive: true },
      }),
      expect.objectContaining({
        userId: IDS.employee,
        eventType: "role_changed",
        source: "member_import",
        operationId: batchId,
        before: { role: "EMPLOYEE" },
        after: { role: "MANAGER" },
      }),
    ]);
  });

  it("同じ内容をもう一度取り込んでも、確かめるだけ（dry-run）でも、記録は増えない", async () => {
    await importMembersCsv(IDS.company, CSV, { actorId: "usr_admin" });
    const first = events().length;

    await importMembersCsv(IDS.company, CSV, { actorId: "usr_admin" });
    await importMembersCsv(IDS.company, CSV.replace("マネージャー", "社員"), { actorId: "usr_admin", dryRun: true });

    expect(events()).toHaveLength(first);
  });

  it("利用状態の列で止めた人を deactivated として残す", async () => {
    await importMembersCsv(IDS.company, ["氏名,メールアドレス,利用状態", "本人,emp@example.com,利用停止"].join("\n"), {
      actorId: "usr_admin",
    });

    expect(events().map((r) => [r.userId, r.eventType])).toEqual([[IDS.employee, "deactivated"]]);
  });
});

describe("記録の表（移行 0037）", () => {
  async function writeOne(actorId: string | null) {
    const [first, ...rest] = accountSecurityEventStatements(t.db, {
      userId: IDS.employee,
      actorId,
      source: "members",
      before: { superAdmin: false, isActive: true, membership: { companyId: IDS.company, role: "EMPLOYEE" } },
      after: { superAdmin: false, isActive: false, membership: { companyId: IDS.company, role: "EMPLOYEE" } },
    });
    await t.db.batch([first, ...rest]);
  }

  it("書いた記録は書き換えられない", async () => {
    await writeOne("usr_admin");

    expect(() => t.raw.prepare("update account_security_events set event_type = 'reactivated'").run()).toThrow(
      /account_security_events_append_only/,
    );
    expect(() => t.raw.prepare("update account_security_events set after_json = null").run()).toThrow(
      /account_security_events_append_only/,
    );
  });

  it("操作した人を消すと、記録は残したまま actor_id だけが外れる", async () => {
    await t.db.insert(s.users).values({ id: "usr_actor", name: "消える人", email: "actor@example.com", role: "SUPER_ADMIN" });
    await writeOne("usr_actor");

    t.raw.prepare("delete from users where id = ?").run("usr_actor");

    expect(events()).toEqual([expect.objectContaining({ userId: IDS.employee, actorId: null, eventType: "deactivated" })]);
  });

  it("when の条件が成り立たない文は、記録を書かない", async () => {
    const [first, ...rest] = accountSecurityEventStatements(t.db, {
      userId: IDS.employee,
      actorId: null,
      source: "system_users",
      before: { superAdmin: false, isActive: true, membership: null },
      after: { superAdmin: false, isActive: false, membership: null },
      when: sql`1 = 0`,
    });
    await t.db.batch([first, ...rest]);

    expect(events()).toEqual([]);
  });

  it("移行をもう一度流しても、表・索引・記録はそのまま", async () => {
    await writeOne("usr_admin");
    const migration = readFileSync(join(process.cwd(), "drizzle/migrations/0037_account_security_events.sql"), "utf8");

    for (const st of migration.split("--> statement-breakpoint").filter((x) => x.trim() !== "")) t.raw.exec(st);

    expect(events()).toHaveLength(1);
    const objects = t.raw
      .prepare("select type, name from sqlite_master where tbl_name = 'account_security_events' order by type, name")
      .all();
    expect(objects).toEqual([
      { type: "index", name: "idx_ase_company_time" },
      { type: "index", name: "idx_ase_user_time" },
      { type: "index", name: "sqlite_autoindex_account_security_events_1" },
      { type: "table", name: "account_security_events" },
      { type: "trigger", name: "trg_ase_append_only" },
    ]);
  });
});
