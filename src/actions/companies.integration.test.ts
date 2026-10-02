import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, ne } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 会社の追加（会社 → 制度のひな形 → 管理者 の3段書き）。
 *
 * ひな形の複製は数百行になりうるので1回の batch に収めず、順に書く。
 * そのぶん「途中で止まったら書きかけが残る」危険があるので、
 * 最後の段で失敗しても会社・制度・管理者が1行も残らないことを確かめる（D-003）。
 */

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

import { createCompany } from "@/actions/companies";
import { COMPENSATION_FAILED_MESSAGE } from "@/lib/compensation";

let t: TestDatabase;

const SUPER: Viewer = {
  id: "usr_super",
  name: "システム管理者",
  email: "super@example.com",
  role: "SUPER_ADMIN",
  companyId: IDS.company,
  gradeId: null,
  managerId: null,
  department: null,
  employeeCode: null,
  hiredAt: null,
  companyName: "テスト社",
  mustChangePassword: false,
} as Viewer;

const input = {
  name: "新しい会社",
  slug: "new-company",
  businessType: "給付事業",
  adminName: "新しい管理者",
  adminEmail: "New-Admin@Example.com",
  adminPassword: "first-pass-0001",
};

/** 管理者を書く batch（利用者の追加を含むもの）だけを失敗させる。 */
function failAdminBatch(error: unknown) {
  const original = t.db.batch.bind(t.db);
  return vi.spyOn(t.db, "batch").mockImplementation((async (queries: { toSQL?: () => { sql: string } }[]) => {
    if (queries.some((q) => q.toSQL?.().sql.startsWith('insert into "users"'))) throw error;
    return original(queries as never);
  }) as never);
}

/** 新しい会社に紐づく行（ひな形から写した制度を含む）が、どの表にも残っていないこと。 */
async function leftovers() {
  const companies = await t.db.select({ id: s.companies.id }).from(s.companies).where(ne(s.companies.id, IDS.company));
  const grades = await t.db.select({ id: s.grades.id }).from(s.grades).where(ne(s.grades.companyId, IDS.company));
  const kpiItems = await t.db.select({ id: s.kpiItems.id }).from(s.kpiItems).where(ne(s.kpiItems.companyId, IDS.company));
  const users = await t.db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, "new-admin@example.com"));
  const memos = await t.db.select({ id: s.initialCredentialMemos.userId }).from(s.initialCredentialMemos);
  return { companies, grades, kpiItems, users, memos };
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  // 既存の会社を標準のひな形にする（会社の追加で制度が写る状態）
  await t.db.update(s.companies).set({ isTemplate: true }).where(eq(s.companies.id, IDS.company));
  await t.db.insert(s.users).values({
    id: "usr_super",
    name: "システム管理者",
    email: "super@example.com",
    companyId: IDS.company,
    role: "SUPER_ADMIN",
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.apiViewer.mockReset();
  mocked.apiViewer.mockResolvedValue(SUPER);
  mocked.refresh.mockReset();
  mocked.env = { CREDENTIAL_ENC_KEY: KEY };
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("会社の追加（createCompany）", () => {
  it("会社・ひな形の制度・管理者・控えがそろって書かれ、画面を描き直す", async () => {
    const result = await createCompany(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain("控えは一覧の行から開けます。");
    const { companies, grades, kpiItems, users, memos } = await leftovers();
    expect(companies.map((c) => c.id)).toEqual([result.id]);
    expect(grades.length).toBeGreaterThan(0);
    expect(kpiItems.length).toBeGreaterThan(0);
    expect(users).toHaveLength(1);
    expect(memos.map((m) => m.id)).toEqual(users.map((u) => u.id));
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("最後の段（管理者）で失敗したら、写した制度も会社も消して、書きかけを残さない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    failAdminBatch(new Error("D1_ERROR: too many SQL variables"));

    const result = await createCompany(input);

    expect(result.ok).toBe(false);
    expect(await leftovers()).toEqual({ companies: [], grades: [], kpiItems: [], users: [], memos: [] });
    // 取り消しが全部できたときは、管理者への連絡は求めない（元の失敗として返す）
    expect(result.ok === false && result.message).not.toBe(COMPENSATION_FAILED_MESSAGE);
    // 何を取り消したかは運用の記録に残る
    expect(warn.mock.calls.flat().join("\n")).toContain("company.create");
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("同じ会社IDは、何も書く前に断る", async () => {
    await createCompany(input);
    const before = await leftovers();

    const second = await createCompany({ ...input, adminEmail: "another@example.com" });

    expect(second).toEqual({ ok: false, message: "この会社IDはすでに使われています。別の文字にしてください。" });
    expect(await leftovers()).toEqual(before);
  });

  it("鍵が無くても会社は作れ、控えは作らない（その旨を伝える）", async () => {
    mocked.env = {};

    const result = await createCompany(input);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toContain("控えは保存していません。今メモしてください。");
    expect((await leftovers()).memos).toEqual([]);
  });
});
