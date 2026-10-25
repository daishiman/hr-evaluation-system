import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { kpiItemPath, schemeStepPath } from "@/lib/domain/scheme-steps";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { HIGHER_BOUNDS, IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 下書きのアンケートから設定への反映（DD-028 の 1〜3・O27 の 1 件目）。
 *
 * 紐づいた設問の文を直すと設定の文が変わり、外すと設定で使わない状態になり、
 * 紐づけの欄を1つだけ付けて足すと設定の行から設問を作る。
 * 評価セットの決まりや計算式に合わない保存は、アンケートも設定も変えずに断り、直す画面の場所を返す。
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

import { rebuildFormQuestions, saveFormQuestions } from "@/actions/forms";

let t: TestDatabase;

const admin = {
  id: "usr_admin",
  name: "会社の管理者",
  email: "admin@example.com",
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

/** 保存の前の更新時刻。保存で時刻が進んだことを、同じミリ秒に重ならずに確かめるため過去に置く */
const SEEDED_AT = new Date("2026-10-01T00:00:00Z");

const REQUIREMENT_ID = "greq_1";
const NEW_ITEM = "kpi_new";

type Row = typeof s.formQuestions.$inferSelect;

async function storedQuestions(): Promise<Row[]> {
  return t.db.select().from(s.formQuestions).where(eq(s.formQuestions.formId, IDS.form)).orderBy(asc(s.formQuestions.displayOrder));
}

/** 組み立て画面が送るのと同じ形にする */
function sent(row: Row) {
  return {
    id: row.id,
    section: row.section as "kpi",
    questionType: row.questionType as "number",
    title: row.title,
    helpText: row.helpText,
    unit: row.unit,
    required: row.required,
    validationMin: row.validationMin,
    validationMax: row.validationMax,
    validationInteger: row.validationInteger,
    options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
    isGate: row.isGate,
    gradeRequirementId: row.gradeRequirementId,
    promotionRequirementId: row.promotionRequirementId,
    behaviorGuidelineId: row.behaviorGuidelineId,
    kpiItemId: row.kpiItemId,
    kpiQuestionKey: row.kpiQuestionKey,
  };
}

async function formUpdatedAt(): Promise<number> {
  const [form] = await t.db.select({ updatedAt: s.forms.updatedAt }).from(s.forms).where(eq(s.forms.id, IDS.form));
  return form.updatedAt.getTime();
}

/** 今の版に対する保存（画面が開いたときの更新時刻を添える） */
async function save(questions: ReturnType<typeof sent>[] | Record<string, unknown>[]) {
  return saveFormQuestions({ formId: IDS.form, expectedUpdatedAt: await formUpdatedAt(), questions });
}

/** 断った保存がアンケートも設定も変えていないことを、関係する表をまるごと比べて確かめる */
async function snapshot(): Promise<string> {
  return JSON.stringify({
    forms: await t.db.select().from(s.forms).orderBy(asc(s.forms.id)),
    questions: await storedQuestions(),
    kpiQuestions: await t.db.select().from(s.kpiQuestions).orderBy(asc(s.kpiQuestions.id)),
    kpiItems: await t.db.select().from(s.kpiItems).orderBy(asc(s.kpiItems.id)),
    schemeItems: await t.db.select().from(s.schemeItems).orderBy(asc(s.schemeItems.id)),
    guidelines: await t.db.select().from(s.behaviorGuidelines).orderBy(asc(s.behaviorGuidelines.id)),
    requirements: await t.db.select().from(s.gradeRequirements).orderBy(asc(s.gradeRequirements.id)),
    events: await t.db.select().from(s.constitutionEvents).orderBy(asc(s.constitutionEvents.id)),
  });
}

function messageOf(result: unknown): string {
  return (result as { message: string }).message;
}

function fixHrefOf(result: unknown): string | undefined {
  return (result as { fixHref?: string }).fixHref;
}

const byKey = (rows: Row[], key: string) => rows.find((r) => r.kpiQuestionKey === key) as Row;

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
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  await t.db.insert(s.gradeRequirements).values({
    id: REQUIREMENT_ID,
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
  await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  expect(await rebuildFormQuestions({ formId: IDS.form })).toMatchObject({ ok: true });
  await t.db.update(s.forms).set({ updatedAt: SEEDED_AT }).where(eq(s.forms.id, IDS.form));
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("紐づいた設問の文を直すと、設定の文が変わる", () => {
  it("KPI の聞くことの文が、直した文になる。紐づけはそのまま", async () => {
    const before = await storedQuestions();
    const result = await save(before.map((r) => (r.kpiQuestionKey === "q2_1" ? { ...sent(r), title: "実際に働いた時間" } : sent(r))));
    expect(result).toMatchObject({ ok: true });

    const [kq] = await t.db.select().from(s.kpiQuestions).where(eq(s.kpiQuestions.questionKey, "q2_1"));
    expect(kq.text).toBe("実際に働いた時間");
    const row = byKey(await storedQuestions(), "q2_1");
    expect(row.title).toBe("実際に働いた時間");
    expect(row.kpiItemId).toBe(IDS.itemHigher);
  });

  it("行動指針の観点の名前が、直した文になる", async () => {
    const before = await storedQuestions();
    const result = await save(before.map((r) => (r.behaviorGuidelineId ? { ...sent(r), title: "新しい工夫について" } : sent(r))));
    expect(result).toMatchObject({ ok: true });

    const [g] = await t.db.select().from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.id, IDS.guideline));
    expect(g.aspectName).toBe("新しい工夫について");
  });

  it("等級要件はかぎかっこの中を新しい版として残し、設問は新しい版に付け替わる", async () => {
    const before = await storedQuestions();
    const result = await save(
      before.map((r) =>
        r.gradeRequirementId ? { ...sent(r), title: "「等級要件1（改）」を、この半期に自分の担当として行いましたか？" } : sent(r),
      ),
    );
    expect(result).toMatchObject({ ok: true });

    const [next] = await t.db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.previousVersionId, REQUIREMENT_ID));
    expect(next).toMatchObject({ text: "等級要件1（改）", isActive: true, gradeId: IDS.gradeFrom, category: "support", seq: 1 });
    const [first] = await t.db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.id, REQUIREMENT_ID));
    expect(first.text).toBe("等級要件1");
    const linked = (await storedQuestions()).find((r) => r.section === "support") as Row;
    expect(linked.gradeRequirementId).toBe(next.id);
  });

  it("等級要件の設問の型を崩した文は断り、アンケートも設定も変えない", async () => {
    const before = await storedQuestions();
    const kept = await snapshot();
    const result = await save(before.map((r) => (r.gradeRequirementId ? { ...sent(r), title: "等級要件を行ったか" } : sent(r))));

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toContain("かぎかっこ");
    expect(await snapshot()).toBe(kept);
  });
});

