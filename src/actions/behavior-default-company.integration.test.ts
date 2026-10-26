import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { DEFAULT_BEHAVIOR_BAND, describeBandAssignment } from "@/lib/domain/behavior-default-assignment";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 新しい会社は、行動指針の既定の割り当てで始まる（DD-026 の3・O25-2）。
 *
 * 会社の追加（createCompany）は雛形の会社（companies.is_template）の制度を copyCompanyMasters で写す。
 * 割り当て（grades.behavior_band）もそのまま写るので、雛形がずれていれば新しい会社もずれて始まる。
 * 0040 は雛形の会社も既定へ戻す。ずれた雛形に 0040 を流してから会社を作り、新しい会社が既定で始まることを確かめる。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const MIGRATION = read("drizzle/migrations/0040_behavior_band_defaults.sql")
  .split("--> statement-breakpoint")
  .filter((st) => st.trim() !== "");

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
  adminEmail: "new-admin@example.com",
  adminPassword: "first-pass-0001",
};

/** 雛形の会社に足す等級。等級1は2つ目へ、等級4-2は出さないへ、等級5-1は2つ目へずれている */
const DRIFTED = [
  ["beginner", "等級1", "Beginner", 1, "g3_4"],
  ["am1", "等級4-1", "AM", 4, "g3_4"],
  ["am2", "等級4-2", "AM", 5, null],
  ["manager1", "等級5-1", "Manager", 6, "g3_4"],
  ["manager2", "等級5-2", "Manager", 7, null],
] as const;

/** 会社の等級の割り当て（code → まとまり） */
async function bandsOf(companyId: string) {
  const rows = await t.db
    .select({ code: s.grades.code, band: s.grades.behaviorBand })
    .from(s.grades)
    .where(eq(s.grades.companyId, companyId));
  return Object.fromEntries(rows.map((r) => [r.code, r.band]));
}

async function summaryOf(companyId: string) {
  const grades = await t.db.select().from(s.grades).where(eq(s.grades.companyId, companyId));
  const sets = await t.db
    .select()
    .from(s.behaviorBandSets)
    .where(eq(s.behaviorBandSets.companyId, companyId))
    .orderBy(asc(s.behaviorBandSets.displayOrder), asc(s.behaviorBandSets.code));
  return describeBandAssignment(grades, sets);
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  seedMemberships(t);
  await t.db.update(s.companies).set({ isTemplate: true }).where(eq(s.companies.id, IDS.company));
  await t.db.insert(s.users).values({
    id: "usr_super",
    name: "システム管理者",
    email: "super@example.com",
    companyId: IDS.company,
    role: "SUPER_ADMIN",
  });
  // seedCompany は等級2（g1_2）と等級3（g3_4）だけを、0034 の前の名前で持つ。名前を既定にし、残りの5つを既定からずらして足す
  await t.db.update(s.grades).set({ name: "等級2" }).where(eq(s.grades.id, IDS.gradeFrom));
  await t.db.update(s.grades).set({ name: "等級3" }).where(eq(s.grades.id, IDS.gradeTo));
  await t.db.insert(s.grades).values(
    DRIFTED.map(([code, name, pointGroup, displayOrder, behaviorBand]) => ({
      id: `grd_${code}`,
      companyId: IDS.company,
      code,
      name,
      pointGroup,
      displayOrder,
      targetCap: 5,
      behaviorBand,
    })),
  );
  await t.db.insert(s.behaviorBandSets).values([
    { id: "bbs_g1_2", companyId: IDS.company, code: "g1_2", name: "", displayOrder: 1 },
    { id: "bbs_g3_4", companyId: IDS.company, code: "g3_4", name: "", displayOrder: 2 },
  ]);
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

describe("新しい会社の行動指針の割り当て（雛形と 0040）", () => {
  it("0040 を流した雛形から作った会社は、既定の割り当てで始まる", async () => {
    for (const st of MIGRATION) t.raw.exec(st);
    expect(await bandsOf(IDS.company)).toEqual(DEFAULT_BEHAVIOR_BAND);

    const result = await createCompany(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await bandsOf(result.id)).toEqual(DEFAULT_BEHAVIOR_BAND);
    // 画面の説明も既定の分け方になる
    expect(await summaryOf(result.id)).toEqual({
      sentence: "等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目を出し、等級5-1・等級5-2には出しません。",
      matchesDefault: true,
      differences: [],
    });
  });

  it("新しい会社の行は 0040 の記録の表に載らない（戻しの対象にならない）", async () => {
    for (const st of MIGRATION) t.raw.exec(st);

    const result = await createCompany(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = t.raw.prepare("SELECT row_id FROM behavior_band_default_rewrites WHERE company_id = ?").all(result.id);
    expect(rows).toEqual([]);
  });

  it("雛形が 0040 の前のままだと、ずれた割り当てがそのまま写る（雛形も移行の対象にする理由）", async () => {
    const result = await createCompany(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await bandsOf(result.id)).toEqual(await bandsOf(IDS.company));
    const summary = await summaryOf(result.id);
    expect(summary.matchesDefault).toBe(false);
    expect(summary.differences.map((d) => d.code)).toEqual(["beginner", "am2", "manager1"]);
  });
});
