import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  COMPANIES_PATH,
  STORAGE_STATE,
  SUCCESS_TEXT,
  addCompany,
  companyCard,
  listedCount,
  openCompanies,
  uniqueCompany,
  type NewCompany,
} from "./support";

/**
 * データの鮮度を確かめる経路の一覧（system-spec の I5・O1〜O3、maintenance-ops (2)）。どの文書もこの一覧を正本として指す。
 *
 * 1. 同じタブ: 成功表示と同じ描画のうちに一覧・件数・会社切替が新しくなる（O1）
 * 2. 強制再読み込み: 作成の直後の ⌘+Shift+R で新しい会社が出て、応答は作成より後に作られている（O2）
 * 3. 2つのタブ: 片方で作ると、もう片方は1秒以内に新しくなる。別の端末の変更は、タブに戻ったときに1秒以内（O3）
 * 4. 戻る・bfcache: 戻るボタンで開き直した画面と、bfcache から戻った画面が新しくなる（I3）
 * 5. 控え: 成功の知らせの後ろに畳んで置き、押したときだけ値を出す（ui-ux (2)。一覧の新しい行 ＞ 成功の知らせ ＞ 控え）
 * 6. スマホ（375px）・タブレット（768px）の幅でも、1 と 5 が同じに振る舞う（ui-ux (5)・maintenance-ops (2)）
 * 7. 下書きの自動保存の型（FormAnswer）: 保存が済んでも打っている途中の値が残り、再読み込み・画面の行き来のあとも保存した値が出る
 * 8. まとめ処理の型（ImprovementBulkTable）: 結果の知らせと同じ描画のうちに一覧と件数が新しくなり、再読み込みしても同じ。
 *    表示中を全て処理して0件になっても、結果は消えない
 *    （7・8 は e2e/data-freshness-component-types.spec.ts）
 *
 * 1〜6 で会社の追加を題材にするのは、表を最も多く書く書き込みで、もともと「出ない」と報告された経路だから。
 */

/** O3 の「1 秒以内」 */
const WITHIN_ONE_SECOND = 1_000;

/**
 * 狭い画面の幅（system-spec/route-ledger.json の 4 幅のうち、パソコン以外の 2 つ）。
 * 高さは spec.md の実測と同じ 375×700 と、縦向きのタブレット。
 */
const NARROW_VIEWPORTS = [
  { label: "スマホ", viewport: { width: 375, height: 700 } },
  { label: "タブレット", viewport: { width: 768, height: 1024 } },
] as const;

/** 別の端末の利用者をまねる。Cookie も BroadcastChannel も分かれるので、他タブへの通知は届かない。 */
async function addFromAnotherDevice(browser: Browser, company: NewCompany): Promise<void> {
  const context = await browser.newContext({ storageState: STORAGE_STATE, baseURL: test.info().project.use.baseURL });
  try {
    const other = await context.newPage();
    await openCompanies(other);
    await addCompany(other, company);
  } finally {
    await context.close();
  }
}

async function expectListed(page: Page, company: NewCompany, timeout: number): Promise<number> {
  const started = Date.now();
  await expect(companyCard(page, company)).toBeVisible({ timeout });
  return Date.now() - started;
}

/** 1. 同じタブ。会社切替はメニュー（狭い幅では引き出し）の中にあり、閉じていても DOM には居るので同じに見られる */
async function expectSameRenderAsSuccess(page: Page, label: string): Promise<void> {
  await openCompanies(page);
  const before = await listedCount(page);
  const company = uniqueCompany(label);

  const atSuccess = await addCompany(page, company);

  expect(atSuccess.hasCard, "成功表示が出た瞬間に、一覧に新しい会社のカードがある").toBe(true);
  expect(atSuccess.count, "成功表示が出た瞬間に、見出しの件数が1つ増えている").toBe(before + 1);
  expect(atSuccess.inSwitcher, "成功表示が出た瞬間に、会社切替の選択肢に新しい会社がある").toBe(true);
}

