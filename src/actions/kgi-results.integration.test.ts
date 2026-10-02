import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 事業所KGIの達成率の保存（達成率の行 → 変更履歴 → 確認中の評価の賞与欄）。
 *
 * 以前は達成率と履歴を書いたあとに、評価の賞与欄を別の batch で書いていた。
 * 後の段で止まると「達成率は変わったのに賞与額は古いまま」が残り、画面も描き直されない。
 * 全部を1回の batch で書き、後の段で失敗しても1行も残らないことを確かめる（§27-4・D-003）。
 */

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
  refresh: vi.fn(),
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

import { saveKgiResult } from "@/actions/kgi-results";

let t: TestDatabase;

const ADMIN: Viewer = {
  id: IDS.evaluator,
  name: "会社の管理者",
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

const input = { officeId: IDS.office, cycleId: IDS.cycle, achievementRate: 105, reason: "実績の確定" };

async function kgiRows() {
  return t.db
    .select({ rate: s.officeKgiResults.achievementRate })
    .from(s.officeKgiResults)
    .where(eq(s.officeKgiResults.officeId, IDS.office));
}

async function revisionRows() {
  return t.db.select({ id: s.officeKgiRevisions.id }).from(s.officeKgiRevisions);
}

async function bonusOfEvaluation() {
  const [row] = await t.db
    .select({
      rate: s.evaluations.officeAchievementRate,
      coefficient: s.evaluations.kgiCoefficient,
      personalPoints: s.evaluations.personalPoints,
    })
    .from(s.evaluations)
    .where(eq(s.evaluations.id, "ev_1"));
  return row;
}

/** 評価の賞与欄を書く文（後の段）だけを、batch の途中で失敗させる。 */
function failEvaluationUpdate() {
  t.raw.exec(`CREATE TRIGGER fail_bonus_update BEFORE UPDATE ON evaluations
    BEGIN SELECT RAISE(ABORT, 'forced bonus failure'); END;`);
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t, { officeKgiRate: null });
  await t.db.insert(s.evaluations).values({
    id: "ev_1",
    companyId: IDS.company,
    cycleId: IDS.cycle,
    employeeId: IDS.employee,
    gradeId: IDS.gradeFrom,
    schemeId: IDS.scheme,
    totalScore: 80,
    maxScore: 100,
    status: "draft",
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.apiViewer.mockReset();
  mocked.apiViewer.mockResolvedValue(ADMIN);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("事業所KGIの達成率の保存", () => {
  it("達成率・変更履歴・確認中の評価の賞与欄を、1回の batch で書く", async () => {
    const batch = vi.spyOn(t.db, "batch");

    const result = await saveKgiResult(input);

    expect(result.ok).toBe(true);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(await kgiRows()).toEqual([{ rate: 105 }]);
    expect(await revisionRows()).toHaveLength(1);
    expect(await bonusOfEvaluation()).toMatchObject({ rate: 105, coefficient: 1.0 });
    expect((await bonusOfEvaluation())?.personalPoints).not.toBeNull();
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("評価の賞与欄で失敗したら、達成率も履歴も1行も残さない", async () => {
    failEvaluationUpdate();

    const result = await saveKgiResult(input);

    expect(result.ok).toBe(false);
    expect(await kgiRows()).toEqual([]);
    expect(await revisionRows()).toEqual([]);
    expect(await bonusOfEvaluation()).toEqual({ rate: null, coefficient: null, personalPoints: null });
    // 書けていないので、画面も描き直さない（入力をそのまま残して直してもらう）
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("登録済みの達成率を変えるときに失敗しても、前の値のまま残す", async () => {
    await t.db.insert(s.officeKgiResults).values({
      id: "okr_1",
      companyId: IDS.company,
      officeId: IDS.office,
      cycleId: IDS.cycle,
      achievementRate: 100,
    });
    failEvaluationUpdate();

    const result = await saveKgiResult(input);

    expect(result.ok).toBe(false);
    expect(await kgiRows()).toEqual([{ rate: 100 }]);
    expect(await revisionRows()).toEqual([]);
  });
});
