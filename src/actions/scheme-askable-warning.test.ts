import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 評価セットの保存で、実績の聞き方（設問のひな形）が決まっていない項目を知らせる（spec §1・DD-012 の4・DD-016）。
 *
 * validateScheme は askableItemIds を渡されたときだけ判定する。
 * 保存がひな形の有無を読み忘れると黙って通るので、保存の入口から確かめる。
 * 見本には kpi_questions が1件も無いので、稼働率・残業率が聞き方の決まっていない項目になる。
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

import { saveScheme } from "@/actions/scheme";

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

const ITEMS = [
  { kpiItemId: IDS.itemFixed, categoryId: IDS.category, isFixedSlot: true, isMajorSlot: false },
  { kpiItemId: IDS.itemHigher, categoryId: IDS.category, isFixedSlot: false, isMajorSlot: false },
  { kpiItemId: IDS.itemLower, categoryId: IDS.category, isFixedSlot: false, isMajorSlot: false },
];

const NO_ASKING = "実績の聞き方がまだ決まっていません";
/** 画面と同じく、読んだときの評価セットの更新時刻を添えて保存する */
const save = async () => {
  const [scheme] = await t.db.select({ updatedAt: s.evaluationSchemes.updatedAt }).from(s.evaluationSchemes).where(eq(s.evaluationSchemes.id, IDS.scheme));
  return saveScheme({ schemeId: IDS.scheme, pointGroup: "Regular", items: ITEMS, expectedUpdatedAt: scheme.updatedAt.getTime() });
};
const warningsOf = (result: unknown) => (result as { warnings: string[] }).warnings;

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  // 固定枠1つと10点枠2つで、見本の3項目がそのまま収まる型
  await t.db.insert(s.gradePointRules).values({
    id: "gpr_regular",
    companyId: IDS.company,
    pointGroup: "Regular",
    totalPoints: 40,
    fixedSlotPoints: 20,
    majorSlotPoints: 0,
    majorSlotCount: 0,
    minorSlotPoints: 10,
    minorSlotCount: 2,
  });
  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("評価セットの保存: 実績の聞き方が決まっていない項目", () => {
  it("保存は止めず、聞き方の決まっていない項目だけを名指しし、決める場所を添えて警告する（固定枠は名指ししない）", async () => {
    const result = await save();

    expect(result).toMatchObject({ ok: true });
    const warning = warningsOf(result).find((w) => w.includes(NO_ASKING));
    expect(warning).toMatch(/^「稼働率」・「残業率」は、実績の聞き方がまだ決まっていません。/);
    expect(warning).toContain("KPI・評価セットの「KPI項目」で決められます。その項目の「内容を直す」を押してください。");
    expect(warning).not.toContain("等級要件達成率");
    const saved = await t.db
      .select({ kpiItemId: s.schemeItems.kpiItemId })
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, IDS.scheme), eq(s.schemeItems.pointGroup, "Regular")));
    expect(saved.map((r) => r.kpiItemId).sort()).toEqual([IDS.itemFixed, IDS.itemHigher, IDS.itemLower].sort());
  });

  it("聞き方を決めた項目は警告から外れ、残った項目だけを名指しする", async () => {
    await t.db.insert(s.kpiQuestions).values({
      id: "kq_higher",
      companyId: IDS.company,
      kpiItemId: IDS.itemHigher,
      questionKey: "q_h",
      text: "稼働時間",
      role: "direct",
    });

    const warning = warningsOf(await save()).find((w) => w.includes(NO_ASKING));
    expect(warning).toMatch(/^「残業率」は、/);
    expect(warning).not.toContain("稼働率");
  });

  it("どの項目も聞き方が決まっていれば、聞き方の警告は出さない", async () => {
    await t.db.insert(s.kpiQuestions).values([
      { id: "kq_higher", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q_h", text: "稼働時間", role: "direct" },
      { id: "kq_lower", companyId: IDS.company, kpiItemId: IDS.itemLower, questionKey: "q_l", text: "残業時間", role: "direct" },
    ]);

    expect(warningsOf(await save()).some((w) => w.includes(NO_ASKING))).toBe(false);
  });
});
