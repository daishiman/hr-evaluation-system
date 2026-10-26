import { expect, test, type Browser, type Page, type Request } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { signIn, waitForHydration } from "./support";

// 数値欄にカーソルを置いたまま「内容を確認して提出する」を押しても、押したことにならなかった不具合の回帰を見る。
// 押し下げで欄から離れると、同じ値でも下書きを予約して「保存済み」が消え、帯の状態の文が長くなった。
// その文でボタンが帯の次の行へ逃げ、指を離した場所がボタンの外になっていた
// （NumberField・FormAnswer・globals.css の .action-bar-*）。
const SUBMIT = "内容を確認して提出する";
const NUMBER_COUNT = 10;
const FIRST_NUMBER = "数える実績 1";

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => {
  fixture = improvementFixture();
  const now = Date.now();
  // 画面を縦に長くし、帯が画面の下端に貼り付く形で確かめる。足した設問は評価期間の削除でアンケートごと消える
  const insert = fixture.db.prepare(
    "INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, unit, required, display_order, created_at, updated_at) VALUES (?, ?, ?, 'free', 'number', ?, '件', 1, ?, ?, ?)",
  );
  for (let i = 1; i <= NUMBER_COUNT; i++) {
    insert.run(`${fixture.formId}_number${i}`, fixture.company.id, fixture.formId, `数える実績 ${i}`, 10 + i, now, now);
  }
});
test.afterEach(() => fixture?.close());

/** 社員としてログインし、回答画面を開く（全体管理者のログイン状態は使わない） */
async function openAsEmployee(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await signIn(page, fixture.employee.account);
  await page.goto(`/me/forms/${fixture.formId}`);
  await waitForHydration(page, "main button");
  return { context, page };
}

function submitButton(page: Page) {
  return page.getByRole("button", { name: SUBMIT, exact: true });
}
function barStatus(page: Page) {
  return page.locator(".action-bar-status");
}

/** 提出ボタンの左端と下端 */
async function place(page: Page) {
  const box = await submitButton(page).boundingBox();
  if (!box) throw new Error("提出ボタンが見つかりません");
  return { x: box.x, bottom: box.y + box.height };
}

/** 2回描き終えるまで待つ */
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/** 描くたびに、提出ボタンの位置と状態の文を控える。止めると控えを返す */
async function recordFrames(page: Page) {
  return submitButton(page).evaluateHandle((button) => {
    const status = document.querySelector(".action-bar-status");
    const frames: { x: number; bottom: number; text: string }[] = [];
    let running = true;
    const tick = () => {
      const rect = button.getBoundingClientRect();
      frames.push({ x: rect.x, bottom: rect.bottom, text: status?.textContent ?? "" });
      if (running) requestAnimationFrame(tick);
    };
    tick();
    return {
      stop: () => {
        running = false;
        return frames;
      },
    };
  });
}

/**
 * 状態の文のうしろに空の箱を足し、帯の1行に残る幅を 10px にする（試験の中だけの仕掛け）。
 * 文がどれだけ長くなると折り返すかは、締切の文や画面の幅で変わる。
 * 残りを詰めておき、文が少しでも長くなれば、直す前の帯ではボタンが次の行へ逃げる形で押す。
 */
async function leaveTenPixels(page: Page) {
  await page.locator(".action-bar-inner").evaluate((inner) => {
    const status = inner.querySelector(".action-bar-status");
    const actions = inner.querySelector(".action-bar-actions");
    if (!status || !actions) throw new Error("帯の状態と操作が見つかりません");
    const statusRect = status.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    if (actionsRect.top >= statusRect.bottom) throw new Error("帯の状態と操作が1行に並んでいません");
    const range = document.createRange();
    range.selectNodeContents(status);
    const used = range.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(inner).columnGap) || 0;
    const filler = document.createElement("span");
    filler.dataset.e2eFiller = "";
    filler.style.display = "inline-block";
    filler.style.width = `${Math.max(0, actionsRect.left - statusRect.left - gap - used - 10)}px`;
    status.appendChild(filler);
    // 詰めすぎて、押す前から折り返していないか
    if (actions.getBoundingClientRect().top >= status.getBoundingClientRect().bottom) {
      throw new Error("箱を足したら帯が折り返しました");
    }
  });
}

