import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships, seedResponse } from "@/test-support/evaluation-fixture";

/*
 * 評価レポート（/reports/[id]・DD-024）の見える範囲を、判定（canViewEvaluationOf）から読み込み（loadEvaluationReport）まで通しで確かめる。
 *
 * - 本人は self、直属の上長と会社の管理者は reviewer。直属でない上長・他社の人・存在しない人は null（画面は 404）
 * - self の中身には点数の数値と、同じ等級の平均と幅を1つも入れない
 * - self では、同じ等級の平均に使う他の人の点数を保管場所へ問い合わせもしない
 * - canViewEvaluationOf を呼ぶのはレポートの画面だけ。CSV の書き出しとメモは今までの判定を使う（DD-021 の4・DD-024）
 */

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

import { buildEvaluations, updateEvaluation } from "@/actions/evaluations";
import { canViewEvaluationOf } from "@/lib/session";
import { loadEvaluationReport } from "@/lib/report-data";

let t: TestDatabase;

const ADMIN_ID = "usr_admin";
/** 同じ会社の別の上長（本人の直属ではない） */
const OTHER_MANAGER_ID = "usr_mgr_other";
/** 同じ会社・同じ上長の別の社員 */
const OTHER_EMPLOYEE_ID = "usr_emp_other";
const OTHER_COMPANY = "cmp_other";
const OTHER_COMPANY_ADMIN_ID = "usr_other_admin";
/** 全体管理者。所属を持たず、いま見ている会社だけが companyId に入る */
const SUPER_ADMIN_ID = "usr_super";

function as(role: Viewer["role"], id: string, companyId: string = IDS.company): Viewer {
  return {
    id,
    name: "見る人",
    email: `${id}@example.com`,
    role,
    companyId,
    gradeId: null,
    officeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  } as Viewer;
}

const MANAGER = as("MANAGER", IDS.evaluator);

/** self の中に出てはいけない、点数と比べる値の鍵 */
const SCORE_KEYS = ["scores", "kpiTotal", "kpiMax", "kpiRatio", "behaviorTotal", "score", "points", "maxPoints", "totalScore", "maxScore", "peer"];

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]);
  }
  return [];
}

/** 同じ等級の平均に使う問い合わせ（他の人の確定した点数を、点数があるものだけ読む） */
const PEER_QUERY = /"total_score" is not null/;

function questions() {
  return [
    { id: "fq_req1", section: "support", questionType: "yesno", title: "等級要件1", displayOrder: 1, gradeRequirementId: "gr_1", answer: 1 },
    { id: "fq_req2", section: "support", questionType: "yesno", title: "等級要件2", displayOrder: 2, gradeRequirementId: "gr_2", answer: 1 },
    { id: "fq_q2_1", section: "kpi", questionType: "number", title: "稼働時間", displayOrder: 4, kpiQuestionKey: "q2_1", answer: 90 },
    { id: "fq_q2_2", section: "kpi", questionType: "number", title: "総時間", displayOrder: 5, kpiQuestionKey: "q2_2", answer: 100 },
    { id: "fq_q3_1", section: "kpi", questionType: "number", title: "残業率", displayOrder: 6, kpiQuestionKey: "q3_1", answer: 3 },
  ];
}

async function finalizeEmployeeEvaluation() {
  const [row] = await t.db.select().from(s.evaluations).where(eq(s.evaluations.employeeId, IDS.employee));
  const result = await updateEvaluation({
    evaluationId: row.id,
    action: "finalize",
    raiseDecision: "follow",
    promotionDecision: "follow",
  });
  expect(result.ok).toBe(true);
}

