import { expect, test, type Locator, type Page } from "@playwright/test";
import { switchCompany, waitForHydration } from "./support";

/*
 * 部品クラスの状態の見た目（DD-030・O29）。
 *
 * 共通部品の ui- の規則が、実際のブラウザで次のとおりに効くことを確かめる。
 *  - キーボードで選んだときの印（:focus-visible）が出る。
 *  - 選んだ（aria-current / aria-pressed）・開いた・現在地で、見た目が変わる。
 *  - 動きを減らす設定では、光（::after）と動きが止まる。
 *  - 印刷・使えない状態・コントラストを強くする設定では、勾配と影の無い平らな面に戻る。
 * あわせて、主な画面を明暗それぞれで撮って test-results/ に残す（見比べの基準は持たない。人が目で見る用）。
 *
 * 相手はローカルの preview と見本データ。ログインはシステム全体管理者（playwright.config.ts の既定）。
 * 会社の画面（/admin/…）は、見本の1社目（給付事業）に切り替えてから撮る。
 */

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/** 明暗を決めてから開く（src/lib/theme.ts の保存先と同じ鍵）。 */
async function openWithTheme(page: Page, path: string, theme: Theme) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("hr-theme", value);
    } catch {
      // 保存できない環境では、下の emulateMedia の明暗に任せる
    }
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
}

async function styleOf(locator: Locator, property: string, pseudo?: string): Promise<string> {
  return locator.evaluate(
    (el, [name, pseudoElement]) => getComputedStyle(el, pseudoElement || null).getPropertyValue(name),
    [property, pseudo ?? ""] as const,
  );
}

/** 「会社を追加する」（主の操作。会社が無いときは空の知らせの中に、あるときは画面の見出しの横に出る）。 */
function mainAction(page: Page): Locator {
  return page.locator("a.ui-press-main", { hasText: "会社を追加する" }).first();
}

/** 影は 120ms かけて消える（.ui-press の transition）ので、読み取りを繰り返して消え終わるのを待つ。 */
async function expectFlat(locator: Locator, label: string) {
  expect(await styleOf(locator, "background-image"), `${label}: 勾配を付けない`).toBe("none");
  await expect.poll(() => styleOf(locator, "box-shadow"), { message: `${label}: 影を付けない` }).toBe("none");
  expect(await styleOf(locator, "content", "::after"), `${label}: 光を出さない`).toBe("none");
}

test.describe("主の操作（ui-press-main）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/system");
    await expect(mainAction(page)).toBeVisible();
  });

  test("ふだんは勾配で塗り、キーボードで選ぶと印が出る", async ({ page }) => {
    const action = mainAction(page);
    expect(await styleOf(action, "background-image")).toContain("linear-gradient");
    await waitForHydration(page, "a.ui-press-main");
    // Tab で順に進み、主の操作まで行く（マウスで押したのではない印 :focus-visible を出す）
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      if (await action.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(action).toBeFocused();
    expect(await action.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    expect(await styleOf(action, "outline-style")).not.toBe("none");
    expect(await styleOf(action, "outline-width")).toBe("2px");
  });

  test("指を乗せると光が1回走り、動きを減らす設定では走らない", async ({ page }) => {
    const action = mainAction(page);
    await action.hover();
    expect(await styleOf(action, "animation-name", "::after")).toBe("ui-glint");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(0, 0);
    await action.hover();
    expect(await styleOf(action, "animation-name", "::after")).toBe("none");
    expect(await styleOf(action, "content", "::after")).toBe("none");
    expect(await styleOf(action, "transition-duration")).toMatch(/^0s(?:, 0s)*$/);
  });

  test("印刷では平らな面に戻す", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await expectFlat(mainAction(page), "印刷");
  });

  test("コントラストを強くする設定では平らな面に戻す", async ({ page }) => {
    await page.emulateMedia({ contrast: "more" });
    await expectFlat(mainAction(page), "prefers-contrast: more");
  });

  test("使えない状態（aria-disabled）では平らな面に戻す", async ({ page }) => {
    const action = mainAction(page);
    await action.evaluate((el) => el.setAttribute("aria-disabled", "true"));
    await action.hover();
    await expectFlat(action, "aria-disabled");
  });
});

test.describe("選ぶ・開く・現在地", () => {
  test("選んだ札（aria-current）は勾配で塗り、選んでいない札は塗らない", async ({ page }) => {
    await page.goto("/system/usage");
    const current = page.locator('a.ui-pick[aria-current="true"]').first();
    const other = page.locator("a.ui-pick:not([aria-current])").first();
    await expect(current).toBeVisible();
    await expect(other).toBeVisible();
    expect(await styleOf(current, "background-image")).toContain("linear-gradient");
    expect(await styleOf(other, "background-image")).toBe("none");
    expect(await styleOf(current, "box-shadow")).not.toBe(await styleOf(other, "box-shadow"));
  });

  test("左のメニューの現在地（aria-current=\"page\"）は、ほかの項目と見た目が違う", async ({ page }) => {
    await page.goto("/system/companies");
    const here = page.locator('a.ui-here[aria-current="page"]').first();
    const other = page.locator("a.sidebar-link:not([aria-current])").first();
    await expect(here).toBeVisible();
    await expect(other).toBeVisible();
    expect(await styleOf(here, "box-shadow")).not.toBe(await styleOf(other, "box-shadow"));
    expect(await styleOf(here, "font-weight")).toBe("600");
  });

  test("見せ隠し（details.ui-reveal）は、開くと見出しの色が変わる", async ({ page }) => {
    await page.goto("/system");
    // :not([open]) のまま持つと、開いた後に次の閉じた見せ隠しへ選び直されるので、何番目かで固定する
    const all = page.locator("details.ui-reveal");
    await expect(all.first()).toBeVisible();
    const index = await all.evaluateAll((els) => els.findIndex((el) => !el.hasAttribute("open")));
    expect(index).toBeGreaterThanOrEqual(0);
    const details = all.nth(index);
    const summary = details.locator("> summary");
    await expect(summary).toBeVisible();
    const closed = await styleOf(summary, "color");
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    expect(await styleOf(summary, "color")).not.toBe(closed);
  });
});

test.describe("主な画面の明暗の写し（基準は持たない）", () => {
  const SCREENS: [string, string][] = [
    ["system", "/system"],
    ["system-companies", "/system/companies"],
    ["system-users", "/system/users"],
    ["system-usage", "/system/usage"],
    // この機能で組み替えた2画面（DD-027）。会社を選ばないと中身が出ない
    ["admin-scheme", "/admin/scheme"],
    ["admin-behavior", "/admin/behavior"],
  ];

  for (const theme of THEMES) {
    for (const [name, path] of SCREENS) {
      test(`${name}（${theme}）`, async ({ page }, testInfo) => {
        if (path.startsWith("/admin/")) {
          await page.goto("/admin/scheme");
          await switchCompany(page, "給付事業（1社目）");
        }
        await openWithTheme(page, path, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`${name}-${theme}.png`), fullPage: true });
      });
    }
  }
});
