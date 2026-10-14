import { expect, test, type Cookie, type Page, type TestInfo } from "@playwright/test";
import { E2E_RESPONDENT, STORAGE_STATE, signIn, switchCompany, waitForHydration } from "./support";

/**
 * 2026-10 の改善要望の画面の試験（feature-improvement-requests-2026-10。受入 A4・A9・A10・A12）。
 *
 * 1. 権限一覧（A4）: 768px 以上は表、768px 未満はカード。説明（InfoTip）はポインターを載せると出て、
 *    説明の上へポインターを動かしても消えず、Esc で消える（WCAG 2.2 SC 1.4.13）。
 *    利用者一覧の『権限一覧を開く』はモーダルで開き、閉じると元のボタンへフォーカスが戻る。
 * 2. 画面名（A9）: Claude Code 連携の画面は『Claude Code連携（システム開発者専用）』。
 * 3. 長押しの並べ替え（A10）: タッチの機器で、つまみを 350ms 押し続けて動かすと並びが変わる。
 *    押してすぐ動かしたとき（スクロール）は並びを変えない。並べ替えは保存しない。
 *    設問を並べ替えられるのは下書きだけなので、下書きが1件も無いときに限り、等級ごとの下書きを1回作る。
 * 4. 右側の余白（A12）: S13 の7画面と、同じ崩れ方をしていたので直した画面・一覧の画面で、1280px と 1600px のとき、
 *    中身のある高さのうち本文（main の内側）の右 40% に何も無い高さが 40% 以下。375・768・1280・1600 の4つの幅で撮影を残す。
 *    /me は一般の方でも測る（一般の方にだけ最新の評価のカードが出て、全体管理者の /me とは中身が違う）。
 *
 * 相手はローカルの preview とローカル D1 の見本データ（playwright.config.ts）。
 * ログインはシステム全体管理者（auth.setup.ts）。操作する会社は見本の1社目にそろえてから始める。
 */

const NEW_AGENT_KEYS_LABEL = "Claude Code連携（システム開発者専用）";
const WIDTHS = [375, 768, 1280, 1600] as const;
const WIDE = [1280, 1600] as const;
/** 右側とみなす幅（本文の内側の幅に対する割合） */
const RIGHT_SHARE = 0.4;
/** 右側だけが空いている高さの割合の上限（%） */
const MAX_RIGHT_EMPTY = 40;

/**
 * S13 の7画面と、同じ崩れ方をしていたので直した画面・一覧の画面（§28-9）。[id] は一覧の先頭のアンケートで埋める
 */
const GAP_ROUTES = [
  "/admin/cycles",
  "/admin/behavior",
  "/forms",
  "/forms/[id]",
  "/admin/forms/[id]",
  "/me",
  "/system",
  "/admin/forms",
  "/admin/forms/[id]/responses",
  "/manager/cycles",
  "/system/permissions",
  "/system/users",
  "/admin/members",
  "/manager/members",
  "/criteria",
  "/admin/masters/promotion",
] as const;

/** 見本データの1社目（scripts/seed-data.mjs の kyufu）。試験はこの会社の評価期間・アンケートを相手にする */
const SAMPLE_COMPANY = "給付事業（1社目）";

/**
 * 操作する会社を見本の1社目にそろえてから始める。
 * 操作する会社は cookie（src/lib/session.ts の COMPANY_SCOPE_COOKIE）に残り、cookie が無いブラウザでは
 * 名前順の先頭の会社になる。先に走る data-freshness 系のスペックが「E2E …」の会社を足すと、それが先頭になり、
 * 評価期間もアンケートも無い会社を見てしまう。そこで一度だけメニューの選択欄で切り替え、その cookie を各試験のブラウザへ渡す。
 * 切り替えはメニューが出る幅の画面で行う（スマホ幅ではメニューが畳まれている）。
 */
const COMPANY_SCOPE_COOKIE = "hr_company";
let companyScope: Cookie | undefined;

test.beforeAll(async ({ browser }, info) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE, baseURL: info.project.use.baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/admin/forms");
    await switchCompany(page, SAMPLE_COMPANY);
    companyScope = (await context.cookies()).find((c) => c.name === COMPANY_SCOPE_COOKIE);
  } finally {
    await context.close();
  }
});

