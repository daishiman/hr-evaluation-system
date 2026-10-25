import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { HIGHER_BOUNDS, IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 設定を保存したときの、アンケートと評価の追従（DD-028 の4・8、O27 の 2 件目）。
 *
 * - 回答の無い下書きのアンケートは作り直す。手で足した設問（設定とつながっていない設問）は残す
 * - 回答のある公開中のアンケートは変えず、次の版の下書きを1つだけ作る（2回目の保存はその下書きを作り直す）
 * - 締め切ったアンケートと、確定した評価は変えない
 * - 確定前の評価は集計し直す。上司のコメントと判断、集計した上司は残す
 * - 保存の結果の文に、作り直したアンケート・作った次の版・集計し直した評価の件数と名前を出す
 * - 評価セットの保存は、読んだ時刻より後の保存があれば 409 にし、制度の変更の記録を残す
 */

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: {} }) }));

import { buildEvaluations } from "@/actions/evaluations";
import { rebuildFormQuestions } from "@/actions/forms";
import { saveMaster } from "@/actions/masters";
import { saveScheme } from "@/actions/scheme";

let t: TestDatabase;

const viewerOf = (id: string, role: Viewer["role"], name: string) =>
  ({
    id,
    name,
    email: `${id}@example.com`,
    role,
    companyId: IDS.company,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  }) as Viewer;

const admin = viewerOf("usr_admin", "COMPANY_ADMIN", "会社の管理者");
const manager = viewerOf(IDS.evaluator, "MANAGER", "上長");

/** 2人目の社員。評価を確定しておき、集計し直しで変わらないことを確かめる */
const EMPLOYEE_2 = "usr_emp2";
const NEW_ITEM = "kpi_new";

/** 次の期（回答の無い下書きがある）と、締め切った前の期 */
const NEXT_CYCLE = "cyc_next";
const NEXT_FORM = "frm_next";
const OLD_CYCLE = "cyc_old";
const CLOSED_FORM = "frm_closed";
/** 次の期の下書きに、人が手で足した設問（設定とつながっていない） */
const FREE_QUESTION = "fq_free_next";

/** 保存の前の更新時刻。保存で時刻が進んだことを、同じミリ秒に重ならずに確かめるため過去に置く */
const SEEDED_AT = new Date("2026-10-01T00:00:00Z");

/** 上司が確定前の評価に書いたコメントと判断（DD-024）。集計し直しで消えないことを確かめる */
const DECISION = {
  evaluatorComment: "利用者さんへの声かけを工夫していました。",
  raiseDecision: "override" as const,
  raiseDecisionReason: "事業所の今期の事情を考えて、昇給は次の期に見送ります。",
  promotionDecision: "follow" as const,
  promotionDecisionReason: null,
  decisionRecordedBy: IDS.evaluator,
  decisionRecordedAt: new Date("2026-10-05T00:00:00Z"),
};

/** 評価セットの保存が古い画面から送られたときの文（DD-028 の8） */
const SCHEME_CONFLICT =
  "この評価セットは、ほかの人が先に保存しました。再読み込みして、最新の内容を確かめてから保存してください。";

/** 回答の値。稼働率は 90 ÷ 100 × 100 ＝ 90 で、今の基準では B（90〜100）になる */
const KPI_ANSWERS: Record<string, number> = { q2_1: 90, q2_2: 100, q3_1: 3 };

type Question = typeof s.formQuestions.$inferSelect;

async function questionsOf(formId: string): Promise<Question[]> {
  return t.db.select().from(s.formQuestions).where(eq(s.formQuestions.formId, formId)).orderBy(asc(s.formQuestions.displayOrder));
}

async function formsOf(cycleId: string) {
  return t.db
    .select()
    .from(s.forms)
    .where(and(eq(s.forms.cycleId, cycleId), eq(s.forms.gradeId, IDS.gradeFrom)))
    .orderBy(asc(s.forms.version));
}