describe("紐づいた設問を外すと、設定で使わない状態になる", () => {
  it("行動指針と等級要件は、使わない状態になる", async () => {
    const before = await storedQuestions();
    const result = await save(before.filter((r) => !r.behaviorGuidelineId && !r.gradeRequirementId).map(sent));
    expect(result).toMatchObject({ ok: true });

    const [g] = await t.db.select().from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.id, IDS.guideline));
    expect(g.isActive).toBe(false);
    const [req] = await t.db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.id, REQUIREMENT_ID));
    expect(req.isActive).toBe(false);
    const after = await storedQuestions();
    expect(after.some((r) => r.behaviorGuidelineId || r.gradeRequirementId)).toBe(false);
  });

  it("KPI 項目を丸ごと外すだけだと評価セットの項目数が足りず、評価セットの画面の場所を返して断る", async () => {
    const before = await storedQuestions();
    const kept = await snapshot();
    const result = await save(before.filter((r) => r.kpiItemId !== IDS.itemLower).map(sent));

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toContain("で選ぶ項目は3件です");
    expect(fixHrefOf(result)).toBe(schemeStepPath("Regular", "select"));
    expect(await snapshot()).toBe(kept);
  });

  it("計算式が使う聞くことだけを外すと、項目の画面の場所を返して断る", async () => {
    const before = await storedQuestions();
    const kept = await snapshot();
    const result = await save(before.filter((r) => r.kpiQuestionKey !== "q2_2").map(sent));

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toContain("稼働率");
    expect(messageOf(result)).toContain("計算式");
    expect(fixHrefOf(result)).toBe(kpiItemPath(IDS.itemHigher));
    expect(await snapshot()).toBe(kept);
  });
});

