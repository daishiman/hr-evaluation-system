import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/*
 * 評価メモの公開範囲（employee_notes.visibility）を、読み出し（listNotes）で守る。
 *
 * - manager（既定）: マネージャー以上が読む。
 * - admin（「管理者のみ」）: 会社の管理者以上だけが読む。マネージャーは書けない（createNote が断る）。
 *   前の版でマネージャーが書いた admin のメモが残っていても、マネージャーには返さない。
 * - 一般（本人）には、どのメモも返さない。
 * 誰のメモを開けるか（直属の部下か）は呼び出し側（canViewEmployee）が先に確かめる。ここは公開範囲だけを見る。
 */

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));
import { listNotes } from "@/lib/queries";

const ADMIN = "usr_admin";

/** 本人（usr_emp）についてのメモ3件。並びは新しい順に返る。 */
const NOTE = {
  forManagers: "note_for_managers",
  adminOnly: "note_admin_only",
  adminOnlyByManager: "note_admin_only_by_manager",
} as const;

let t: TestDatabase;

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
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

  const base = { companyId: IDS.company, employeeId: IDS.employee };
  await t.db.insert(s.employeeNotes).values([
    { ...base, id: NOTE.forManagers, authorId: IDS.evaluator, body: "面談で話したこと", visibility: "manager", createdAt: new Date("2026-04-10T09:00:00Z") },
    { ...base, id: NOTE.adminOnly, authorId: ADMIN, body: "管理者だけの記録", visibility: "admin", createdAt: new Date("2026-04-11T09:00:00Z") },
    // 前の版でマネージャーが「管理者だけが読めるようにする」を選んで残したメモ（今は書けない）
    { ...base, id: NOTE.adminOnlyByManager, authorId: IDS.evaluator, body: "上長から管理者への申し送り", visibility: "admin", createdAt: new Date("2026-04-12T09:00:00Z") },
  ]);
});

afterEach(() => t.close());

describe("listNotes の公開範囲", () => {
  it("マネージャーは「管理者のみ」のメモを受け取らない（前の版で自分が書いたものも受け取らない）", async () => {
    const notes = await listNotes(IDS.company, IDS.employee, "MANAGER");

    expect(ids(notes)).toEqual([NOTE.forManagers]);
    expect(notes.every((n) => n.visibility === "manager")).toBe(true);
  });

  it.each(["COMPANY_ADMIN", "SUPER_ADMIN"] as const satisfies readonly Viewer["role"][])(
    "%s は今までどおり「管理者のみ」を含めて全部を新しい順に受け取る",
    async (role) => {
      const notes = await listNotes(IDS.company, IDS.employee, role);

      expect(ids(notes)).toEqual([NOTE.adminOnlyByManager, NOTE.adminOnly, NOTE.forManagers]);
      expect(notes.map((n) => n.authorName)).toEqual(["上長", "会社の管理者", "上長"]);
    },
  );

  it("一般（本人）には1件も返さず、保管場所にも問い合わせない", async () => {
    mocked.getDb.mockClear();

    expect(await listNotes(IDS.company, IDS.employee, "EMPLOYEE")).toEqual([]);
    expect(mocked.getDb).not.toHaveBeenCalled();
  });

  it("他の会社を選んでいれば、同じ人のメモでも返さない", async () => {
    await t.db.insert(s.companies).values({ id: "cmp_other", name: "他社", slug: "other" });

    expect(await listNotes("cmp_other", IDS.employee, "COMPANY_ADMIN")).toEqual([]);
  });
});
