import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

const mocked = vi.hoisted(() => ({ userId: null as string | null, companyId: null as string | null, getDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: async () => ({ api: { getSession: async () => mocked.userId ? { user: { id: mocked.userId } } : null } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => mocked.companyId ? { value: mocked.companyId } : undefined }) }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));

import { getViewer, HttpError } from "@/lib/session";
import { apiViewerFor } from "@/lib/api";

let t: TestDatabase;
beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.userId = "dual";
  mocked.companyId = null;
  await t.db.insert(s.companies).values([
    { id: "a", name: "A社", slug: "a" }, { id: "b", name: "B社", slug: "b" },
    { id: "template", name: "ひな形", slug: "template", isTemplate: true },
  ]);
  await t.db.insert(s.users).values([
    { id: "dual", name: "2社の人", email: "dual@example.com", role: "EMPLOYEE", companyId: "a", employeeCode: "旧写し", mustChangePassword: true },
    { id: "super", name: "全体管理者", email: "super@example.com", role: "SUPER_ADMIN" },
    { id: "solo", name: "所属なし", email: "solo@example.com", role: "EMPLOYEE" },
  ]);
  await t.db.insert(s.companyMemberships).values([
    { id: "ma", userId: "dual", companyId: "a", role: "EMPLOYEE", employeeCode: "A-1", gradeId: "grade-a", managerId: "manager-a", createdAt: new Date(1000) },
    { id: "mb", userId: "dual", companyId: "b", role: "MANAGER", employeeCode: "B-2", gradeId: "grade-b", managerId: "manager-b", createdAt: new Date(2000) },
    { id: "mt", userId: "dual", companyId: "template", role: "COMPANY_ADMIN", createdAt: new Date(0) },
  ]);
});
afterEach(() => t.close());

describe("認証セッションから会社別Viewerを作るDB結合", () => {
  it("cookieの所属から役割・等級・上長を読み、usersの旧写しを使わない", async () => {
    mocked.companyId = "b";
    expect(await getViewer()).toMatchObject({ id: "dual", role: "MANAGER", companyId: "b", companyName: "B社", gradeId: "grade-b", managerId: "manager-b", employeeCode: "B-2", mustChangePassword: true });
  });
  it.each([null, "missing", "template"])("cookie=%sなら有効な所属のうち会社名の順で最初の会社へ戻す", async (companyId) => {
    mocked.companyId = companyId;
    expect(await getViewer()).toMatchObject({ role: "EMPLOYEE", companyId: "a", employeeCode: "A-1" });
  });
  it("初期選択は所属の古さではなく会社名の順で、改名すると開く会社も変わる（D-009）", async () => {
    // a は最古の所属だが、名前の順では b が先になる
    await t.db.update(s.companies).set({ name: "Z社" }).where(eq(s.companies.id, "a"));
    await t.db.update(s.companies).set({ name: "A社" }).where(eq(s.companies.id, "b"));
    expect(await getViewer()).toMatchObject({ companyId: "b", role: "MANAGER" });
    await t.db.update(s.companies).set({ name: "0社" }).where(eq(s.companies.id, "a"));
    expect(await getViewer()).toMatchObject({ companyId: "a", role: "EMPLOYEE" });
    // 明示的に選んだ有効な所属は、初期選択の順序より優先する。
    mocked.companyId = "b";
    expect(await getViewer()).toMatchObject({ companyId: "b", role: "MANAGER" });
  });
  it("同名の会社は会社IDの順で安定して選び、無効な会社は候補にしない", async () => {
    // 所属の古さを名前の順と逆にしても、同名なら会社IDの順で決まる
    await t.db.update(s.companyMemberships).set({ createdAt: new Date(3000) }).where(eq(s.companyMemberships.id, "ma"));
    await t.db.update(s.companies).set({ name: "同名社" });
    expect(await getViewer()).toMatchObject({ companyId: "a" });
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, "a"));
    expect(await getViewer()).toMatchObject({ companyId: "b", role: "MANAGER" });
  });
  it("停止会社のcookieを使わず、全所属が無効なら認証済みでも通さない", async () => {
    mocked.companyId = "a";
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, "a"));
    expect(await getViewer()).toMatchObject({ companyId: "b", role: "MANAGER" });
    await t.db.update(s.companies).set({ isActive: false }).where(eq(s.companies.id, "b"));
    expect(await getViewer()).toBeNull();
  });
  it("利用者の停止・所属なし・存在しない利用者・未ログインを拒否する", async () => {
    await t.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, "dual"));
    for (const id of ["dual", "solo", "missing", null]) {
      mocked.userId = id;
      expect(await getViewer()).toBeNull();
    }
  });
  it("全体管理者は所属を持たず有効な会社を選び、会社が無くても全体管理者で通る", async () => {
    mocked.userId = "super";
    mocked.companyId = "b";
    expect(await getViewer()).toMatchObject({ role: "SUPER_ADMIN", companyId: "b", gradeId: null, managerId: null });
    mocked.companyId = "template";
    expect(await getViewer()).toMatchObject({ companyId: "a" });
    await t.db.update(s.companies).set({ isActive: false });
    expect(await getViewer()).toMatchObject({ role: "SUPER_ADMIN", companyId: null });
  });
  it("API認可は同じアカウントでも今選んだ会社の役割を使う", async () => {
    await expect(apiViewerFor("evaluations.build")).rejects.toMatchObject({ status: 403 });
    mocked.companyId = "b";
    expect(await apiViewerFor("evaluations.build")).toMatchObject({ role: "MANAGER", companyId: "b" });
    mocked.userId = null;
    await expect(apiViewerFor("evaluations.build")).rejects.toBeInstanceOf(HttpError);
  });
});
