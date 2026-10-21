import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));

import { getEvaluationDetail, listEvaluations } from "@/lib/queries";

let t: TestDatabase;
const EVALUATION_ID = "eval_target";

beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  await seedCompany(t);
  seedMemberships(t);
  await t.db.insert(s.evaluations).values([
    {
      id: EVALUATION_ID, companyId: IDS.company, employeeId: IDS.employee,
      cycleId: IDS.cycle, gradeId: IDS.gradeFrom, schemeId: IDS.scheme,
      totalScore: 73, maxScore: 100, status: "finalized", personalPoints: 73,
      raiseReason: "必要点数に届かなかった", raiseReasonEmployee: "改善を続けましょう",
    },
    {
      id: "eval_other", companyId: IDS.company, employeeId: IDS.evaluator,
      cycleId: IDS.cycle, gradeId: IDS.gradeTo, schemeId: IDS.scheme, totalScore: 88,
    },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("評価1件の読み取り", () => {
  it("ID条件は会社・社員・期間の条件と同時に効く", async () => {
    const opts = { evaluationId: EVALUATION_ID, employeeId: IDS.employee, cycleId: IDS.cycle };
    expect((await listEvaluations(IDS.company, "MANAGER", opts)).map((r) => r.id)).toEqual([EVALUATION_ID]);
    expect(await listEvaluations(IDS.company, "MANAGER", { ...opts, employeeId: IDS.evaluator })).toEqual([]);
    expect(await listEvaluations(IDS.company, "MANAGER", { ...opts, cycleId: "missing" })).toEqual([]);
    expect(await listEvaluations("other_company", "MANAGER", opts)).toEqual([]);
  });

  it("詳細の見出しは対象IDで絞って読み、全社の履歴を読み出さない", async () => {
    const prepare = vi.spyOn(t.raw, "prepare");

    expect((await getEvaluationDetail(IDS.company, EVALUATION_ID, "MANAGER"))?.head.id).toBe(EVALUATION_ID);

    const headQuery = prepare.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes('left join "evaluation_cycles"'));
    expect(headQuery).toBeDefined();
    expect(headQuery?.split(" where ")[1]).toContain('"evaluations"."id" = ?');
  });

  it("対象IDの絞り込みを加えても、本人向けの点数を隠し理由文を切り替える", async () => {
    const own = await getEvaluationDetail(IDS.company, EVALUATION_ID, "EMPLOYEE");
    expect(own?.head).toMatchObject({ id: EVALUATION_ID, totalScore: null, maxScore: null, personalPoints: null, raiseReason: "改善を続けましょう" });
    const full = await getEvaluationDetail(IDS.company, EVALUATION_ID, "MANAGER");
    expect(full?.head).toMatchObject({ totalScore: 73, maxScore: 100, personalPoints: 73, raiseReason: "必要点数に届かなかった" });
  });

  it("他社や存在しない評価の詳細は返さない", async () => {
    expect(await getEvaluationDetail("other_company", EVALUATION_ID, "MANAGER")).toBeNull();
    expect(await getEvaluationDetail(IDS.company, "missing", "MANAGER")).toBeNull();
    expect(await getEvaluationDetail(IDS.company, "", "MANAGER")).toBeNull();
  });
});
