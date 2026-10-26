import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { signIn, switchCompany, waitForHydration } from "./support";

/**
 * KPI・評価セットの入口と、そこから分けた作業の画面（O26-2・DD-027）。
 *
 * 入口は等級区分のカードと、ほかの作業（共通の設定・KPI項目・KPIカテゴリ）への入口だけにした。
 * 1画面に全部を積んでいたころは、どこで何をするのかを読み取るのに縦に長く送る必要があった。
 * 見本のデータ（給付事業）で、入口から4つの作業へ行けること、カードの中身、
 * 聞くことの1行ずつの並び、狭い幅で横にはみ出さないこと、古いURLからの転送を確かめる。
 * 保存はしないので、データは変わらない。
 * ただし I30（設定とずれた下書きをそろえる）だけは、試験のために作った下書きを実際にそろえる。
 * 下書きは試験だけの等級・期に作り、試験の後に消す。見本の下書きと、どの会社の設定にも触れない。
 */

const KYUFU = "給付事業（1社目）";

const NARROW = [
  { label: "スマホ", viewport: { width: 375, height: 700 } },
  { label: "タブレット", viewport: { width: 768, height: 1024 } },
] as const;

/** 給付事業に切り替えてから、その画面を開き直す（会社の切り替えは入口の画面で行う） */
async function openAsKyufu(page: Page, path: string) {
  await page.goto("/admin/scheme");
  await switchCompany(page, KYUFU);
  await page.goto(path);
}

/** 横にはみ出している幅（0以下なら、はみ出していない） */
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("KPI・評価セットの入口から4つの作業へ（DD-027）", () => {
  test("等級区分のカードから、その区分の手順の画面へ行ける", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme");
    await expect(page.getByRole("heading", { level: 1, name: "KPI・評価セット" })).toBeVisible();
    const group = page.getByRole("region", { name: "等級区分ごとの設定" }).getByRole("link").first();
    await group.click();
    await expect(page).toHaveURL(/\/admin\/scheme\/[^/?#]+(\/criteria)?$/);
    // 手順の画面の見出しは「区分の呼び名：手順名」
    await expect(page.getByRole("heading", { level: 1 })).toContainText("：");
  });

  for (const [name, path, heading] of [
    ["共通の設定を開く", "/admin/scheme/common", "全等級区分に共通の設定"],
    ["KPI項目を開く", "/admin/scheme/items", "KPI項目"],
    ["KPIカテゴリを開く", "/admin/scheme/categories", "KPIカテゴリ"],
  ] as const) {
    test(`「${name}」から ${path} へ行ける`, async ({ page }) => {
      await openAsKyufu(page, "/admin/scheme");
      await page.getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }

  test("入口には KPI 項目の追加や入力欄を置かない", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme");
    await expect(page.getByRole("button", { name: "＋ KPI項目を追加" })).toHaveCount(0);
    await expect(page.locator("main input, main select, main textarea")).toHaveCount(0);
  });
});

test.describe("等級区分のカード（DD-027）", () => {
  test("どのカードにも、等級・使うKPIの数・配点の合計・状態の札がある", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme");
    const cards = page.getByRole("region", { name: "等級区分ごとの設定" }).locator(".card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      for (const label of ["等級", "使うKPI", "配点の合計"]) {
        await expect(card.locator("dt", { hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
      }
      await expect(card.locator("dd").filter({ hasText: /\d+件\s*\/\s*\d+件/ })).toHaveCount(1);
      await expect(card.locator("dd").filter({ hasText: /\d+点\s*\/\s*\d+点/ })).toHaveCount(1);
      await expect(card.locator(".badge")).toHaveCount(1);
    }
  });
});

test.describe("KPI項目の画面（DD-027）", () => {
  test("聞くことを A・B… の順に1行ずつ並べる", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme/items");
    const lists = page.getByRole("list", { name: /の聞くこと$/ });
    await expect(lists.first()).toBeVisible();
    const total = await lists.count();
    let checked = 0;
    for (let i = 0; i < total && checked === 0; i++) {
      const lines = lists.nth(i).getByRole("listitem");
      if ((await lines.count()) < 2) continue;
      const texts = await lines.allInnerTexts();
      expect(texts[0]).toMatch(/^A\s/);
      expect(texts[1]).toMatch(/^B\s/);
      // 1行ずつ：2行目は1行目より下に出る（横に詰めて並べない）
      const [first, second] = await Promise.all([lines.nth(0).boundingBox(), lines.nth(1).boundingBox()]);
      expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 1);
      checked++;
    }
    expect(checked, "聞くことが2つ以上の項目").toBe(1);
  });

  test("計算式・実績区分・単位・向きは、開くまで見えない", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme/items");
    const detail = page.locator("main details.inline-detail").first();
    await expect(detail).not.toHaveAttribute("open", /.*/);
    await expect(detail.locator("dt", { hasText: "単位" })).toBeHidden();
  });
});

