import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships, seedResponse } from "@/test-support/evaluation-fixture";

/*
 * 昇給と昇格への上司の判断（DD-024・qa-y12 (17)〜(19)・qa-y16 (11)）を、入口から保管場所まで通しで確かめる。
 *
 * 見たいのは3つ。
 *  1. 判断がそろわない確定は 400 で断り、評価の行を1文字も変えない（画面の「押せない理由」と同じ文）
 *  2. 確定の1文で、判断・記録した人・時刻がまとめて書かれる（判断の無い確定を残さない）
 *  3. コメントだけの保存・確定を戻す操作・作り直し（buildEvaluations）は判断を消さない（作り直しは DD-028 の4 で改めた）。確定のたびに選び直す
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

let t: TestDatabase;

/** 同じ会社の別の上長（本人の直属ではない） */
const OTHER_MANAGER_ID = "usr_mgr_other";

function as(role: Viewer["role"], id: string): Viewer {
  return {
    id,
    name: "操作する人",
    email: `${id}@example.com`,
    role,
    companyId: IDS.company,
    gradeId: IDS.gradeTo,
    officeId: IDS.office,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  } as Viewer;
}

const MANAGER = as("MANAGER", IDS.evaluator);

const FOLLOW_BOTH = { raiseDecision: "follow", promotionDecision: "follow" } as const;

function questions() {
  return [
    { id: "fq_req1", section: "support", questionType: "yesno", title: "等級要件1", displayOrder: 1, gradeRequirementId: "gr_1", answer: 1 },
    { id: "fq_req2", section: "support", questionType: "yesno", title: "等級要件2", displayOrder: 2, gradeRequirementId: "gr_2", answer: 1 },
    { id: "fq_q2_1", section: "kpi", questionType: "number", title: "稼働時間", displayOrder: 4, kpiQuestionKey: "q2_1", answer: 90 },
    { id: "fq_q2_2", section: "kpi", questionType: "number", title: "総時間", displayOrder: 5, kpiQuestionKey: "q2_2", answer: 100 },
    { id: "fq_q3_1", section: "kpi", questionType: "number", title: "残業率", displayOrder: 6, kpiQuestionKey: "q3_1", answer: 3 },
  ];
}

async function evaluation() {
  return (await t.db.select().from(s.evaluations).where(eq(s.evaluations.employeeId, IDS.employee)))[0];
}

