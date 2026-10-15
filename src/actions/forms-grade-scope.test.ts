import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 「この等級だけ新しい版の下書きを作る」の範囲（DD-012 の5・7・受入 AC5）。
 *
 * 比べる警告の直す操作は、createForms に gradeIds を1件だけ渡す。確かめるのは次の3つ。
 *  - 名指しした等級の版だけが増え、ほかの等級のアンケートは増えない。
 *  - 自社に無い等級（他社の等級 id）が1件でも混ざれば 400 で、1行も作らない（今までは黙って外していた）。
 *  - 使用を止めた自社の等級は、名指しすれば今どおり作れる。gradeIds を省けば使用中の等級だけを作る。
 * 見本には配点ルールが無く、評価セットの準備の確認が 409 になるので、その確認だけを「準備済み」に差し替える。
 */

const COMPANY_B = "cmp_b";
const GRADE_B = "grd_b_regular";
const OUTSIDE = "この会社に無い等級が含まれています。";

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
vi.mock("@/lib/scheme-readiness", () => ({
  loadSchemeReadiness: async () => ({ schemeReady: true, schemeGaps: [], schemeMessage: "", groups: [] }),
}));

import { createForms } from "@/actions/forms";

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

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  await t.db.insert(s.companies).values({ id: COMPANY_B, name: "B社", slug: "b" });
  await t.db.insert(s.grades).values({
    id: GRADE_B, companyId: COMPANY_B, code: "regular", name: "B社の等級", pointGroup: "Regular", displayOrder: 2, targetCap: 5,
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

/** 等級ごとのアンケートの版（会社をまたいで全部） */
async function versionsByGrade() {
  const rows = await t.db.select({ gradeId: s.forms.gradeId, version: s.forms.version }).from(s.forms);
  const out: Record<string, number[]> = {};
  for (const r of rows) out[r.gradeId] = [...(out[r.gradeId] ?? []), r.version].sort((a, b) => a - b);
  return out;
}

describe("名指しした等級の版だけが増える", () => {
  it("Regular を名指しすると Regular の第2版だけが増え、Chief は作られない", async () => {
    const result = await createForms({ cycleId: IDS.cycle, gradeIds: [IDS.gradeFrom] });

    expect(result).toMatchObject({ ok: true });
    expect(await versionsByGrade()).toEqual({ [IDS.gradeFrom]: [1, 2] });
  });

  it("Chief を名指しすると Chief の第1版だけが増え、Regular の版は増えない", async () => {
    const result = await createForms({ cycleId: IDS.cycle, gradeIds: [IDS.gradeTo] });

    expect(result).toMatchObject({ ok: true });
    expect(await versionsByGrade()).toEqual({ [IDS.gradeFrom]: [1], [IDS.gradeTo]: [1] });
  });
});

// 中では HttpError(400) で断るが、画面へ返る形（ActionFail）は状態コードを持たない。
// 断られたことは ok と理由の文で確かめる
describe("自社に無い等級は拒否する（DD-012 の7）", () => {
  it.each([
    { name: "他社の等級だけ", gradeIds: [GRADE_B] },
    { name: "自社の等級に他社の等級が1件混ざる", gradeIds: [IDS.gradeFrom, GRADE_B] },
    { name: "どこにも無い id", gradeIds: ["grd_missing"] },
  ])("$name は断られ、アンケートを1行も作らない", async ({ gradeIds }) => {
    const before = await versionsByGrade();

    const result = await createForms({ cycleId: IDS.cycle, gradeIds });

    expect(result).toMatchObject({ ok: false, message: OUTSIDE });
    expect(await versionsByGrade()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("使用を止めた自社の等級", () => {
  beforeEach(async () => {
    await t.db.update(s.grades).set({ isActive: false }).where(eq(s.grades.id, IDS.gradeTo));
  });

  it("名指しすれば今どおり作れる（狭めるのは他社の id だけ）", async () => {
    const result = await createForms({ cycleId: IDS.cycle, gradeIds: [IDS.gradeTo] });

    expect(result).toMatchObject({ ok: true });
    expect((await versionsByGrade())[IDS.gradeTo]).toEqual([1]);
  });

  it("gradeIds を省くと、使用中の等級だけを作る（今までの振る舞いのまま）", async () => {
    const result = await createForms({ cycleId: IDS.cycle });

    expect(result).toMatchObject({ ok: true });
    expect(await versionsByGrade()).toEqual({ [IDS.gradeFrom]: [1, 2] });
  });
});
