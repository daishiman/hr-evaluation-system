import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { kpiItemPath } from "@/lib/domain/scheme-steps";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 設定とずれた下書きのアンケートをそろえる操作（DD-028 の6・I30）。
 *
 * - 回答0件の下書きごとに、設定とつながった設問がいまの設定とずれているかを見る
 * - 下書きの設問を保存した時刻（設問の行の更新時刻の最大）と、つながった設定の行の更新時刻を比べ、新しい方を正とする
 *   下書きが新しければ設定へ反映し（I28 の保存と同じ経路）、設定が新しければ下書きを作り直す（I29 と同じ経路）
 *   締切・題だけの直しは設問を書かないので、向きを変えない（設定の後に締切を直しても、新しい設定を古い下書きで上書きしない）
 * - dry-run は書かずに件数と一覧を返す。本流しの後の2回目の dry-run は0件
 * - 締め切ったアンケート・回答のある下書き・確定した評価・他社（見本の会社を含む）の行には触れない
 * - 会社の管理者より下の権限では断る。内容を見た後に保存が入っていたら 409 で断る
 * - 設定へ反映した変更は、そろえた人の制度の変更として記録に残る
 * - 行動指針の割り当てを既定へ戻す移行（0040）が書き換えた等級の下書きは、設定の側が新しいとして作り直す（DD-026 の5）
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

import { rebuildFormQuestions, updateForm } from "@/actions/forms";
import { saveMaster } from "@/actions/masters";
import { applyFormAlignment, previewFormAlignment } from "@/actions/form-align";
import { alignDraftForms } from "@/lib/form-align";

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
const employee = viewerOf(IDS.employee, "EMPLOYEE", "本人");

const FORBIDDEN_MESSAGE = "この操作を行う権限がありません。";
/** 内容を見た後に、アンケートか設定が保存されたときの文（DD-028 の6） */
const ALIGN_CONFLICT = "内容を見た後に、アンケートか設定が保存されました。もう一度内容を見てから、そろえてください。";

/** 次の期の回答の無い下書きと、人が手で足した設問 */
const NEXT_CYCLE = "cyc_next";
const NEXT_FORM = "frm_next";
const FREE_QUESTION = "fq_free_next";
/** 試しの回答（下書き）が1件ある下書き。回答のある下書きは作り直さない */
const TRIAL_CYCLE = "cyc_trial";
const TRIAL_FORM = "frm_trial";
/** 締め切った前の期のアンケートと、確定した評価 */
const OLD_CYCLE = "cyc_old";
const CLOSED_FORM = "frm_closed";
const FINALIZED_EVALUATION = "ev_finalized";

/** 見本の会社（scripts/sample-data.mjs の SAMPLE_COMPANY_ID）と、もう1つの他社 */
const SAMPLE_COMPANY = "cmp_sample";
const OTHER_COMPANY = "cmp_other";
const OTHER_COMPANIES = [SAMPLE_COMPANY, OTHER_COMPANY];

/** 下ごしらえの時刻。設定と下書きはここでそろっている */
const BASE = new Date("2026-10-01T00:00:00Z");
/** 後から保存した側の時刻 */
const LATER = new Date("2026-10-20T00:00:00Z");

const OLD_NAME = "創造性について";
const NEW_NAME = "挑戦する姿勢";

/** つながった設定の表（DD-028 の6。更新時刻の新しい方を決めるのに使う） */
const SETTING_TABLES = [
  "grades",
  "grade_requirements",
  "promotion_requirements",
  "behavior_guidelines",
  "behavior_levels",
  "kpi_items",
  "kpi_questions",
  "evaluation_schemes",
  "scheme_items",
];

type Question = typeof s.formQuestions.$inferSelect;

async function questionsOf(formId: string): Promise<Question[]> {
  return t.db.select().from(s.formQuestions).where(eq(s.formQuestions.formId, formId)).orderBy(asc(s.formQuestions.displayOrder));
}

const behaviorTitleOf = (rows: Question[]) => rows.find((q) => q.behaviorGuidelineId === IDS.guideline)?.title;

async function guidelineName(): Promise<string | undefined> {
  const [row] = await t.db.select({ aspectName: s.behaviorGuidelines.aspectName }).from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.id, IDS.guideline));
  return row?.aspectName;
}

