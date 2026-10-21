import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { parseCsv } from "@/lib/csv";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/*
 * 評価結果・KPI明細のCSV書き出し（/api/export?type=results|kpi）に載る人の範囲。
 *
 * 入口はマネージャー以上が使える（台帳 exports.evaluationData）。入口を通ったあと、
 * 行の範囲は評価の画面と同じ判定（canReviewEmployeeEvaluation）で決める。
 * - マネージャーは直属の部下の行だけ。担当外の人の行も、自分自身の行も受け取らない。
 * - 会社の管理者以上は、今までどおりその会社の全員の行を受け取る。
 * 見ている人は src/lib/session の apiViewer を差し替えて作り分ける。
 */

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

import { GET } from "@/app/api/export/route";
import { listEvaluations, listMembers } from "@/lib/queries";

/** 同じ会社の、別のマネージャーとその部下（usr_mgr から見て担当外）と、会社の管理者。 */
const OTHER_MANAGER = "usr_mgr_other";
const OTHER_EMPLOYEE = "usr_emp_other";
const ADMIN = "usr_admin";

/** 評価の id。usr_mgr の直属の部下・担当外の人・usr_mgr 自身の3人ぶん。 */
const EVAL = {
  directReport: "ev_direct",
  outOfScope: "ev_out_of_scope",
  managerSelf: "ev_manager_self",
} as const;

let t: TestDatabase;

function viewer(id: string, role: Viewer["role"], companyId: string | null = IDS.company): Viewer {
  return {
    id,
    name: "見る人",
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
  };
}

function exportRequest(type: "results" | "kpi", extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ type, cycleId: IDS.cycle, ...extra });
  return new Request(`http://localhost/api/export?${params.toString()}`);
}

/** CSVを読み、見出しを除いた行を返す。 */
async function csvBody(response: Response): Promise<string[][]> {
  expect(response.status).toBe(200);
  const [, ...rows] = parseCsv(await response.text());
  return rows;
}

/** ダウンロードのファイル名（content-disposition の filename*=UTF-8''…）。 */
function downloadName(response: Response): string {
  const header = response.headers.get("content-disposition") ?? "";
  return decodeURIComponent(header.slice(header.indexOf("''") + 2));
}

/** 評価結果CSVの「HTML評価票URL」列（評価の画面へのリンク）から評価の id を取り出す。 */
function resultEvaluationIds(rows: string[][]): string[] {
  return rows.map((r) => r.find((cell) => cell.includes("/manager/evaluations/"))!.split("/").pop()!).sort();
}

/** KPI明細CSVの「回答ID」列。回答の無い評価は評価の id が入る。 */
function kpiEvaluationIds(rows: string[][]): string[] {
  return [...new Set(rows.map((r) => r[0]))].sort();
}

beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.apiViewer.mockReset();

  await seedCompany(t);
  await t.db.insert(s.users).values([
    {
      id: OTHER_MANAGER,
      name: "別の上長",
      email: "mgr-other@example.com",
      companyId: IDS.company,
      role: "MANAGER",
      gradeId: IDS.gradeTo,
      officeId: IDS.office,
    },
    {
      id: OTHER_EMPLOYEE,
      name: "担当外の人",
      email: "emp-other@example.com",
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      officeId: IDS.office,
      managerId: OTHER_MANAGER,
    },
    {
      id: ADMIN,
      name: "会社の管理者",
      email: "admin@example.com",
      companyId: IDS.company,
      role: "COMPANY_ADMIN",
      officeId: IDS.office,
    },
  ]);
  seedMemberships(t);

  const base = { companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeFrom, schemeId: IDS.scheme };
  await t.db.insert(s.evaluations).values([
    { ...base, id: EVAL.directReport, employeeId: IDS.employee, status: "draft", totalScore: 70, maxScore: 100 },
    { ...base, id: EVAL.outOfScope, employeeId: OTHER_EMPLOYEE, status: "finalized", totalScore: 80, maxScore: 100 },
    // マネージャー自身の評価。直属の上長（usr_mgr には上長がいない）か管理者以上が扱う
    { ...base, id: EVAL.managerSelf, employeeId: IDS.evaluator, gradeId: IDS.gradeTo, status: "draft", totalScore: 90, maxScore: 100 },
  ]);
  await t.db.insert(s.evaluationItems).values(
    Object.values(EVAL).map((evaluationId, i) => ({
      id: `ei_${evaluationId}`,
      companyId: IDS.company,
      evaluationId,
      kpiItemId: IDS.itemHigher,
      itemName: "稼働率",
      unit: "%",
      actualValue: 90 + i,
      rank: "B",
      points: 40,
      maxPoints: 50,
      displayOrder: 1,
    })),
  );
  await t.db.insert(s.evaluationGates).values(
    Object.values(EVAL).map((evaluationId) => ({
      id: `eg_${evaluationId}`,
      companyId: IDS.company,
      evaluationId,
      kind: "promotion",
      text: "昇格要件",
      achieved: true,
    })),
  );
});

