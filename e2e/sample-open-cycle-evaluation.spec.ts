import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signIn, switchCompany, waitForHydration, type Account } from "./support";

/**
 * 見本の会社の受付中の期（DD-029）で、提出済みの回答から評価を作り、一覧と詳細まで進めること。
 * あわせて、見本の人がデモの会社の未回答の一覧と提出状況に混ざって出ないこと。
 *
 * 前提は手元の D1 に見本（pnpm db:sample:local）が入っていること。
 * 見本の利用者は誰も知らない仮パスワードで作るので、見本の会社の管理者はこの中で一時的に作り、終わったら消す。
 * 評価を作るのは見本の会社の受付中の期だけで、ほかの spec の会社・期の数に依らない。
 */

const SAMPLE_COMPANY_ID = "cmp_sample";
const OPEN_CYCLE_ID = "cyc_sample_2026h2";
/** 提出済みの5人（scripts/sample-data.mjs の SAMPLE_OPEN_RESPONSES） */
const SUBMITTED = ["サンプル 一郎", "サンプル 三郎", "サンプル 五月", "サンプル 七海", "サンプル 九条"];
const KYUFU = "給付事業（1社目）";
const KYUFU_ADMIN: Account = { email: "admin@kyufu.hyoka-demo.jp", password: "Hyoka2026!demo" };
/**
 * デモの会社の受付中の期の提出状況と、その期のアンケートの回答一覧（scripts/seed-data.mjs）。
 * それぞれ全員と未回答（?status=none）の2つを開く。
 */
const KYUFU_OPEN_CYCLE = ["/manager/cycles?cycle=cyc_kyufu_2026h2", "/manager/cycles?cycle=cyc_kyufu_2026h2&status=none"];
const KYUFU_OPEN_FORM = ["/admin/forms/frm_kyufu_2026h2_regular/responses", "/admin/forms/frm_kyufu_2026h2_regular/responses?status=none"];

/** 見本の会社の一時的な管理者。ローカルの D1 にだけ作る */
function sampleAdminFixture() {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:8787");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("試験用DBはローカル専用です");
  const directory = join(process.env.E2E_PERSIST_TO ?? ".wrangler/state", "v3/d1/miniflare-D1DatabaseObject");
  const files = readdirSync(directory).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) throw new Error("試験用D1を一意に特定できません。E2E_PERSIST_TOでpreviewの保存先を指定してください");
  const db = new DatabaseSync(join(directory, files[0]));
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const cycle = db
    .prepare("SELECT id FROM evaluation_cycles WHERE company_id = ? AND id = ? AND status = 'open'")
    .get(SAMPLE_COMPANY_ID, OPEN_CYCLE_ID);
  // 見本データのローカル専用パスワードのハッシュを使う。値はログにも成果物にも出さない。
  const credential = db
    .prepare("SELECT a.password FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.email = 'e1@kyufu.hyoka-demo.jp' AND a.provider_id = 'credential'")
    .get() as { password: string } | undefined;
  if (!cycle || !credential) {
    db.close();
    throw new Error("手元の D1 に見本の受付中の期が必要です（pnpm db:sample:local）");
  }
  // 確定済みがあると「作り直さない」になり、作った人数が変わる。入れ直してから流す
  const finalized = db
    .prepare("SELECT count(*) AS n FROM evaluations WHERE cycle_id = ? AND status = 'finalized'")
    .get(OPEN_CYCLE_ID) as { n: number };
  if (finalized.n > 0) {
    db.close();
    throw new Error("見本の受付中の期に確定済みの評価があります。pnpm db:sample:local で入れ直してください");
  }

  const id = `e2e_${randomUUID()}`;
  const now = Date.now();
  const admin = {
    id,
    name: `サンプル E2E 管理者 ${id.slice(-8)}`,
    account: { email: `${id}@example.com`, password: "Hyoka2026!demo" } satisfies Account,
  };
  function insert(table: string, values: Record<string, string | number | null>) {
    const keys = Object.keys(values);
    db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
  }
  db.exec("BEGIN");
  try {
    // 等級を持たない管理者なので、提出状況の対象者（等級に所属する人）は増えない
    insert("users", { id, name: admin.name, email: admin.account.email, email_verified: 1, role: "COMPANY_ADMIN", company_id: SAMPLE_COMPANY_ID, grade_id: null, manager_id: null, is_active: 1, created_at: now, updated_at: now });
    insert("accounts", { id: `${id}_account`, account_id: id, provider_id: "credential", user_id: id, password: credential.password, created_at: now, updated_at: now });
    insert("company_memberships", { id: `${id}_membership`, user_id: id, company_id: SAMPLE_COMPANY_ID, role: "COMPANY_ADMIN", grade_id: null, manager_id: null, created_at: now, updated_at: now });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  return {
    db,
    admin,
    close() {
      db.exec("BEGIN");
      try {
        // 作った評価は評価者の外部キーで利用者の削除を止めるので、先に消す（根拠行は評価の削除へ cascade）。
        // 見本の受付中の期は「評価がまだ無い」状態に戻る。
        db.prepare("DELETE FROM evaluations WHERE evaluator_id = ?").run(id);
        // 監査のactor外部キーは利用者削除へcascadeしない
        db.prepare(`DELETE FROM constitution_events WHERE actor_id = ?
          OR (entity_type = 'membership' AND entity_id = ?)`).run(id, `${id}_membership`);
        db.prepare("DELETE FROM users WHERE id = ?").run(id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      } finally {
        db.close();
      }
    },
  };
}

/**
 * 提出状況の表に見本の人がいないこと。全員の表に1行以上あることも見る（表が出ないまま通らないように）。
 * 未回答の人数はほかの spec の回答で変わるので、未回答の表は0行でもよい。
 */
async function expectNoSamplePeople(page: Page, [all, unanswered]: string[]) {
  await page.goto(all);
  await expect(page.getByRole("row").filter({ hasText: /提出済み|入力途中|未回答/ }).first()).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "サンプル" })).toHaveCount(0);
  await page.goto(unanswered);
  await expect(page.getByRole("navigation", { name: "状態で絞り込む" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "サンプル" })).toHaveCount(0);
}