test.beforeEach(async ({ context }) => {
  // 既定がすでに見本の1社目なら、切り替えは起きず cookie も無い（そのままで同じ会社を見る）
  if (companyScope) await context.addCookies([companyScope]);
});

async function firstHref(page: Page, listPath: string, prefix: string): Promise<string> {
  await page.goto(listPath);
  const href = await page
    .locator(`main a[href^="${prefix}"]`)
    .evaluateAll(
      (links, prefix) =>
        links.map((a) => a.getAttribute("href") ?? "").find((h) => new RegExp(`^${prefix}[^/?#]+$`).test(h)) ?? null,
      prefix,
    );
  if (!href) throw new Error(`${listPath} に ${prefix}<id> のリンクがありません（見本データを入れてください）`);
  return href;
}

/**
 * 設問を並べ替えられるアンケート（下書き）の編集画面。
 *
 * 公開中・締め切り済みの版は設問を変えられないので、つまみが出ない。見本データのアンケートは
 * 公開中か締め切り済みだけなので、下書きが1件も無いときに限り「等級ごとの下書きをまとめて作る」で作る
 * （playwright.config.ts の止めにより、書き込むのはローカルの D1 だけ）。2回目からは残っている下書きを使い、増やし続けない。
 */
async function draftFormHref(page: Page): Promise<string> {
  const findDraft = () =>
    page.locator("main").evaluate((main) => {
      for (const badge of main.querySelectorAll(".badge")) {
        if (badge.textContent?.trim() !== "下書き") continue;
        const href = [...(badge.closest(".card-pad")?.querySelectorAll("a[href^='/admin/forms/']") ?? [])]
          .map((a) => a.getAttribute("href") ?? "")
          .find((h) => /^\/admin\/forms\/[^/?#]+$/.test(h));
        if (href) return href;
      }
      return null;
    });

  await page.goto("/admin/forms");
  const existing = await findDraft();
  if (existing) return existing;

  const label = "等級ごとの下書きをまとめて作る";
  await waitForHydration(page, "main button");
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("dialog", { name: `${label}の確認` }).getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByText(/件のアンケートを下書きで作りました/)).toBeVisible({ timeout: 15_000 });
  await page.goto("/admin/forms");
  const created = await findDraft();
  if (!created) throw new Error("下書きを作ったのに、一覧に下書きのアンケートが出ていません");
  return created;
}

async function resolveRoute(page: Page, route: (typeof GAP_ROUTES)[number]): Promise<string> {
  if (route === "/forms/[id]") return firstHref(page, "/forms", "/forms/");
  if (route === "/admin/forms/[id]") return firstHref(page, "/admin/forms", "/admin/forms/");
  if (route === "/admin/forms/[id]/responses") return `${await firstHref(page, "/admin/forms", "/admin/forms/")}/responses`;
  return route;
}

/**
 * 右側だけが空いている高さの割合（%）。
 *
 * 依頼の画像（#14）は、枠は幅いっぱいなのに、設問と選択肢が左の3分の1に寄り、右が空いていた。
 * 枠や背景は幅いっぱいに広がるので、中身の数え方に入れると常に「空きは無い」になる。
 * そこで中身を「文字の各行・入力欄・ボタン・画像」に限り、上から 2px ずつ横の帯で切って、
 * 中身のある帯のうち、本文（main の内側）の右 40% に何も無い帯の割合を返す。
 * 何も無い帯（段落の間の余白）は数えない。position: fixed のもの（改善要望のボタン）は main の外とみなす。
 * 表は行（tr）を1つの単位として見る。行の右の列に中身があれば、その行の高さの帯は空きと数えない
 * （左のセルが複数行で右のセルが1行だと、行の右は列の中身で埋まって見えるのに、帯では空きと出るため。§28-9）。
 */
async function rightEmptyShare(page: Page): Promise<number> {
  return page.evaluate((rightShare) => {
    const main = document.querySelector("main");
    if (!main) throw new Error("main がありません");
    const ms = getComputedStyle(main);
    const mr = main.getBoundingClientRect();
    const innerLeft = mr.left + parseFloat(ms.paddingLeft) + parseFloat(ms.borderLeftWidth);
    const innerRight = mr.right - parseFloat(ms.paddingRight) - parseFloat(ms.borderRightWidth);
    const split = innerRight - (innerRight - innerLeft) * rightShare;
    const hidden = (el: Element) => {
      for (let e: Element | null = el; e && e !== main; e = e.parentElement) {
        if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return true;
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return true; // 読み上げ用の隠し文字
        if (getComputedStyle(e).position === "fixed") return true;
      }
      return false;
    };
    const boxes: { top: number; bottom: number; left: number; right: number }[] = [];
    const add = (r: DOMRect) => {
      if (r.width > 0 && r.height > 0) boxes.push({ top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right });
    };
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || !node.parentElement || hidden(node.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) add(r);
    }
    const controls = 'input:not([type="hidden"]),select,textarea,button,img,svg,canvas,video,[role="img"]';
    for (const el of Array.from(main.querySelectorAll(controls))) if (!hidden(el)) add(el.getBoundingClientRect());
    if (boxes.length === 0) throw new Error("main の中に見える中身がありません");
    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    // 右の列まで中身がある表の行（その高さの帯は、帯の中に右の中身が無くても空きと数えない）
    const reachingRows = Array.from(main.querySelectorAll("tr"))
      .filter((tr) => !hidden(tr))
      .map((tr) => tr.getBoundingClientRect())
      .map((r) => ({ top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right }))
      .filter((row) =>
        boxes.some(
          (b) => b.top >= row.top && b.bottom <= row.bottom && b.left >= row.left && b.right <= row.right && b.right > split,
        ),
      );
    let filled = 0;
    let rightEmpty = 0;
    for (let y = top; y < bottom; y += 2) {
      const band = boxes.filter((b) => b.top <= y && b.bottom > y);
      if (band.length === 0) continue;
      filled++;
      if (band.some((b) => b.right > split) || reachingRows.some((row) => row.top <= y && row.bottom > y)) continue;
      rightEmpty++;
    }
    return Math.round((rightEmpty / filled) * 100);
  }, RIGHT_SHARE);
}