afterEach(() => t.close());

describe("/api/export の評価結果・KPI明細に載る人", () => {
  it("マネージャーの評価結果CSVには直属の部下の行だけが載り、担当外の人と自分自身の行は載らない", async () => {
    mocked.apiViewer.mockResolvedValue(viewer(IDS.evaluator, "MANAGER"));

    const rows = await csvBody(await GET(exportRequest("results")));

    expect(resultEvaluationIds(rows)).toEqual([EVAL.directReport]);
    const text = rows.flat().join("\n");
    expect(text).not.toContain("担当外の人");
    expect(text).not.toContain(OTHER_EMPLOYEE);
  });

  it("マネージャーのKPI明細CSVにも直属の部下の行だけが載る", async () => {
    mocked.apiViewer.mockResolvedValue(viewer(IDS.evaluator, "MANAGER"));

    const rows = await csvBody(await GET(exportRequest("kpi")));

    expect(kpiEvaluationIds(rows)).toEqual([EVAL.directReport]);
    expect(rows.map((r) => r[2])).toEqual(["本人"]);
  });

  it("直属の部下がいないマネージャーは、評価結果・KPI明細とも見出しだけを受け取る", async () => {
    // 誰の上長でもないマネージャー。会社には他の人の評価があるが、1行も載らない
    mocked.apiViewer.mockResolvedValue(viewer("usr_mgr_without_reports", "MANAGER"));

    expect(await csvBody(await GET(exportRequest("results")))).toEqual([]);
    expect(await csvBody(await GET(exportRequest("kpi")))).toEqual([]);
  });

  it("載る行が0件でも、ファイル名には評価期間の名前が入る", async () => {
    mocked.apiViewer.mockResolvedValue(viewer("usr_mgr_without_reports", "MANAGER"));

    expect(downloadName(await GET(exportRequest("results")))).toBe("評価結果_2026年度上期.csv");
    expect(downloadName(await GET(exportRequest("kpi")))).toBe("KPI明細_2026年度上期.csv");
  });

  it("行がある書き出しのファイル名も、評価期間の名前のまま", async () => {
    mocked.apiViewer.mockResolvedValue(viewer(ADMIN, "COMPANY_ADMIN"));

    expect(downloadName(await GET(exportRequest("results")))).toBe("評価結果_2026年度上期.csv");
    expect(downloadName(await GET(exportRequest("kpi")))).toBe("KPI明細_2026年度上期.csv");
  });

  it("CSVに載る人は、マネージャーの評価の画面（/manager/cycles）に出る人と同じ", async () => {
    for (const managerId of [IDS.evaluator, OTHER_MANAGER]) {
      mocked.apiViewer.mockResolvedValue(viewer(managerId, "MANAGER"));
      // 画面と同じ求め方: その期の評価のうち、自分が上長の所属の人のぶん
      const assigned = new Set((await listMembers(IDS.company, { managerId })).map((m) => m.id));
      const onScreen = (await listEvaluations(IDS.company, "MANAGER", { cycleId: IDS.cycle }))
        .filter((e) => assigned.has(e.employeeId))
        .map((e) => e.id)
        .sort();

      expect(onScreen.length).toBeGreaterThan(0);
      expect(resultEvaluationIds(await csvBody(await GET(exportRequest("results"))))).toEqual(onScreen);
      expect(kpiEvaluationIds(await csvBody(await GET(exportRequest("kpi"))))).toEqual(onScreen);
    }
  });

  it.each([
    ["会社の管理者", viewer(ADMIN, "COMPANY_ADMIN"), {}],
    ["全体管理者（会社を指定）", viewer("usr_super", "SUPER_ADMIN", null), { companyId: IDS.company }],
  ] as const)("%sは今までどおり全員分の評価結果・KPI明細を受け取る", async (_label, v, extra) => {
    mocked.apiViewer.mockResolvedValue(v);
    const everyone = Object.values(EVAL).sort();

    expect(resultEvaluationIds(await csvBody(await GET(exportRequest("results", extra))))).toEqual(everyone);
    expect(kpiEvaluationIds(await csvBody(await GET(exportRequest("kpi", extra))))).toEqual(everyone);
  });
});

