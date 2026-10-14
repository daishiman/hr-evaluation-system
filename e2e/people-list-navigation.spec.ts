import { test, expect } from "@playwright/test";
import { waitForHydration } from "./support";

test.describe("人の一覧の検索条件を移動後も保つ", () => {
  test("検索URLの書き戻しを待たずに会社の札へ進んでも検索語を引き継ぐ", async ({ page }) => {
    await page.clock.install();
    await page.goto("/system/users");
    await waitForHydration(page, "main input[type=search]");
    // browserの模擬時刻を基準にする。端末時刻だと時計の自動進行後に「過去」になりうる。
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.getByRole("searchbox", { name: "探す" }).fill("山田");
    await page.locator("main a.chip[href*='company=']").first().click();
    await page.clock.resume();
    await expect(page).toHaveURL(/company=/);
    await expect(page).toHaveURL(/q=/);
    await waitForHydration(page, "main input[type=search]");
    await expect(page.getByRole("searchbox", { name: "探す" })).toHaveValue("山田");
    expect(new URL(page.url()).searchParams.get("q")).toBe("山田");
  });

  test("別の会社範囲で検索して戻ると、戻り先URLの検索語と並びに戻る", async ({ page }) => {
    await page.goto("/system/users");
    await waitForHydration(page, "main input[type=search]");
    const search = page.getByRole("searchbox", { name: "探す" });
    await search.fill("山田");
    await page.getByRole("combobox", { name: "並べ替え" }).selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    await expect(page).toHaveURL(/q=/);
    const previous = page.url();
    await page.locator("main a.chip[href*='company=']").first().click();
    await expect(page).toHaveURL(/company=/);
    await waitForHydration(page, "main input[type=search]");
    await search.fill("佐藤");
    await page.getByRole("combobox", { name: "並べ替え" }).selectOption("score");
    await expect(page).toHaveURL(/sort=score/);
    await page.goBack();
    await expect(page).toHaveURL(previous);
    await expect(search).toHaveValue("山田");
    await expect(page.getByRole("combobox", { name: "並べ替え" })).toHaveValue("name");
  });
});
