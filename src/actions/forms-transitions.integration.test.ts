import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { operationRefusal } from "@/lib/domain/form-transitions";

/*
 * アンケートの状態ごとに許す操作を、API の側で確かめる（qa-y10-y16 の16・版の会社スコープ）。
 *
 * 規則そのもの（状態 × 締切の前後 × 回答の有無）は src/lib/domain/form-transitions.test.ts が全部の組で持つ。
 * ここでは、その規則が updateForm・grantFormExtension・回答一覧の催促の判定に実際につながっているかを、
 * 本物の D1 相当（sqlite）で見る。
 *  - 断る遷移: 締め切り済み→公開中、下書き→締め切り済み、公開中→下書き。締め切り済みの回答期間の変更。
 *  - 版の締め切りと採番は会社で閉じる: 他社の行が同じ評価期間・等級の id を持っていても、締めず、番号にも数えない。
 *  - 延長と催促は、下書き・締め切り済み・評価期間の終了では断る（断る文は、画面に無い「公開中に戻す」を案内しない）。
 *
 * 見本には配点ルールが無く、評価セットの準備の確認が 409 になるので、その確認だけを「準備済み」に差し替える。
 * 公開の前の「聞き方が古い設問」の確認も、見本では読み出す材料が無いので「無し」に差し替える。
 */

const COMPANY_B = "cmp_b";

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
vi.mock("@/lib/scheme-readiness", () => ({
  loadSchemeReadiness: async () => ({ schemeReady: true, schemeGaps: [], schemeMessage: "", groups: [] }),
}));
vi.mock("@/lib/stale-asking-loader", () => ({ loadStaleAsking: async () => new Map() }));

import { createForms, rebuildFormQuestions, saveFormQuestions, updateForm } from "@/actions/forms";
import { grantFormExtension } from "@/actions/form-extensions";
import { getForm } from "@/lib/queries";

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

