import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { FORBIDDEN_MESSAGE } from "@/test-support/action-mocks";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 評価の代表経路を、入口（サーバーアクション）から保管場所まで通しで確かめる。
 *
 * 本人が回答を出し、上長が集計して確定するまでの3つの入口を、本物の表に対して順に呼ぶ。
 * 見たいのは2つ。
 *  1. 成功した保存だけが、同じ応答で画面を描き直す（refresh を1回ずつ呼ぶ）
 *  2. 断られた保存は1行も書かず、画面も描き直さない（入力欄を残して直してもらう）
 * 役割の判定は本物と同じ順位で行い、会社の境界は保管場所の行で確かめる。
 */

const OTHER_COMPANY = "cmp_other";

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

// 役割の判定は本物の atLeast で行う（入口が求める役割を、テストで取り違えないため）
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

import { saveResponse } from "@/actions/responses";
import { buildEvaluations, updateEvaluation } from "@/actions/evaluations";

let t: TestDatabase;

function as(role: Viewer["role"], id: string, opts: { companyId?: string; gradeId?: string | null } = {}): Viewer {
  return {
    id,
    name: "操作する人",
    email: `${id}@example.com`,
    role,
    companyId: opts.companyId ?? IDS.company,
    gradeId: opts.gradeId ?? null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  } as Viewer;
}

const EMPLOYEE = as("EMPLOYEE", IDS.employee, { gradeId: IDS.gradeFrom });
const MANAGER = as("MANAGER", IDS.evaluator, { gradeId: IDS.gradeTo });

/** 回答の対象になる設問（等級要件2問・受講報告・KPI 3問・行動指針1問。すべて必須）。 */
const QUESTIONS = [
  { id: "fq_req1", section: "support", questionType: "yesno", title: "等級要件1", gradeRequirementId: "gr_1" },
  { id: "fq_req2", section: "support", questionType: "yesno", title: "等級要件2", gradeRequirementId: "gr_2" },
  { id: "fq_gate", section: "training", questionType: "yesno", title: "受講後報告書を提出した", isGate: true },
  { id: "fq_q2_1", section: "kpi", questionType: "number", title: "稼働日数", kpiQuestionKey: "q2_1" },
  { id: "fq_q2_2", section: "kpi", questionType: "number", title: "所定日数", kpiQuestionKey: "q2_2" },
  { id: "fq_q3_1", section: "kpi", questionType: "number", title: "残業率", kpiQuestionKey: "q3_1" },
  { id: "fq_beh", section: "behavior", questionType: "single", title: "創造性について", behaviorGuidelineId: IDS.guideline },
] as const;

const FULL_ANSWERS = [
  { questionId: "fq_req1", valueNumber: 1 },
  { questionId: "fq_req2", valueNumber: 1 },
  { questionId: "fq_gate", valueNumber: 1 },
  { questionId: "fq_q2_1", valueNumber: 100 },
  { questionId: "fq_q2_2", valueNumber: 100 },
  { questionId: "fq_q3_1", valueNumber: 4 },
  { questionId: "fq_beh", valueNumber: 3, valueText: "模範" },
];

async function seedQuestions() {
  await t.db.insert(s.gradeRequirements).values(
    ["gr_1", "gr_2"].map((id, i) => ({
      id,
      companyId: IDS.company,
      gradeId: IDS.gradeFrom,
      category: "support",
      seq: i + 1,
      text: `等級要件${i + 1}`,
    })),
  );
  await t.db.insert(s.formQuestions).values(
    QUESTIONS.map((q, i) => ({ ...q, companyId: IDS.company, formId: IDS.form, displayOrder: i + 1 })),
  );
}

async function responses() {
  return t.db
    .select({ id: s.formResponses.id, status: s.formResponses.status })
    .from(s.formResponses)
    .where(eq(s.formResponses.employeeId, IDS.employee));
}

