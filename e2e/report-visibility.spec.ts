import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signIn, switchCompany } from "./support";

/*
 * 誰のレポートを、どの形で開けるか（DD-024・canViewEvaluationOf）。
 * - 本人: 自分のものだけ、点数の数値を除いた形（self）
 * - 直属の上長: 直属の部下だけ、点数まで含む形（reviewer）
 * - 会社の管理者: 会社の全員を reviewer で
 * 開けない人には 404 を返し、レポートがあることも知らせない。
 * 見本データでは e1〜e6 の上長がマネージャー、e7・e8 の上長が会社の管理者。
 */

test.use({ storageState: { cookies: [], origins: [] } });

const SEED_PASSWORD = "Hyoka2026!demo";
const account = (key: string) => ({ email: `${key}@kyufu.hyoka-demo.jp`, password: SEED_PASSWORD });

async function open(page: Page, employeeKey: string) {
  return page.goto(`/reports/usr_kyufu_${employeeKey}`);
}

async function useKyufu(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "hr_company", value: "cmp_kyufu", url: baseURL }]);
}

test("本人は自分のレポートを点数の数値なしで読み、ほかの人のレポートは 404 になる", async ({ page }) => {
  await signIn(page, account("e1"));
  await open(page, "e1");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "self");
  await expect(page.locator("main")).not.toContainText("KPI評価点");

  const other = await open(page, "e2");
  expect(other?.status()).toBe(404);
  await expect(page.locator(".report")).toHaveCount(0);
});

test("上長は直属の部下を評価者の形で読み、直属でない人は 404 になる", async ({ page, context, baseURL }) => {
  await signIn(page, account("manager"));
  await useKyufu(context, baseURL!);
  await open(page, "e1");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  await expect(page.locator("main")).toContainText("KPI評価点");

  const notMine = await open(page, "e7");
  expect(notMine?.status()).toBe(404);
  await expect(page.locator(".report")).toHaveCount(0);
});

test("会社の管理者は、上長がマネージャーでない人も評価者の形で読む", async ({ page }) => {
  await signIn(page, account("admin"));
  await open(page, "e7");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  await expect(page.locator("main")).toContainText("KPI評価点");
});


test("システム管理者は選んだ会社の全員を読み、会社を切り替えると前の会社の URL は開けない", async ({ page, context, baseURL }) => {
  await signIn(page, { email: "super@hyoka-demo.jp", password: SEED_PASSWORD });
  await useKyufu(context, baseURL!);
  await page.goto("/admin/members/usr_kyufu_e7");
  await page.getByRole("link", { name: "最新の確定済みレポートを見る", exact: true }).click();
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  await page.goto("/admin/members");
  await switchCompany(page, "さくら福祉会");
  await page.goto("/reports/usr_sakura_e1");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  expect((await open(page, "e7"))?.status()).toBe(404);
  await expect(page.locator(".report")).toHaveCount(0);
});