async function evaluationOf(employeeId: string) {
  const [row] = await t.db
    .select()
    .from(s.evaluations)
    .where(and(eq(s.evaluations.cycleId, IDS.cycle), eq(s.evaluations.employeeId, employeeId)));
  return row;
}

async function itemRankOf(evaluationId: string, kpiItemId: string) {
  const [row] = await t.db
    .select({ rank: s.evaluationItems.rank })
    .from(s.evaluationItems)
    .where(and(eq(s.evaluationItems.evaluationId, evaluationId), eq(s.evaluationItems.kpiItemId, kpiItemId)));
  return row?.rank;
}

/** 確定した評価とその内訳をまるごと写す（集計し直しの前後で比べる） */
async function finalizedSnapshot(): Promise<string> {
  const evaluation = await evaluationOf(EMPLOYEE_2);
  return JSON.stringify({
    evaluation,
    items: await t.db.select().from(s.evaluationItems).where(eq(s.evaluationItems.evaluationId, evaluation.id)).orderBy(asc(s.evaluationItems.id)),
    behaviors: await t.db
      .select()
      .from(s.evaluationBehaviors)
      .where(eq(s.evaluationBehaviors.evaluationId, evaluation.id))
      .orderBy(asc(s.evaluationBehaviors.id)),
    requirements: await t.db
      .select()
      .from(s.evaluationRequirements)
      .where(eq(s.evaluationRequirements.evaluationId, evaluation.id))
      .orderBy(asc(s.evaluationRequirements.id)),
    gates: await t.db
      .select()
      .from(s.evaluationGates)
      .where(eq(s.evaluationGates.evaluationId, evaluation.id))
      .orderBy(asc(s.evaluationGates.id)),
  });
}

/** 評価の内訳のうち、回答したアンケートの設問から写す2表の文（settings-copy-ledger.md の 1） */
async function copiedTextsOf(employeeId: string) {
  const evaluation = await evaluationOf(employeeId);
  const requirements = await t.db
    .select({ text: s.evaluationRequirements.text })
    .from(s.evaluationRequirements)
    .where(eq(s.evaluationRequirements.evaluationId, evaluation.id));
  const behaviors = await t.db
    .select({ aspectName: s.evaluationBehaviors.aspectName, levelLabel: s.evaluationBehaviors.levelLabel })
    .from(s.evaluationBehaviors)
    .where(eq(s.evaluationBehaviors.evaluationId, evaluation.id));
  return { requirements: requirements.map((r) => r.text), behaviors };
}

/** 締め切ったアンケートと公開中の版（回答のあるもの）をまるごと写す */
async function frozenFormsSnapshot(): Promise<string> {
  return JSON.stringify({
    forms: await t.db.select().from(s.forms).where(eq(s.forms.id, CLOSED_FORM)),
    closed: await questionsOf(CLOSED_FORM),
    published: await questionsOf(IDS.form),
    publishedForm: await t.db.select().from(s.forms).where(eq(s.forms.id, IDS.form)),
  });
}

function messageOf(result: unknown): string {
  return (result as { message: string }).message;
}

const behaviorTitleOf = (rows: Question[]) => rows.find((q) => q.behaviorGuidelineId === IDS.guideline)?.title;