async function evaluationOf(employeeId: string) {
  return (await t.db.select().from(s.evaluations).where(eq(s.evaluations.employeeId, employeeId)))[0];
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedCompany(t);
  await seedQuestions();
  await t.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "よその会社", slug: "other" });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.viewer = EMPLOYEE;
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("本人の提出 → 上長の集計 → 確定（代表経路）", () => {
  it("どの段も保管場所に書かれ、成功した保存ごとに画面を描き直す", async () => {
    const draft = await saveResponse({ formId: IDS.form, status: "draft", answers: FULL_ANSWERS.slice(0, 2) });
    expect(draft).toMatchObject({ ok: true, message: "入力内容を保存しました。", status: "draft" });
    expect(await responses()).toEqual([expect.objectContaining({ status: "draft" })]);
    expect(mocked.refresh).toHaveBeenCalledTimes(1);

    const submitted = await saveResponse({ formId: IDS.form, status: "submitted", answers: FULL_ANSWERS });
    expect(submitted).toMatchObject({ ok: true, message: "提出しました。" });
    // 下書きの行をそのまま提出に進める（2行に増やさない）
    expect(await responses()).toEqual([{ id: draft.ok ? draft.responseId : "", status: "submitted" }]);
    expect(mocked.refresh).toHaveBeenCalledTimes(2);

    mocked.viewer = MANAGER;
    const built = await buildEvaluations({ cycleId: IDS.cycle });
    expect(built.ok).toBe(true);
    const evaluation = await evaluationOf(IDS.employee);
    expect(evaluation).toMatchObject({ companyId: IDS.company, cycleId: IDS.cycle });
    expect(evaluation.status).not.toBe("finalized");
    expect(mocked.refresh).toHaveBeenCalledTimes(3);

    const finalized = await updateEvaluation({ evaluationId: evaluation.id, action: "finalize", comment: "よくできました" });
    expect(finalized).toEqual({ ok: true, message: "確定しました。本人の画面に結果が表示されます。" });
    expect(await evaluationOf(IDS.employee)).toMatchObject({
      status: "finalized",
      evaluatorId: IDS.evaluator,
      evaluatorComment: "よくできました",
    });
    expect(mocked.refresh).toHaveBeenCalledTimes(4);
  });
});

describe("断られた保存は何も書かず、画面も描き直さない", () => {
  it("必須の未入力がある提出は、回答の行を作らない", async () => {
    const result = await saveResponse({ formId: IDS.form, status: "submitted", answers: FULL_ANSWERS.slice(0, 3) });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("未入力の項目が4件あります");
    expect(await responses()).toEqual([]);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("入力の形が違えば、中身を読む前に断る", async () => {
    const result = await saveResponse({ formId: IDS.form, status: "approved", answers: [] });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/^入力内容を確認してください（status：/);
    expect(await responses()).toEqual([]);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("提出済みの回答は、本人が直接呼んでも書き換えられない", async () => {
    await saveResponse({ formId: IDS.form, status: "submitted", answers: FULL_ANSWERS });
    mocked.refresh.mockReset();

    const again = await saveResponse({
      formId: IDS.form,
      status: "submitted",
      answers: FULL_ANSWERS.map((a) => (a.questionId === "fq_q3_1" ? { ...a, valueNumber: 50 } : a)),
    });

    expect(again).toEqual({
      ok: false,
      message: "すでに提出済みのため、内容を変更できません。修正が必要な場合は上長にご連絡ください。",
    });
    const overtime = await t.db
      .select({ value: s.formAnswers.valueNumber })
      .from(s.formAnswers)
      .where(eq(s.formAnswers.questionId, "fq_q3_1"));
    expect(overtime).toEqual([{ value: 4 }]);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("本人は評価を確定できない（役割の確認は入口で行う）", async () => {
    await saveResponse({ formId: IDS.form, status: "submitted", answers: FULL_ANSWERS });
    mocked.viewer = MANAGER;
    await buildEvaluations({ cycleId: IDS.cycle });
    const evaluation = await evaluationOf(IDS.employee);
    mocked.refresh.mockReset();

    mocked.viewer = EMPLOYEE;
    const result = await updateEvaluation({ evaluationId: evaluation.id, action: "finalize" });

    expect(result).toEqual({ ok: false, message: FORBIDDEN_MESSAGE });
    expect((await evaluationOf(IDS.employee)).status).toBe(evaluation.status);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});

describe("他社の期間・評価には届かない", () => {
  it("他社の上長は、期間も評価も「見つからない」で断られ、何も変わらない", async () => {
    await saveResponse({ formId: IDS.form, status: "submitted", answers: FULL_ANSWERS });
    mocked.viewer = MANAGER;
    await buildEvaluations({ cycleId: IDS.cycle });
    const evaluation = await evaluationOf(IDS.employee);
    mocked.refresh.mockReset();

    mocked.viewer = as("COMPANY_ADMIN", "usr_other_admin", { companyId: OTHER_COMPANY });
    expect(await buildEvaluations({ cycleId: IDS.cycle })).toEqual({
      ok: false,
      message: "その評価期間は見つかりませんでした。",
    });
    expect(await updateEvaluation({ evaluationId: evaluation.id, action: "finalize" })).toEqual({
      ok: false,
      message: "評価が見つかりませんでした。",
    });

    expect(await evaluationOf(IDS.employee)).toEqual(evaluation);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("他社のアンケートには回答を作れない", async () => {
    mocked.viewer = as("EMPLOYEE", "usr_other_emp", { companyId: OTHER_COMPANY, gradeId: IDS.gradeFrom });

    const result = await saveResponse({ formId: IDS.form, status: "draft", answers: FULL_ANSWERS });

    expect(result).toEqual({ ok: false, message: "アンケートが見つかりませんでした。" });
    expect(await t.db.select().from(s.formResponses)).toEqual([]);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
});
