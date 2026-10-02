import { expect, test, type Browser, type Page, type Request } from "@playwright/test";
import {
  E2E_RESPONDENT,
  STORAGE_STATE,
  addCompany,
  openCompanies,
  signIn,
  switchCompany,
  uniqueCompany,
  waitForHydration,
  watchFirstStatus,
} from "./support";

/**
 * データの鮮度を、画面の部品の型ごとに1本ずつ確かめる（e2e/data-freshness.spec.ts の経路の一覧の 7・8）。
 *
 * 7. 下書きの自動保存（FormAnswer）: 保存が済んだ瞬間も打っている途中の値が消えず・巻き戻らず、
 *    再読み込みしても、別の画面へ移って戻っても、保存した値が出る
 * 8. まとめ処理（ImprovementBulkTable）: 選んだ行をまとめて処理すると、結果の知らせと同じ描画のうちに
 *    一覧と件数が新しくなり、再読み込みしても同じ。表示中を全て処理して0件になっても結果は消えない
 *
 * どちらも前提を試験の中で作る（7 は締切が過ぎていれば本人の期限を延ばし、8 は新しい会社に要望を送る）。
 * 何度続けて走らせても同じ結果になる。
 */

/** 下書きの保存状態を出す画面下の帯。role="status" を持たないので場所で指す */
const DRAFT_STATE = ".action-bar-status";
/** 回答画面の「補足（任意）」の欄。見出しとは結び付いておらず、名前は案内文（placeholder）だけ */
const MEMO = 'textarea[placeholder^="例：4月に担当が交代したため"]';

const IMPROVEMENTS_PATH = "/admin/improvements";
const IMPROVEMENT_LIST = "届いた改善要望の一覧";
const REQUEST_HEADING = /要望（(\d+)件）/;

/** Server Action の呼び出し（下書きの保存はこれで届く） */
function isServerAction(request: Request): boolean {
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

/** 日本時間で今日から days 日後の日付（YYYY-MM-DD） */
function jstDateAfterDays(days: number): string {
  return new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/** システム全体管理者として、本人のアンケートの回答期限を30日後まで延ばす */
async function extendDeadline(
  browser: Browser,
  formPath: string,
  respondent: { name: string; company: string },
): Promise<void> {
  const context = await browser.newContext({ storageState: STORAGE_STATE, baseURL: test.info().project.use.baseURL });
  try {
    const admin = await context.newPage();
    await admin.goto("/admin/forms");
    await switchCompany(admin, respondent.company);

    await admin.goto(`/admin/forms/${formPath.split("/").pop()}/responses`);
    await waitForHydration(admin, 'select[name="employeeId"]');
    const submit = admin.getByRole("button", { name: "この内容で期限を延ばす" });
    const form = admin.locator("form").filter({ has: submit });
    const select = form.locator('select[name="employeeId"]');
    // 選択肢は「名前（提出済み／入力途中／未回答）」
    const employeeId = await select.evaluate(
      (el, prefix) =>
        el instanceof HTMLSelectElement ? (Array.from(el.options).find((o) => o.text.startsWith(prefix))?.value ?? null) : null,
      `${respondent.name}（`,
    );
    if (!employeeId) throw new Error("期限を延ばす相手の選択肢に、答える人が見つかりません");
    await select.selectOption(employeeId);
    await form.locator('input[name="extendedUntil"]').fill(jstDateAfterDays(30));
    await form.locator('textarea[name="reason"]').fill("E2E: 下書きの自動保存を確かめるため");
    await submit.click();
    await expect(admin.getByRole("status").filter({ hasText: "まで延ばしました" })).toBeVisible({ timeout: 30_000 });
  } finally {
    await context.close();
  }
}

/**
 * いま答えられるアンケートを開き、その画面のパスを返す。
 * 見本データのアンケートは締切を過ぎていることがある。そのときは本人の期限を延ばしてから開く
 * （延ばすのは締切が過ぎているときだけなので、続けて走らせても延長は積み上がらない）。
 */
async function openAnswerableForm(page: Page, browser: Browser): Promise<string> {
  await page.goto("/me/forms");
  const rows = page.locator(".card-row");
  // 提出済みでも締め切り済みでもない行の札は「入力途中」か「未着手」
  const answerable = rows.filter({ hasText: /入力途中|未着手/ }).getByRole("link").first();

  if ((await answerable.count()) === 0) {
    const locked = rows.filter({ hasText: "本人ごとに期限を延ばすことができます" }).getByRole("link").first();
    if ((await locked.count()) === 0) {
      throw new Error("答えられるアンケートも、期限を延ばせるアンケートもありません。見本データを確かめてください");
    }
    const account = page.getByRole("button", { name: /さんのアカウント$/ });
    const name = ((await account.getAttribute("aria-label")) ?? "").replace(/さんのアカウント$/, "");
    await account.click();
    const affiliation = page.getByRole("region", { name: "アカウントメニュー" }).getByText(/^所属: /);
    const company = ((await affiliation.textContent()) ?? "").replace(/^所属: /, "").trim();
    await extendDeadline(browser, (await locked.getAttribute("href")) ?? "", { name, company });
    await page.reload();
  }

  const formPath = (await answerable.getAttribute("href")) ?? "";
  expect(formPath, "答えられるアンケートがある").toMatch(/^\/me\/forms\/.+/);
  await page.goto(formPath);
  await waitForHydration(page, MEMO);
  return formPath;
}

/** 見出し「要望（N件）」の N */
async function requestCount(page: Page): Promise<number> {
  const match = REQUEST_HEADING.exec((await page.getByText(REQUEST_HEADING).textContent()) ?? "");
  if (!match) throw new Error("要望の件数の見出しが読めません");
  return Number(match[1]);
}

/**
 * 改善要望を1件送る。受け口は公開前の確かめに残している /api/improvements で、中身は画面からの送信と同じ処理。
 * 送信は1人1分に5件まで。続けて走らせて断られたら、言われた秒数だけ待って送り直す。
 */
async function sendImprovement(page: Page, body: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await page.evaluate(
      async ({ path, text }) => {
        const r = await fetch("/api/improvements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, body: text, kind: "usability", submissionKey: crypto.randomUUID() }),
        });
        return { status: r.status, retryAfter: Number(r.headers.get("retry-after") ?? "60") };
      },
      { path: IMPROVEMENTS_PATH, text: body },
    );
    if (res.status !== 429) {
      expect(res.status, "改善要望を送れる").toBe(200);
      return;
    }
    await page.waitForTimeout(res.retryAfter * 1_000);
  }
  throw new Error("改善要望の送信が続けて断られました");
}