beforeEach(async () => {
  t = createTestDatabase();
  t.raw.exec("PRAGMA foreign_keys = ON");
  await seedCompany(t);
  await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
  seedMemberships(t);
  await t.db.insert(s.companies).values({ id: COMPANY_B, name: "B社", slug: "b" });
  mocked.viewer = admin;
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

async function statusOf(formId: string) {
  return (await t.db.select({ status: s.forms.status }).from(s.forms).where(eq(s.forms.id, formId)))[0]?.status;
}

async function setStatus(formId: string, status: "draft" | "published" | "closed") {
  await t.db.update(s.forms).set({ status }).where(eq(s.forms.id, formId));
}

/** 見本の Regular（第1版・公開中）の後に、自社の第2版の下書きを足す。設問を1問持たせ、公開できる形にする */
async function insertDraftV2() {
  await t.db.insert(s.forms).values({
    id: "frm_v2",
    companyId: IDS.company,
    gradeId: IDS.gradeFrom,
    cycleId: IDS.cycle,
    title: "",
    version: 2,
    status: "draft",
    publicToken: "tok_v2",
  });
  await t.db.insert(s.formQuestions).values({
    id: "q_v2",
    companyId: IDS.company,
    formId: "frm_v2",
    section: "kpi",
    questionType: "number",
    title: "稼働率",
    displayOrder: 1,
  });
}

/** 他社の公開中のアンケート。評価期間・等級の id だけを見本の会社と同じにする（会社の絞り込みが外れると巻き込まれる形） */
async function insertOtherCompanyForm(version: number) {
  await t.db.insert(s.forms).values({
    id: "frm_b",
    companyId: COMPANY_B,
    gradeId: IDS.gradeFrom,
    cycleId: IDS.cycle,
    title: "B社のアンケート",
    version,
    status: "published",
    publicToken: "tok_b",
  });
}

// 中では HttpError(400) で断るが、画面へ返る形（ActionFail）は状態コードを持たない。
// 断られたことは ok と理由の文、そして行が変わっていないことで確かめる
describe("状態の変更は 下書き → 公開中 → 締め切り済み の一方向", () => {
  it("締め切り済み→公開中 は断り、新しい版と、締め切らずに延ばす道を案内する", async () => {
    await setStatus(IDS.form, "closed");

    const result = await updateForm({ formId: IDS.form, status: "published" });

    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("締め切ったアンケートは公開中に戻せません");
    expect(result.message).toContain("新しい版を作って公開してください");
    expect(await statusOf(IDS.form)).toBe("closed");
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("下書き→締め切り済み は断り、下書きのまま残す", async () => {
    await insertDraftV2();

    const result = await updateForm({ formId: "frm_v2", status: "closed" });

    expect(result).toMatchObject({
      ok: false,
      message: "まだ公開していないアンケートは締め切れません。配らないときは、下書きのまま置いておけます。",
    });
    expect(await statusOf("frm_v2")).toBe("draft");
  });

  it("公開中→下書き は断る（公開した版は読まれている可能性がある）", async () => {
    const result = await updateForm({ formId: IDS.form, status: "draft" });

    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("公開済みのアンケートは下書きに戻せません");
    expect(await statusOf(IDS.form)).toBe("published");
  });

  it("締め切り済みの回答期間は変えられない（変えても受け付けを再開しない）", async () => {
    await setStatus(IDS.form, "closed");

    const result = await updateForm({ formId: IDS.form, closesAt: "2026-10-31" });

    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("締め切ったアンケートは回答期間を変えられません");
    const row = (await t.db.select({ closesAt: s.forms.closesAt }).from(s.forms).where(eq(s.forms.id, IDS.form)))[0];
    expect(row?.closesAt).toBeNull();
  });

  it("公開中→締め切り済み は通す（通す組が断られていないことの確かめ）", async () => {
    const result = await updateForm({ formId: IDS.form, status: "closed" });

    expect(result).toMatchObject({ ok: true });
    expect(await statusOf(IDS.form)).toBe("closed");
  });
});

describe("版の締め切りと採番は会社で閉じる", () => {
  it("第2版を公開すると自社の第1版だけが締め切られ、同じ id を持つ他社の公開中は触らない", async () => {
    await insertDraftV2();
    await insertOtherCompanyForm(5);

    const result = await updateForm({ formId: "frm_v2", status: "published" });

    expect(result).toMatchObject({ ok: true });
    expect(await statusOf("frm_v2")).toBe("published");
    expect(await statusOf(IDS.form)).toBe("closed");
    expect(await statusOf("frm_b")).toBe("published");
  });

  it("新しい版の番号は自社の版だけから振る（他社の第7版を数えない）", async () => {
    await insertOtherCompanyForm(7);

    const result = await createForms({ cycleId: IDS.cycle, gradeIds: [IDS.gradeFrom] });

    expect(result).toMatchObject({ ok: true });
    const mine = await t.db
      .select({ version: s.forms.version })
      .from(s.forms)
      .where(eq(s.forms.companyId, IDS.company));
    expect(mine.map((r) => r.version).sort((a, b) => a - b)).toEqual([1, 2]);
  });
});

describe("延長は、下書き・締め切り済み・評価期間の終了では断る", () => {
  const extend = (formId: string) =>
    grantFormExtension({ formId, employeeId: IDS.employee, extendedUntil: "2099-12-31", reason: "長期休暇のため" });

  async function extensionCount() {
    return (await t.db.select({ id: s.formDeadlineExtensions.id }).from(s.formDeadlineExtensions)).length;
  }

  it("下書きは、公開してからと伝えて断る", async () => {
    await insertDraftV2();

    const result = await extend("frm_v2");

    expect(result).toMatchObject({
      ok: false,
      message: "このアンケートはまだ公開されていません。公開してから期限を延ばしてください。",
    });
    expect(await extensionCount()).toBe(0);
  });

  it("締め切り済みは断り、画面に無い「公開中に戻す」は案内しない", async () => {
    await setStatus(IDS.form, "closed");

    const result = await extend(IDS.form);

    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("締め切ったアンケートは期限を延ばせません");
    expect(result.message).toContain("新しい版を作って公開してください");
    expect(result.message).not.toContain("公開中に戻");
    expect(await extensionCount()).toBe(0);
  });

  it("公開中でも、評価期間が終了していれば断る", async () => {
    await t.db.update(s.evaluationCycles).set({ status: "closed" }).where(eq(s.evaluationCycles.id, IDS.cycle));

    const result = await extend(IDS.form);

    expect(result).toMatchObject({ ok: false, message: "この評価期間は終了しているため、期限を延ばせません。" });
    expect(await extensionCount()).toBe(0);
  });

  it("公開中で評価期間が受付中なら延ばせる（通す組が断られていないことの確かめ）", async () => {
    const result = await extend(IDS.form);

    expect(result).toMatchObject({ ok: true });
    expect(await extensionCount()).toBe(1);
  });
});

describe("催促の文面は、下書き・締め切り済みでは出さない（回答一覧の画面と同じ読み出し）", () => {
  /** 回答一覧の画面（/admin/forms/[id]/responses）と同じく、getForm の行から催促を出すかを決める */
  async function remindRefusalOf(formId: string) {
    const form = await getForm(IDS.company, formId);
    if (!form) throw new Error("アンケートが見つからない");
    return operationRefusal("remind", form.status, { closesAt: form.closesAt, now: new Date(), cycleStatus: form.cycleStatus }, false);
  }

  it("公開中（期限なし・評価期間は受付中）は出す", async () => {
    expect(await remindRefusalOf(IDS.form)).toBeNull();
  });

  it("下書きは出さない", async () => {
    await insertDraftV2();
    expect(await remindRefusalOf("frm_v2")).toContain("まだ公開していないため、催促の文面は出しません");
  });

  it("締め切り済みは出さない", async () => {
    await setStatus(IDS.form, "closed");
    expect(await remindRefusalOf(IDS.form)).toContain("締め切ったため、催促の文面は出しません");
  });

  it("評価期間が終了していれば、公開中でも出さない（getForm が評価期間の状態を返している）", async () => {
    await t.db.update(s.evaluationCycles).set({ status: "closed" }).where(eq(s.evaluationCycles.id, IDS.cycle));
    expect(await remindRefusalOf(IDS.form)).toBe("この評価期間は終了しているため、催促の文面は出しません。");
  });
});


describe("内容の編集と終了済み評価期間の案内", () => {
  it.each(["draft", "published", "closed"] as const)("%s: 終了済み評価期間では新しい版の作成を勧めず保存しない", async (status) => {
    await setStatus(IDS.form, status);
    await t.db.update(s.evaluationCycles).set({ status: "closed" }).where(eq(s.evaluationCycles.id, IDS.cycle));
    if (status === "draft") {
      await t.db.insert(s.formResponses).values({ id: "response", companyId: IDS.company, formId: IDS.form, cycleId: IDS.cycle, employeeId: IDS.employee, gradeId: IDS.gradeFrom });
    }
    const result = await updateForm({ formId: IDS.form, title: "変更" });
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("この評価期間は終了しているため");
    expect(result.message).not.toContain("新しい版を作ってください");
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it.each(["published", "draft"] as const)("終了済み評価期間のclosed→%sで使えない新しい版を案内しない", async (status) => {
    await setStatus(IDS.form, "closed");
    await t.db.update(s.evaluationCycles).set({ status: "closed" }).where(eq(s.evaluationCycles.id, IDS.cycle));
    const result = await updateForm({ formId: IDS.form, status });
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("この評価期間は終了しているため");
    expect(result.message).not.toContain("新しい版を作って公開してください");
  });
});


describe("内容の変更は3つの入口で同じ版を守る", () => {
  const operations = [
    { name: "タイトル・説明", run: () => updateForm({ formId: IDS.form, title: "変更", description: "変更" }), responseReason: "タイトルと説明文を変更できません" },
    { name: "設問の保存", run: () => saveFormQuestions({ formId: IDS.form, questions: [{ section: "free", questionType: "text", title: "追加", required: false }] }), responseReason: "設問を変更できません" },
    { name: "制度から作り直し", run: () => rebuildFormQuestions({ formId: IDS.form }), responseReason: "設問を作り直せません" },
  ];
  it.each(operations)("$name: 回答のある下書きを拒否し、原本を保つ", async ({ run, responseReason }) => {
    await setStatus(IDS.form, "draft");
    await t.db.insert(s.formResponses).values({ id: "response", companyId: IDS.company, formId: IDS.form, cycleId: IDS.cycle, employeeId: IDS.employee, gradeId: IDS.gradeFrom });
    const forms = await t.db.select().from(s.forms);
    const questions = await t.db.select().from(s.formQuestions);
    const result = await run();
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain(responseReason);
    expect(result.message).toContain("新しい版");
    expect(await t.db.select().from(s.forms)).toEqual(forms);
    expect(await t.db.select().from(s.formQuestions)).toEqual(questions);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
  it.each(operations)("$name: 回答0件でも公開済みなら拒否する", async ({ run }) => {
    const result = await run();
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("断られるはず");
    expect(result.message).toContain("公開中のため、内容を変更できません");
    expect(mocked.refresh).not.toHaveBeenCalled();
  });
  it("回答0件の下書きはタイトル・説明を保存できる", async () => {
    await setStatus(IDS.form, "draft");
    expect(await updateForm({ formId: IDS.form, title: "新しい題名", description: "説明" })).toMatchObject({ ok: true });
    const row = (await t.db.select().from(s.forms).where(eq(s.forms.id, IDS.form)))[0];
    expect(row).toMatchObject({ title: "新しい題名", description: "説明" });
  });
});