/** 会社の設定の行の更新時刻をまとめて決める（$onUpdate に任せず、どちらが新しいかを試験で決める） */
function setSettingsUpdatedAt(companyId: string, at: Date) {
  for (const table of SETTING_TABLES) {
    t.raw.prepare(`UPDATE ${table} SET updated_at = ? WHERE company_id = ?`).run(at.getTime(), companyId);
  }
}

function setFormUpdatedAt(formId: string, at: Date) {
  t.raw.prepare("UPDATE forms SET updated_at = ? WHERE id = ?").run(at.getTime(), formId);
}

/** 下書きの設問を保存した時刻を決める。設問の保存は全ての行を入れ直すので、行の時刻とアンケートの時刻がそろって進む */
function setQuestionsSavedAt(formId: string, at: Date) {
  t.raw.prepare("UPDATE form_questions SET updated_at = ? WHERE form_id = ?").run(at.getTime(), formId);
  setFormUpdatedAt(formId, at);
}

/** 試験のテスト社の DB 全体を写す（dry-run の前後で比べる） */
function wholeDatabase(): string {
  const tables = t.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name")
    .all() as { name: string }[];
  return JSON.stringify(tables.map(({ name }) => [name, t.raw.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
}

/** 触れてはいけない行（締め切ったアンケート・回答のある下書き・確定した評価） */
async function untouchableSnapshot(): Promise<string> {
  return JSON.stringify({
    forms: await t.db.select().from(s.forms).where(inArray(s.forms.id, [CLOSED_FORM, TRIAL_FORM])).orderBy(asc(s.forms.id)),
    closed: await questionsOf(CLOSED_FORM),
    trial: await questionsOf(TRIAL_FORM),
    responses: await t.db.select().from(s.formResponses).orderBy(asc(s.formResponses.id)),
    evaluation: await t.db.select().from(s.evaluations).where(eq(s.evaluations.id, FINALIZED_EVALUATION)),
  });
}

/** 他社（見本の会社を含む）の行 */
async function otherCompaniesSnapshot(): Promise<string> {
  return JSON.stringify({
    forms: await t.db.select().from(s.forms).where(inArray(s.forms.companyId, OTHER_COMPANIES)).orderBy(asc(s.forms.id)),
    questions: await t.db.select().from(s.formQuestions).where(inArray(s.formQuestions.companyId, OTHER_COMPANIES)).orderBy(asc(s.formQuestions.id)),
    guidelines: await t.db
      .select()
      .from(s.behaviorGuidelines)
      .where(inArray(s.behaviorGuidelines.companyId, OTHER_COMPANIES))
      .orderBy(asc(s.behaviorGuidelines.id)),
    events: await t.db
      .select()
      .from(s.constitutionEvents)
      .where(inArray(s.constitutionEvents.companyId, OTHER_COMPANIES))
      .orderBy(asc(s.constitutionEvents.id)),
  });
}

function messageOf(result: unknown): string {
  return (result as { message: string }).message;
}

const plan = (dryRun: boolean) => alignDraftForms(t.db, { companyId: IDS.company, dryRun, actorId: admin.id });
const formIdsOf = (items: { formId: string }[]) => items.map((i) => i.formId).sort();

/** 他社の行。どれも自分の会社の行動指針とずれた下書きを持つ（会社で絞り忘れると、一覧に混ざる） */
async function seedOtherCompany(companyId: string, name: string) {
  const id = (x: string) => `${x}_${companyId}`;
  await t.db.insert(s.companies).values({ id: companyId, name, slug: companyId });
  await t.db.insert(s.grades).values({
    id: id("grd"),
    companyId,
    code: "regular",
    name: "等級２：Regular",
    pointGroup: "Regular",
    displayOrder: 2,
    targetCap: 5,
    behaviorBand: "g1_2",
  });
  await t.db.insert(s.evaluationSchemes).values({ id: id("sch"), companyId, name: "2026年度", status: "active" });
  await t.db.insert(s.evaluationCycles).values({
    id: id("cyc"),
    companyId,
    name: "2026年度下期",
    periodStart: "2026-10-01",
    periodEnd: "2027-03-31",
    schemeId: id("sch"),
    status: "open",
  });
  await t.db.insert(s.behaviorGuidelines).values({
    id: id("bg"),
    companyId,
    band: "g1_2",
    aspect: "creativity",
    aspectName: "その会社の観点",
    seq: 1,
  });
  await t.db.insert(s.forms).values({
    id: id("frm"),
    companyId,
    gradeId: id("grd"),
    cycleId: id("cyc"),
    title: "2026年度下期 Regular",
    status: "draft",
    publicToken: id("tok"),
  });
  await t.db.insert(s.formQuestions).values({
    id: id("fq"),
    companyId,
    formId: id("frm"),
    section: "behavior",
    questionType: "single",
    title: "以前の観点の名前",
    displayOrder: 1,
    behaviorGuidelineId: id("bg"),
  });
  setSettingsUpdatedAt(companyId, LATER);
  setQuestionsSavedAt(id("frm"), BASE);
}

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
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
  await t.db.insert(s.behaviorLevels).values(
    [3, 2, 1].map((score) => ({ id: `blv_${score}`, companyId: IDS.company, guidelineId: IDS.guideline, score, label: `段階${score}`, text: "説明" })),
  );

  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();

  await t.db.insert(s.evaluationCycles).values([
    { id: NEXT_CYCLE, companyId: IDS.company, name: "2026年度下期", periodStart: "2026-10-01", periodEnd: "2027-03-31", schemeId: IDS.scheme, status: "open" },
    { id: TRIAL_CYCLE, companyId: IDS.company, name: "2027年度上期", periodStart: "2027-04-01", periodEnd: "2027-09-30", schemeId: IDS.scheme, status: "open" },
    { id: OLD_CYCLE, companyId: IDS.company, name: "2025年度下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", schemeId: IDS.scheme, status: "closed" },
  ]);
  await t.db.insert(s.forms).values([
    { id: NEXT_FORM, companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: NEXT_CYCLE, title: "2026年度下期 Regular", status: "draft", publicToken: "tok_next" },
    { id: TRIAL_FORM, companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: TRIAL_CYCLE, title: "2027年度上期 Regular", status: "draft", publicToken: "tok_trial" },
    { id: CLOSED_FORM, companyId: IDS.company, gradeId: IDS.gradeFrom, cycleId: OLD_CYCLE, title: "2025年度下期 Regular", status: "closed", publicToken: "tok_closed" },
  ]);

  // 今の期と次の期と試しの期の下書きを、設定から作る（どれも設定とそろった状態から始める）
  await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
  for (const formId of [IDS.form, NEXT_FORM, TRIAL_FORM]) {
    expect(await rebuildFormQuestions({ formId })).toMatchObject({ ok: true });
  }
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
      title: OLD_NAME,
      displayOrder: 1,
      behaviorGuidelineId: IDS.guideline,
    },
  ]);
  // 試しの期の下書きには、試しの回答が1件ある（状態を問わず回答があれば作り直さない）
  await t.db.insert(s.formResponses).values({
    id: "res_trial",
    companyId: IDS.company,
    formId: TRIAL_FORM,
    cycleId: TRIAL_CYCLE,
    employeeId: IDS.employee,
    gradeId: IDS.gradeFrom,
    officeId: IDS.office,
    status: "draft",
  });
  // 前の期の評価は確定している
  await t.db.insert(s.evaluations).values({
    id: FINALIZED_EVALUATION,
    companyId: IDS.company,
    cycleId: OLD_CYCLE,
    employeeId: IDS.employee,
    gradeId: IDS.gradeFrom,
    schemeId: IDS.scheme,
    evaluatorId: IDS.evaluator,
    status: "finalized",
    totalScore: 72,
    finalizedAt: new Date("2026-04-10T00:00:00Z"),
  });

  await seedOtherCompany(SAMPLE_COMPANY, "見本の会社");
  await seedOtherCompany(OTHER_COMPANY, "ほかの会社");

  setSettingsUpdatedAt(IDS.company, BASE);
  for (const formId of [IDS.form, NEXT_FORM, TRIAL_FORM, CLOSED_FORM]) setQuestionsSavedAt(formId, BASE);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