/** 公開中の版の設問に、2人ぶんの提出済みの回答を入れる */
async function seedAnswers() {
  const questions = await questionsOf(IDS.form);
  const answerOf = (q: Question): { valueNumber: number; valueText?: string } | null => {
    if (q.gradeRequirementId) return { valueNumber: 1 };
    if (q.behaviorGuidelineId) return { valueNumber: 3, valueText: "段階3" };
    if (q.kpiQuestionKey && q.kpiQuestionKey in KPI_ANSWERS) return { valueNumber: KPI_ANSWERS[q.kpiQuestionKey] };
    return null;
  };
  for (const [responseId, employeeId] of [
    ["res_1", IDS.employee],
    ["res_2", EMPLOYEE_2],
  ] as const) {
    await t.db.insert(s.formResponses).values({
      id: responseId,
      companyId: IDS.company,
      formId: IDS.form,
      cycleId: IDS.cycle,
      employeeId,
      gradeId: IDS.gradeFrom,
      officeId: IDS.office,
      status: "submitted",
      submittedAt: new Date("2026-09-30T00:00:00Z"),
    });
    const answers = questions.flatMap((q) => {
      const a = answerOf(q);
      return a
        ? [{ id: `fa_${responseId}_${q.id}`, companyId: IDS.company, responseId, questionId: q.id, valueNumber: a.valueNumber, valueText: a.valueText ?? null }]
        : [];
    });
    await t.db.insert(s.formAnswers).values(answers);
  }
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  // Regular の型（固定枠 80・10点枠 2）に合う配点にしておく
  await seedCompany(t, { weights: [80, 10, 10] });
  await t.db.insert(s.gradePointRules).values({
    id: "gpr_regular",
    companyId: IDS.company,
    pointGroup: "Regular",
    displayOrder: 2,
    totalPoints: 100,
    fixedSlotPoints: 80,
    majorSlotPoints: 0,
    majorSlotCount: 0,
    minorSlotPoints: 10,
    minorSlotCount: 2,
  });
  await t.db.insert(s.users).values([
    { id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    {
      id: EMPLOYEE_2,
      name: "本人2",
      email: "emp2@example.com",
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      officeId: IDS.office,
      managerId: IDS.evaluator,
    },
  ]);
  seedMemberships(t);
  await t.db.insert(s.gradeRequirements).values({
    id: "greq_1",
    companyId: IDS.company,
    gradeId: IDS.gradeFrom,
    category: "support",
    seq: 1,
    text: "等級要件1",
  });
  await t.db.insert(s.kpiQuestions).values([
    { id: "kq_2_1", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q2_1", text: "稼働時間", role: "numerator", displayOrder: 201 },
    { id: "kq_2_2", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q2_2", text: "所定時間", role: "denominator", displayOrder: 202 },
    { id: "kq_3_1", companyId: IDS.company, kpiItemId: IDS.itemLower, questionKey: "q3_1", text: "残業時間", role: "direct", displayOrder: 301 },
  ]);
  // 評価セットにまだ入っていない項目（入れ替えの先）
  await t.db.insert(s.kpiItems).values({
    id: NEW_ITEM,
    companyId: IDS.company,
    no: 4,
    name: "研修の参加",
    categoryId: IDS.category,
    measureType: "個人実績",
    unit: "回",
    direction: "higher",
    formula: "q4_1",
  });
  await t.db.insert(s.kpiQuestions).values({
    id: "kq_4_1",
    companyId: IDS.company,
    kpiItemId: NEW_ITEM,
    questionKey: "q4_1",
    text: "研修に参加した回数",
    role: "direct",
    displayOrder: 401,
  });
  await t.db.insert(s.kpiRankCriteria).values(
    HIGHER_BOUNDS.map((r) => ({
      id: `krc_${NEW_ITEM}_${r.rank}`,
      companyId: IDS.company,
      kpiItemId: NEW_ITEM,
      rank: r.rank,
      displayLabel: `${r.rank}の範囲`,
      lowerBound: r.lower,
      upperBound: r.upper,
    })),
  );
  await t.db.insert(s.behaviorLevels).values(
    [3, 2, 1].map((score) => ({ id: `blv_${score}`, companyId: IDS.company, guidelineId: IDS.guideline, score, label: `段階${score}`, text: "説明" })),
  );

  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();

  // 今の期: 設定から設問を作ってから公開し、2人が回答した
  await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
  expect(await rebuildFormQuestions({ formId: IDS.form })).toMatchObject({ ok: true });
  await t.db.update(s.forms).set({ status: "published" }).where(eq(s.forms.id, IDS.form));
  await seedAnswers();

  // 次の期: 回答の無い下書き。設定から作った設問に、人が1つ設問を足した
  await t.db.insert(s.evaluationCycles).values([
    { id: NEXT_CYCLE, companyId: IDS.company, name: "2026年度下期", periodStart: "2026-10-01", periodEnd: "2027-03-31", schemeId: IDS.scheme, status: "open" },
    { id: OLD_CYCLE, companyId: IDS.company, name: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", schemeId: IDS.scheme, status: "closed" },
  ]);
  await t.db.insert(s.forms).values([
    { id: NEXT_FORM, companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: NEXT_CYCLE, title: "2026年度下期 Regular", status: "draft", publicToken: "tok_next" },
    { id: CLOSED_FORM, companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: OLD_CYCLE, title: "2025年度下期 Regular", status: "closed", publicToken: "tok_closed" },
  ]);
  expect(await rebuildFormQuestions({ formId: NEXT_FORM })).toMatchObject({ ok: true });
  await t.db.insert(s.formQuestions).values([
    {
      id: FREE_QUESTION,
      companyId: IDS.company,
      formId: NEXT_FORM,
      section: "free",
      questionType: "text",
      title: "半期で工夫したこと",
      required: false,
      displayOrder: 999,
    },
    // 前の期の締め切ったアンケートは、当時の名前のまま残っている
    {
      id: "fq_closed_behavior",
      companyId: IDS.company,
      formId: CLOSED_FORM,
      section: "behavior",
      questionType: "single",
      title: "創造性について",
      displayOrder: 1,
      behaviorGuidelineId: IDS.guideline,
    },
  ]);

  // 上司が評価を作り、本人にはコメントと判断を書き、本人2の評価は確定した
  mocked.viewer = manager;
  expect(await buildEvaluations({ cycleId: IDS.cycle })).toMatchObject({ ok: true });
  await t.db
    .update(s.evaluations)
    .set(DECISION)
    .where(and(eq(s.evaluations.cycleId, IDS.cycle), eq(s.evaluations.employeeId, IDS.employee)));
  await t.db
    .update(s.evaluations)
    .set({ status: "finalized", finalizedAt: new Date("2026-10-10T00:00:00Z") })
    .where(and(eq(s.evaluations.cycleId, IDS.cycle), eq(s.evaluations.employeeId, EMPLOYEE_2)));
  await t.db.update(s.evaluationSchemes).set({ updatedAt: SEEDED_AT }).where(eq(s.evaluationSchemes.id, IDS.scheme));
  mocked.viewer = admin;
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("下ごしらえ", () => {
  it("公開中の版に2人の回答があり、本人の評価は確定前・本人2の評価は確定している", async () => {
    expect((await evaluationOf(IDS.employee)).status).toBe("draft");
    expect((await evaluationOf(EMPLOYEE_2)).status).toBe("finalized");
    const evaluation = await evaluationOf(IDS.employee);
    expect(await itemRankOf(evaluation.id, IDS.itemHigher)).toBe("B");
    expect(behaviorTitleOf(await questionsOf(NEXT_FORM))).toBe("創造性について");
  });
});

describe("行動指針の名前を保存すると、アンケートが追従する", () => {
  const rename = (aspectName: string) => saveMaster({ kind: "behaviorGuideline", id: IDS.guideline, aspectName });

  it("回答の無い下書きは作り直し、手で足した設問は同じ id で残る", async () => {
    const before = await questionsOf(NEXT_FORM);
    const result = await rename("新しい工夫について");
    expect(result).toMatchObject({ ok: true });

    const after = await questionsOf(NEXT_FORM);
    expect(behaviorTitleOf(after)).toBe("新しい工夫について");
    const free = after.find((q) => q.id === FREE_QUESTION);
    expect(free).toMatchObject({ section: "free", title: "半期で工夫したこと" });
    // 設定とつながった設問の数は変わらない（名前を変えただけ）
    expect(after.length).toBe(before.length);
  });

  it("回答のある公開中の版は変えず、次の版の下書きを1つだけ作る", async () => {
    const frozen = await frozenFormsSnapshot();
    const result = await rename("新しい工夫について");
    expect(result).toMatchObject({ ok: true });

    expect(await frozenFormsSnapshot()).toBe(frozen);
    const forms = await formsOf(IDS.cycle);
    expect(forms.map((f) => [f.version, f.status])).toEqual([
      [1, "published"],
      [2, "draft"],
    ]);
    expect(behaviorTitleOf(await questionsOf(forms[1].id))).toBe("新しい工夫について");
  });

  it("締め切った前の期のアンケートは、当時の名前のまま変わらない", async () => {
    await rename("新しい工夫について");
    expect(await formsOf(OLD_CYCLE)).toHaveLength(1);
    expect(behaviorTitleOf(await questionsOf(CLOSED_FORM))).toBe("創造性について");
  });

  it("結果の文に、作り直したアンケートと作った次の版の件数と名前が出る", async () => {
    const message = messageOf(await rename("新しい工夫について"));
    expect(message).toContain("回答の無い下書きのアンケートを作り直しました（1件: 2026年度下期 Regular）");
    expect(message).toContain("回答のあるアンケートに次の版の下書きを作りました（1件: 2026年度上期 Regular 第2版）");
    expect(message).toContain("公開は内容を確かめてから行ってください。");
  });

  it("2回目の保存では次の版を増やさず、前に作った次の版の下書きを作り直す", async () => {
    await rename("新しい工夫について");
    const second = await rename("さらに新しい工夫について");
    expect(second).toMatchObject({ ok: true });

    const forms = await formsOf(IDS.cycle);
    expect(forms.map((f) => f.version)).toEqual([1, 2]);
    expect(behaviorTitleOf(await questionsOf(forms[1].id))).toBe("さらに新しい工夫について");
    expect(behaviorTitleOf(await questionsOf(NEXT_FORM))).toBe("さらに新しい工夫について");
    expect(messageOf(second)).toContain("回答の無い下書きのアンケートを作り直しました（2件");
    expect(messageOf(second)).not.toContain("次の版の下書きを作りました");
  });
});

describe("ランク基準を保存すると、確定前の評価が集計し直される", () => {
  const RANKS = ["A", "B", "C", "D", "E"] as const;
  /** A を 85 以上に下げる。90 だった稼働率は B から A になる */
  const LOWERED: Record<(typeof RANKS)[number], [number | null, number | null]> = {
    A: [85, null],
    B: [80, 85],
    C: [75, 80],
    D: [70, 75],
    E: [null, 70],
  };
  const saveCriteria = () =>
    saveMaster({
      kind: "rankCriteriaSet",
      kpiItemId: IDS.itemHigher,
      rows: RANKS.map((rank) => ({ id: `krc_${IDS.itemHigher}_${rank}`, lowerBound: LOWERED[rank][0], upperBound: LOWERED[rank][1] })),
    });

  it("確定前の評価のランクが新しい基準で決まり、上司のコメントと判断・集計した上司・評価の id が残る", async () => {
    const before = await evaluationOf(IDS.employee);
    const result = await saveCriteria();
    expect(result).toMatchObject({ ok: true });

    const after = await evaluationOf(IDS.employee);
    expect(after.id).toBe(before.id);
    expect(after.status).toBe("draft");
    expect(after.evaluatorId).toBe(IDS.evaluator);
    expect(after).toMatchObject(DECISION);
    expect(await itemRankOf(after.id, IDS.itemHigher)).toBe("A");
  });

  it("確定した評価とその内訳は変わらない", async () => {
    const frozen = await finalizedSnapshot();
    expect(await saveCriteria()).toMatchObject({ ok: true });
    expect(await finalizedSnapshot()).toBe(frozen);
  });

  it("設問に関わらない保存なので、アンケートは作り直さず次の版も作らない", async () => {
    const next = JSON.stringify(await questionsOf(NEXT_FORM));
    const message = messageOf(await saveCriteria());
    expect(await formsOf(IDS.cycle)).toHaveLength(1);
    expect(JSON.stringify(await questionsOf(NEXT_FORM))).toBe(next);
    expect(message).not.toContain("アンケート");
  });

  it("結果の文に、集計し直した評価の件数と名前が出る", async () => {
    const message = messageOf(await saveCriteria());
    expect(message).toContain("確定前の評価を集計し直しました（1件: 本人）。上司のコメントと判断はそのまま残しています。");
  });
});

describe("評価セットの保存", () => {
  const items = (third: string) => [
    { kpiItemId: IDS.itemFixed, categoryId: IDS.category, isFixedSlot: true },
    { kpiItemId: IDS.itemHigher, categoryId: IDS.category, isFixedSlot: false },
    { kpiItemId: third, categoryId: IDS.category, isFixedSlot: false },
  ];
  const swap = (expectedUpdatedAt: number) =>
    saveScheme({ schemeId: IDS.scheme, pointGroup: "Regular", items: items(NEW_ITEM), expectedUpdatedAt });

  async function schemeSnapshot(): Promise<string> {
    return JSON.stringify({
      scheme: await t.db.select().from(s.evaluationSchemes).where(eq(s.evaluationSchemes.id, IDS.scheme)),
      items: await t.db.select().from(s.schemeItems).orderBy(asc(s.schemeItems.id)),
      forms: await t.db.select().from(s.forms).orderBy(asc(s.forms.id)),
      next: await questionsOf(NEXT_FORM),
      events: await t.db.select().from(s.constitutionEvents).orderBy(asc(s.constitutionEvents.id)),
    });
  }

  it("読んだ時刻より後に保存されていれば 409 で断り、何も書かない", async () => {
    const before = await schemeSnapshot();
    const result = await swap(SEEDED_AT.getTime() - 60_000);
    expect(result).toMatchObject({ ok: false, message: SCHEME_CONFLICT });
    expect(await schemeSnapshot()).toBe(before);
  });

  it("通った保存は制度の変更の記録を残し、評価セットの更新時刻を進める", async () => {
    const result = await swap(SEEDED_AT.getTime());
    expect(result).toMatchObject({ ok: true });

    const [scheme] = await t.db.select().from(s.evaluationSchemes).where(eq(s.evaluationSchemes.id, IDS.scheme));
    expect(scheme.updatedAt.getTime()).toBeGreaterThan(SEEDED_AT.getTime());

    const events = await t.db
      .select()
      .from(s.constitutionEvents)
      .where(and(eq(s.constitutionEvents.entityType, "evaluationScheme"), eq(s.constitutionEvents.entityId, IDS.scheme)));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "updated", actorId: "usr_admin" });
    expect(events[0].beforeJson).toContain(IDS.itemLower);
    expect(events[0].afterJson).toContain(NEW_ITEM);
  });

  it.each([
    ["回答一覧", /select "form_id" from "form_responses"/],
    ["同じ期・等級の版", /select "cycle_id", "grade_id", "version" from "forms"/],
  ])("%sの読取が失敗しても保存済みと返し、評価追従と画面の更新を続ける", async (_name, sqlPattern) => {
    const kept = await questionsOf(NEXT_FORM);
    await t.db.update(s.evaluations).set({ updatedAt: SEEDED_AT }).where(eq(s.evaluations.id, (await evaluationOf(IDS.employee)).id));
    const prepare = t.raw.prepare.bind(t.raw);
    let injected = false;
    vi.spyOn(t.raw, "prepare").mockImplementation((sql) => {
      if (!injected && sqlPattern.test(sql)) {
        injected = true;
        throw new Error("追従準備の読取失敗（試験）");
      }
      return prepare(sql);
    });
    mocked.refresh.mockClear();

    const result = await swap(SEEDED_AT.getTime());

    expect(injected).toBe(true);
    expect(result).toMatchObject({ ok: true });
    const saved = await t.db.select().from(s.schemeItems).where(eq(s.schemeItems.schemeId, IDS.scheme));
    expect(saved.some((i) => i.kpiItemId === NEW_ITEM)).toBe(true);
    expect(await questionsOf(NEXT_FORM)).toEqual(kept);
    expect(messageOf(result)).toContain("アンケートをいまの設定に合わせられませんでした");
    expect(messageOf(result)).toContain("アンケートの画面で設問を作り直すか、新しい版を作ってください");
    expect(messageOf(result)).toContain("確定前の評価を集計し直しました");
    expect((await evaluationOf(IDS.employee)).updatedAt.getTime()).toBeGreaterThan(SEEDED_AT.getTime());
    expect(mocked.refresh).toHaveBeenCalledOnce();
  });

  it("項目を入れ替えると、回答の無い下書きは新しい項目の設問になり、手で足した設問は残る", async () => {
    const result = await swap(SEEDED_AT.getTime());
    expect(result).toMatchObject({ ok: true });

    const next = await questionsOf(NEXT_FORM);
    const keys = next.map((q) => q.kpiQuestionKey).filter(Boolean);
    expect(keys).toContain("q4_1");
    expect(keys).not.toContain("q3_1");
    expect(next.find((q) => q.id === FREE_QUESTION)).toBeDefined();

    const forms = await formsOf(IDS.cycle);
    expect(forms.map((f) => [f.version, f.status])).toEqual([
      [1, "published"],
      [2, "draft"],
    ]);
    expect((await questionsOf(forms[1].id)).map((q) => q.kpiQuestionKey)).toContain("q4_1");
    expect(messageOf(result)).toContain("回答のあるアンケートに次の版の下書きを作りました（1件: 2026年度上期 Regular 第2版）");
  });

  it("読んだ時刻を送らない保存は照合できないので断り、何も書かない（RELIABILITY-008）", async () => {
    const before = await schemeSnapshot();
    const result = await saveScheme({ schemeId: IDS.scheme, pointGroup: "Regular", items: items(NEW_ITEM) });
    expect(result).toMatchObject({ ok: false });
    expect(await schemeSnapshot()).toBe(before);
  });
});

describe("等級要件・行動指針の文を直しても、評価の内訳は回答した時点の文のまま（settings-copy-ledger.md の 1）", () => {
  /** 評価の内訳は回答したアンケートの設問から写すので、集計し直しても回答した時点の文になる */
  async function rebuildAsManager() {
    mocked.viewer = manager;
    expect(await buildEvaluations({ cycleId: IDS.cycle })).toMatchObject({ ok: true });
    mocked.viewer = admin;
  }

  it("等級要件の文を直す保存は、確定前の評価を集計し直さず、集計し直しても元の文のまま", async () => {
    const before = await copiedTextsOf(IDS.employee);
    // 設問の文は要件の文を問いの形にしたもの。評価の内訳はその設問の文を写す
    expect(before.requirements).toEqual(["「等級要件1」を、この半期に自分の担当として行いましたか？"]);

    const result = await saveMaster({ kind: "gradeRequirementRevise", id: "greq_1", text: "新しい等級要件1" });
    expect(result).toMatchObject({ ok: true });
    expect(messageOf(result)).not.toContain("確定前の評価を集計し直しました");
    expect(await copiedTextsOf(IDS.employee)).toEqual(before);

    await rebuildAsManager();
    expect(await copiedTextsOf(IDS.employee)).toEqual(before);
    // 新しい文は、次の版の下書きの設問に入る
    const forms = await formsOf(IDS.cycle);
    expect((await questionsOf(forms[1].id)).map((q) => q.title)).toContain("「新しい等級要件1」を、この半期に自分の担当として行いましたか？");
  });

  it("行動指針の名前を直す保存のあとに集計し直しても、観点の名前と段階の名前は回答した時点のまま", async () => {
    const before = await copiedTextsOf(IDS.employee);
    expect(before.behaviors).toEqual([{ aspectName: "創造性について", levelLabel: "段階3" }]);

    expect(await saveMaster({ kind: "behaviorGuideline", id: IDS.guideline, aspectName: "新しい工夫について" })).toMatchObject({ ok: true });
    await rebuildAsManager();
    expect(await copiedTextsOf(IDS.employee)).toEqual(before);
  });
});