describe("KPI 項目の入れ替え", () => {
  it("外した項目の枠を、足した項目が引き継ぐ。設問は設定の聞くことから作る", async () => {
    const before = await storedQuestions();
    const kept = before.filter((r) => r.kpiItemId !== IDS.itemLower).map(sent);
    const result = await save([
      ...kept,
      { section: "kpi", questionType: "number", title: "（項目を選んだだけ）", required: true, kpiItemId: NEW_ITEM },
    ]);
    expect(result).toMatchObject({ ok: true });

    const items = await t.db
      .select()
      .from(s.schemeItems)
      .where(and(eq(s.schemeItems.schemeId, IDS.scheme), eq(s.schemeItems.pointGroup, "Regular")))
      .orderBy(asc(s.schemeItems.displayOrder));
    expect(items.map((i) => i.kpiItemId)).toEqual([IDS.itemFixed, IDS.itemHigher, NEW_ITEM]);
    expect(items[2]).toMatchObject({ weight: 10, displayOrder: 3, isFixedSlot: false });

    const added = (await storedQuestions()).filter((r) => r.kpiItemId === NEW_ITEM);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kpiQuestionKey: "q4_1", title: "研修に参加した回数", section: "kpi" });
  });
});

describe("足す設問の紐づけ", () => {
  it("聞くことの key まで付けて足すと断る。KPI は項目だけを選ぶ", async () => {
    const before = await storedQuestions();
    const kept = await snapshot();
    const result = await save([
      ...before.map(sent),
      { section: "kpi", questionType: "number", title: "研修の回数", required: true, kpiItemId: NEW_ITEM, kpiQuestionKey: "q4_1" },
    ]);

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toBe("「研修の回数」に付けられる紐づけは、設定の項目1つだけです。KPI は項目だけを選んでください。");
    expect(await snapshot()).toBe(kept);
  });

  it("使っていない行動指針と等級要件を足すと、使う状態に戻り、設問は設定から作る", async () => {
    await t.db.insert(s.behaviorGuidelines).values({
      id: "bg_off",
      companyId: IDS.company,
      band: "g1_2",
      aspect: "expertise",
      aspectName: "専門性について",
      seq: 2,
      isActive: false,
    });
    await t.db.insert(s.behaviorLevels).values(
      [3, 2, 1].map((score) => ({ id: `blv_off_${score}`, companyId: IDS.company, guidelineId: "bg_off", score, label: `段階${score}`, text: "専門の説明" })),
    );
    await t.db.insert(s.gradeRequirements).values({
      id: "greq_off",
      companyId: IDS.company,
      gradeId: IDS.gradeFrom,
      category: "operation",
      seq: 1,
      text: "使っていない要件",
      isActive: false,
    });

    const before = await storedQuestions();
    const result = await save([
      ...before.map(sent),
      { section: "behavior", questionType: "single", title: "（行動指針を選んだだけ）", required: true, behaviorGuidelineId: "bg_off" },
      { section: "operation", questionType: "yesno", title: "（要件を選んだだけ）", required: true, gradeRequirementId: "greq_off" },
    ]);
    expect(result).toMatchObject({ ok: true });

    const [g] = await t.db.select().from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.id, "bg_off"));
    expect(g.isActive).toBe(true);
    const [req] = await t.db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.id, "greq_off"));
    expect(req.isActive).toBe(true);

    const after = await storedQuestions();
    const behavior = after.find((r) => r.behaviorGuidelineId === "bg_off") as Row;
    expect(behavior.title).toBe("専門性について");
    expect(JSON.parse(behavior.optionsJson as string)).toHaveLength(3);
    const requirement = after.find((r) => r.gradeRequirementId === "greq_off") as Row;
    expect(requirement.title).toBe("「使っていない要件」を、この半期に自分の担当として行いましたか？");
  });
});