test.describe("古いURLからの転送（DD-027）", () => {
  test("/admin/scheme?item=<id> は、KPI項目の画面のその行へ送る", async ({ page }) => {
    await openAsKyufu(page, "/admin/scheme/items");
    await waitForHydration(page, "main [id^='kpi-item-']");
    const anchor = await page.locator("main [id^='kpi-item-']").nth(1).getAttribute("id");
    expect(anchor).toBeTruthy();
    const id = (anchor ?? "").replace(/^kpi-item-/, "");
    await page.goto(`/admin/scheme?item=${encodeURIComponent(id)}`);
    await expect(page).toHaveURL(new RegExp(`/admin/scheme/items\\?item=${encodeURIComponent(id)}#kpi-item-`));
    await expect(page.getByRole("heading", { level: 1, name: "KPI項目" })).toBeVisible();
  });

  test("/admin/masters/kpi-categories は KPIカテゴリの画面へ送る", async ({ page }) => {
    await openAsKyufu(page, "/admin/masters/kpi-categories");
    await expect(page).toHaveURL(/\/admin\/scheme\/categories$/);
    await expect(page.getByRole("heading", { level: 1, name: "KPIカテゴリ" })).toBeVisible();
  });
});

for (const { label, viewport } of NARROW) {
  test.describe(`${label}の幅で横にはみ出さない（DD-027）`, () => {
    test.use({ viewport, hasTouch: true });

    for (const path of ["/admin/scheme", "/admin/scheme/common", "/admin/scheme/items", "/admin/scheme/categories", "/admin/behavior"]) {
      test(path, async ({ page }) => {
        await openAsKyufu(page, path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
      });
    }
  });
}

// 入口の「設定とずれた下書きのアンケート」の知らせから内容を見て、確認してそろえ、知らせが消えるまで（I30）。
test.describe("設定とずれた下書きのアンケート（I30）", () => {
  let fixture: ReturnType<typeof improvementFixture>;
  /** 試験のために作った行。片付けで消す */
  let made: { gradeIds: string[]; cycleIds: string[] };

  /**
   * 設問の無い下書きを1つ作る。更新時刻を古くしておくので、設定の方が新しい（設定に合わせて作り直す側）。
   * 回答は無く、期は開いているので、そろえる対象になる。
   */
  function draft(args: { companyId: string; gradeId: string; cycleId: string; version?: number; title: string }) {
    const formId = `${args.gradeId}_draft_${args.version ?? 1}`;
    const old = Date.parse("2020-01-01T00:00:00Z");
    fixture.db
      .prepare(
        "INSERT INTO forms (id, company_id, grade_id, cycle_id, title, version, status, public_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)",
      )
      .run(formId, args.companyId, args.gradeId, args.cycleId, args.title, args.version ?? 1, `${formId}_token`, old, old);
    return formId;
  }

  const questionCount = (formId: string) =>
    (fixture.db.prepare("SELECT count(*) AS n FROM form_questions WHERE form_id = ?").get(formId) as { n: number }).n;

  test.beforeEach(() => {
    fixture = improvementFixture();
    made = { gradeIds: [], cycleIds: [] };
  });

  test.afterEach(() => {
    try {
      // アンケートと設問は、期・等級の削除で一緒に消える（on delete cascade）
      for (const id of made.cycleIds) fixture.db.prepare("DELETE FROM evaluation_cycles WHERE id = ?").run(id);
      for (const id of made.gradeIds) fixture.db.prepare("DELETE FROM grades WHERE id = ?").run(id);
    } finally {
      fixture.close();
    }
  });

  test("内容を見て、確認してそろえると、結果の文が出て知らせが消える", async ({ page }) => {
    const sakura = fixture.secondCompany;
    const suffix = fixture.grade.id.slice(-8);
    const template = fixture.db.prepare("SELECT * FROM grades WHERE company_id = ? AND code = 'regular'").get(sakura.id) as
      | Record<string, string | number | null>
      | undefined;
    const scheme = fixture.db
      .prepare("SELECT id FROM evaluation_schemes WHERE company_id = ? AND status = 'active' LIMIT 1")
      .get(sakura.id) as { id: string } | undefined;
    expect(template && scheme, "さくら福祉会の見本の等級と評価セット").toBeTruthy();
    const gradeId = `${fixture.grade.id}_sakura`;
    const cycleId = `${fixture.cycleId}_sakura`;
    const now = Date.now();
    fixture.db
      .prepare(`INSERT INTO grades (${Object.keys(template!).join(",")}) VALUES (${Object.keys(template!).map(() => "?").join(",")})`)
      .run(...Object.values({ ...template!, id: gradeId, code: gradeId, name: `E2E 等級 ${suffix}`, display_order: 90 }));
    made.gradeIds.push(gradeId);
    fixture.db
      .prepare(
        "INSERT INTO evaluation_cycles (id, company_id, name, period_start, period_end, scheme_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      )
      .run(
        cycleId,
        sakura.id,
        `E2E 評価期間 ${suffix}`,
        new Date(now).toISOString().slice(0, 10),
        new Date(now + 30 * 86400000).toISOString().slice(0, 10),
        scheme!.id,
        now,
        now,
      );
    made.cycleIds.push(cycleId);
    const title = `E2E そろえる ${suffix}`;
    const formId = draft({ companyId: sakura.id, gradeId, cycleId, title });
    expect(questionCount(formId)).toBe(0);

    await page.goto("/admin/scheme");
    await switchCompany(page, sakura.name);
    await page.goto("/admin/scheme");
    const heading = page.getByText("設定とずれた下書きのアンケートが1件あります");
    await expect(heading).toBeVisible();

    await page.getByRole("button", { name: "内容を見る" }).click();
    await expect(page.getByText(`${title}：設定に合わせて作り直す`)).toBeVisible();
    // 内容を見るだけでは書かない
    expect(questionCount(formId)).toBe(0);

    await page.getByRole("button", { name: "そろえる", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "そろえるの確認" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "そろえる", exact: true }).click();

    await expect(page.getByRole("status").filter({ hasText: "設定とずれた下書きを1件そろえました。" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("status").filter({ hasText: title })).toBeVisible();
    await expect(heading).toHaveCount(0);
    expect(questionCount(formId), "設定から作り直した設問").toBeGreaterThan(0);
  });

  test.describe("開ける人", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("会社の管理者は知らせと一覧を見られる。内容を見るだけでは何も書かない", async ({ page }) => {
      // 給付事業の試験の期に、公開中の版とは別の版で下書きを作る（見本の下書きの状態に頼らない）
      const title = `E2E 見るだけ ${fixture.grade.id.slice(-8)}`;
      const formId = draft({ companyId: fixture.company.id, gradeId: fixture.grade.id, cycleId: fixture.cycleId, version: 2, title });

      await signIn(page, fixture.admin.account);
      await page.goto("/admin/scheme");
      await expect(page.getByText(/設定とずれた下書きのアンケートが\d+件あります/)).toBeVisible();
      await page.getByRole("button", { name: "内容を見る" }).click();
      await expect(page.getByText(`${title} 第2版：設定に合わせて作り直す`)).toBeVisible();
      await expect(page.getByRole("button", { name: "そろえる", exact: true })).toBeEnabled();
      expect(questionCount(formId)).toBe(0);
    });

    test("上長は入口を開けず、知らせも出ない", async ({ page }) => {
      await signIn(page, fixture.manager.account);
      await page.goto("/admin/scheme");
      await expect(page).not.toHaveURL(/\/admin\/scheme/);
      await expect(page.getByText(/設定とずれた下書きのアンケート/)).toHaveCount(0);
    });
  });
});