test.describe("データの鮮度（下書きの自動保存）", () => {
  // 答えるのは一般の社員。システム全体管理者のログイン状態は使わない
  test.use({ storageState: { cookies: [], origins: [] } });

  test("7. 下書き: 保存が済んでも打っている途中の値が残り、再読み込みしても戻ってきても保存した値が出る", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, E2E_RESPONDENT);
    const formPath = await openAnswerableForm(page, browser);

    const memo = page.locator(MEMO);
    const typed = `E2E 下書き ${Date.now().toString(36)} 前半`;
    const saved = `${typed}／後半`;

    // 1つ目の保存（打ち終えて1秒後）を止めておき、保存している間に続きを打つ
    let arrived!: () => void;
    const firstSaveSent = new Promise<void>((resolve) => (arrived = resolve));
    let release!: () => void;
    const firstSaveReleased = new Promise<void>((resolve) => (release = resolve));
    let sent = 0;
    // 保存の応答は流れてくる形（RSC）で、読み終わりの知らせ（requestfinished）が来ない。応答の頭が届いた数で数える
    let answered = 0;
    page.on("response", (res) => {
      if (isServerAction(res.request())) answered++;
    });
    await page.route(
      (url) => url.pathname === formPath,
      async (route) => {
        if (isServerAction(route.request()) && ++sent === 1) {
          arrived();
          await firstSaveReleased;
        }
        await route.continue();
      },
    );

    await memo.fill(typed);
    await firstSaveSent;
    await expect(page.locator(DRAFT_STATE)).toContainText("保存しています…");
    await memo.pressSequentially("／後半");
    await expect(memo).toHaveValue(saved);

    // 次の1秒タイマーが来ても、先の保存が済むまでは次を送らない（逆順の上書きを防ぐ）。
    await page.waitForTimeout(1200);
    expect(sent).toBe(1);
    await expect(page.locator(DRAFT_STATE)).not.toContainText("保存済み");

    const atSaved = await watchFirstStatus(page, "保存済み", { memo: MEMO }, DRAFT_STATE);
    release();
    await expect(page.locator(DRAFT_STATE)).toContainText("保存済み", { timeout: 30_000 });
    expect((await atSaved()).parts.memo, "最新入力の保存が済んだ瞬間も、保存中に打った続きが残っている").toEqual([saved]);

    // 続きは、先の保存が完了してから2つ目の保存で届く。
    await expect.poll(() => answered, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator(DRAFT_STATE)).toContainText("保存済み");
    await expect(memo, "2つ目の保存が済んでも値は変わらない").toHaveValue(saved);
    await page.unrouteAll({ behavior: "wait" });

    await page.reload();
    await expect(memo, "再読み込みしても保存した値が出る").toHaveValue(saved);

    // メニューから一覧へ移り、一覧から開き直す
    await waitForHydration(page, MEMO);
    await page.getByRole("complementary", { name: "メニュー" }).getByRole("link", { name: "実績を報告する" }).click();
    await expect(page).toHaveURL(/\/me\/forms$/);
    await page.locator(`a[href="${formPath}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${formPath}$`));
    await expect(memo, "別の画面から戻っても保存した値が出る").toHaveValue(saved);
  });
});

