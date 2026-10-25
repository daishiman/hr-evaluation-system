import { expect, test, type Locator } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { switchCompany, waitForHydration } from "./support";

// fieldset の中で子の出入りと size container の中身の変化が重なると、container の中身が描かれない
// Chromium の不具合の回帰を見る（DD-017）。2026-10-16 に「＋ 聞くことを追加」を1回押すと
// 追加の行ごと消える形で見つかった。保存はしないので、データは変わらない
const ASKING = /^[A-Z]の聞くこと（アンケートの設問の文言）$/;

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => {
  fixture = improvementFixture();
});
test.afterEach(() => {
  fixture?.close();
});

/** 見えていて、箱の高さが0でない（不具合では高さ0のまま読み上げからも消える） */
async function expectDrawn(target: Locator) {
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
}

test("新しいKPI項目で「＋ 聞くことを追加」を続けて押しても、聞くことと追加のボタンが消えない（DD-017）", async ({ page }) => {
  // KPI項目の追加と修正は、KPI・評価セットの入口から /admin/scheme/items へ分けた（DD-027）
  await page.goto("/admin/scheme/items");
  await switchCompany(page, fixture.company.name);
  await page.goto("/admin/scheme/items");
  await waitForHydration(page, "main button");
  await page.getByRole("button", { name: "＋ KPI項目を追加" }).click();

  const group = page.getByRole("group", { name: "実績の聞き方" });
  const add = group.getByRole("button", { name: "＋ 聞くことを追加" });
  const asking = group.getByRole("textbox", { name: ASKING });
  await expectDrawn(add);
  const before = await asking.count();

  for (const added of [1, 2]) {
    await add.click();
    await expect(asking).toHaveCount(before + added);
    await expectDrawn(asking.last());
    await expectDrawn(add);
  }
});
