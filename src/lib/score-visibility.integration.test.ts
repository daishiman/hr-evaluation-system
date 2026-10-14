import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import type { Viewer } from "@/lib/session";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import {
  latestFinalizedScores,
  latestFinalizedScoresEveryCompany,
  membershipScoreKey,
  withGradeAndScore,
} from "@/lib/score-visibility";

/*
 * 一覧の等級と点数（S6・A5）。
 *
 * - 点数は確定済み（finalized）の評価のうち、評価期間の開始日が最も新しい1件だけを使う。
 * - 会社は引数で受けず、見ている人の会社（viewer.companyId）に限る。
 * - 見せるかどうかは台帳の操作 members.viewGradeScore（MANAGER 以上）で決め、
 *   見せない役割には等級と点数のキーそのものを応答に含めない。
 */

let t: TestDatabase;

function viewer(role: Viewer["role"], companyId: string | null = IDS.company): Viewer {
  return {
    id: `usr_view_${role}`,
    name: "見る人",
    email: `${role.toLowerCase()}@example.com`,
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

beforeEach(async () => {
  t = createTestDatabase();
  await seedCompany(t);
  seedMemberships(t);
  await t.db.insert(s.evaluationCycles).values([
    { id: "cyc_old", companyId: IDS.company, name: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", schemeId: IDS.scheme, status: "closed" },
    { id: "cyc_new", companyId: IDS.company, name: "2026年度下期", periodStart: "2026-10-01", periodEnd: "2027-03-31", schemeId: IDS.scheme, status: "open" },
  ]);
  const base = { companyId: IDS.company, employeeId: IDS.employee, gradeId: IDS.gradeFrom, schemeId: IDS.scheme };
  await t.db.insert(s.evaluations).values([
    { ...base, id: "ev_old", cycleId: "cyc_old", status: "finalized", totalScore: 60, maxScore: 100, requirementRate: 50 },
    { ...base, id: "ev_mid", cycleId: IDS.cycle, status: "finalized", totalScore: 72.5, maxScore: 100, requirementRate: 80 },
    // 開始日がいちばん新しいが下書き。点数に使わない
    { ...base, id: "ev_new", cycleId: "cyc_new", status: "draft", totalScore: 99, maxScore: 100, requirementRate: 100 },
  ]);
  await t.db.insert(s.companies).values({ id: "cmp_other", name: "他社", slug: "other" });
});

afterEach(() => t.close());

describe("latestFinalizedScores", () => {
  it("確定済みのうち評価期間の開始日が最も新しい1件を返す", async () => {
    const scores = await latestFinalizedScores(t.db, viewer("MANAGER"), [IDS.employee, IDS.evaluator]);
    expect(scores.get(IDS.employee)).toEqual({
      totalScore: 72.5,
      maxScore: 100,
      requirementRate: 80,
      cycleName: "2026年度上期",
    });
    // 確定済みの評価が無い人は含めない
    expect(scores.has(IDS.evaluator)).toBe(false);
  });

  it("見ている人の会社の評価だけを読む（他社の会社を選んでいれば0件）", async () => {
    const scores = await latestFinalizedScores(t.db, viewer("COMPANY_ADMIN", "cmp_other"), [IDS.employee]);
    expect(scores.size).toBe(0);
  });

  it("対象が空なら問い合わせずに空を返す", async () => {
    expect((await latestFinalizedScores(t.db, viewer("MANAGER"), [])).size).toBe(0);
  });

  it("見てよくない役割（EMPLOYEE）には、問い合わせずに空を返す", async () => {
    expect((await latestFinalizedScores(t.db, viewer("EMPLOYEE"), [IDS.employee])).size).toBe(0);
  });
});

describe("複数の会社に所属する人の点数（S7 と S6）", () => {
  beforeEach(async () => {
    // 同じ人が他社にも所属し、他社では開始日のより新しい評価期間で確定している
    await t.db.insert(s.evaluationCycles).values({
      id: "cyc_other",
      companyId: "cmp_other",
      name: "他社 2027年度上期",
      periodStart: "2027-04-01",
      periodEnd: "2027-09-30",
      schemeId: IDS.scheme,
      status: "closed",
    });
    await t.db.insert(s.evaluations).values({
      id: "ev_other",
      companyId: "cmp_other",
      cycleId: "cyc_other",
      employeeId: IDS.employee,
      gradeId: IDS.gradeFrom,
      schemeId: IDS.scheme,
      status: "finalized",
      totalScore: 41,
      maxScore: 100,
      requirementRate: 30,
    });
  });

  it("会社の一覧には、その会社で確定した点数だけを出す（他社の新しい評価を混ぜない）", async () => {
    const own = await latestFinalizedScores(t.db, viewer("COMPANY_ADMIN"), [IDS.employee]);
    expect(own.get(IDS.employee)?.totalScore).toBe(72.5);
    const other = await latestFinalizedScores(t.db, viewer("COMPANY_ADMIN", "cmp_other"), [IDS.employee]);
    expect(other.get(IDS.employee)?.totalScore).toBe(41);
  });

  it("全体管理者の利用者一覧には、所属（会社と人の組）ごとの点数を1回で返す", async () => {
    const all = await latestFinalizedScoresEveryCompany(t.db, viewer("SUPER_ADMIN", null));
    expect(all.get(membershipScoreKey(IDS.company, IDS.employee))?.cycleName).toBe("2026年度上期");
    expect(all.get(membershipScoreKey("cmp_other", IDS.employee))?.cycleName).toBe("他社 2027年度上期");
  });

  it("全社ぶんの点数は、利用者一覧を開けない役割には返さない", async () => {
    for (const role of ["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as const) {
      expect((await latestFinalizedScoresEveryCompany(t.db, viewer(role))).size, role).toBe(0);
    }
  });
});

describe("withGradeAndScore", () => {
  const rows = [
    { id: IDS.employee, name: "本人", gradeId: IDS.gradeFrom },
    { id: IDS.evaluator, name: "上長", gradeId: IDS.gradeTo },
  ];

  it.each(["MANAGER", "COMPANY_ADMIN"] as const)("%s には等級名と最新の点数を付ける", async (role) => {
    const out = await withGradeAndScore(t.db, viewer(role), rows);
    expect(out[0]).toMatchObject({ id: IDS.employee, gradeName: "等級２：Regular", latestScore: { totalScore: 72.5 } });
    expect(out[1]).toMatchObject({ id: IDS.evaluator, gradeName: "等級３：Chief", latestScore: null });
  });

  it("EMPLOYEE には等級と点数のキーそのものを含めない（等級の id も落とす）", async () => {
    const out = await withGradeAndScore(t.db, viewer("EMPLOYEE"), rows);
    for (const row of out) {
      expect(Object.keys(row).sort()).toEqual(["id", "name"]);
      expect(JSON.stringify(row)).not.toMatch(/totalScore|gradeName|latestScore/);
    }
  });
});