async function finalize(input: Record<string, unknown> = {}) {
  const row = await evaluation();
  return updateEvaluation({ evaluationId: row.id, action: "finalize", ...input });
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedCompany(t);
  await t.db.insert(s.users).values({
    id: OTHER_MANAGER_ID,
    name: "別の上長",
    email: "mgr-other@example.com",
    companyId: IDS.company,
    role: "MANAGER",
    gradeId: IDS.gradeTo,
    officeId: IDS.office,
  });
  seedMemberships(t);
  await seedResponse(t, questions());
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.viewer = MANAGER;
  const built = await buildEvaluations({ cycleId: IDS.cycle });
  expect(built.ok).toBe(true);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("判断がそろわない確定は断り、何も書かない", () => {
  it("どちらも選んでいなければ、昇給と昇格の2行を返す", async () => {
    const before = await evaluation();

    expect(await finalize()).toEqual({
      ok: false,
      message:
        "昇給について「点数の判定どおりにする」か「変える」かを選んでください。\n昇格について「点数の判定どおりにする」か「変える」かを選んでください。",
    });
    expect(await evaluation()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("変えるのに理由が空白だけ", async () => {
    const before = await evaluation();

    const result = await finalize({ raiseDecision: "override", raiseDecisionReason: "  \n", promotionDecision: "follow" });

    expect(result).toEqual({ ok: false, message: "昇給を変える理由を書いてください。" });
    expect(await evaluation()).toEqual(before);
  });

  it("理由が2000字を超える", async () => {
    const result = await finalize({
      raiseDecision: "follow",
      promotionDecision: "override",
      promotionDecisionReason: "あ".repeat(2001),
    });

    expect(result).toEqual({ ok: false, message: "昇格を変える理由は2000字までです（いま2001字）。" });
    expect((await evaluation()).status).toBe("draft");
  });

  it("理由に本人に見せられない語があれば、語を名指しして断る（DD-023）", async () => {
    const result = await finalize({
      raiseDecision: "override",
      raiseDecisionReason: "配点の高い項目が伸びなかった",
      promotionDecision: "follow",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("（「配点」）");
    expect((await evaluation()).raiseDecision).toBeNull();
  });

  it("上長からのコメントに本人に見せられない語があれば、確定もコメントの保存も断る", async () => {
    const before = await evaluation();
    const message =
      "上長からのコメントに、本人に見せられない語があります（「必要点数」）。点数や配点ではなく、行動や事実で書き直してください。";

    expect(await finalize({ ...FOLLOW_BOTH, comment: "必要点数まであと少し" })).toEqual({ ok: false, message });
    expect(await updateEvaluation({ evaluationId: before.id, action: "comment", comment: "必要点数まであと少し" })).toEqual({
      ok: false,
      message,
    });
    expect(await evaluation()).toEqual(before);
  });

  it.each([undefined, null])("コメントが %s の確定でも、引き継ぐ古いコメントを検査する", async (comment) => {
    const row = await evaluation();
    await t.db.update(s.evaluations).set({ evaluatorComment: "必要点数まであと少し" }).where(eq(s.evaluations.id, row.id));
    const before = await evaluation();

    const result = await finalize({ ...FOLLOW_BOTH, comment });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("（「必要点数」）");
    expect(await evaluation()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("自分自身の評価は確定できない（判断の中身を読む前に断る）", async () => {
    mocked.viewer = as("COMPANY_ADMIN", IDS.employee);
    const before = await evaluation();

    const result = await finalize(FOLLOW_BOTH);

    expect(result.ok).toBe(false);
    expect(await evaluation()).toEqual(before);
  });

  it("直属ではない上長は確定できない", async () => {
    mocked.viewer = as("MANAGER", OTHER_MANAGER_ID);
    const before = await evaluation();

    expect(await finalize(FOLLOW_BOTH)).toEqual({
      ok: false,
      message: "この方の評価を変更する権限がありません。直属メンバーの評価を選んでください。",
    });
    expect(await evaluation()).toEqual(before);
  });
});

describe("確定の1文で判断を書く", () => {
  it.each([undefined, null])("コメントが %s なら、正常な古いコメントを引き継ぐ", async (comment) => {
    const row = await evaluation();
    const saved = "引き継ぎの段取りから一緒に見直しましょう";
    await t.db.update(s.evaluations).set({ evaluatorComment: saved }).where(eq(s.evaluations.id, row.id));

    expect(await finalize({ ...FOLLOW_BOTH, comment })).toMatchObject({ ok: true });
    expect(await evaluation()).toMatchObject({ status: "finalized", evaluatorComment: saved });
  });

  it("空文字のコメントは古い禁止語を引き継がず、空文字を保存する", async () => {
    const row = await evaluation();
    await t.db.update(s.evaluations).set({ evaluatorComment: "必要点数まであと少し" }).where(eq(s.evaluations.id, row.id));

    expect(await finalize({ ...FOLLOW_BOTH, comment: "" })).toMatchObject({ ok: true });
    expect(await evaluation()).toMatchObject({ status: "finalized", evaluatorComment: "" });
  });

  it("判断・理由・記録した人・時刻が、確定と一緒に書かれる", async () => {
    const result = await finalize({
      raiseDecision: "override",
      raiseDecisionReason: "  期の後半に顧客対応の引き継ぎを放置した  ",
      promotionDecision: "follow",
      promotionDecisionReason: "判定どおりのときは残らない",
      comment: "来期は引き継ぎの段取りから一緒に見直しましょう",
    });

    expect(result).toEqual({ ok: true, message: "確定しました。本人の画面に結果が表示されます。" });
    const row = await evaluation();
    expect(row).toMatchObject({
      status: "finalized",
      evaluatorId: IDS.evaluator,
      evaluatorComment: "来期は引き継ぎの段取りから一緒に見直しましょう",
      raiseDecision: "override",
      raiseDecisionReason: "期の後半に顧客対応の引き継ぎを放置した",
      promotionDecision: "follow",
      promotionDecisionReason: null,
      decisionRecordedBy: IDS.evaluator,
    });
    // 記録の時刻は確定の時刻と同じ（同じ1文で書いた印）
    expect(row.decisionRecordedAt).toEqual(row.finalizedAt);
    // 点数の判定は書き換えない（最終の結論は表示のたびに出す）
    expect(typeof row.raiseEligible).toBe("boolean");
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("判断を消す操作と消さない操作", () => {
  it.each([undefined, null])("コメントだけの保存で %s を渡すと、古いコメントを消す", async (comment) => {
    const row = await evaluation();
    await t.db.update(s.evaluations).set({ evaluatorComment: "必要点数まであと少し" }).where(eq(s.evaluations.id, row.id));

    expect(await updateEvaluation({ evaluationId: row.id, action: "comment", comment })).toMatchObject({ ok: true });
    expect((await evaluation()).evaluatorComment).toBeNull();
  });

  it("コメントだけの保存は判断を変えない", async () => {
    await finalize({ raiseDecision: "override", raiseDecisionReason: "引き継ぎを放置した", promotionDecision: "follow" });
    const row = await evaluation();

    await updateEvaluation({ evaluationId: row.id, action: "comment", comment: "追記しました" });

    expect(await evaluation()).toMatchObject({
      evaluatorComment: "追記しました",
      raiseDecision: "override",
      raiseDecisionReason: "引き継ぎを放置した",
      promotionDecision: "follow",
    });
  });

  it("確定を戻しても判断は残り、もう一度の確定で選び直せる", async () => {
    await finalize({ raiseDecision: "override", raiseDecisionReason: "引き継ぎを放置した", promotionDecision: "follow" });
    const row = await evaluation();

    expect(await updateEvaluation({ evaluationId: row.id, action: "reopen" })).toMatchObject({ ok: true });
    expect(await evaluation()).toMatchObject({
      status: "draft",
      finalizedAt: null,
      raiseDecision: "override",
      raiseDecisionReason: "引き継ぎを放置した",
      decisionRecordedBy: IDS.evaluator,
    });

    await finalize(FOLLOW_BOTH);
    expect(await evaluation()).toMatchObject({
      status: "finalized",
      raiseDecision: "follow",
      raiseDecisionReason: null,
      promotionDecision: "follow",
    });
  });

  it("確定を戻したあとの作り直しでも判断は残り、次の確定ではまた選ぶ", async () => {
    await finalize({ raiseDecision: "override", raiseDecisionReason: "引き継ぎを放置した", promotionDecision: "follow" });
    const row = await evaluation();
    await updateEvaluation({ evaluationId: row.id, action: "reopen" });
    const recorded = await evaluation();

    expect((await buildEvaluations({ cycleId: IDS.cycle })).ok).toBe(true);

    // 設定の保存で流れる集計し直しと同じ関数なので、設定を保存しただけで判断が消えないことも、ここで確かめている
    expect(await evaluation()).toMatchObject({
      status: "draft",
      raiseDecision: "override",
      raiseDecisionReason: "引き継ぎを放置した",
      promotionDecision: "follow",
      decisionRecordedBy: IDS.evaluator,
      decisionRecordedAt: recorded.decisionRecordedAt,
    });
    expect((await finalize()).ok).toBe(false);
  });

  it("確定済みの評価は作り直さないので、判断も残る", async () => {
    await finalize({ raiseDecision: "override", raiseDecisionReason: "引き継ぎを放置した", promotionDecision: "follow" });

    await buildEvaluations({ cycleId: IDS.cycle });

    expect(await evaluation()).toMatchObject({ status: "finalized", raiseDecision: "override" });
  });
});