describe("守り（権限・会社の境界・同時の保存・記録）", () => {
  it("会社の管理者より下の権限では断り、何も変えない", async () => {
    const before = await storedQuestions();
    const kept = await snapshot();
    mocked.viewer = { ...admin, id: IDS.evaluator, role: "MANAGER" } as Viewer;
    const result = await save(before.map((r) => (r.kpiQuestionKey === "q2_1" ? { ...sent(r), title: "書き換え" } : sent(r))));

    expect(result).toEqual({ ok: false, message: "この操作を行う権限がありません。" });
    expect(await snapshot()).toBe(kept);
  });

  it("他社の項目を付けて足すと断り、何も変えない", async () => {
    await t.db.insert(s.companies).values({ id: "cmp_other", name: "別の会社", slug: "other" });
    await t.db.insert(s.kpiCategories).values({ id: "cat_other", companyId: "cmp_other", code: "ops", name: "運営", displayOrder: 1 });
    await t.db.insert(s.kpiItems).values({
      id: "kpi_other",
      companyId: "cmp_other",
      no: 9,
      name: "別の会社の項目",
      categoryId: "cat_other",
      measureType: "個人実績",
      unit: "%",
      direction: "higher",
      formula: "q9_1",
    });
    await t.db.insert(s.kpiQuestions).values({ id: "kq_other", companyId: "cmp_other", kpiItemId: "kpi_other", questionKey: "q9_1", text: "別の会社の設問", role: "direct" });

    const before = await storedQuestions();
    const kept = await snapshot();
    const result = await save([
      ...before.filter((r) => r.kpiItemId !== IDS.itemLower).map(sent),
      { section: "kpi", questionType: "number", title: "別の会社の設問", required: true, kpiItemId: "kpi_other" },
    ]);

    expect(result).toMatchObject({ ok: false });
    expect(await snapshot()).toBe(kept);
  });

  it("開いた後に別の保存が入っていたら 409 で断り、何も変えない", async () => {
    const before = await storedQuestions();
    const opened = await formUpdatedAt();
    expect(await save(before.map(sent))).toMatchObject({ ok: true });
    expect(await formUpdatedAt()).toBeGreaterThan(opened);

    const kept = await snapshot();
    const stale = await saveFormQuestions({
      formId: IDS.form,
      expectedUpdatedAt: opened,
      questions: (await storedQuestions()).map((r) => (r.kpiQuestionKey === "q2_1" ? { ...sent(r), title: "古い画面からの書き換え" } : sent(r))),
    });
    expect(stale).toEqual({
      ok: false,
      message: "このアンケートは、ほかの人が先に保存しました。再読み込みして、最新の内容を確かめてから保存してください。",
    });
    expect(await snapshot()).toBe(kept);
  });

  it("開いた時刻を送らない保存は照合できないので断り、何も変えない（RELIABILITY-008）", async () => {
    const kept = await snapshot();
    const result = await saveFormQuestions({
      formId: IDS.form,
      questions: (await storedQuestions()).map((r) => (r.kpiQuestionKey === "q2_1" ? { ...sent(r), title: "時刻を添えない書き換え" } : sent(r))),
    });
    expect(result).toMatchObject({ ok: false });
    expect(await snapshot()).toBe(kept);
  });

  it("設定へ写した変更は、保存した人の制度の変更として記録に残る", async () => {
    const before = await storedQuestions();
    const result = await save(
      before.map((r) => {
        if (r.kpiQuestionKey === "q2_1") return { ...sent(r), title: "実際に働いた時間" };
        if (r.behaviorGuidelineId) return { ...sent(r), title: "新しい工夫について" };
        if (r.gradeRequirementId) return { ...sent(r), title: "「等級要件1（改）」を、この半期に自分の担当として行いましたか？" };
        return sent(r);
      }),
    );
    expect(result).toMatchObject({ ok: true });

    const events = await t.db.select().from(s.constitutionEvents).where(eq(s.constitutionEvents.companyId, IDS.company));
    const pick = (entityType: string) => events.filter((e) => e.entityType === entityType);
    expect(pick("kpiItem")).toEqual([expect.objectContaining({ entityId: IDS.itemHigher, eventType: "updated", actorId: "usr_admin" })]);
    expect(pick("behaviorGuideline")).toEqual([expect.objectContaining({ entityId: IDS.guideline, eventType: "updated", actorId: "usr_admin" })]);
    expect(pick("gradeRequirement")).toEqual([expect.objectContaining({ entityId: REQUIREMENT_ID, eventType: "revised", actorId: "usr_admin" })]);
  });
});
