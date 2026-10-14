import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));
import { listCycleSubmissionRows, listFormSubmissionCounts, listFormSubmissionRows } from "@/lib/submission-queries";

let t: TestDatabase;
const EARLY = new Date("2026-04-10T09:00:00Z");
const LATE = new Date("2026-04-11T09:00:00Z");
beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: "other", name: "他社", slug: "other" });
  await t.db.insert(s.users).values([
    { id: "draft", name: "入力途中の人", email: "draft@example.com", companyId: IDS.company, gradeId: IDS.gradeFrom },
    { id: "none", name: "未回答の人", email: "none@example.com", companyId: IDS.company, gradeId: IDS.gradeFrom },
    { id: "stopped", name: "停止した人", email: "stopped@example.com", companyId: IDS.company, gradeId: IDS.gradeFrom, isActive: false },
    { id: "other-user", name: "他社の人", email: "other@example.com", companyId: "other", gradeId: IDS.gradeFrom },
  ]);
  seedMemberships(t);
  // 同じ人の他社の所属があっても、自社の対象者は1行だけ。
  await t.db.insert(s.companyMemberships).values({ id: "dual", userId: IDS.employee, companyId: "other", gradeId: IDS.gradeTo, department: "他社だけの部署" });
  await t.db.insert(s.forms).values([
    { id: "old", companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeFrom, title: "旧版", status: "closed", version: 2, publicToken: "old" },
    { id: "other-form", companyId: "other", cycleId: IDS.cycle, gradeId: IDS.gradeFrom, title: "他社", version: 3, publicToken: "other" },
  ]);
  const base = { companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeFrom };
  await t.db.insert(s.formResponses).values([
    { ...base, id: "submitted", formId: IDS.form, employeeId: IDS.employee, status: "submitted", submittedAt: EARLY },
    { ...base, id: "draft-response", formId: IDS.form, employeeId: "draft", status: "draft" },
    { ...base, id: "stopped-response", formId: IDS.form, employeeId: "stopped", status: "submitted", submittedAt: LATE },
    { ...base, id: "old-submitted", formId: "old", employeeId: IDS.employee, status: "submitted", submittedAt: LATE },
    { ...base, id: "old-draft", formId: "old", employeeId: "draft", status: "draft" },
    { ...base, companyId: "other", id: "other-response", formId: "other-form", employeeId: "none", status: "submitted", submittedAt: LATE },
  ]);
});
afterEach(() => t.close());

describe("提出状況の対象者と回答を実DBで結合する", () => {
  it("アンケートの対象等級の利用中の所属全員を出し、他社・別等級・停止中を除く", async () => {
    const result = await listFormSubmissionRows(IDS.company, IDS.form);
    expect(result?.counts).toEqual({ total: 3, submitted: 1, draft: 1, none: 1 });
    expect(result?.rows.map((r) => r.employeeId).sort()).toEqual([IDS.employee, "draft", "none"].sort());
    expect(result?.rows.find((r) => r.employeeId === "none")?.state).toBe("none");
    expect(result?.rows.find((r) => r.employeeId === IDS.employee)?.submittedAt).toEqual(EARLY);
    expect(JSON.stringify(result)).not.toContain("他社だけの部署");
  });
  it("アンケートごとの件数はその版だけを数え、対象者行の件数と一致する", async () => {
    const counts = await listFormSubmissionCounts(IDS.company, IDS.cycle);
    expect(counts.size).toBe(2);
    for (const form of [IDS.form, "old"]) {
      expect(counts.get(form)).toEqual((await listFormSubmissionRows(IDS.company, form))?.counts);
    }
  });
  it("サイクルは旧版を含めて1人1行とし、最後の提出済みを選ぶ", async () => {
    const result = await listCycleSubmissionRows(IDS.company, IDS.cycle);
    expect(result.counts).toEqual({ total: 3, submitted: 1, draft: 1, none: 1 });
    expect(result.rows.find((r) => r.employeeId === IDS.employee)?.response?.id).toBe("old-submitted");
    expect(result.rows.find((r) => r.employeeId === IDS.employee)?.submittedAt).toEqual(LATE);
    await t.db.update(s.formResponses).set({ status: "draft", submittedAt: null }).where(eq(s.formResponses.id, "old-submitted"));
    expect((await listCycleSubmissionRows(IDS.company, IDS.cycle)).rows.find((r) => r.employeeId === IDS.employee)?.response?.id).toBe("submitted");
  });
  it("存在しないアンケート・他社のID・アンケートのないサイクルは空", async () => {
    expect(await listFormSubmissionRows(IDS.company, "missing")).toBeNull();
    expect(await listFormSubmissionRows(IDS.company, "other-form")).toBeNull();
    expect((await listFormSubmissionCounts(IDS.company, "missing")).size).toBe(0);
    expect(await listCycleSubmissionRows(IDS.company, "missing")).toEqual({ rows: [], counts: { total: 0, submitted: 0, draft: 0, none: 0 } });
  });
});
