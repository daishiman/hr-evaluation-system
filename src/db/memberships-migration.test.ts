import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 所属の表を作り、今の利用者の会社を最初の所属として写す移行（0033）を、実際の SQL ファイルのまま流して確かめる。
 *
 * 本番では、この移行が流れた瞬間から会社ごとの値（役割・等級・上長など）の正本が所属の表に移る。
 * 写し漏れた人はどの会社の画面にも出なくなり、余分に写した全体管理者は会社の役割を持ってしまう。
 * 移行前と同じ形のデータを作り、本物の SQL を流して、写す人・写さない人・写す値・2回目に流したときを固定する。
 *
 * 表は本番と同じ移行（drizzle/migrations/*.sql）で作る。0033 は空の表の上で1回流れているので、
 * ここで入れたデータに対してもう一度流すことが「本番での1回目」に当たる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const MIGRATION = statements(read("drizzle/migrations/0033_company_memberships.sql"));

let t: TestDatabase;

function run(sql: string[]) {
  for (const st of sql) t.raw.exec(st);
}

function memberships() {
  return t.raw.prepare("SELECT * FROM company_memberships ORDER BY id").all() as Record<string, unknown>[];
}

const CREATED = new Date("2025-04-01T00:00:00Z");
const UPDATED = new Date("2026-09-30T00:00:00Z");

/** 移行前の形のデータ。会社ごとの値は users にだけあり、所属の表は空 */
async function seedBeforeMigration() {
  await t.db.insert(s.companies).values([
    { id: "cmp_a", name: "A社", slug: "a" },
    { id: "cmp_b", name: "B社", slug: "b" },
  ]);
  const base = { emailVerified: true, createdAt: CREATED, updatedAt: UPDATED };
  await t.db.insert(s.users).values([
    {
      ...base,
      id: "usr_admin",
      name: "管理 一郎",
      email: "admin@a.example",
      companyId: "cmp_a",
      role: "COMPANY_ADMIN",
    },
    {
      ...base,
      id: "usr_mgr",
      name: "上長 二郎",
      email: "mgr@a.example",
      companyId: "cmp_a",
      role: "MANAGER",
      gradeId: "grd_a_4",
      officeId: "ofc_a_tokyo",
      managerId: "usr_admin",
      employeeCode: "A-002",
      department: "営業部",
      hiredAt: "2020-04-01",
      profileNote: "面談は月曜",
    },
    {
      ...base,
      id: "usr_emp",
      name: "社員 三郎",
      email: "emp@b.example",
      companyId: "cmp_b",
      role: "EMPLOYEE",
      gradeId: "grd_b_1",
      managerId: "usr_b_mgr",
    },
    // 利用を止めた人も写す。所属は会社ごとの値の置き場で、止めたかどうかは users に残る
    { ...base, id: "usr_retired", name: "退職 四郎", email: "retired@a.example", companyId: "cmp_a", isActive: false },
    // 全体管理者は所属を持たない。昔の作り方で会社の列が埋まっていても写さない
    { ...base, id: "usr_super", name: "全体 五郎", email: "super@example", companyId: "cmp_a", role: "SUPER_ADMIN" },
    { ...base, id: "usr_super2", name: "全体 六郎", email: "super2@example", role: "SUPER_ADMIN" },
    // 会社の決まっていない人は、写す先が無い
    { ...base, id: "usr_nocompany", name: "未定 七郎", email: "nocompany@example" },
  ]);
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedBeforeMigration();
});

afterEach(() => t.close());

describe("0033 所属の表への写し", () => {
  it("移行前は所属の表が空（0033 は空の表の上で流れたあと）", () => {
    expect(memberships()).toEqual([]);
  });

  it("会社に属する人を、利用者の id から作った id で1人1件ずつ写す", () => {
    run(MIGRATION);
    expect(memberships().map((m) => [m.id, m.user_id, m.company_id, m.role])).toEqual([
      ["mem_usr_admin", "usr_admin", "cmp_a", "COMPANY_ADMIN"],
      ["mem_usr_emp", "usr_emp", "cmp_b", "EMPLOYEE"],
      ["mem_usr_mgr", "usr_mgr", "cmp_a", "MANAGER"],
      ["mem_usr_retired", "usr_retired", "cmp_a", "EMPLOYEE"],
    ]);
  });

  it("会社ごとの値と作成・更新の時刻を、そのまま写す", () => {
    run(MIGRATION);
    const mgr = memberships().find((m) => m.user_id === "usr_mgr");
    const user = t.raw.prepare("SELECT * FROM users WHERE id = 'usr_mgr'").get() as Record<string, unknown>;
    expect(mgr).toMatchObject({
      grade_id: "grd_a_4",
      office_id: "ofc_a_tokyo",
      manager_id: "usr_admin",
      employee_code: "A-002",
      department: "営業部",
      hired_at: "2020-04-01",
      profile_note: "面談は月曜",
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  });

  it("全体管理者と、会社の決まっていない人は写さない", () => {
    run(MIGRATION);
    const users = memberships().map((m) => m.user_id);
    expect(users).not.toContain("usr_super");
    expect(users).not.toContain("usr_super2");
    expect(users).not.toContain("usr_nocompany");
  });

  it("2回流しても増えず、1回目のあとにアプリが書いた所属を上書きしない", () => {
    run(MIGRATION);
    // 移行のあと、アプリが所属の役割を変え、別の会社の所属を足した
    t.raw.exec("UPDATE company_memberships SET role = 'MANAGER', department = '開発部' WHERE id = 'mem_usr_emp'");
    t.raw.exec(
      `INSERT INTO company_memberships (id, user_id, company_id, role, created_at, updated_at)
       VALUES ('mem_extra', 'usr_emp', 'cmp_a', 'EMPLOYEE', 0, 0)`,
    );
    const before = memberships();
    run(MIGRATION);
    expect(memberships()).toEqual(before);
  });

  it("1人が同じ会社に2つの所属を持てず、所属には全体管理者の役割を置けない", () => {
    run(MIGRATION);
    expect(() =>
      t.raw.exec(
        `INSERT INTO company_memberships (id, user_id, company_id, role, created_at, updated_at)
         VALUES ('mem_dup', 'usr_mgr', 'cmp_a', 'EMPLOYEE', 0, 0)`,
      ),
    ).toThrow(/UNIQUE/);
    expect(() =>
      t.raw.exec(
        `INSERT INTO company_memberships (id, user_id, company_id, role, created_at, updated_at)
         VALUES ('mem_super', 'usr_super2', 'cmp_b', 'SUPER_ADMIN', 0, 0)`,
      ),
    ).toThrow(/CHECK/);
  });

  it("利用者を消すと、その人の所属も消える", () => {
    run(MIGRATION);
    t.raw.exec("DELETE FROM users WHERE id = 'usr_retired'");
    expect(memberships().map((m) => m.user_id)).not.toContain("usr_retired");
  });

  it("試験の下ごしらえ（seedMemberships）は、0033 と同じ所属を作る", () => {
    run(MIGRATION);
    const fromMigration = memberships();
    t.raw.exec("DELETE FROM company_memberships");
    seedMemberships(t);
    expect(memberships()).toEqual(fromMigration);
  });
});