test.describe("権限一覧（A4）", () => {
  test("768px 以上は表、768px 未満はカードで、どちらも同じページの行を出す", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/system/permissions");
    await expect(page.getByRole("heading", { level: 1, name: "権限一覧" })).toBeVisible();
    const table = page.locator("main table");
    const cards = page.locator('[data-permission-cards="true"]');
    await expect(table).toBeVisible();
    await expect(cards).toBeHidden();
    const tableRows = await table.locator("[data-permission-row]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-permission-row")),
    );
    expect(tableRows).toContain("/system/permissions");

    await page.setViewportSize({ width: 375, height: 700 });
    await expect(cards).toBeVisible();
    await expect(table).toBeHidden();
    const cardRows = await cards.locator("[data-permission-row]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-permission-row")),
    );
    expect(cardRows).toEqual(tableRows);
  });

  test("役割のタブは ←→ で隣へ移り、選んだ役割の列だけを出す", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/system/permissions");
    await waitForHydration(page, '[role="tab"]');
    const tabs = page.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("説明はポインターで出て、説明の上へ動かしても消えず、Esc で消える", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/system/permissions");
    const trigger = page.getByRole("button", { name: /の説明$/ }).first();
    await waitForHydration(page, "main button");
    await trigger.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();

    const box = await tip.boundingBox();
    if (!box) throw new Error("説明の位置が取れません");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await expect(tip).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  });

  test("説明はキーボードのフォーカスだけでも出て、Escで閉じる", async ({ page }) => {
    await page.goto("/system/permissions");
    await waitForHydration(page, "main button");
    const trigger = page.getByRole("button", { name: /の説明$/ }).first();
    await trigger.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("利用者一覧の『権限一覧を開く』はモーダルで開き、閉じると元のボタンへフォーカスが戻る", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/system/users");
    await waitForHydration(page, "main details summary");
    await page.locator("main details summary").filter({ hasText: "役割ごとにできること" }).click();
    const open = page.getByRole("button", { name: "権限一覧を開く" });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-permission-row]").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
});

test.describe("権限の説明（A4・タッチ）", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("初回タップで説明が残り、次のタップで閉じる", async ({ page }) => {
    await page.goto("/system/permissions");
    await waitForHydration(page, "main button");
    const trigger = page.getByRole("button", { name: /の説明$/ }).first();
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeHidden();
  });
});

