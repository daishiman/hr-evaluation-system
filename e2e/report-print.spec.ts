import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";
import { improvementFixture } from "./improvement-db-fixture";

/*
 * 評価レポートの印刷（DD-024）。A4/A3 縦の標準2枚組で、1枚目は①〜④とコメント、2枚目は⑤〜⑦。
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

async function expectPrintLayout(page: Page, savePdf: (paper: string, pdf: Buffer) => Promise<void>) {
  // 実際の印刷操作が、全図と文字の準備後にだけ起きることを確認する。
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printInvoked = "true"; }; });
  // 読込中を再現する。紙用SVGを一時的に外し、準備前に印刷されないことを観測する。
  await page.locator(".report-chart-print svg.recharts-surface").first().waitFor({ state: "attached" });
  await page.evaluate(() => {
    const svg = document.querySelector(".report-chart-print svg.recharts-surface")!;
    const parent = svg.parentElement!;
    svg.remove();
    (window as unknown as { restorePrintChart: () => void }).restorePrintChart = () => parent.appendChild(svg);
  });
  await page.getByRole("button", { name: "印刷する", exact: true }).click();
  await expect(page.getByRole("button", { name: "印刷の準備中…", exact: true })).toBeDisabled();
  await expect(page.locator("html")).not.toHaveAttribute("data-print-invoked", "true");
  await page.evaluate(() => (window as unknown as { restorePrintChart: () => void }).restorePrintChart());
  await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
  await expect(page.locator(".report-chart-print svg.recharts-surface")).toHaveCount(await page.locator(".report-chart-print").count());
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

  const a4 = await printPdf(page);
  expect(pageCount(a4), "標準の内容は A4 縦2枚").toBe(2);
  await savePdf("A4", a4);
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("用紙", { exact: true }).selectOption("A3");
  await expect(page.locator("html")).toHaveAttribute("data-report-paper", "A3");
  await page.emulateMedia({ media: "print" });
  const a3 = await printPdf(page);
  expect(pageCount(a3), "標準の内容は A3 縦2枚").toBe(2);
  await savePdf("A3", a3);
}

function printPdf(page: Page) {
  return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
}

test("上長が刷る評価レポートは A4/A3 の標準2枚で、図の準備を待つ", async ({ page, context, baseURL }, testInfo) => {
  await signIn(page, { email: "manager@kyufu.hyoka-demo.jp", password: SEED_PASSWORD });
  // 上長は さくら にも所属し、既定は さくら になる。kyufu のメンバーを読むので会社を選んでおく
  await context.addCookies([{ name: "hr_company", value: "cmp_kyufu", url: baseURL! }]);
  await page.goto("/reports/usr_kyufu_e3");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  await expectPrintLayout(page, async (paper, pdf) => { await testInfo.attach(`report-${paper}.pdf`, { body: pdf, contentType: "application/pdf" }); });
});

test("本人が刷る評価レポートも A4/A3 の標準2枚に収まる", async ({ page }, testInfo) => {
  await signIn(page, { email: "e1@kyufu.hyoka-demo.jp", password: SEED_PASSWORD });
  await page.goto("/reports/usr_kyufu_e1");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "self");
  await expectPrintLayout(page, async (paper, pdf) => { await testInfo.attach(`report-${paper}.pdf`, { body: pdf, contentType: "application/pdf" }); });
});


test("長い上長コメントは切らず、必要な紙へ続けて印刷する", async ({ page }, testInfo) => {
  const fixture = improvementFixture();
  try {
    const comment = "担当業務の改善を続け、引き継ぎの手順を整理しました。".repeat(70) + "末尾の確認文です。";
    fixture.db.prepare("UPDATE evaluations SET status = 'finalized', evaluator_comment = ?, finalized_at = ? WHERE id = ?").run(comment, Date.now(), fixture.evaluationId);
    await signIn(page, fixture.manager.account);
    await page.goto(`/reports/${fixture.employee.id}`);
    await page.evaluate(() => { window.print = () => {}; });
    await page.getByRole("button", { name: "印刷する", exact: true }).click();
    await expect(page.getByRole("button", { name: "印刷する", exact: true })).toBeEnabled();
    await expect(page.locator(".report-comment")).toContainText("末尾の確認文です。");
    await page.emulateMedia({ media: "print" });
    const pdf = await printPdf(page);
    expect(pageCount(pdf)).toBeGreaterThan(2);
    await testInfo.attach("report-long-comment.pdf", { body: pdf, contentType: "application/pdf" });
  } finally { fixture.close(); }
});
