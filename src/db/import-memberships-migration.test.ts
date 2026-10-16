import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 社員CSVの取り込みで作ったのに所属の行が無い人へ、所属の行を足す移行（0036）を、実際の SQL ファイルのまま流して確かめる。
 *
 * 0033 のあと、取り込みは users だけを書いていた（所属の行を作らなかった）。その人たちは社員の一覧・評価の画面に出ない。
 * 取り込みの記録（import_batches の before_json）で「その取り込みで新しく作った人」と分かる人だけに足し、
 * 画面で作った人・登録済みの人・全体管理者・他社の記録の人には足さない。
 *
 * 表は本番と同じ移行（drizzle/migrations/*.sql）で作る。0036 は空の表の上で1回流れているので、
 * ここで入れたデータに対してもう一度流すことが「本番での1回目」に当たる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const MIGRATION = statements(read("drizzle/migrations/0036_import_member_memberships.sql"));

let t: TestDatabase;

function run(sql: string[]) {
  for (const st of sql) t.raw.exec(st);
}

function memberships() {
  return t.raw.prepare("SELECT * FROM company_memberships ORDER BY id").all() as Record<string, unknown>[];
}

const CREATED = new Date("2026-10-01T00:00:00Z");
const UPDATED = new Date("2026-10-02T00:00:00Z");

/** 直す前の取り込みが残した記録の形（修正前の import-members.ts と同じ: 新しく作った人は before が null） */
function batch(id: string, companyId: string, rows: { userId: string; before: unknown }[]) {
  return {
    id,
    companyId,
    kind: "members",
    subjectId: companyId,
    sourceHash: "0".repeat(64),
    rowCount: rows.length,
    beforeJson: JSON.stringify(rows),
  };
}

/**
 * 移行前の形のデータ。
 * A社の取り込みで usr_imp1・usr_imp2 を新しく作り、usr_known（画面で作った人）を変えた。
 * usr_screen は画面で作った人で、所属の行を持っている。
 */
async function seedBeforeMigration() {
  await t.db.insert(s.companies).values([
    { id: "cmp_a", name: "A社", slug: "a" },
    { id: "cmp_b", name: "B社", slug: "b" },
  ]);
  const base = { emailVerified: true, createdAt: CREATED, updatedAt: UPDATED };
  await t.db.insert(s.users).values([
    {
      ...base,
      id: "usr_imp1",
      name: "取込 一郎",
      email: "imp1@a.example",
      companyId: "cmp_a",
      role: "MANAGER",
      employeeCode: "A-101",
      department: "営業部",
      hiredAt: "2026-04-01",
    },
    { ...base, id: "usr_imp2", name: "取込 二郎", email: "imp2@a.example", companyId: "cmp_a", managerId: "usr_imp1" },
    // 取り込みで作ったあと、全体管理者に変えた人（所属を持たない）
    { ...base, id: "usr_imp_super", name: "取込 三郎", email: "imp3@a.example", companyId: "cmp_a", role: "SUPER_ADMIN" },
    // A社の取り込みで作ったが、その後 B社へ移した人（記録の会社と今の会社が違う）
    { ...base, id: "usr_imp_moved", name: "取込 四郎", email: "imp4@a.example", companyId: "cmp_b" },
    // 登録済みの人を取り込みで変えた（記録の before が null でない）
    { ...base, id: "usr_known", name: "既存 五郎", email: "known@a.example", companyId: "cmp_a" },
    // 画面で作った人。取り込みの記録に出てこない
    { ...base, id: "usr_screen", name: "画面 六郎", email: "screen@a.example", companyId: "cmp_a" },
    // 取り込みの記録に出てこない、所属の行が無い人（原因が分からないので足さない）
    { ...base, id: "usr_orphan", name: "不明 七郎", email: "orphan@a.example", companyId: "cmp_a" },
  ]);
  t.raw.exec(
    `INSERT INTO company_memberships (id, user_id, company_id, role, created_at, updated_at) VALUES
       ('mem_usr_known', 'usr_known', 'cmp_a', 'EMPLOYEE', 0, 0),
       ('mem_usr_screen', 'usr_screen', 'cmp_a', 'EMPLOYEE', 0, 0)`,
  );
  await t.db.insert(s.importBatches).values([
    batch("import_1", "cmp_a", [
      { userId: "usr_imp1", before: null },
      { userId: "usr_imp_super", before: null },
      { userId: "usr_imp_moved", before: null },
      { userId: "usr_known", before: { id: "usr_known", name: "既存 五郎" } },
    ]),
    batch("import_2", "cmp_a", [{ userId: "usr_imp2", before: null }]),
    // 回答CSVの記録は見ない
    { ...batch("import_resp", "cmp_a", [{ userId: "usr_orphan", before: null }]), kind: "responses" },
    // JSON として読めない記録があっても、移行は止まらない
    { ...batch("import_broken", "cmp_a", []), beforeJson: "{not json" },
  ]);
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedBeforeMigration();
});

