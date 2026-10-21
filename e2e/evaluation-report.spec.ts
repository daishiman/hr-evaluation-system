import { expect, test, type Page } from "@playwright/test";
import { signIn, switchCompany } from "./support";

/*
 * 評価レポート（DD-024）を、入口から開いて読めることを確かめる。
 * 相手はローカルの見本データ（scripts/seed-data.mjs）。上長は2社に所属し、既定は さくら なので kyufu を選ぶ。
 */

test.use({ storageState: { cookies: [], origins: [] } });

const SEED_PASSWORD = "Hyoka2026!demo";
const MANAGER = { email: "manager@kyufu.hyoka-demo.jp", password: SEED_PASSWORD };
const E1 = { email: "e1@kyufu.hyoka-demo.jp", password: SEED_PASSWORD };
const KYUFU = "給付事業（1社目）";

/** 本文が横にはみ出していないか（表と図は自分の枠の中で横に送る） */
async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** 1枚目の④のレーダー図が、画面用の svg まで描けている（見本の社員は KPI が3項目以上あるので、横棒でなく図になる） */
async function expectRadarChart(page: Page) {
  const radar = page.locator("main").getByRole("img", { name: /^KPIの項目ごとの達成度のレーダー図/ });
  await expect(radar.locator(".report-chart-screen svg").first()).toBeVisible();
}

/** 2枚目の推移と等級ごとの図が、画面用の svg まで描けている（図は遅れて読み込む） */
async function expectPage2Charts(page: Page) {
  const figures = page.locator("main .report-page-2 .report-figure");
  await expect(figures).toHaveCount(2);
  for (const figure of await figures.all()) {
    await expect(figure.locator(".report-chart-screen svg").first()).toBeVisible();
  }
}

test("上長はメンバーのページから評価レポートを開け、どの幅でも横にはみ出さない", async ({ page }) => {
  await signIn(page, MANAGER);
  await page.goto("/manager/members");
  await switchCompany(page, KYUFU);
  await page.goto("/manager/members/usr_kyufu_e1");
  await page.getByRole("link", { name: "最新の確定済みレポートを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/reports\/usr_kyufu_e1$/);

  const main = page.locator("main");
  await expect(page.getByRole("heading", { level: 1, name: "評価レポート" })).toBeVisible();
  await expect(page.locator(".report")).toHaveAttribute("data-view", "reviewer");
  for (const heading of ["昇給・昇格の判断", "点数", "KPIの項目ごとの達成度", "上長からのコメント"]) {
    await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  // 2枚目（⑤〜⑦）は推移・等級ごとの点数・過去の実績の順に並ぶ
  await expect(main.locator(".report-page-2").getByRole("heading", { level: 2 })).toHaveText([
    "等級と達成率の推移",
    "等級ごとの点数",
    "過去の実績",
  ]);
  await expectRadarChart(page);
  await expectPage2Charts(page);
  // 昇給と昇格のそれぞれに、点数の判定と上司の判断が並ぶ
  await expect(main.locator(".report-decision-label")).toHaveText(["昇給", "昇格"]);
  await expect(main.getByText("KPI評価点", { exact: true }).first()).toBeVisible();
  // 図は画面用が見え、紙用は隠れている
  await expect(main.locator(".report-chart-screen").first()).toBeVisible();
  await expect(main.locator(".report-chart-print").first()).toBeHidden();
  await expect(page.getByRole("complementary", { name: "メニュー" })).toBeVisible();
  await expect(page.getByRole("button", { name: "印刷する", exact: true })).toBeVisible();

  // 受け入れの4つの幅（DD-024）。スマホ・タブレット・ノート・広い画面
  for (const width of [375, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => overflowX(page), { message: `${width}px で横にはみ出さない` }).toBeLessThanOrEqual(0);
  }
});

test("本人は自分の結果から評価レポートを開け、点数の数値を除いた形で読む", async ({ page }) => {
  await signIn(page, E1);
  await page.goto("/me/results");
  await page.getByRole("link", { name: "評価レポートを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/reports\/usr_kyufu_e1$/);

  const main = page.locator("main");
  await expect(page.locator(".report")).toHaveAttribute("data-view", "self");
  await expect(main.getByRole("heading", { name: "昇給・昇格の判断", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "判定", exact: true })).toBeVisible();
  await expect(main.locator(".report-decision-label")).toHaveText(["昇給", "昇格"]);
  // 本人の2枚目は、点数の代わりに等級要件の達成率で並ぶ
  await expect(main.locator(".report-page-2").getByRole("heading", { level: 2 })).toHaveText([
    "等級と達成率の推移",
    "等級ごとの達成率",
    "過去の実績",
  ]);
  await expectRadarChart(page);
  await expectPage2Charts(page);
  // 戻り先は本人の結果の一覧
  await expect(main.getByRole("link", { name: "評価の結果を見る" })).toBeVisible();
});