/** 行動指針の割り当てを既定へ戻す移行。本番と同じファイルを、文の区切りごとに流す */
const MIGRATION_0040 = readFileSync(join(process.cwd(), "drizzle/migrations/0040_behavior_band_defaults.sql"), "utf8")
  .split("--> statement-breakpoint")
  .filter((st) => st.trim() !== "");

/** 設定の側を後から保存した（行動指針の名前を変えた） */
async function settingsSavedLater() {
  await t.db.update(s.behaviorGuidelines).set({ aspectName: NEW_NAME, updatedAt: LATER }).where(eq(s.behaviorGuidelines.id, IDS.guideline));
}

/** 下書きの側を後から保存した（今の期の下書きで、行動指針の設問の文を直した） */
async function draftSavedLater() {
  const behavior = (await questionsOf(IDS.form)).find((q) => q.behaviorGuidelineId === IDS.guideline);
  expect(behavior).toBeDefined();
  t.raw.prepare("UPDATE form_questions SET title = ? WHERE id = ?").run(NEW_NAME, behavior!.id);
  setQuestionsSavedAt(IDS.form, LATER);
}

describe("下ごしらえ", () => {
  it("設定とそろった下書きだけなら、ずれは0件で何も書かない", async () => {
    const before = wholeDatabase();
    const result = await plan(true);
    expect(result.items).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(wholeDatabase()).toBe(before);
  });
});

