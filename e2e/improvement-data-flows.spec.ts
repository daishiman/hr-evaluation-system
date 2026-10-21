import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { signIn, switchCompany, waitForHydration } from "./support";

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => { fixture = improvementFixture(); });
test.afterEach(() => fixture?.close());

async function confirm(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
}

test("選択肢を押して提出し、再読込とDB・管理者の提出状況で同じ回答になる（A7・A11）", async ({ browser, page }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  try {
    const employee = await context.newPage();
    await signIn(employee, fixture.employee.account);
    await employee.goto(`/me/forms/${fixture.formId}`);
    await waitForHydration(employee, "main button");
    const single = employee.getByRole("group", { name: "今回の選択" });
    await single.getByRole("button", { name: "乙", exact: true }).click();
    await expect(single.getByRole("button", { name: "乙", exact: true })).toHaveAttribute("aria-pressed", "true");
    await employee.getByRole("group", { name: "複数の選択" }).getByRole("checkbox", { name: "甲", exact: true }).check();
    await employee.getByRole("button", { name: "内容を確認して提出する", exact: true }).click();
    await employee.getByRole("button", { name: "提出する", exact: true }).click();
    await expect.poll(() => fixture.db.prepare("SELECT status FROM form_responses WHERE form_id = ? AND employee_id = ?").get(fixture.formId, fixture.employee.id)).toMatchObject({ status: "submitted" });
    const answer = fixture.db.prepare("SELECT a.value_text, a.value_json FROM form_answers a JOIN form_responses r ON r.id=a.response_id WHERE r.form_id=? AND r.employee_id=? ORDER BY a.question_id").all(fixture.formId, fixture.employee.id);
    expect(answer).toEqual([{ value_text: "甲", value_json: '["a"]' }, { value_text: "乙", value_json: null }]);
    await employee.reload();
    await expect(employee.locator("main")).toContainText("乙");
    await page.goto("/admin/forms");
    await switchCompany(page, fixture.company.name);
    await page.goto(`/admin/forms/${fixture.formId}/responses`);
    const submitted = page.getByRole("row").filter({ hasText: fixture.employee.name });
    await expect(submitted).toContainText("提出済み");
    await expect(page.getByRole("row").filter({ hasText: fixture.unanswered.name })).toContainText("未回答");
    await page.getByRole("navigation", { name: "状態で絞り込む" }).getByRole("link", { name: /^提出済み/ }).click();
    await expect(page.getByRole("row").filter({ hasText: fixture.employee.name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: fixture.unanswered.name })).toHaveCount(0);
  } finally { await context.close(); }
});

test("評価を確定すると3一覧へ最新点数が出て、一般社員の一覧・APIアクセスは拒否される（A5）", async ({ browser, page }) => {
  const managerContext = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  const adminContext = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  const employeeContext = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  try {
    const manager = await managerContext.newPage();
    await signIn(manager, fixture.manager.account);
    await manager.goto(`/manager/evaluations/${fixture.evaluationId}`);
    await waitForHydration(manager, "main button");
    // 確定の前に、昇給と昇格それぞれへ上司の判断を選ぶ（DD-024）
    for (const subject of ["昇給", "昇格"]) {
      await manager.getByRole("group", { name: subject, exact: true }).getByRole("button", { name: /^点数の判定どおりにする/ }).click();
    }
    await confirm(manager, "確定して本人に公開する");
    await expect.poll(() => fixture.db.prepare("SELECT status FROM evaluations WHERE id=?").get(fixture.evaluationId)).toMatchObject({ status: "finalized" });
    await manager.goto("/manager/members");
    await expect(manager.locator("main")).toContainText(fixture.cycleName);
    await expect(manager.locator("main")).toContainText("83.5");
    const admin = await adminContext.newPage();
    await signIn(admin, fixture.admin.account);
    await admin.goto("/admin/members");
    await expect(admin.getByRole("link").filter({ hasText: fixture.employee.name })).toContainText("83.5");
    await page.goto("/system/users");
    await expect(page.getByRole("link").filter({ hasText: fixture.employee.name })).toContainText("83.5");
    const employee = await employeeContext.newPage();
    await signIn(employee, fixture.employee.account);
    const response = await employee.goto("/admin/members");
    await expect(employee).toHaveURL(/\/me\?denied=1$/);
    expect(await response!.text()).not.toContain("83.5");
    const exported = await employeeContext.request.get("/api/export?type=members");
    expect(exported.status()).toBe(403);
    expect(await exported.text()).not.toContain("83.5");
  } finally { await Promise.all([managerContext.close(), adminContext.close(), employeeContext.close()]); }
});

