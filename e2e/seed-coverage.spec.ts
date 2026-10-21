import { expect, test, type Locator, type Page } from "@playwright/test";
import { switchCompany } from "./support";

/*
 * 見本データ（scripts/seed-data.mjs）を入れた後に、受け入れの O20 が求める状態が画面に出ることを確かめる。
 * DB の中身は scripts/seed-idempotent.test.mjs が確かめる。ここでは、それが画面まで届いているかを見る。
 *
 * 確かめること
 *   1. 受付中の期（2026年度 下期）のアンケートに、下書き・公開中・締め切り済みの旧版と新しい版がそろう
 *   2. 締切を過ぎた版（等級4-2）の回答一覧に、延長中の人が出る
 *   3. 比べる警告の表に、ずれの3種類（等級要件・行動指針・KPI項目）の行が出る
 *
 * 前提にするデータ
 *   - ローカルの preview と、見本データを入れたローカル D1
 *   - 全体管理者のログイン状態（auth.setup.ts が保存する super@hyoka-demo.jp）
 *
 * DB には書かない。画面の札と見本データの値は、src や seed の定数を読み込まず、ここに書く。
 */

const KYUFU = "給付事業（1社目）";
const CYCLE = "cyc_kyufu_2026h2";
const OPEN_GAP = "直すところを見る";
const GAP_TABLE = "いまの設定とこのアンケートの項目の比べ";

/** 一覧のカード。対象の等級と版の行で見分ける（題名は評価期間と等級から作られる） */
function formCard(page: Page, grade: string, version: number): Locator {
  return page
    .locator(".card")
    .filter({ has: page.locator(".todo-row-sub", { hasText: `対象：${grade} ／ 第${version}版` }) })
    .last();
}

/** 給付事業へ切り替えてから開く（全体管理者は前の試験の会社を選んだままのことがある） */
async function openInKyufu(page: Page, path: string) {
  await page.goto("/admin/forms");
  await switchCompany(page, KYUFU);
  await page.goto(path);
}

async function openGapTable(page: Page, formId: string): Promise<Locator> {
  await page.goto(`/admin/forms/${formId}`);
  await page.getByText(OPEN_GAP, { exact: true }).click();
  const table = page.getByRole("table", { name: GAP_TABLE });
  await expect(table).toBeVisible();
  return table;
}

/** 表に、その種類で、その項目名の行がある */
async function expectGapRow(page: Page, table: Locator, kind: string, item: string) {
  // has の内側は行の中で探すので、表を起点にしない
  const row = table.getByRole("row").filter({ has: page.getByText(item, { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell").first()).toHaveText(kind);
}

test("受付中の期のアンケートに、下書き・公開中・締め切り済みの旧版と新しい版がそろう", async ({ page }) => {
  await openInKyufu(page, `/admin/forms?cycle=${CYCLE}`);

  await expect(formCard(page, "等級1", 1)).toContainText("下書き");
  await expect(formCard(page, "等級2", 1)).toContainText("公開中");
  await expect(formCard(page, "等級3", 1)).toContainText("締め切り済み");
  await expect(formCard(page, "等級3", 2)).toContainText("公開中");
  await expect(formCard(page, "等級4-2", 1)).toContainText("公開中");
});

test("締切を過ぎた等級4-2の版の回答一覧に、延長中の人が出る", async ({ page }) => {
  await openInKyufu(page, "/admin/forms/frm_kyufu_2026h2_am2/responses");

  const extension = page.locator("main").getByText("延長中", { exact: true });
  await expect(extension).toBeVisible();
  await expect(page.locator("main").getByText("山本 千夏", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "延長を取り消す", exact: true })).toBeVisible();
});

test("比べる警告の表に、ずれの3種類の行が出る", async ({ page }) => {
  await openInKyufu(page, `/admin/forms?cycle=${CYCLE}`);

  // 等級要件: 等級5-2の要件を1つ改訂し、1つ足した（アンケートは元の版のまま）。
  // 足したほうだけが行になる。改訂は版の系列で同じ項目と数えるので、行にしない（comparison-items.ts）
  const requirement = await openGapTable(page, "frm_kyufu_2026h2_manager2");
  await expectGapRow(page, requirement, "等級要件", "法人内の他の事業所と連携した人材育成の仕組みづくり");
  await expect(requirement.getByText("中期の事業計画と予算を作成し、期の途中で実績と照らして見直す", { exact: true })).toHaveCount(0);

  // 行動指針: 等級1・等級2向けの連帯性を使わなくしたが、公開中の等級2のアンケートはまだ聞いている
  const behavior = await openGapTable(page, "frm_kyufu_2026h2_regular");
  await expectGapRow(page, behavior, "行動指針", "連帯性について");

  // KPI項目: 等級4-1のアンケートは、評価セットで選んだ「利用者満足度」の代わりに「改善提案」を聞いている
  const kpi = await openGapTable(page, "frm_kyufu_2026h2_am1");
  await expectGapRow(page, kpi, "KPI項目", "利用者満足度");
  await expectGapRow(page, kpi, "KPI項目", "改善提案");
});