describe("設定が新しければ、下書きを作り直す", () => {
  it("dry-run は書かずに、ずれた下書きの件数と一覧を返す", async () => {
    await settingsSavedLater();
    const before = wholeDatabase();

    const result = await plan(true);

    expect(formIdsOf(result.items)).toEqual([IDS.form, NEXT_FORM].sort());
    for (const item of result.items) expect(item.direction).toBe("toForm");
    expect(result.items.map((i) => i.title)).toEqual(expect.arrayContaining(["2026年度上期 Regular", "2026年度下期 Regular"]));
    expect(result.planKey).toEqual(expect.any(String));
    expect(result.planKey).not.toBe("");
    expect(wholeDatabase()).toBe(before);
  });

  it("行動段階の保存後に追従が失敗しても、整列で新しい設定として選択肢を復旧できる", async () => {
    // 設問保存より新しいのは段階だけ。他の設定の時刻では向きを決められない状況を作る。
    setQuestionsSavedAt(IDS.form, new Date(BASE.getTime() + 1_000));
    const prepare = t.raw.prepare.bind(t.raw);
    let injected = false;
    vi.spyOn(t.raw, "prepare").mockImplementation((sql) => {
      if (!injected && sql.includes('from "forms" inner join "evaluation_cycles"')) {
        injected = true;
        throw new Error("行動段階保存後の追従読取失敗（試験）");
      }
      return prepare(sql);
    });
    const saved = await saveMaster({ kind: "behaviorLevel", id: "blv_3", label: "新しい段階" });
    expect(injected).toBe(true);
    expect(saved).toMatchObject({ ok: true });
    expect(messageOf(saved)).toContain("アンケートをいまの設定に合わせられませんでした");
    expect((await questionsOf(IDS.form)).find((q) => q.behaviorGuidelineId === IDS.guideline)?.optionsJson).not.toContain("新しい段階");

    const preview = await plan(true);
    expect(preview.items).toContainEqual(expect.objectContaining({ formId: IDS.form, direction: "toForm" }));
    await plan(false);

    const restored = (await questionsOf(IDS.form)).find((q) => q.behaviorGuidelineId === IDS.guideline);
    expect(restored?.optionsJson).toContain("新しい段階");
    expect((await plan(true)).items).toEqual([]);
  });

  it("本流しで下書きが新しい名前になり、手で足した設問は残る。2回目の dry-run は0件", async () => {
    await settingsSavedLater();

    const result = await plan(false);
    expect(formIdsOf(result.items)).toEqual([IDS.form, NEXT_FORM].sort());

    expect(behaviorTitleOf(await questionsOf(IDS.form))).toBe(NEW_NAME);
    const next = await questionsOf(NEXT_FORM);
    expect(behaviorTitleOf(next)).toBe(NEW_NAME);
    expect(next.find((q) => q.id === FREE_QUESTION)).toMatchObject({ section: "free", title: "半期で工夫したこと", displayOrder: 999 });
    // 設定の側は変えない
    expect(await guidelineName()).toBe(NEW_NAME);

    const again = await plan(true);
    expect(again.items).toEqual([]);
  });

  it("設定を保存した後に締切と題だけを直した下書きは、作り直す側に出て、設定を変えない（向きは設問の保存の時刻で決める）", async () => {
    await settingsSavedLater();
    expect(await updateForm({ formId: IDS.form, title: "題を直した下書き", closesAt: "2026-12-31" })).toMatchObject({ ok: true });
    // 締切と題の直しでアンケートの時刻は設定より新しくなるが、設問は書いていない
    const [form] = await t.db.select().from(s.forms).where(eq(s.forms.id, IDS.form));
    expect(form.updatedAt.getTime()).toBeGreaterThan(LATER.getTime());

    expect((await plan(true)).items.find((i) => i.formId === IDS.form)).toMatchObject({ direction: "toForm" });
    await plan(false);
    expect(await guidelineName()).toBe(NEW_NAME);
    expect(behaviorTitleOf(await questionsOf(IDS.form))).toBe(NEW_NAME);
  });

  it("締め切ったアンケート・回答のある下書き・確定した評価には触れず、一覧にも出さない", async () => {
    await settingsSavedLater();
    const kept = await untouchableSnapshot();

    const preview = await plan(true);
    expect(formIdsOf(preview.items)).not.toContain(CLOSED_FORM);
    expect(formIdsOf(preview.items)).not.toContain(TRIAL_FORM);

    await plan(false);
    expect(await untouchableSnapshot()).toBe(kept);
    expect(behaviorTitleOf(await questionsOf(CLOSED_FORM))).toBe(OLD_NAME);
  });
});

