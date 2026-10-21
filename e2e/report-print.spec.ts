import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

/*
 * 評価レポートの印刷（DD-024）。A4 縦の2枚組で、1枚目は①〜④とコメント、2枚目は⑤〜⑦。
 * 紙には画面の骨格（メニュー・ヘッダー・印刷ボタン）を刷らず、図は紙用の形に差し替える。
 * PDF を作れるのは Chromium だけなので、page.pdf で紙の枚数を数える。
 */

test.use({ storageState: { cookies: [], origins: [] } });

const SEED_PASSWORD = "Hyoka2026!demo";

/** PDF の中のページの数（/Type /Page の数。/Pages は数えない） */
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/** 上長からのコメントが2枚目（⑤〜⑦）より上にあるか */
async function commentAbovePage2(page: Page): Promise<boolean> {
  const comment = await page.locator(".report-comment").boundingBox();
  const page2 = await page.locator(".report-page-2").boundingBox();
  expect(comment, "コメントの欄はいつも置く（無ければ「ありません」と書く）").not.toBeNull();
  expect(page2).not.toBeNull();
  return comment!.y < page2!.y;
}

async function expectPrintLayout(page: Page) {
  await page.waitForSelector(".report-page-2");
  // 画面ではコメントを最後に読む。紙では order で1枚目の末尾へ寄せる（HTML の順は変えない）
  expect(await commentAbovePage2(page), "画面ではコメントが⑦の後ろにある").toBe(false);
  await page.emulateMedia({ media: "print" });
  expect(await commentAbovePage2(page), "紙ではコメントが1枚目（2枚目より上）にある").toBe(true);

  await expect(page.locator(".report-chart-print").first()).toBeVisible();
  await expect(page.locator(".report-chart-screen").first()).toBeHidden();
  for (const selector of [".app-header", ".app-sidebar", ".no-print"]) {
    await expect(page.locator(selector).first(), `${selector} は紙に刷らない`).toBeHidden();
  }
  await expect(page.getByRole("button", { name: "印刷する" })).toBeHidden();
  // 2枚目の頭は紙だけに刷る
  await expect(page.locator(".report-print-head")).toBeVisible();
  // ⑤〜⑦は必ず新しい紙から始める。これと「全部で2枚」がそろえば、1枚目は①〜④とコメントで収まり、2枚目は⑤から始まる
  await expect(page.locator(".report-page-2")).toHaveCSS("break-before", "page");

  // 図は遅れて読み込む。届く前に刷っても、枠が紙の大きさを先に取るので紙面は伸びない
  expect(pageCount(await printPdf(page)), "図が届く前でも A4 の2枚に収まる").toBe(2);

  const boxes = page.locator(".report-chart-print");
  await expect(page.locator(".report-chart-print .recharts-wrapper")).toHaveCount(await boxes.count());
  expect(pageCount(await printPdf(page)), "図を描き終えて A4 の2枚に収まる").toBe(2);
}

function printPdf(page: Page) {
  return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
}

test("上長が刷る評価レポートは A4 の2枚で、画面の骨格を刷らない", async ({ page, context, baseURL }) => {
  await signIn(page, { email: "manager@kyufu.hyoka-demo.jp", password: SEED_PASSWORD });
  // 上長は さくら にも所属し、既定は さくら になる。kyufu のメンバーを読むので会社を選んでおく
  await context.addCookies([{ name: "hr_company", value: "cmp_kyufu", url: baseURL! }]);
  await page.goto("/reports/usr_kyufu_e3");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  await expectPrintLayout(page);
});

test("本人が刷る評価レポートも A4 の2枚に収まる", async ({ page }) => {
  await signIn(page, { email: "e1@kyufu.hyoka-demo.jp", password: SEED_PASSWORD });
  await page.goto("/reports/usr_kyufu_e1");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "self");
  await expectPrintLayout(page);
});
