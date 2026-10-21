import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { signIn, waitForHydration } from "./support";

/*
 * 昇給と昇格への上司の判断（DD-024）。画面→Server Action→ローカル D1→評価レポートの順に通す。
 * 理由は本人にもそのまま見えるので、点数の語は保存の前に名指しで止め、直してもらう。
 */

test.use({ storageState: { cookies: [], origins: [] } });

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => { fixture = improvementFixture(); });
test.afterEach(() => fixture?.close());

const REASON = "期の後半に、担当顧客の引き継ぎを期限までに終えられなかった。";

function decisionGroup(page: Page, subject: "昇給" | "昇格") {
  return page.getByRole("group", { name: subject, exact: true });
}

test("昇給を変える理由に点数の語があると確定できず、直すと確定してレポートに理由が出る", async ({ page }) => {
  await signIn(page, fixture.manager.account);
  await page.goto(`/manager/evaluations/${fixture.evaluationId}`);
  await waitForHydration(page, "main button");

  const raise = decisionGroup(page, "昇給");
  await raise.getByRole("button", { name: /^変える/ }).click();
  const reason = raise.getByLabel("昇給を変える理由");
  await reason.fill("80点に届かなかったため。");
  await decisionGroup(page, "昇格").getByRole("button", { name: /^点数の判定どおりにする/ }).click();

  const finalize = page.getByRole("button", { name: "確定して本人に公開する", exact: true });
  await expect(finalize).toBeDisabled();
  // 押せない理由は、触れた語を名指しして1行で出す
  await expect(page.locator("main")).toContainText("昇給を変える理由に、本人に見せられない語があります（「80点」）");

  await reason.fill(REASON);
  await expect(finalize).toBeEnabled();
  await finalize.click();
  await page.getByRole("dialog").getByRole("button", { name: "確定して本人に公開する", exact: true }).click();
  await expect
    .poll(() => fixture.db.prepare("SELECT status, raise_decision, raise_decision_reason FROM evaluations WHERE id = ?").get(fixture.evaluationId))
    .toMatchObject({ status: "finalized", raise_decision: "override", raise_decision_reason: REASON });

  await page.goto(`/reports/${fixture.employee.id}`);
  const raiseCard = page.locator(".report-decisions > *").filter({ hasText: "昇給" }).first();
  await expect(raiseCard).toContainText("上司の判断");
  await expect(raiseCard).toContainText(`理由：${REASON}`);
});