describe("下書きが新しければ、設定へ反映する", () => {
  it("dry-run は書かずに、設定へ反映する下書きとして返す", async () => {
    await draftSavedLater();
    const before = wholeDatabase();

    const result = await plan(true);

    expect(result.items).toEqual([expect.objectContaining({ formId: IDS.form, direction: "toSettings" })]);
    expect(wholeDatabase()).toBe(before);
  });

  it("本流しで設定の名前が直した文になり、ほかの回答の無い下書きも追従する。2回目の dry-run は0件", async () => {
    await draftSavedLater();

    const result = await plan(false);
    expect(result.items).toEqual([expect.objectContaining({ formId: IDS.form, direction: "toSettings" })]);

    expect(await guidelineName()).toBe(NEW_NAME);
    // I28 の保存と同じ経路を通るので、その後の追従（I29）で次の期の下書きも新しい名前になる
    const next = await questionsOf(NEXT_FORM);
    expect(behaviorTitleOf(next)).toBe(NEW_NAME);
    expect(next.find((q) => q.id === FREE_QUESTION)).toBeDefined();

    const again = await plan(true);
    expect(again.items).toEqual([]);
  });

  it("先に書込みが失敗した下書きは、後の下書きから設定を反映しても作り直さない", async () => {
    await draftSavedLater();
    t.raw.prepare("UPDATE form_questions SET title = ? WHERE form_id = ? AND behavior_guideline_id = ?")
      .run("後の下書きの観点", NEXT_FORM, IDS.guideline);
    setQuestionsSavedAt(NEXT_FORM, new Date(LATER.getTime() - 1_000));
    const kept = await questionsOf(IDS.form);
    vi.spyOn(t.db, "batch").mockRejectedValueOnce(new Error("先行の書込み失敗（試験）"));

    const result = await plan(false);

    expect(result.failed).toEqual([expect.objectContaining({ formId: IDS.form })]);
    expect(result.items).toEqual([expect.objectContaining({ formId: NEXT_FORM, direction: "toSettings" })]);
    expect(await guidelineName()).toBe("後の下書きの観点");
    expect(await questionsOf(IDS.form)).toEqual(kept);
  });

  it("設定へ反映した変更は、そろえた人の制度の変更として記録に残る", async () => {
    await draftSavedLater();
    await plan(false);

    const events = await t.db
      .select()
      .from(s.constitutionEvents)
      .where(and(eq(s.constitutionEvents.companyId, IDS.company), eq(s.constitutionEvents.entityType, "behaviorGuideline")));
    expect(events).toEqual([expect.objectContaining({ entityId: IDS.guideline, eventType: "updated", actorId: admin.id })]);
    expect(events[0].afterJson).toContain(NEW_NAME);
  });

  it("設定の決まりに合わない反映は断り、理由と直す画面の場所を付けて「そろえられなかった」に数える", async () => {
    // 計算式が使う聞くこと（所定時間）を下書きから外した
    t.raw.prepare("DELETE FROM form_questions WHERE form_id = ? AND kpi_question_key = 'q2_2'").run(IDS.form);
    setQuestionsSavedAt(IDS.form, LATER);
    const kept = wholeDatabase();

    const result = await plan(false);

    expect(result.items).toEqual([]);
    expect(result.failed).toEqual([
      expect.objectContaining({ formId: IDS.form, fixHref: kpiItemPath(IDS.itemHigher), reason: expect.stringContaining("計算式") }),
    ]);
    expect(wholeDatabase()).toBe(kept);
  });

  it("いまの設定から作る設問に無い紐づけの設問は、写し方が決まらないので断り、アンケートの画面を示す", async () => {
    // 設定に無い聞くことの key を指す設問（使わなくなった項目への設問の代わり）
    const [asked] = (await questionsOf(IDS.form)).filter((q) => q.kpiQuestionKey !== null);
    t.raw.prepare("UPDATE form_questions SET kpi_question_key = 'q_gone' WHERE id = ?").run(asked.id);
    setQuestionsSavedAt(IDS.form, LATER);
    const kept = wholeDatabase();

    const result = await plan(false);

    expect(result.items).toEqual([]);
    expect(result.failed).toEqual([
      expect.objectContaining({ formId: IDS.form, fixHref: `/admin/forms/${IDS.form}`, reason: expect.stringContaining(`「${asked.title}」`) }),
    ]);
    expect(wholeDatabase()).toBe(kept);
  });
});

