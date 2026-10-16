import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 「設問を作り直す」の返事（DD-012 の5・spec §22-9）。
 *
 * 設問のひな形（kpi_questions）が無い項目は、作り直しても設問が出ない。
 * 押しても警告が消えなかった理由と直し方を、返事の文で伝える。
 * 見本には kpi_questions が1件も無いので、稼働率・残業率がひな形の無い項目になる。
 */

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: {} }) }));

import { rebuildFormQuestions } from "@/actions/forms";

let t: TestDatabase;

const admin = {
  id: "usr_admin",
  name: "会社の管理者",
  email: "admin@example.com",
  role: "COMPANY_ADMIN",
  companyId: IDS.company,
  gradeId: null,
  managerId: null,
  department: null,
  employeeCode: null,
  hiredAt: null,
  companyName: "テスト社",
  mustChangePassword: false,
} as Viewer;

const NOTE = "「稼働率」・「残業率」には設問のひな形がありません。作り直しても新しい版でも、設問は出ず点も付きません。";
const HINT = "使うKPIを選ぶで、ひな形のある項目に選び直してください。";

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  // 作り直せるのは回答0件の下書きだけ
  await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("設問を作り直したときの返事", () => {
  it("ひな形の無い項目が残れば、名指しして直し方を添える", async () => {
    const result = await rebuildFormQuestions({ formId: IDS.form });

    expect(result).toMatchObject({ ok: true });
    const message = (result as { message: string }).message;
    expect(message).toMatch(/^いまの制度の設定から設問を作り直しました（\d+問）。/);
    expect(message).toContain(NOTE + HINT);
    expect(message.endsWith("内容を確認してから公開してください。")).toBe(true);
  });

  it("どの項目にもひな形があれば、従来の返事のまま", async () => {
    await t.db.insert(s.kpiQuestions).values([
      { id: "kq_higher", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q_h", text: "稼働時間", role: "direct" },
      { id: "kq_lower", companyId: IDS.company, kpiItemId: IDS.itemLower, questionKey: "q_l", text: "残業時間", role: "direct" },
    ]);

    const result = await rebuildFormQuestions({ formId: IDS.form });

    expect(result).toMatchObject({ ok: true });
    expect((result as { message: string }).message).toMatch(
      /^いまの制度の設定から設問を作り直しました（\d+問）。内容を確認してから公開してください。$/,
    );
  });
});