function report(view: "reviewer" | "self", viewerRole: Viewer["role"] = "MANAGER") {
  return loadEvaluationReport({ companyId: IDS.company, employeeId: IDS.employee, view, viewerRole, now: new Date("2026-10-20T00:00:00Z") });
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "別の会社", slug: "other" });
  await t.db.insert(s.users).values([
    { id: ADMIN_ID, name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN", officeId: IDS.office },
    { id: OTHER_MANAGER_ID, name: "別の上長", email: "mgr-other@example.com", companyId: IDS.company, role: "MANAGER", gradeId: IDS.gradeTo, officeId: IDS.office },
    { id: OTHER_EMPLOYEE_ID, name: "別の社員", email: "emp-other@example.com", companyId: IDS.company, role: "EMPLOYEE", gradeId: IDS.gradeFrom, officeId: IDS.office, managerId: IDS.evaluator },
    { id: OTHER_COMPANY_ADMIN_ID, name: "別の会社の管理者", email: "other-admin@example.com", companyId: OTHER_COMPANY, role: "COMPANY_ADMIN" },
  ]);
  seedMemberships(t);
  await seedResponse(t, questions());
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.viewer = MANAGER;
  expect((await buildEvaluations({ cycleId: IDS.cycle })).ok).toBe(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("canViewEvaluationOf: 誰がどの形で開けるか", () => {
  it.each([
    ["本人", as("EMPLOYEE", IDS.employee), "self"],
    ["直属の上長", MANAGER, "reviewer"],
    ["会社の管理者", as("COMPANY_ADMIN", ADMIN_ID), "reviewer"],
    // 全体管理者は、いま見ている会社の中でだけ開ける
    ["全体管理者（その会社を見ている）", as("SUPER_ADMIN", SUPER_ADMIN_ID), "reviewer"],
    ["全体管理者（別の会社を見ている）", as("SUPER_ADMIN", SUPER_ADMIN_ID, OTHER_COMPANY), null],
    ["直属でない上長", as("MANAGER", OTHER_MANAGER_ID), null],
    ["同じ上長の別の社員", as("EMPLOYEE", OTHER_EMPLOYEE_ID), null],
    ["他社の管理者", as("COMPANY_ADMIN", OTHER_COMPANY_ADMIN_ID, OTHER_COMPANY), null],
  ] as const)("%s は %s", async (_label, viewer, expected) => {
    expect(await canViewEvaluationOf(viewer, IDS.employee)).toBe(expected);
  });

  it("上長が自分のレポートを開くと、評価者の形ではなく本人向けになる", async () => {
    expect(await canViewEvaluationOf(MANAGER, IDS.evaluator)).toBe("self");
  });

  it("存在しない人・所属の無い人は null（他社と区別しない）", async () => {
    expect(await canViewEvaluationOf(MANAGER, "usr_missing")).toBeNull();
    expect(await canViewEvaluationOf(as("EMPLOYEE", IDS.employee, null as unknown as string), IDS.employee)).toBeNull();
  });
});

describe("loadEvaluationReport: 見せる中身", () => {
  it("確定した評価が無ければ、どちらの形でも empty（作りかけの評価から作らない）", async () => {
    expect((await report("reviewer")).kind).toBe("empty");
    expect((await report("self")).kind).toBe("empty");
  });

  it("reviewer は点数と、同じ等級の平均に使う問い合わせを含む", async () => {
    await finalizeEmployeeEvaluation();
    const prepare = vi.spyOn(t.raw, "prepare");

    const r = await report("reviewer");

    expect(r.kind).toBe("reviewer");
    if (r.kind !== "reviewer") return;
    expect(r.scores.kpiTotal).not.toBeNull();
    expect(r.scores.kpiMax).not.toBeNull();
    expect(r.history).toHaveLength(1);
    expect(r.history[0].kpiTotal).toBe(r.scores.kpiTotal);
    expect(r.decisions.map((d) => d.subject)).toEqual(["raise", "promotion"]);
    expect(r.decisions.every((d) => d.decision === "follow" && d.recordedBy === "上長")).toBe(true);
    // 網が空振りしていないこと（下の self の検査が意味を持つ）
    expect(prepare.mock.calls.some(([sql]) => PEER_QUERY.test(String(sql)))).toBe(true);
  });

  it("self には点数の数値と比べる値の鍵を1つも入れず、他の人の点数を問い合わせない", async () => {
    await finalizeEmployeeEvaluation();
    const prepare = vi.spyOn(t.raw, "prepare");

    // 役割が管理者でも、本人向けの形は一般の方として読む
    const r = await report("self", "COMPANY_ADMIN");

    expect(r.kind).toBe("self");
    if (r.kind !== "self") return;
    expect(keysOf(r).filter((k) => SCORE_KEYS.includes(k))).toEqual([]);
    expect(r.radar.basis).toBe("rank");
    expect(r.judgements.requirementRate).not.toBeNull();
    expect(prepare.mock.calls.filter(([sql]) => PEER_QUERY.test(String(sql)))).toEqual([]);
  });
});

/** dir の下の .ts・.tsx を、リポジトリからの相対 path（区切りは /）で返す。試験のファイルは除く */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(process.cwd(), dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(process.cwd(), rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel.split(path.sep).join("/"));
  }
  return out;
}

const source = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("canViewEvaluationOf を呼ぶ場所（DD-021・DD-024）", () => {
  it("呼ぶのはレポートの画面だけ（CSV の書き出し・メモ・評価の詳細は呼ばない）", () => {
    const callers = sourceFiles("src")
      .filter((rel) => rel !== "src/lib/session.ts")
      .filter((rel) => /\bcanViewEvaluationOf\(/.test(source(rel)));
    expect(callers).toEqual(["src/app/reports/[id]/page.tsx"]);
  });

  it("CSV は上司側の判定だけ、メモは公開範囲と担当の判定で、本人の枝を持たない", () => {
    expect(source("src/lib/export.ts")).toMatch(/\bcanReviewEmployeeEvaluation\(/);
    expect(source("src/actions/notes.ts")).toMatch(/\bcanManageEmployee\(/);
    expect(source("src/lib/queries.ts")).toMatch(/\breadableNoteVisibilities\(viewerRole\)/);
    for (const rel of ["src/lib/export.ts", "src/actions/notes.ts"]) {
      expect(source(rel), rel).not.toMatch(/\bcanReadSelfResult\b|\bevaluationViewOf\b/);
    }
  });

  it("評価の詳細の2画面は今までの判定のまま（見える範囲を変えない）", () => {
    expect(source("src/app/manager/evaluations/[id]/page.tsx")).toMatch(/\bcanReviewEmployeeEvaluation\(/);
    expect(source("src/app/me/results/[id]/page.tsx")).toMatch(/\bcanReadSelfResult\(/);
  });
});