describe("会社の境界", () => {
  it("見本の会社と他社のずれた下書きは、一覧に出さず、本流しでも変えない", async () => {
    await settingsSavedLater();
    const kept = await otherCompaniesSnapshot();

    const preview = await plan(true);
    for (const item of [...preview.items, ...preview.failed]) expect(item.formId).not.toMatch(/cmp_(sample|other)$/);

    await plan(false);
    expect(await otherCompaniesSnapshot()).toBe(kept);
  });

  it("見本の会社をそろえても、試験の会社と他社の行は変えない", async () => {
    const keptOther = JSON.stringify(
      await t.db.select().from(s.formQuestions).where(eq(s.formQuestions.companyId, OTHER_COMPANY)).orderBy(asc(s.formQuestions.id)),
    );
    const keptTest = JSON.stringify(
      await t.db.select().from(s.formQuestions).where(eq(s.formQuestions.companyId, IDS.company)).orderBy(asc(s.formQuestions.id)),
    );

    await alignDraftForms(t.db, { companyId: SAMPLE_COMPANY, dryRun: false, actorId: "usr_sample_admin" });

    expect(
      JSON.stringify(await t.db.select().from(s.formQuestions).where(eq(s.formQuestions.companyId, OTHER_COMPANY)).orderBy(asc(s.formQuestions.id))),
    ).toBe(keptOther);
    expect(
      JSON.stringify(await t.db.select().from(s.formQuestions).where(eq(s.formQuestions.companyId, IDS.company)).orderBy(asc(s.formQuestions.id))),
    ).toBe(keptTest);
  });
});

