import { test, expect } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { switchCompany, waitForHydration } from "./support";

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => { fixture = improvementFixture(); });
test.afterEach(() => { fixture?.close(); });

test("等級要件の追加下書きは同じ等級では保持し、別等級には持ち越さない", async ({ page }) => {
  await page.goto("/admin/masters/requirements");
  await switchCompany(page, fixture.company.name);
  await page.goto(`/admin/masters/requirements?grade=${fixture.grade.id}`);
  await waitForHydration(page, "main fieldset button");
  await page.getByRole("button", { name: "＋ 項目を追加", exact: true }).first().click();
  const draft = page.getByRole("textbox", { name: "支援についてに追加する項目の内容" });
  const text = "未保存の支援内容".repeat(40); // 300文字超。サーバーの入力検査で断らせる。
  await draft.fill(text);
  const save = page.getByRole("button", { name: "この内容で追加する", exact: true });
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "入力" })).toBeVisible();
  await expect(draft).toHaveValue(text);
  await expect(save).toBeEnabled();

  // 同じ対象への画面遷移でも下書きは失わない。
  await page.locator(`main a[href='/admin/masters/requirements?grade=${fixture.grade.id}']`).click();
  await expect(draft).toHaveValue(text);
  // 他の等級の入力は閉じた状態から始める。
  const other = page.locator("main a.chip[href*='?grade=']").filter({ hasNotText: fixture.grade.name }).first();
  const href = await other.getAttribute("href");
  if (!href) throw new Error("別の等級が必要です");
  await other.click();
  await expect(page).toHaveURL(new URL(href, page.url()).href);
  await expect(draft).toHaveCount(0);
  await page.getByRole("button", { name: "＋ 項目を追加", exact: true }).first().click();
  await expect(draft).toHaveValue("");
  expect(fixture.db.prepare("SELECT count(*) AS count FROM grade_requirements WHERE grade_id=?").get(fixture.grade.id)).toEqual({ count: 0 });
});
