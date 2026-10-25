import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 設問の保存で、集計との紐づけをサーバーが確かめる（DD-015・spec 一覧の 20。DD-028 で改めた）。
 *
 * 紐づけはサーバーが設定の行から書く値で、組み立て画面は保存済みの設問の紐づけを引き継ぐだけ。
 * 保存の要求に入っていた紐づけを信じず、保存済みの同じ設問の値と同じものだけを受け付ける。
 * 新しい設問には、自社の設定の行を1つだけ指す紐づけ（KPI は項目だけ）を付けて「設定の項目を選んで足す」ことができる（DD-028 の1）。
 * 足す・外す・文を直すが設定へ写る経路は src/actions/form-to-settings-sync.test.ts が確かめる。
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

const freeQuestion = {
  section: "free" as const,
  questionType: "text" as const,
  title: "ひとこと",
  required: false,
};

function messageOf(result: unknown): string {
  return (result as { message: string }).message;
}

/** 画面と同じく、開いたときのアンケートの更新時刻を添えて保存する */
async function save(questions: unknown[]) {
  const [form] = await t.db.select({ updatedAt: s.forms.updatedAt }).from(s.forms).where(eq(s.forms.id, IDS.form));
  return saveFormQuestions({ formId: IDS.form, expectedUpdatedAt: form.updatedAt.getTime(), questions });
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
  await t.db.insert(s.kpiQuestions).values([
    { id: "kq_higher", companyId: IDS.company, kpiItemId: IDS.itemHigher, questionKey: "q_h", text: "稼働時間", role: "direct" },
    { id: "kq_lower", companyId: IDS.company, kpiItemId: IDS.itemLower, questionKey: "q_l", text: "残業時間", role: "direct" },
  ]);
  // 見本の行動指針には段階が無く、選択肢0の設問になって保存し直せない。本番と同じく段階を置く
  await t.db.insert(s.behaviorLevels).values(
    [3, 2, 1].map((score) => ({ id: `blv_${score}`, companyId: IDS.company, guidelineId: IDS.guideline, score, label: `段階${score}`, text: "説明" })),
  );
  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  // KPI の設問を作り直しで作っておく（紐づけはサーバーが書く）
  expect(await rebuildFormQuestions({ formId: IDS.form })).toMatchObject({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe("設問の保存と集計との紐づけ", () => {
  it("画面が送るとおり引き継げば、紐づけと id はそのまま残る", async () => {
    const before = await storedQuestions();
    expect(before.some((q) => q.kpiQuestionKey === "q_h")).toBe(true);

    const result = await save([...before.map(sent), freeQuestion]);

    expect(result).toMatchObject({ ok: true });
    const after = await storedQuestions();
    expect(after.slice(0, before.length).map((q) => [q.id, q.kpiItemId, q.kpiQuestionKey])).toEqual(
      before.map((q) => [q.id, q.kpiItemId, q.kpiQuestionKey]),
    );
    expect(after.at(-1)).toMatchObject({ title: "ひとこと", kpiItemId: null, kpiQuestionKey: null, isGate: false });
  });

  it("新しい設問に聞くことの key まで付けて送ると断り、保存済みの設問は変えない（KPI は項目だけを選ぶ）", async () => {
    const before = await storedQuestions();

    const result = await save([...before.map(sent), { ...freeQuestion, kpiItemId: IDS.itemHigher, kpiQuestionKey: "q_h" }]);

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toBe("「ひとこと」に付けられる紐づけは、設定の項目1つだけです。KPI は項目だけを選んでください。");
    expect(await storedQuestions()).toEqual(before);
  });

  it("この版がもう聞いている KPI 項目を選んで足すと断り、保存済みの設問は変えない", async () => {
    const before = await storedQuestions();

    const result = await save([...before.map(sent), { ...freeQuestion, kpiItemId: IDS.itemHigher }]);

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toBe("「稼働率」は、このアンケートがもう聞いています。同じ項目を2回は足せません。");
    expect(await storedQuestions()).toEqual(before);
  });

  it("新しい設問を昇格の必須要件にして送っても断る", async () => {
    const before = await storedQuestions();

    const result = await save([...before.map(sent), { ...freeQuestion, isGate: true }]);

    expect(result).toMatchObject({ ok: false });
    expect(await storedQuestions()).toEqual(before);
  });

  it("保存済みの設問の紐づけを書き換えて送っても断る", async () => {
    const before = await storedQuestions();
    const questions = before.map(sent).map((q) => (q.kpiQuestionKey === "q_h" ? { ...q, kpiQuestionKey: "q_l" } : q));

    const result = await save(questions);

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toContain("の集計との紐づけは、この画面では変えられません");
    expect(await storedQuestions()).toEqual(before);
  });

  it("集計に使う設問の答え方を変えて送っても断る", async () => {
    const before = await storedQuestions();
    const questions = before.map(sent).map((q) => (q.kpiQuestionKey === "q_h" ? { ...q, questionType: "text" as const } : q));

    const result = await save(questions);

    expect(result).toMatchObject({ ok: false });
    expect(messageOf(result)).toContain("は集計に使う設問なので、まとまりと答え方は変えられません");
    expect(await storedQuestions()).toEqual(before);
  });

  it("自由設問は、まとまりも答え方も変えられる", async () => {
    const before = await storedQuestions();
    expect(await save([...before.map(sent), freeQuestion])).toMatchObject({ ok: true });
    const saved = await storedQuestions();
    const free = saved.at(-1)!;

    const result = await save([...saved.slice(0, -1).map(sent), { ...sent(free), section: "support" as const, questionType: "yesno" as const }]);

    expect(result).toMatchObject({ ok: true });
    expect((await storedQuestions()).at(-1)).toMatchObject({ id: free.id, section: "support", questionType: "yesno" });
  });

  it("この版に無い id の自由設問は、新しい id で保存する", async () => {
    const before = await storedQuestions();

    const result = await save([...before.map(sent), { ...freeQuestion, id: "fq_other_form" }]);

    expect(result).toMatchObject({ ok: true });
    const last = (await storedQuestions()).at(-1)!;
    expect(last.title).toBe("ひとこと");
    expect(last.id).not.toBe("fq_other_form");
  });
});
