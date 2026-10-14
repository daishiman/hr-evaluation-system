import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { switchCompany, waitForHydration } from "./support";

test.use({ hasTouch: true });
let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => {
  fixture = improvementFixture();
  fixture.db.prepare("UPDATE forms SET status='draft' WHERE id=?").run(fixture.formId);
});
test.afterEach(() => fixture?.close());

function handles(page: Page) { return page.getByRole("button", { name: /番目『.+』を並べ替え$/ }); }
async function order(page: Page) {
  return handles(page).evaluateAll((els) => els.map((el) => /『(.+)』/.exec(el.getAttribute("aria-label") ?? "")?.[1]));
}

for (const input of ["マウス", "タッチ", "キーボード"] as const) {
  test(`${input}で同じ順に並べ替え、保存後のDBと再読込も一致する（A10）`, async ({ page }) => {
    await page.goto("/admin/forms");
    await switchCompany(page, fixture.company.name);
    await page.goto(`/admin/forms/${fixture.formId}`);
    await waitForHydration(page, "main button");
    const before = await order(page);
    expect(before).toEqual(["今回の選択", "複数の選択"]);
    if (input === "キーボード") {
      await handles(page).first().focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Space");
    } else {
      await handles(page).first().scrollIntoViewIfNeeded();
      const from = await handles(page).first().boundingBox();
      const to = await handles(page).nth(1).boundingBox();
      if (!from || !to) throw new Error("並べ替えつまみが見つかりません");
      const x = from.x + from.width / 2, y = from.y + from.height / 2, target = to.y + to.height / 2;
      if (input === "マウス") {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, target, { steps: 8 });
        await page.mouse.up();
      } else {
        const cdp = await page.context().newCDPSession(page);
        try {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
          await page.waitForTimeout(450); // 長押しの350msを実際に超える
          for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (target - y) * step / 8 }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } finally { await cdp.detach(); }
      }
    }
    await expect.poll(() => order(page)).toEqual([...before].reverse());
    await page.getByRole("button", { name: "設問を保存する", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "設問を保存しました" })).toBeVisible();
    expect(fixture.db.prepare("SELECT title FROM form_questions WHERE form_id=? ORDER BY display_order").all(fixture.formId)).toEqual([
      { title: "複数の選択" }, { title: "今回の選択" },
    ]);
    await page.reload();
    await expect.poll(() => order(page)).toEqual([...before].reverse());
  });
}