test("全体管理者が2社目の所属を足すと同じ資格情報で切り替えられ、所属外の会社を選べない（A6）", async ({ browser, page }) => {
  await page.goto(`/system/users/${fixture.employee.id}`);
  await waitForHydration(page, "main form");
  const add = page.locator("form").filter({ has: page.getByRole("button", { name: "この会社に所属させる" }) });
  await add.getByRole("combobox", { name: /^足す会社/ }).selectOption(fixture.secondCompany.id);
  await add.getByRole("button", { name: "この会社に所属させる" }).click();
  await expect(page.getByRole("status").filter({ hasText: "に所属させました" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "所属している会社（2社）" })).toBeVisible();
  expect(fixture.db.prepare("SELECT count(*) AS n FROM company_memberships WHERE user_id=?").get(fixture.employee.id)).toMatchObject({ n: 2 });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  try {
    const employee = await context.newPage();
    await signIn(employee, fixture.employee.account);
    await switchCompany(employee, fixture.secondCompany.name);
    await employee.reload();
    await expect(employee.locator("#company-scope")).toHaveValue(fixture.secondCompany.id);
    await expect(employee.locator("#company-scope option")).toHaveCount(2);
    await context.addCookies([{ name: "hr_company", value: "cmp_mirai", url: test.info().project.use.baseURL as string }]);
    await employee.goto("/me");
    // 所属の無い会社の cookie は使わず、切り替えの一覧の先頭（会社名の順）を開く（D-009）
    const first = await employee.locator("#company-scope option").first().getAttribute("value");
    expect([fixture.company.id, fixture.secondCompany.id]).toContain(first);
    await expect(employee.locator("#company-scope")).toHaveValue(first!);
    await expect(employee.locator("main")).not.toContainText("83.5");
  } finally { await context.close(); }
});

test("会社管理者が等級名を保存すると関連画面へ反映され、マネージャーは編集画面へ入れない（A1・A2）", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  const managerContext = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  try {
    const admin = await context.newPage();
    await signIn(admin, fixture.admin.account);
    await admin.goto(`/admin/masters?grade=${fixture.grade.id}`);
    await waitForHydration(admin, 'input[name="name"]');
    const renamed = `改名後 ${fixture.grade.name}`;
    await admin.getByRole("textbox", { name: /^等級の名前/ }).fill(renamed);
    // RecordFormの保存ボタンをEnterで送ることも回帰として確認する。
    await admin.getByRole("button", { name: "等級の設定を保存する", exact: true }).focus();
    await admin.keyboard.press("Enter");
    await expect(admin.getByRole("status").filter({ hasText: "保存しました" })).toBeVisible();
    expect(fixture.db.prepare("SELECT name FROM grades WHERE id=?").get(fixture.grade.id)).toMatchObject({ name: renamed });
    for (const route of ["/admin/masters", "/admin/forms", "/admin/members", "/criteria"]) {
      await admin.goto(route);
      await expect(admin.locator("main")).toContainText(renamed);
      await expect(admin.locator("main")).not.toContainText("Beginner");
    }
    const manager = await managerContext.newPage();
    await signIn(manager, fixture.manager.account);
    await manager.goto(`/admin/masters?grade=${fixture.grade.id}`);
    await expect(manager).toHaveURL(/\/manager\?denied=1$/);
    await expect(manager.getByRole("button", { name: "等級の設定を保存する" })).toHaveCount(0);
  } finally { await Promise.all([context.close(), managerContext.close()]); }
});

test("制度未設定の会社では不足の案内から直す画面を開ける（A8）", async ({ page }) => {
  await page.goto("/admin/setup");
  await switchCompany(page, fixture.emptyCompany.name);
  await page.goto("/admin/setup");
  const fix = page.getByRole("link", { name: /評価セット|等級|設定/ }).filter({ hasText: /設定する|決める|開く|作る/ }).first();
  await expect(fix).toBeVisible();
  const href = await fix.getAttribute("href");
  expect(href).toMatch(/^\/admin\//);
  await fix.click();
  await expect(page.locator("main")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator("main")).not.toContainText("ページが見つかりません");
});
