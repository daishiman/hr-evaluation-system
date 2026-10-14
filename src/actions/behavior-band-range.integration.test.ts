import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 行動指針の基準セットは、等級の並びで続いた等級にだけ出す（§28-12・DD-010）。
 *
 * 画面は飛び飛びになる選択肢を選べなくしているが、saveMaster（kind=grade）を直接呼んでも
 * 同じ判定で止まることを確かめる。止めたときは等級も制度の変更記録も書かない。
 * すでに飛び飛びになっている会社（本番で等級1 だけが上の層へ移っていた形）は、直す向きの1手で戻せる。
 */

const ADMIN = "usr_admin";
const BEGINNER = "grd_beginner";
const AM1 = "grd_am1";
const AM2 = "grd_am2";
const MANAGER1 = "grd_manager1";

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

const WATCHED_TABLES = ["grades", "constitution_events"];

function snapshot() {
  return Object.fromEntries(
    WATCHED_TABLES.map((name) => [name, t.raw.prepare(`select * from ${name} order by 1`).all()]),
  );
}

async function bands() {
  const rows = await t.db
    .select({ name: s.grades.name, band: s.grades.behaviorBand, order: s.grades.displayOrder })
    .from(s.grades)
    .where(eq(s.grades.companyId, IDS.company));
  return rows.sort((a, b) => a.order - b.order).map((r) => [r.name, r.band]);
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  // seedCompany は 等級２（g1_2・並び2）と 等級３（g3_4・並び3）を作る。前後を足して初期の分け方にそろえる
  await seedCompany(t);
  seedMemberships(t);
  await t.db.insert(s.grades).values([
    { id: BEGINNER, companyId: IDS.company, code: "beginner", name: "等級1", pointGroup: "Beginner", displayOrder: 1, targetCap: 5, behaviorBand: "g1_2" },
    { id: AM1, companyId: IDS.company, code: "am1", name: "等級4-1", pointGroup: "AM", displayOrder: 4, targetCap: 3, behaviorBand: "g3_4" },
    { id: AM2, companyId: IDS.company, code: "am2", name: "等級4-2", pointGroup: "AM", displayOrder: 5, targetCap: 2, behaviorBand: "g3_4" },
    { id: MANAGER1, companyId: IDS.company, code: "manager1", name: "等級5-1", pointGroup: "Manager", displayOrder: 6, targetCap: 2, behaviorBand: null },
  ]);
  await t.db.insert(s.behaviorBandSets).values([
    { id: "bbs_g1_2", companyId: IDS.company, code: "g1_2", name: "", displayOrder: 1 },
    { id: "bbs_g3_4", companyId: IDS.company, code: "g3_4", name: "", displayOrder: 2 },
  ]);
  await t.db.insert(s.users).values({ id: ADMIN, name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  await t.db.insert(s.companyMemberships).values({ id: "mem_admin", userId: ADMIN, companyId: IDS.company, role: "COMPANY_ADMIN" });
  mocked.viewer = {
    id: ADMIN,
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
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("行動指針の基準セットは続いた等級にだけ出す", () => {
  it("等級２ を挟んで 等級1 を上の層のセットへ移すのは 400 で、何も書かない", async () => {
    const before = snapshot();
    expect(await saveMaster({ kind: "grade", id: BEGINNER, behaviorBand: "g3_4" })).toEqual({
      ok: false,
      message:
        "等級1・等級３：Chief・等級4-1・等級4-2に同じ行動指針を出すと、あいだの等級２：Regularだけが別になります。同じ行動指針は、等級の並びで続いた等級にだけ出せます。",
    });
    expect(snapshot()).toEqual(before);
  });

  it("層の途中を「出さない」にして、残りが割れるのも止める", async () => {
    const result = await saveMaster({ kind: "grade", id: AM1, behaviorBand: null });
    expect(result).toMatchObject({ ok: false });
    expect(await bands()).toEqual([
      ["等級1", "g1_2"],
      ["等級２：Regular", "g1_2"],
      ["等級３：Chief", "g3_4"],
      ["等級4-1", "g3_4"],
      ["等級4-2", "g3_4"],
      ["等級5-1", null],
    ]);
  });

  it("境目をずらすのは保存できる（等級２ を上の層へ）", async () => {
    expect(await saveMaster({ kind: "grade", id: IDS.gradeFrom, behaviorBand: "g3_4" })).toMatchObject({ ok: true });
    expect((await bands()).map(([, band]) => band)).toEqual(["g1_2", "g3_4", "g3_4", "g3_4", "g3_4", null]);
  });

  it("すでに飛び飛びの会社は、直す向きの1手で戻せる。悪くする手は止める", async () => {
    // 本番で見つかった形を直接作る（以前は画面から作れた）
    await t.db.update(s.grades).set({ behaviorBand: "g3_4" }).where(eq(s.grades.id, BEGINNER));

    expect(await saveMaster({ kind: "grade", id: MANAGER1, behaviorBand: "g3_4" })).toMatchObject({ ok: false });
    expect(await saveMaster({ kind: "grade", id: BEGINNER, behaviorBand: "g1_2" })).toMatchObject({ ok: true });
    expect((await bands()).map(([, band]) => band)).toEqual(["g1_2", "g1_2", "g3_4", "g3_4", "g3_4", null]);
  });

  it("すでに飛び飛びの会社でも、飛び飛びのセットの等級へ今と同じ値を送り直すのは 400 にしない", async () => {
    await t.db.update(s.grades).set({ behaviorBand: "g3_4" }).where(eq(s.grades.id, BEGINNER));

    expect(await saveMaster({ kind: "grade", id: BEGINNER, behaviorBand: "g3_4" })).toMatchObject({ ok: true });
    expect(await saveMaster({ kind: "grade", id: IDS.gradeTo, behaviorBand: "g3_4" })).toMatchObject({ ok: true });
    expect((await bands()).map(([, band]) => band)).toEqual(["g3_4", "g1_2", "g3_4", "g3_4", "g3_4", null]);
  });

  it("等級名だけを変えるときは、割り当ての判定をしない", async () => {
    await t.db.update(s.grades).set({ behaviorBand: "g3_4" }).where(eq(s.grades.id, BEGINNER));
    expect(await saveMaster({ kind: "grade", id: BEGINNER, name: "等級1----" })).toMatchObject({ ok: true });
  });
});