test.describe("設問と保存済みデータの接続（A10・A11）", () => {
  const handles = (page: Page) => page.getByRole("button", { name: /番目『.+』を並べ替え$/ });
  const names = (page: Page) => handles(page).evaluateAll((elements) =>
    elements.map((element) => /『(.+)』/.exec(element.getAttribute("aria-label") ?? "")?.[1] ?? ""),
  );
  const saveQuestions = async (page: Page) => {
    await page.getByRole("button", { name: "設問を保存する", exact: true }).click();
    await expect(page.getByText(/設問を保存しました（\d+問）/)).toBeVisible();
    await expect(page.getByRole("button", { name: "設問を保存する", exact: true })).toBeEnabled();
  };

  test("追加設問は再保存でも同じIDを保ち、作り直し後の保存で旧設問を復活させない", async ({ page }) => {
    await page.goto(await draftFormHref(page));
    await waitForHydration(page, "main button");
    const marker = `E2E 保存と再生成 ${Date.now()}`;
    await page.getByRole("button", { name: "1つ選ぶ", exact: true }).click();
    await page.getByLabel("設問文", { exact: true }).fill(marker);
    await saveQuestions(page);
    const previewTitle = page.locator('main [id^="preview_t_"]').filter({ hasText: marker });
    const assignedId = await previewTitle.getAttribute("id");
    expect(assignedId).toBeTruthy();
    await saveQuestions(page);
    await expect(previewTitle).toHaveAttribute("id", assignedId!);
    await page.reload();
    await expect(previewTitle).toHaveAttribute("id", assignedId!);

    const rebuild = "いまの評価項目に合わせて設問を作り直す";
    await waitForHydration(page, "main button");
    await page.getByRole("button", { name: rebuild, exact: true }).click();
    await page.getByRole("dialog", { name: `${rebuild}の確認` }).getByRole("button", { name: rebuild, exact: true }).click();
    await expect(page.getByText(/設問を作り直しました（\d+問）/)).toBeVisible();
    await expect(handles(page).filter({ hasText: marker })).toHaveCount(0);
    expect(await names(page)).not.toContain(marker);
    await saveQuestions(page);
    await page.reload();
    expect(await names(page)).not.toContain(marker);
    await expect(previewTitle).toHaveCount(0);
  });

  test("キーボードの並べ替えを保存すると、再読み込みでも同じ並びになる", async ({ page }) => {
    await page.goto(await draftFormHref(page));
    await waitForHydration(page, "main button");
    const before = await names(page);
    expect(before.length).toBeGreaterThanOrEqual(2);
    await handles(page).first().focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    const reordered = [before[1], before[0], ...before.slice(2)];
    await expect.poll(() => names(page)).toEqual(reordered);
    await saveQuestions(page);
    await page.reload();
    await expect.poll(() => names(page)).toEqual(reordered);
    // 試験の順番に依存しないよう、元の並びへ戻す。
    await waitForHydration(page, "main button");
    await handles(page).first().focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect.poll(() => names(page)).toEqual(before);
    await saveQuestions(page);
  });

  test("タイトルの保存ボタンにフォーカスしてEnterで保存すると、再読み込みにも残る", async ({ page }) => {
    await page.goto(await draftFormHref(page));
    await waitForHydration(page, "main button");
    const title = page.getByRole("textbox", { name: /^タイトル/ });
    const original = await title.inputValue();
    const marker = `E2E キーボード保存 ${Date.now()}`;
    await title.fill(marker);
    const save = page.getByRole("button", { name: "保存する", exact: true });
    await save.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: marker })).toBeVisible();
    await page.reload();
    await expect(title).toHaveValue(marker);
    await waitForHydration(page, "main button");
    await title.fill(original);
    await save.click();
    await expect(save).toBeEnabled();
  });
});

test.describe("画面名（A9）", () => {
  test("Claude Code 連携の画面は新しい名前で、メニューと見出しにも同じ名前が出る", async ({ page }) => {
    await page.goto("/system/agent-keys");
    await expect(page.getByRole("heading", { level: 1, name: NEW_AGENT_KEYS_LABEL })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "メニュー" }).getByRole("link", { name: NEW_AGENT_KEYS_LABEL })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Claude Code 連携の鍵");
  });
});

