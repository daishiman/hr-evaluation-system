import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { NOTE_VISIBILITY_BLOCK_REASON } from "@/lib/domain/evaluation-authority";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 評価メモの保存（createNote）は、書ける公開範囲を読める公開範囲と同じにする。
 *
 * - マネージャーは「管理者のみ」（admin）を書けない。画面に選択肢は出さないが、直接呼ばれても断り、行を増やさない。
 * - 会社の管理者は今までどおり admin で残せて、残したメモを読める。
 * 読み出しは listNotes（見る人の役割で公開範囲を絞る）で確かめる。
 */

const ADMIN = "usr_admin";

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

import { createNote } from "@/actions/notes";
import { listNotes } from "@/lib/queries";

let t: TestDatabase;

function viewer(id: string, role: Viewer["role"]): Viewer {
  return {
    id,
    name: "書く人",
    email: `${id}@example.com`,
    role,
    companyId: IDS.company,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  };
}

const noteRows = () => t.db.select().from(s.employeeNotes);

beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  await seedCompany(t);
  await t.db.insert(s.users).values({
    id: ADMIN,
    name: "会社の管理者",
    email: "admin@example.com",
    companyId: IDS.company,
    role: "COMPANY_ADMIN",
    officeId: IDS.office,
  });
  seedMemberships(t);
});

afterEach(() => t.close());

describe("createNote の公開範囲", () => {
  it("マネージャーが「管理者のみ」で保存しようとすると断り、メモの行を増やさない", async () => {
    mocked.viewer = viewer(IDS.evaluator, "MANAGER");

    const result = await createNote({ employeeId: IDS.employee, body: "管理者への申し送り", visibility: "admin" });

    expect(result).toEqual({ ok: false, message: NOTE_VISIBILITY_BLOCK_REASON });
    expect(await noteRows()).toHaveLength(0);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("マネージャーは直属の部下のメモを「マネージャー以上」で残せて、読める", async () => {
    mocked.viewer = viewer(IDS.evaluator, "MANAGER");

    expect(await createNote({ employeeId: IDS.employee, body: "面談で話したこと" })).toMatchObject({ ok: true });

    const notes = await listNotes(IDS.company, IDS.employee, "MANAGER");
    expect(notes.map((n) => [n.body, n.visibility])).toEqual([["面談で話したこと", "manager"]]);
  });

  it("会社の管理者は今までどおり「管理者のみ」で残せて、読める（マネージャーには返らない）", async () => {
    mocked.viewer = viewer(ADMIN, "COMPANY_ADMIN");

    expect(await createNote({ employeeId: IDS.employee, body: "管理者だけの記録", visibility: "admin" })).toMatchObject({
      ok: true,
    });

    const rows = await noteRows();
    expect(rows.map((r) => [r.authorId, r.visibility])).toEqual([[ADMIN, "admin"]]);
    expect((await listNotes(IDS.company, IDS.employee, "COMPANY_ADMIN")).map((n) => n.body)).toEqual(["管理者だけの記録"]);
    expect(await listNotes(IDS.company, IDS.employee, "MANAGER")).toEqual([]);
  });
});