describe("/api/export の評価結果の昇給・昇格の列（backend の (20)・DD-024）", () => {
  /** 見出しの名前で列を引く（位置で引くと、列を足したときに別の列を見てしまう） */
  async function resultTable(response: Response): Promise<Record<string, string>[]> {
    expect(response.status).toBe(200);
    const [header, ...rows] = parseCsv(await response.text());
    return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  }
  const rowOf = (table: Record<string, string>[], evaluationId: string) =>
    table.find((r) => r["HTML評価票URL"].endsWith(`/${evaluationId}`))!;

  it("先頭の23列は現行の並びのまま、末尾に昇給の結論と上司の判断の7列が付く", async () => {
    mocked.apiViewer.mockResolvedValue(viewer(ADMIN, "COMPANY_ADMIN"));
    const [header] = parseCsv(await (await GET(exportRequest("results"))).text());
    expect(header).toHaveLength(30);
    expect(header[16]).toBe("昇格可否");
    expect(header[22]).toBe("内部JSON");
    expect(header.slice(23)).toEqual([
      "昇給",
      "昇給の点数の判定",
      "昇給の上司の判断",
      "昇給の判断の理由",
      "昇格の点数の判定",
      "昇格の上司の判断",
      "昇格の判断の理由",
    ]);
  });

  it("上司が変えた結論・判定どおり・記録なし・確定前を、それぞれの語で書き出す", async () => {
    // 直属の部下：昇給は点数の判定が可だが上司が見送りに変えた。昇格は否のまま判定どおり
    await t.db
      .update(s.evaluations)
      .set({
        status: "finalized",
        raiseEligible: true,
        raiseDecision: "override",
        raiseDecisionReason: "期の後半に担当の引き継ぎが終わっていないため、次の期に見直す。",
        promotionEligible: false,
        promotionBlockedReason: "昇格要件が未達です。",
        promotionDecision: "follow",
      })
      .where(eq(s.evaluations.id, EVAL.directReport));
    mocked.apiViewer.mockResolvedValue(viewer(ADMIN, "COMPANY_ADMIN"));

    const table = await resultTable(await GET(exportRequest("results")));

    const overridden = rowOf(table, EVAL.directReport);
    expect(overridden["昇給"]).toBe("見送り（上司の判断）");
    expect(overridden["昇給の点数の判定"]).toBe("可");
    expect(overridden["昇給の上司の判断"]).toBe("変える");
    expect(overridden["昇給の判断の理由"]).toBe("期の後半に担当の引き継ぎが終わっていないため、次の期に見直す。");
    expect(overridden["昇格可否"]).toBe("見送り");
    expect(overridden["昇格の点数の判定"]).toBe("否（昇格要件が未達です。）");
    expect(overridden["昇格の上司の判断"]).toBe("点数の判定どおり");
    expect(overridden["昇格の判断の理由"]).toBe("");

    // この仕組みより前に確定した評価は、点数の判定を結論にして「記録なし」と書く
    const legacy = rowOf(table, EVAL.outOfScope);
    expect(legacy["昇給の上司の判断"]).toBe("上司の判断の記録なし（この仕組みより前に確定）");
    expect(legacy["昇給"]).toBe("見送り");

    // 確定前の評価は、確定のときに記録すると書く
    const draft = rowOf(table, EVAL.managerSelf);
    expect(draft["昇格の上司の判断"]).toBe("上司の判断はまだ記録されていません（確定のときに記録します）");
  });
});
