import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/**
 * 等級区分「Manager」（等級5）に行動指針の帯域を割り当てたとき、
 * アンケート組み立て（buildQuestionRows）が他の等級区分と同じように動くかを確かめる。
 *
 * 背景: 行動指針の帯域は g1_2 / g3_4 の2種類しか無かった時期があり、
 * 「Manager には割り当てられない」という制約が残っていないかを疑われた。
 * 実装（form-build.ts）を読むと grade.behaviorBand / grade.pointGroup の値は
 * 完全に汎用で、等級区分による分岐は無い。それを固定するテスト。
 */

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getDb: async () => (globalThis as { __testDb?: unknown }).__testDb,
  };
});

const { buildQuestionRows } = await import("@/lib/form-build");

beforeEach(() => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

describe("等級区分がManagerでも、行動指針の帯域を割り当てればアンケートに設問が出る", () => {
  it("Managerの等級に既存の基準セットを割り当てると、行動指針の設問が組み立てられる", async () => {
    await seedCompany(current);

    // 等級5（Manager）相当に切り替える。行動指針の帯域は既存セット g1_2 をそのまま割り当てる。
    // g1_2 / g3_4 という帯域そのものに「対応する等級区分」の制約は無い。
    await current.db
      .update(s.grades)
      .set({ pointGroup: "Manager", behaviorBand: "g1_2" })
      .where(eq(s.grades.id, IDS.gradeFrom));
    await current.db.update(s.schemeItems).set({ pointGroup: "Manager" });

    const rows = await buildQuestionRows({
      companyId: IDS.company,
      cycleId: IDS.cycle,
      gradeId: IDS.gradeFrom,
      formId: "frm_manager_test",
    });

    const behaviorRows = rows.filter((r) => r.section === "behavior");
    expect(behaviorRows).toHaveLength(1);
    expect(behaviorRows[0].behaviorGuidelineId).toBe(IDS.guideline);
  });

  it("Managerの等級で帯域を割り当てなければ、これまでどおり行動指針の設問は出ない", async () => {
    await seedCompany(current);
    await current.db
      .update(s.grades)
      .set({ pointGroup: "Manager", behaviorBand: null })
      .where(eq(s.grades.id, IDS.gradeFrom));
    await current.db.update(s.schemeItems).set({ pointGroup: "Manager" });

    const rows = await buildQuestionRows({
      companyId: IDS.company,
      cycleId: IDS.cycle,
      gradeId: IDS.gradeFrom,
      formId: "frm_manager_test2",
    });

    expect(rows.filter((r) => r.section === "behavior")).toHaveLength(0);
  });
});