/** Server Action の呼び出し（下書きの保存と提出はこれで届く） */
function isServerAction(request: Request): boolean {
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

/** 必須の設問をすべて埋め、下書きが保存されるまで待つ */
async function fillAll(page: Page) {
  await page.getByRole("group", { name: "今回の選択" }).getByRole("button", { name: "甲", exact: true }).click();
  await page.getByRole("group", { name: "複数の選択" }).getByRole("checkbox", { name: "甲", exact: true }).check();
  for (let i = 1; i <= NUMBER_COUNT; i++) {
    await page.getByLabel(`数える実績 ${i}`, { exact: true }).fill(String(i));
  }
  await expect(barStatus(page)).toContainText("保存済み");
}

/** この人の回答の状態と、1問目の数値の答え */
function storedAnswer() {
  const response = fixture.db
    .prepare("SELECT id, status FROM form_responses WHERE form_id = ? AND employee_id = ?")
    .get(fixture.formId, fixture.employee.id) as { id: string; status: string } | undefined;
  const answer = response
    ? (fixture.db
        .prepare("SELECT value_number FROM form_answers WHERE response_id = ? AND question_id = ?")
        .get(response.id, `${fixture.formId}_number1`) as { value_number: number | null } | undefined)
    : undefined;
  return { status: response?.status ?? null, first: answer?.value_number ?? null };
}

test("配点を渡さず、同じ文言の単一選択とyes/noを下書き→再読込→提出で維持する", async ({ browser }) => {
  const singleId = (fixture.db.prepare("SELECT id FROM form_questions WHERE form_id = ? AND question_type = 'single'")
    .get(fixture.formId) as { id: string }).id;
  const yesNoId = `${fixture.formId}_yesno`;
  const singleScore = 918273;
  const yesScore = 564738;
  fixture.db.prepare("UPDATE form_questions SET options_json = ? WHERE id = ?").run(JSON.stringify([
    { value: "1", label: "同じ", score: 2 }, { value: "2", label: "同じ", score: singleScore },
  ]), singleId);
  const now = Date.now();
  fixture.db.prepare(`INSERT INTO form_questions
    (id, company_id, form_id, section, question_type, title, required, options_json, display_order, created_at, updated_at)
    VALUES (?, ?, ?, 'free', 'yesno', '文字列値の選択', 1, ?, 3, ?, ?)`).run(
    yesNoId, fixture.company.id, fixture.formId,
    JSON.stringify([{ value: "yes", label: "できた", score: yesScore }, { value: "no", label: "できない", score: 0 }]), now, now,
  );

  const { context, page } = await openAsEmployee(browser);
  const received: { kind: "document" | "action" | "rsc"; body: string }[] = [];
  // 遷移後のResponse.text()はブラウザが本文を破棄して読めないことがある。
  // APIResponseの本文を読み終えてから画面へ渡し、reloadのHTMLと保存応答を確実に検査する。
  await page.route((url) => url.pathname === `/me/forms/${fixture.formId}`, async (route) => {
    const request = route.request();
    const response = await route.fetch();
    const body = await response.text();
    received.push({
      kind: isServerAction(request) ? "action" : request.isNavigationRequest() ? "document" : "rsc",
      body,
    });
    await route.fulfill({ response, body });
  });
  const savedChoices = () => fixture.db.prepare(`SELECT a.question_id, a.value_number, a.value_json
    FROM form_answers a JOIN form_responses r ON r.id = a.response_id
    WHERE r.form_id = ? AND r.employee_id = ? AND a.question_id IN (?, ?) ORDER BY a.question_id`)
    .all(fixture.formId, fixture.employee.id, singleId, yesNoId);
  const expected = (yes: boolean) => [
    { question_id: singleId, value_number: singleScore, value_json: '["2"]' },
    { question_id: yesNoId, value_number: yes ? yesScore : 0, value_json: yes ? '["yes"]' : '["no"]' },
  ].sort((a, b) => a.question_id.localeCompare(b.question_id));
  try {
    const single = page.getByRole("group", { name: "今回の選択" }).getByRole("button", { name: "同じ", exact: true });
    const yesNo = page.getByRole("group", { name: "文字列値の選択" });
    await single.nth(1).click();
    await yesNo.getByRole("button", { name: "できた", exact: true }).click();
    await page.getByRole("group", { name: "複数の選択" }).getByRole("checkbox", { name: "甲", exact: true }).check();
    for (let i = 1; i <= NUMBER_COUNT; i++) await page.getByLabel(`数える実績 ${i}`, { exact: true }).fill(String(i));
    await expect(barStatus(page)).toContainText("保存済み");
    await expect.poll(savedChoices).toEqual(expected(true));

    await page.reload();
    await waitForHydration(page, "main button");
    await expect(single.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(single.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(yesNo.getByRole("button", { name: "できた", exact: true })).toHaveAttribute("aria-pressed", "true");
    // 再保存時も選択値を点数と取り違えず、非数値のnoは0点で提出できる
    await yesNo.getByRole("button", { name: "できない", exact: true }).click();
    await expect(barStatus(page)).toContainText("保存済み");
    await expect.poll(savedChoices).toEqual(expected(false));
    await submitButton(page).click();
    await page.getByRole("button", { name: "提出する", exact: true }).click();
    await expect(page.getByText("提出済み（内容は変更できません）", { exact: true })).toBeVisible();
    await expect.poll(savedChoices).toEqual(expected(false));
    await page.reload();
    await expect(page.getByText("提出済み（内容は変更できません）", { exact: true })).toBeVisible();
    expect(received.filter((r) => r.kind === "document").length).toBeGreaterThanOrEqual(2);
    expect(received.filter((r) => r.kind === "action").length).toBeGreaterThanOrEqual(3);
    for (const { body } of received) {
      expect(body).not.toContain(String(singleScore));
      expect(body).not.toContain(String(yesScore));
    }
  } finally {
    await context.close();
  }
});

test("数値欄にカーソルを置いたまま提出ボタンを押すと、確認の欄が開く", async ({ browser }) => {
  const { context, page } = await openAsEmployee(browser);
  try {
    const field = page.getByLabel(FIRST_NUMBER, { exact: true });
    await field.fill("12");
    await expect(barStatus(page)).toContainText("保存済み");
    await expect(field).toBeFocused();
    await leaveTenPixels(page);

    // 座標で押す（click() はボタンが動くのを待ってから押し直すので、人の押し方にならない）
    const box = await submitButton(page).boundingBox();
    if (!box) throw new Error("提出ボタンが見つかりません");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const onButton = await submitButton(page).evaluate(
      (button, [px, py]) => button.contains(document.elementFromPoint(px, py)),
      [x, y] as const,
    );
    expect(onButton, "押す点が提出ボタンの上にある（ほかの部品に覆われていない）").toBe(true);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();

    const heading = page.getByText("この内容で提出します", { exact: true });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    // 同じ値のまま欄を離れただけなので、下書きを予約し直さない
    await expect(barStatus(page)).toContainText("保存済み");
    await expect(field).toHaveValue("12");

    // 未入力の注記から、画面の上から数えて最初の未入力の欄（選ぶ設問の束）へ移れる
    await page.getByRole("button", { name: "最初の未入力の欄へ移る", exact: true }).click();
    await expect(page.getByRole("group", { name: "今回の選択" })).toBeFocused();
  } finally {
    await context.close();
  }
});

test("状態の文が変わっても、提出ボタンの左端と下端は動かない（1280・1024・800px）", async ({ browser }) => {
  const { context, page } = await openAsEmployee(browser);
  try {
    const field = page.getByLabel(FIRST_NUMBER, { exact: true });
    // 開いた直後は保存の状態を書かないので、先に1回保存しておく
    await field.fill("1");
    await expect(barStatus(page)).toContainText("保存済み");

    for (const width of [1280, 1024, 800]) {
      await page.setViewportSize({ width, height: 720 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const before = await place(page);

      // 変えた直後（保存待ち）から保存の後（保存済み）まで、描くたびの位置を控える
      const recorder = await recordFrames(page);
      await field.fill(String(width));
      await expect(barStatus(page)).toContainText("保存待ち");
      await expect(barStatus(page)).toContainText("保存済み");
      const frames = await recorder.evaluate((r) => r.stop());
      await recorder.dispose();
      expect(frames.some((f) => f.text.includes("保存待ち")), `${width}px: 保存待ちを描いた`).toBe(true);
      expect(frames.some((f) => f.text.includes("保存済み")), `${width}px: 保存済みを描いた`).toBe(true);
      const drift = Math.max(...frames.map((f) => Math.max(Math.abs(f.x - before.x), Math.abs(f.bottom - before.bottom))));
      expect(drift, `${width}px: 状態が変わる間のボタンのずれ`).toBeLessThan(0.5);

      // 締切の文などが長い会社でも同じ。状態に長い文を足しても、ボタンは動かない
      await barStatus(page).evaluate((status) => {
        const long = document.createElement("span");
        long.dataset.e2eLong = "";
        long.textContent = "／ 長い案内の文が続きます".repeat(12);
        status.appendChild(long);
      });
      // 帯の高さの書き戻し（ResizeObserver）が済んでから測る
      await nextFrames(page);
      const withLong = await place(page);
      expect(Math.abs(withLong.x - before.x), `${width}px: 長い文のときの左端のずれ`).toBeLessThan(0.5);
      expect(Math.abs(withLong.bottom - before.bottom), `${width}px: 長い文のときの下端のずれ`).toBeLessThan(0.5);
      await barStatus(page).evaluate((status) => status.querySelector("[data-e2e-long]")?.remove());
    }
  } finally {
    await context.close();
  }
});

test("下書きを保存している間に提出しても、押したときの値で1回だけ提出し、あとから下書きを送らない", async ({ browser }) => {
  const { context, page } = await openAsEmployee(browser);
  try {
    await fillAll(page);
    // 下書きの返事を遅らせ、「保存しています…」の間に提出まで進める
    await page.route(
      (url) => url.pathname === `/me/forms/${fixture.formId}`,
      async (route) => {
        if (isServerAction(route.request())) await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      },
    );
    const sent: Request[] = [];
    page.on("request", (request) => {
      if (isServerAction(request)) sent.push(request);
    });

    const field = page.getByLabel(FIRST_NUMBER, { exact: true });
    await field.fill("7");
    await expect(barStatus(page)).toContainText("保存しています…");
    // 保存の返事が来る前に値を変え、そのまま確認を開いて提出する（8 はまだどこにも保存されていない）
    await field.fill("8");
    await submitButton(page).click();
    const confirm = page.getByRole("button", { name: "提出する", exact: true });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText("提出済み（内容は変更できません）", { exact: true })).toBeVisible();
    await expect.poll(() => storedAnswer()).toEqual({ status: "submitted", first: 8 });
    // 提出のあとに下書きが届くと「提出済み」で断られる。遅らせた分より長く待っても、送ったのは下書き1件と提出1件だけ
    await page.waitForTimeout(2000);
    expect(sent.length, "送った保存の数（7 の下書きと、8 の提出）").toBe(2);
    await expect(page.getByText("保存できていません")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("ボタンを2回続けて押しても、確認を開くだけで提出せず、提出は1回しか送らない", async ({ browser }) => {
  const { context, page } = await openAsEmployee(browser);
  try {
    await fillAll(page);
    const sent: Request[] = [];
    page.on("request", (request) => {
      if (isServerAction(request)) sent.push(request);
    });

    // 2回目は、確認の欄の「提出する」（同じ場所に出る）に当たりうる。続けて押した2回目では提出しない
    await submitButton(page).dblclick();
    await expect(page.getByText("この内容で提出します", { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    expect(sent.length, "確認を開いただけで送った保存の数").toBe(0);
    expect(storedAnswer().status).toBe("draft");

    await page.getByRole("button", { name: "提出する", exact: true }).dblclick();
    await expect(page.getByText("提出済み（内容は変更できません）", { exact: true })).toBeVisible();
    await expect.poll(() => storedAnswer()).toEqual({ status: "submitted", first: 1 });
    await page.waitForTimeout(1000);
    expect(sent.length, "2回押したときに送った提出の数").toBe(1);
  } finally {
    await context.close();
  }
});
