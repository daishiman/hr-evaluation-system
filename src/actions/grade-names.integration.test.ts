import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { FORBIDDEN_MESSAGE as FORBIDDEN } from "@/test-support/action-mocks";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { bandSetLabel, pointGroupLabel } from "@/lib/domain/grade-label";
import { activeMembershipFor } from "@/lib/memberships";

/*
 * 等級名を変えられる人（S3・A2・A3）。
 *
 * 等級名の変更は saveMaster（kind=grade、台帳の操作 masters.save、COMPANY_ADMIN 以上）だけが受け付ける。
 * 確かめるのは次の3つ。
 *  - 役割: MANAGER・EMPLOYEE は 403。どの表も書かず、制度の変更記録（constitution_events）も残さない。
 *  - 会社の境界: 他社の等級 id は 404。A社では管理者でB社では一般の社員の人がB社を選ぶと、
 *    B社の等級もA社の等級も変えられない（役割は選んでいる所属のもの）。
 *  - 反映: 変えた名前が、区分・行動指針のセットの呼び名にそのまま出る（呼び名は表示のたびに作る）。
 */

const COMPANY_B = "cmp_b";
const GRADE_B = "grd_b_regular";
const DUAL = "usr_dual";

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

import { saveMaster } from "@/actions/masters";

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

/** 所属の表から、選んでいる会社の役割で Viewer を作る（getViewer と同じ選び方）。 */
async function viewerFromMembership(userId: string, preferredCompanyId: string): Promise<Viewer> {
  const membership = await activeMembershipFor(t.db, userId, preferredCompanyId);
  expect(membership, "有効な所属が見つからない").toBeTruthy();
  return as(membership!.role, userId, membership!.companyId);
}

const WATCHED_TABLES = ["grades", "constitution_events", "behavior_band_sets"];

function snapshot() {
  return Object.fromEntries(
    WATCHED_TABLES.map((name) => [name, t.raw.prepare(`select * from ${name} order by 1`).all()]),
  );
}

async function gradeName(id: string) {
  return (await t.db.select({ name: s.grades.name }).from(s.grades).where(eq(s.grades.id, id)).limit(1))[0]?.name;
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  seedMemberships(t);
  await t.db.insert(s.companies).values({ id: COMPANY_B, name: "B社", slug: "b" });
  await t.db.insert(s.grades).values({
    id: GRADE_B,
    companyId: COMPANY_B,
    code: "regular",
    name: "等級2",
    pointGroup: "Regular",
    displayOrder: 2,
    targetCap: 5,
  });
  await t.db.insert(s.users).values([
    { id: "usr_super", name: "システム管理者", email: "super@example.com", companyId: null, role: "SUPER_ADMIN" },
    { id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: DUAL, name: "2社に所属する人", email: "dual@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
  ]);
  await t.db.insert(s.companyMemberships).values([
    { id: "mem_admin", userId: "usr_admin", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: "mem_dual_a", userId: DUAL, companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: "mem_dual_b", userId: DUAL, companyId: COMPANY_B, role: "EMPLOYEE" },
  ]);
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("役割が足りない人は、等級名を変えられない", () => {
  it.each([
    { role: "MANAGER" as const, id: IDS.evaluator },
    { role: "EMPLOYEE" as const, id: IDS.employee },
  ])("$role は 403 で、等級も制度の変更記録も1行も書かない", async ({ role, id }) => {
    mocked.viewer = as(role, id);
    const before = snapshot();

    const result = await saveMaster({ kind: "grade", id: IDS.gradeFrom, name: "等級2" });

    expect(result).toEqual({ ok: false, message: FORBIDDEN });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("会社の境界", () => {
  it("会社の管理者が他社の等級 id を送ると 404 で、何も書かない", async () => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");
    const before = snapshot();

    const result = await saveMaster({ kind: "grade", id: GRADE_B, name: "乗っ取り" });

    expect(result).toEqual({ ok: false, message: "等級が見つかりませんでした。" });
    expect(snapshot()).toEqual(before);
    expect(await gradeName(GRADE_B)).toBe("等級2");
  });

  it("A社では管理者でB社では一般の社員の人は、B社を選ぶと B社の等級も A社の等級も変えられない", async () => {
    mocked.viewer = await viewerFromMembership(DUAL, COMPANY_B);
    expect(mocked.viewer.role).toBe("EMPLOYEE");
    expect(mocked.viewer.companyId).toBe(COMPANY_B);
    const before = snapshot();

    for (const id of [GRADE_B, IDS.gradeFrom]) {
      const result = await saveMaster({ kind: "grade", id, name: "等級を勝手に変える" });
      expect(result).toEqual({ ok: false, message: FORBIDDEN });
    }
    expect(snapshot()).toEqual(before);
  });

  it("同じ人が A社を選び直せば、A社の等級だけを変えられる（B社の等級は 404）", async () => {
    mocked.viewer = await viewerFromMembership(DUAL, IDS.company);
    expect(mocked.viewer.role).toBe("COMPANY_ADMIN");

    expect(await saveMaster({ kind: "grade", id: IDS.gradeFrom, name: "等級2" })).toMatchObject({ ok: true });
    expect(await saveMaster({ kind: "grade", id: GRADE_B, name: "乗っ取り" })).toEqual({
      ok: false,
      message: "等級が見つかりませんでした。",
    });
    expect(await gradeName(GRADE_B)).toBe("等級2");
  });
});

describe("会社の管理者と全体管理者は変えられ、呼び名に反映される", () => {
  it.each([
    { role: "COMPANY_ADMIN" as const, id: "usr_admin" },
    { role: "SUPER_ADMIN" as const, id: "usr_super" },
  ])("$role が変えると、等級名と制度の変更記録が1件ずつ書かれる", async ({ role, id }) => {
    mocked.viewer = as(role, id);

    const result = await saveMaster({ kind: "grade", id: IDS.gradeFrom, name: "等級2" });

    expect(result).toMatchObject({ ok: true, message: "等級の設定を保存しました。" });
    expect(await gradeName(IDS.gradeFrom)).toBe("等級2");
    const events = t.raw
      .prepare("select entity_type, entity_id, actor_id from constitution_events where entity_id = ?")
      .all(IDS.gradeFrom);
    expect(events).toEqual([{ entity_type: "grade", entity_id: IDS.gradeFrom, actor_id: id }]);
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("変えた名前が、区分と行動指針のセットの呼び名にそのまま出る", async () => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");
    await saveMaster({ kind: "grade", id: IDS.gradeFrom, name: "一般職" });
    await saveMaster({ kind: "grade", id: IDS.gradeTo, name: "主任" });

    const grades = await t.db.select().from(s.grades).where(eq(s.grades.companyId, IDS.company));
    expect(pointGroupLabel("Regular", grades)).toBe("一般職");
    expect(pointGroupLabel("Chief", grades)).toBe("主任");
    expect(bandSetLabel({ code: "g1_2", name: "Beginner・Regular向け", displayOrder: 1 }, grades)).toBe("一般職向け");
    expect(bandSetLabel({ code: "g3_4", name: "", displayOrder: 2 }, grades)).toBe("主任向け");
  });

  it("等級名を空にはできない（呼び名が「等級未設定」に崩れないため）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");
    const before = snapshot();

    const result = await saveMaster({ kind: "grade", id: IDS.gradeFrom, name: "" });

    expect(result).toMatchObject({ ok: false });
    expect(snapshot()).toEqual(before);
  });
});