afterEach(() => t.close());

describe("0036 取り込みで作った人への所属の行の補い", () => {
  it("取り込みで新しく作り、今もその会社の役割を持つ人にだけ、mem_imp_ の id で足す", () => {
    run(MIGRATION);
    expect(memberships().map((m) => [m.id, m.user_id, m.company_id, m.role])).toEqual([
      ["mem_imp_usr_imp1", "usr_imp1", "cmp_a", "MANAGER"],
      ["mem_imp_usr_imp2", "usr_imp2", "cmp_a", "EMPLOYEE"],
      ["mem_usr_known", "usr_known", "cmp_a", "EMPLOYEE"],
      ["mem_usr_screen", "usr_screen", "cmp_a", "EMPLOYEE"],
    ]);
  });

  it("会社ごとの値と作成・更新の時刻は、取り込みが書いた users の写しから取る", () => {
    run(MIGRATION);
    const imp1 = memberships().find((m) => m.user_id === "usr_imp1");
    const imp2 = memberships().find((m) => m.user_id === "usr_imp2");
    const user = t.raw.prepare("SELECT * FROM users WHERE id = 'usr_imp1'").get() as Record<string, unknown>;
    expect(imp1).toMatchObject({
      employee_code: "A-101",
      department: "営業部",
      hired_at: "2026-04-01",
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
    expect(imp2).toMatchObject({ manager_id: "usr_imp1" });
  });

  it("全体管理者・記録と今の会社が違う人・回答CSVの記録だけの人には足さない", () => {
    run(MIGRATION);
    const users = memberships().map((m) => m.user_id);
    expect(users).not.toContain("usr_imp_super");
    expect(users).not.toContain("usr_imp_moved");
    expect(users).not.toContain("usr_orphan");
  });

  it("登録済みの人の所属の行は書き換えない（写しとずれていても）", () => {
    t.raw.exec("UPDATE users SET role = 'MANAGER', department = '開発部' WHERE id = 'usr_known'");
    run(MIGRATION);
    expect(memberships().find((m) => m.user_id === "usr_known")).toMatchObject({ role: "EMPLOYEE", department: null });
  });

  it("2回流しても増えず、1回目のあとにアプリが書いた所属を上書きしない", () => {
    run(MIGRATION);
    t.raw.exec("UPDATE company_memberships SET role = 'COMPANY_ADMIN' WHERE id = 'mem_imp_usr_imp2'");
    const before = memberships();
    run(MIGRATION);
    expect(memberships()).toEqual(before);
  });

  it("修正後の取り込みが所属の行を書いた人には足さない（同じ人に2つ目を作らない）", () => {
    t.raw.exec(
      `INSERT INTO company_memberships (id, user_id, company_id, role, created_at, updated_at)
       VALUES ('mem_new_imp1', 'usr_imp1', 'cmp_a', 'MANAGER', 0, 0)`,
    );
    run(MIGRATION);
    expect(memberships().filter((m) => m.user_id === "usr_imp1").map((m) => m.id)).toEqual(["mem_new_imp1"]);
  });

  it("書いてある戻し方で、足した行だけを消せる", () => {
    run(MIGRATION);
    t.raw.exec("DELETE FROM company_memberships WHERE id LIKE 'mem_imp_%'");
    expect(memberships().map((m) => m.id)).toEqual(["mem_usr_known", "mem_usr_screen"]);
  });
});