test.describe("見本の会社の受付中の期（DD-029）", () => {
  let fixture: ReturnType<typeof sampleAdminFixture>;
  test.beforeEach(() => { fixture = sampleAdminFixture(); });
  test.afterEach(() => fixture?.close());

  test("見本の会社の管理者が、提出済みの回答から評価を作り、一覧から詳細へ進める", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
    try {
      const page = await context.newPage();
      await signIn(page, fixture.admin.account);
      await page.goto(`/manager/cycles?cycle=${OPEN_CYCLE_ID}`);
      await waitForHydration(page, "main button");
      await expect(page.locator("main")).toContainText("5 / 11 人が提出済み");

      const name = "提出済みの回答から評価を作る";
      await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "5人ぶんの評価を作りました。" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "この期の評価（5件）" })).toBeVisible();
      await expect.poll(() =>
        fixture.db.prepare("SELECT count(*) AS n FROM evaluations WHERE company_id = ? AND cycle_id = ?").get(SAMPLE_COMPANY_ID, OPEN_CYCLE_ID),
      ).toEqual({ n: 5 });
      for (const person of SUBMITTED) await expect(page.getByRole("link", { name: person, exact: true })).toBeVisible();

      await page.getByRole("link", { name: SUBMITTED[0], exact: true }).click();
      await page.waitForURL(/\/manager\/evaluations\/[^/?]+$/);
      await expect(page.getByRole("heading", { name: "確認と確定" })).toBeVisible();
      await expect(page.locator("main")).toContainText(SUBMITTED[0]);
    } finally {
      await context.close();
    }
  });

  test("デモの会社の管理者が開いた未回答の一覧と提出状況に、見本の人は出ない", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
    try {
      const page = await context.newPage();
      await signIn(page, KYUFU_ADMIN);
      await expectNoSamplePeople(page, KYUFU_OPEN_CYCLE);
      await expectNoSamplePeople(page, KYUFU_OPEN_FORM);
    } finally {
      await context.close();
    }
  });

  test("全体管理者がデモの会社へ切り替えて開いた未回答の一覧と提出状況に、見本の人は出ない", async ({ page }) => {
    await page.goto("/manager/cycles");
    await switchCompany(page, KYUFU);
    await expectNoSamplePeople(page, KYUFU_OPEN_CYCLE);
    await expectNoSamplePeople(page, KYUFU_OPEN_FORM);
  });
});