/** 5. 控え。成功の知らせの後ろに畳んで置き、押したときだけ値を出す */
async function expectMemoFoldedBehindSuccess(page: Page, label: string): Promise<void> {
  await openCompanies(page);
  const company = uniqueCompany(label);
  await addCompany(page, company);

  const status = page.getByRole("status").filter({ hasText: SUCCESS_TEXT });
  // 一覧の行の「◯◯さんの仮パスワードの控えを見る」と混ざらないよう、名前は完全一致で探す
  const show = page.getByRole("button", { name: "仮パスワードの控えを見る", exact: true });
  const hide = page.getByRole("button", { name: "控えを隠す", exact: true });
  const memo = page.getByRole("group", { name: "今回発行した仮パスワードの控え" });
  await expect(companyCard(page, company)).toBeVisible();

  // 控えを保存できなかった（鍵が無い）ときは、一覧から開き直せないので最初から開いている
  if (!(await status.textContent())?.includes("控えは一覧の行から開けます")) {
    await expect(memo).toBeVisible();
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    return;
  }

  await expect(memo, "保存のあと、控えは畳まれている").toHaveCount(0);
  await expect(show).toHaveAttribute("aria-expanded", "false");
  const statusFirst = await status.evaluate(
    (el, toggle) => toggle !== null && (el.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    await show.elementHandle(),
  );
  expect(statusFirst, "成功の知らせが控えの操作より先にある").toBe(true);

  await show.click();
  await expect(memo).toBeVisible();
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  await expect(memo.getByRole("textbox")).toHaveValue(/.{10,}/);

  await hide.click();
  await expect(memo).toHaveCount(0);
  await expect(companyCard(page, company), "控えを開閉しても一覧の新しい行は残る").toBeVisible();
}

test.describe("データの鮮度（会社の追加）", () => {
  test("1. 同じタブ: 成功表示と同じ描画のうちに一覧・件数・会社切替が新しくなる", async ({ page }) => {
    await expectSameRenderAsSuccess(page, "同じタブ");
  });

  test("2. 強制再読み込み: 作成直後の ⌘+Shift+R で出て、応答は作成より後に作られている", async ({ page }) => {
    await openCompanies(page);
    const company = uniqueCompany("再読み込み");
    await addCompany(page, company);
    const successAt = Date.now();

    // ⌘+Shift+R と同じ「キャッシュを使わない再読み込み」
    const cdp = await page.context().newCDPSession(page);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => new URL(res.url()).pathname === COMPANIES_PATH && res.request().resourceType() === "document",
      ),
      cdp.send("Page.reload", { ignoreCache: true }),
    ]);

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"], "ログイン後の画面は保存させない").toContain("no-store");
    const generatedAt = response.headers()["x-generated-at"];
    expect(generatedAt, "画面の応答に生成時刻が付いている").toBeTruthy();
    expect(Date.parse(generatedAt), "応答は作成の成功より後に作られている").toBeGreaterThanOrEqual(successAt);

    await expect(companyCard(page, company)).toBeVisible();
  });

  test("3a. 2つのタブ: 片方で作ると、もう片方が1秒以内に新しくなる", async ({ page, context }) => {
    await openCompanies(page);
    const before = await listedCount(page);

    const writer = await context.newPage();
    await openCompanies(writer);
    const company = uniqueCompany("他タブ");
    await addCompany(writer, company);

    const elapsed = await expectListed(page, company, WITHIN_ONE_SECOND);
    test.info().annotations.push({ type: "他タブへの反映（ミリ秒）", description: String(elapsed) });
    await expect.poll(() => listedCount(page)).toBe(before + 1);
  });

  test("3b. 別の端末の変更: タブに戻ったときに1秒以内に新しくなる", async ({ page, browser }) => {
    await openCompanies(page);
    const company = uniqueCompany("画面復帰");
    await addFromAnotherDevice(browser, company);

    // 別の端末からは知らせが届かないので、戻ってくるまでは古いまま
    await expect(companyCard(page, company)).toHaveCount(0);

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const elapsed = await expectListed(page, company, WITHIN_ONE_SECOND);
    test.info().annotations.push({ type: "画面復帰からの反映（ミリ秒）", description: String(elapsed) });
  });

  test("4a. 戻る: 離れている間に作られた会社が、戻るボタンで開き直した画面に出る", async ({ page, browser }) => {
    await openCompanies(page);
    await page.goto("/system/users");
    const company = uniqueCompany("戻る");
    await addFromAnotherDevice(browser, company);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${COMPANIES_PATH}$`));
    await expect(companyCard(page, company)).toBeVisible({ timeout: WITHIN_ONE_SECOND });
  });

  test("4b. bfcache: 保存しておいた画面がそのまま戻っても、1秒以内に新しくなる", async ({ page, browser }) => {
    // ログイン後の画面は no-store なので Chrome はふつう bfcache に入れない（Playwright も bfcache を切っている）。
    // 入れるブラウザで戻ったときに起きる pageshow（persisted）を送り、取り直しの経路を確かめる。
    await openCompanies(page);
    const company = uniqueCompany("bfcache");
    await addFromAnotherDevice(browser, company);
    await expect(companyCard(page, company)).toHaveCount(0);

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    const elapsed = await expectListed(page, company, WITHIN_ONE_SECOND);
    test.info().annotations.push({ type: "bfcache 復元からの反映（ミリ秒）", description: String(elapsed) });
  });

  test("5. 控え: 成功の知らせの後ろに畳んで置き、押したときだけ値を出す", async ({ page }) => {
    await expectMemoFoldedBehindSuccess(page, "控え");
  });
});

for (const { label, viewport } of NARROW_VIEWPORTS) {
  test.describe(`データの鮮度（${label}の幅 ${viewport.width}px）`, () => {
    test.use({ viewport, hasTouch: true });

    test("6-1. 同じタブ: 成功表示と同じ描画のうちに一覧・件数・会社切替が新しくなる", async ({ page }) => {
      await expectSameRenderAsSuccess(page, `${label}同じタブ`);
    });

    test("6-5. 控え: 成功の知らせの後ろに畳んで置き、押したときだけ値を出す", async ({ page }) => {
      await expectMemoFoldedBehindSuccess(page, `${label}控え`);
    });
  });
}