describe("サーバー処理（権限・409・結果の文）", () => {
  it("内容を見る → そろえる、で結果の文に件数と名前が出る", async () => {
    await settingsSavedLater();

    const preview = await previewFormAlignment();
    expect(preview).toMatchObject({ ok: true });
    const { planKey, items } = preview as unknown as { planKey: string; items: { formId: string }[] };
    expect(formIdsOf(items)).toEqual([IDS.form, NEXT_FORM].sort());

    const applied = await applyFormAlignment({ planKey });
    expect(applied).toMatchObject({ ok: true });
    expect(messageOf(applied)).toContain("2件");
    expect(messageOf(applied)).toContain("2026年度下期 Regular");
    expect(behaviorTitleOf(await questionsOf(NEXT_FORM))).toBe(NEW_NAME);
  });

  it.each([
    ["社員", employee],
    ["上長", manager],
  ])("%sの権限では、内容を見ることも、そろえることも断る", async (_label, viewer) => {
    await settingsSavedLater();
    mocked.viewer = viewer;
    const before = wholeDatabase();

    const preview = await previewFormAlignment();
    expect(preview).toMatchObject({ ok: false });
    expect(messageOf(preview)).toBe(FORBIDDEN_MESSAGE);

    const applied = await applyFormAlignment({ planKey: "any" });
    expect(applied).toMatchObject({ ok: false });
    expect(messageOf(applied)).toBe(FORBIDDEN_MESSAGE);
    expect(wholeDatabase()).toBe(before);
  });

  it("内容を見た後に設定が保存されていたら 409 で断り、何も変えない", async () => {
    await settingsSavedLater();
    const preview = await previewFormAlignment();
    const { planKey } = preview as unknown as { planKey: string };

    // 内容を見た後に、別の人が行動指針の名前をもう一度変えた
    await t.db
      .update(s.behaviorGuidelines)
      .set({ aspectName: "挑戦と工夫", updatedAt: new Date("2026-10-21T00:00:00Z") })
      .where(eq(s.behaviorGuidelines.id, IDS.guideline));
    const before = wholeDatabase();

    const applied = await applyFormAlignment({ planKey });
    expect(applied).toMatchObject({ ok: false });
    expect(messageOf(applied)).toBe(ALIGN_CONFLICT);
    expect(wholeDatabase()).toBe(before);
  });

  it("内容を見た後に下書きが保存されていたら 409 で断る", async () => {
    await settingsSavedLater();
    const preview = await previewFormAlignment();
    const { planKey } = preview as unknown as { planKey: string };

    setQuestionsSavedAt(NEXT_FORM, new Date("2026-10-21T00:00:00Z"));

    const applied = await applyFormAlignment({ planKey });
    expect(applied).toMatchObject({ ok: false });
    expect(messageOf(applied)).toBe(ALIGN_CONFLICT);
  });
});

describe("0040 の後（行動指針の割り当てを既定へ戻す移行・DD-026 の5）", () => {
  it("移行が書き換えた等級の下書きは、設定の側が新しいとして作り直す一覧に出る", async () => {
    // 0040 は既定の2つのまとまりがそろった会社だけを書き換えるので、まとまりと等級3・4の観点を足す
    await t.db.insert(s.behaviorBandSets).values([
      { id: "bbs_g12", companyId: IDS.company, code: "g1_2", name: "等級1・2", displayOrder: 1 },
      { id: "bbs_g34", companyId: IDS.company, code: "g3_4", name: "等級3・4", displayOrder: 2 },
    ]);
    await t.db
      .insert(s.behaviorGuidelines)
      .values({ id: "bg_g34", companyId: IDS.company, band: "g3_4", aspect: "leadership", aspectName: "周りを動かす", seq: 1 });
    await t.db.insert(s.behaviorLevels).values(
      [3, 2, 1].map((score) => ({ id: `blv_g34_${score}`, companyId: IDS.company, guidelineId: "bg_g34", score, label: `段階${score}`, text: "説明" })),
    );
    // 等級2が等級3・4のまとまりへずれていた間に、下書きを作った（下書きは設定より新しく、そろっている）
    await t.db.update(s.grades).set({ behaviorBand: "g3_4" }).where(eq(s.grades.id, IDS.gradeFrom));
    for (const formId of [IDS.form, NEXT_FORM]) expect(await rebuildFormQuestions({ formId })).toMatchObject({ ok: true });
    setSettingsUpdatedAt(IDS.company, BASE);
    for (const formId of [IDS.form, NEXT_FORM]) setQuestionsSavedAt(formId, LATER);
    expect((await plan(true)).items).toEqual([]);

    for (const statement of MIGRATION_0040) t.raw.exec(statement);

    // 移行は割り当てを戻し、更新の時刻を移行の時刻（下書きより後）にする
    const [grade] = await t.db.select().from(s.grades).where(eq(s.grades.id, IDS.gradeFrom));
    expect(grade.behaviorBand).toBe("g1_2");
    expect(grade.updatedAt.getTime()).toBeGreaterThan(LATER.getTime());

    const result = await plan(true);
    expect(formIdsOf(result.items)).toEqual([IDS.form, NEXT_FORM].sort());
    for (const item of result.items) expect(item.direction).toBe("toForm");

    // 本流しで、下書きの行動指針の設問が既定のまとまりの観点へ戻る
    await plan(false);
    for (const formId of [IDS.form, NEXT_FORM]) {
      const behavior = (await questionsOf(formId)).filter((q) => q.section === "behavior").map((q) => q.behaviorGuidelineId);
      expect(behavior).toContain(IDS.guideline);
      expect(behavior).not.toContain("bg_g34");
    }
    expect((await plan(true)).items).toEqual([]);
  });
});