test.describe("長押しの並べ替え（A10）", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  async function handleNames(page: Page): Promise<string[]> {
    return page.getByRole("button", { name: /番目『.+』を並べ替え$/ }).evaluateAll((els) =>
      els.map((el) => /『(.+)』/.exec(el.getAttribute("aria-label") ?? el.textContent ?? "")?.[1] ?? ""),
    );
  }

  /** CDP のタッチで、つまみの中心から下の行の中心まで動かす。holdMs だけ押し続けてから動かす */
  async function touchDrag(page: Page, fromIndex: number, toIndex: number, holdMs: number): Promise<void> {
    const handles = page.getByRole("button", { name: /番目『.+』を並べ替え$/ });
    // CDP のタッチは画面に見えている座標へ打つ。スマホ幅では設問が画面の下にあるので、先に真ん中まで送る
    // （端に寄せると、持ち上げた直後に端の自動スクロールが動いて行き先がずれる）
    await handles.nth(fromIndex).evaluate((el) => el.scrollIntoView({ block: "center" }));
    const from = await handles.nth(fromIndex).boundingBox();
    const to = await handles.nth(toIndex).boundingBox();
    if (!from || !to) throw new Error("つまみの位置が取れません");
    const client = await page.context().newCDPSession(page);
    const point = (box: { x: number; y: number; width: number; height: number }, dy = 0) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2 + dy,
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(from)] });
    await page.waitForTimeout(holdMs);
    for (let step = 1; step <= 8; step++) {
      const y = from.y + ((to.y - from.y + to.height / 2) * step) / 8;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + from.width / 2, y: y + from.height / 2 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  }

  test("アンケートの設問を、つまみの長押しで1つ下へ動かせる（保存はしない）", async ({ page }) => {
    const href = await draftFormHref(page);
    await page.goto(href);
    await waitForHydration(page, "main button");
    const before = await handleNames(page);
    expect(before.length, "並べ替えのつまみが2つ以上ある設問の画面").toBeGreaterThanOrEqual(2);

    await touchDrag(page, 0, 1, 450);

    await expect.poll(() => handleNames(page)).toEqual([before[1], before[0], ...before.slice(2)]);
  });

  test("押してすぐ動かしたとき（スクロール）は持ち上げず、並びを変えない", async ({ page }) => {
    const href = await draftFormHref(page);
    await page.goto(href);
    await waitForHydration(page, "main button");
    const before = await handleNames(page);
    expect(before.length, "並べ替えのつまみが2つ以上ある設問の画面").toBeGreaterThanOrEqual(2);

    await touchDrag(page, 0, 1, 0);

    expect(await handleNames(page)).toEqual(before);
  });
});

/** 4つの幅で開いて撮影し、広い2つの幅で右側だけが空く高さを測る。横へのはみ出しはどの幅でも許さない */
async function checkRightGap(page: Page, info: TestInfo, path: string, name: string): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.locator("main").first().waitFor();
    // 読み込み中の表示（aria-busy の main）が消えてから測る。消える前は main が2つある
    await page.waitForFunction(() => !document.querySelector('main[aria-busy="true"]'));
    await page.screenshot({
      path: info.outputPath(`${name.replace(/[/[\]]+/g, "_")}-${width}.png`),
      fullPage: true,
    });
    if ((WIDE as readonly number[]).includes(width)) {
      const share = await rightEmptyShare(page);
      expect(share, `${name} の ${width}px で、中身のある高さの ${share}% は右側が空いている`).toBeLessThanOrEqual(
        MAX_RIGHT_EMPTY,
      );
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${name} の ${width}px で横にはみ出している`).toBeLessThanOrEqual(0);
  }
}

test.describe("右側の余白（A12）", () => {
  for (const route of GAP_ROUTES) {
    test(`${route}: 1280px と 1600px で右側だけが空く高さが ${MAX_RIGHT_EMPTY}% 以下。4つの幅で撮影する`, async ({ page }, info) => {
      await checkRightGap(page, info, await resolveRoute(page, route), route);
    });
  }
});

test.describe("右側の余白（A12・一般の方の /me）", () => {
  // 全体管理者のログインを引き継がず、一般の方（見本の1社目の社員）で入り直す
  test.use({ storageState: { cookies: [], origins: [] } });

  test(`/me（一般の方）: 最新の評価のカードがあっても、右側だけが空く高さが ${MAX_RIGHT_EMPTY}% 以下`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, E2E_RESPONDENT);
    await checkRightGap(page, info, "/me", "/me-employee");
  });
});