test.describe("データの鮮度（まとめ処理）", () => {
  test("8. まとめ処理: 選んだ要望をまとめて「対応しない」にすると、知らせと同じ描画のうちに一覧と件数が新しくなり、再読み込みしても同じ", async ({
    page,
  }) => {
    // 前提づくり（会社の追加・要望3件）に加え、送信の上限に当たったら1分待つことがある
    test.setTimeout(150_000);

    // 前提: 新しい会社に切り替え、要望を3件送る（ほかの会社や前の実行の要望と混ざらない）
    await openCompanies(page);
    const company = uniqueCompany("まとめ処理");
    await addCompany(page, company);
    await switchCompany(page, company.name);
    const [first, second, kept] = ["その1", "その2", "その3"].map((n) => `E2E まとめ処理 ${company.slug} ${n}`);
    for (const body of [first, second, kept]) await sendImprovement(page, body);

    await page.goto(IMPROVEMENTS_PATH);
    await waitForHydration(page, 'input[aria-label="表示中の要望をすべて選ぶ"]');
    const table = page.getByRole("table", { name: IMPROVEMENT_LIST });
    const row = (headline: string) => table.getByRole("checkbox", { name: `この要望を選ぶ：${headline}`, exact: true });
    expect(await requestCount(page)).toBe(3);

    // 3件のうち2件を選んで「対応しない」にする（残りの1件は、最後に0件になる場面で使う）
    await row(first).check();
    await row(second).check();
    await page.getByRole("button", { name: "対応しない", exact: true }).click();
    await page.getByRole("button", { name: "2件に実行する", exact: true }).click();

    const atDone = await watchFirstStatus(page, "対応しない2件", { tables: "table", stats: "dl" });
    await page
      .getByRole("dialog", { name: "2件に実行するの確認" })
      .getByRole("button", { name: "2件に実行する", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "対応しない2件" })).toBeVisible({ timeout: 30_000 });

    const { text, parts } = await atDone();
    const list = parts.tables.find((t) => t.includes(IMPROVEMENT_LIST)) ?? "";
    const stats = parts.stats.find((t) => t.includes("見送り")) ?? "";
    expect(REQUEST_HEADING.exec(text)?.[1], "結果の知らせが出た瞬間に、見出しの件数が2つ減っている").toBe("1");
    expect(list, "結果の知らせが出た瞬間に、処理した要望が一覧から消えている").not.toContain(first);
    expect(list).not.toContain(second);
    expect(list, "選ばなかった要望は一覧に残る").toContain(kept);
    expect(stats, "結果の知らせが出た瞬間に、状態ごとの件数も新しくなっている").toContain("未対応1件");
    expect(stats).toContain("見送り2件");

    await page.reload();
    await expect(table).toBeVisible();
    expect(await requestCount(page), "再読み込みしても件数は同じ").toBe(1);
    await expect(row(first)).toHaveCount(0);
    await expect(row(second)).toHaveCount(0);
    await expect(row(kept)).toHaveCount(1);
    await expect(page.locator("dl").filter({ hasText: "見送り" })).toContainText("見送り2件");

    // 残りの1件も処理して表示中が0件になっても、結果の知らせと結果の表は消えない
    await waitForHydration(page, 'input[aria-label="表示中の要望をすべて選ぶ"]');
    await row(kept).check();
    await page.getByRole("button", { name: "対応しない", exact: true }).click();
    await page.getByRole("button", { name: "1件に実行する", exact: true }).click();
    await page
      .getByRole("dialog", { name: "1件に実行するの確認" })
      .getByRole("button", { name: "1件に実行する", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "対応しない1件" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("table", { name: "まとめ処理の結果" })).toContainText(kept);
    await expect(page.getByText("この絞り込みに当てはまる要望はありません")).toBeVisible();
    expect(await requestCount(page)).toBe(0);
  });
});
