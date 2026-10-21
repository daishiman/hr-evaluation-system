import { expect, test, type Locator, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { signIn, switchCompany, waitForHydration } from "./support";

/*
 * アンケートの状態ごとの操作（src/lib/domain/form-transitions.ts）と、比べる警告の3種類の行
 * （src/lib/domain/comparison-gap.ts・comparison-items.ts）を、画面で確かめる。
 *
 * 確かめること
 *   1. 一覧のカード・1本の画面・回答一覧が、状態ごとに決まったボタンと欄だけを出す（下書き・公開中・締め切り済み）
 *   2. 締め切り済みには延長と催促を出さない。評価期間が終わると、新しい版も出さない
 *   3. 古い版の配布URL（/f/[token]）を開いた人に、いま配っている版へのリンクを出す（下書きの版は指さない）
 *   4. 比べる警告の表に、等級要件・行動指針・KPI項目の行が種類つきで並び、項目名からその行へ飛べる
 *   5. KPI項目の画面を開いたまま別の項目を指されても（# だけが変わる・戻る・警告の別の行から来る）、その項目を開く
 *
 * 前提にするデータ
 *   - ローカルの preview と、見本データ（scripts/seed-data.mjs）を入れたローカル D1（E2E_PERSIST_TO で保存先を指す）
 *   - 全体管理者のログイン状態（auth.setup.ts が保存する super@hyoka-demo.jp）
 *   - improvementFixture（e2e/improvement-db-fixture.ts）が試験ごとに作るもの:
 *       kyufu の会社に、regular の等級を写した E2E 等級（等級区分と行動指針の基準を引き継ぐ）、
 *       その等級の社員2人（employee・unanswered。どちらも未回答）、
 *       評価期間（受付中。使用中の評価セットを付ける）、
 *       公開中のアンケート1本（期限なし・自由設問2問。KPI・等級要件・行動指針の設問は無い）
 *   - この試験が足すもの（評価期間と等級の削除で一緒に消える。fixture の close が消す）:
 *       同じ等級の第1版（締め切り済み）・第3版（下書き・自由設問1問・回答なし）、fixture の版を第2版にする、
 *       E2E 等級の等級要件1件
 *   - 見本データに要るもの（無ければ前提の作成で止まる。3・4番目は試験の中で読む）:
 *       kyufu の使用中の評価セットに準備の不足が無い（下書きの「公開する」が出るため）、
 *       その評価セットで regular の等級区分の「使うKPI」が選んであり、固定枠でないKPI項目が2つ以上ある、
 *       regular の行動指針の基準に、使う観点が1つ以上ある
 *
 * 公開する・締め切る・新しい版を作る・作り直すは押さない（出ているか、出ていないかだけを見る）。
 * DB に書くのは前提の用意だけ。画面の札は src の定数を読み込まず、ここに書く（札が変わったら、この試験も見直す）。
 */

const PUBLISH = "公開する";
const CLOSE = "締め切る";
const REOPEN = "公開中に戻す";
const NEW_VERSION = "新しい版を作る";
const REBUILD = "いまの制度の設定から設問を作り直す";
const SAVE_PERIOD = "回答期間を保存する";
const EXTEND = "この内容で期限を延ばす";
const REMIND = "未回答の方への連絡文をコピーする";
const SHARE = "配布用のURL：";
const OPEN_GAP = "直すところを見る";
const GAP_TABLE = "いまの設定とこのアンケートの項目の比べ";

let fixture: ReturnType<typeof improvementFixture>;
test.beforeEach(() => {
  fixture = improvementFixture();
});
test.afterEach(() => fixture?.close());

interface FormRef {
  id: string;
  title: string;
  token: string;
}

/** fixture が作った公開中のアンケート */
function fixtureForm(): FormRef {
  const row = fixture.db.prepare("SELECT title, public_token AS token FROM forms WHERE id = ?").get(fixture.formId) as
    | { title: string; token: string }
    | undefined;
  if (!row) throw new Error("fixture のアンケートが見つかりません");
  return { id: fixture.formId, ...row };
}

/** 同じ評価期間・等級に、別の版を足す。版の番号は会社・評価期間・等級で重ならないこと */
function addVersion(version: number, status: "draft" | "published" | "closed", withQuestion = false): FormRef {
  const now = Date.now();
  const id = `${fixture.formId}_v${version}`;
  const ref = { id, title: `E2E 第${version}版 ${id.slice(-14)}`, token: `${id}_token` };
  fixture.db
    .prepare(
      "INSERT INTO forms (id, company_id, grade_id, cycle_id, title, version, status, public_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, fixture.company.id, fixture.grade.id, fixture.cycleId, ref.title, version, status, ref.token, now, now);
  if (withQuestion) {
    // 設問0件の下書きは「公開する」を出さない（公開の準備の不足になる）。出すかを見るために1問だけ置く
    fixture.db
      .prepare(
        "INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, required, display_order, created_at, updated_at) VALUES (?, ?, ?, 'free', 'text', '今期の振り返り', 1, 1, ?, ?)",
      )
      .run(`${id}_q`, fixture.company.id, id, now, now);
  }
  return ref;
}

/** 第1版（締め切り済み）・第2版（公開中。fixture のもの）・第3版（下書き・回答なし）を並べる */
function threeVersions() {
  // fixture は第1版で作るので、先に第2版へずらしてから第1版を足す（同じ版の番号は重ねられない）
  fixture.db.prepare("UPDATE forms SET version = 2 WHERE id = ?").run(fixture.formId);
  const closed = addVersion(1, "closed");
  const draft = addVersion(3, "draft", true);
  return { closed, published: fixtureForm(), draft };
}

/** 日本時間で days 日後の日付（YYYY-MM-DD。負なら前の日） */
function jstDate(days: number): string {
  return new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * fixture の会社へ切り替えてから開く（全体管理者は前の試験の会社を選んだままのことがある）。
 * 他社のアンケート1本の画面は notFound でサイドバーが無いので、切り替えはどの会社でも描ける一覧で行う
 */
async function openAsAdmin(page: Page, path: string) {
  await page.goto("/admin/forms");
  await switchCompany(page, fixture.company.name);
  await page.goto(path);
}

/** 一覧のカード。題名の行で見分ける（警告の表も card の枠を持つので、題名の行を持つ枠のうち内側を取る） */
function formCard(page: Page, title: string): Locator {
  return page.locator(".card").filter({ has: page.locator(".todo-row-title", { hasText: title }) }).last();
}

/** 出ているボタンと出ていないボタン。閉じた畳みの中のボタンは、見えないので数えない */
async function expectButtons(scope: Locator | Page, shown: readonly string[], hidden: readonly string[]) {
  for (const name of shown) await expect(scope.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of hidden) await expect(scope.getByRole("button", { name, exact: true })).toHaveCount(0);
}

test.describe("状態ごとに出す操作（form-transitions.ts）", () => {
  test("一覧のカードは、下書き・公開中・締め切り済みで決まったボタンだけを出す", async ({ page }) => {
    const { closed, published, draft } = threeVersions();
    await openAsAdmin(page, `/admin/forms?cycle=${fixture.cycleId}`);

    const draftCard = formCard(page, draft.title);
    const publishedCard = formCard(page, published.title);
    const closedCard = formCard(page, closed.title);
    await expect(draftCard).toContainText("下書き");
    await expect(publishedCard).toContainText("公開中");
    await expect(closedCard).toContainText("締め切り済み");

    // 下書き（回答なし・いちばん後の版）: 公開するだけ。まだ配らないので配布URLも出さない
    await expectButtons(draftCard, [PUBLISH], [CLOSE, NEW_VERSION]);
    await expect(draftCard.getByText(SHARE, { exact: true })).toHaveCount(0);

    // 公開中（期限なし）: 締め切ると配布URL。新しい版は、後の版（第3版）があるので古い版のカードには出さない
    await expectButtons(publishedCard, [CLOSE], [PUBLISH, NEW_VERSION]);
    await expect(publishedCard.getByText(SHARE, { exact: true })).toBeVisible();

    // 締め切り済み: 公開中に戻す道は無い。後の版があるので新しい版も出さない
    await expectButtons(closedCard, [], [PUBLISH, CLOSE, REOPEN, NEW_VERSION]);
    await expect(closedCard.getByText(SHARE, { exact: true })).toHaveCount(0);
  });

  test("1本の画面は、作り直し・回答期間の欄・後の版への道を状態ごとに出し分ける", async ({ page }) => {
    const { closed, published, draft } = threeVersions();

    // 下書き（回答なし）: その場で作り直せて、回答期間も直せる。新しい版は重ねない
    await openAsAdmin(page, `/admin/forms/${draft.id}`);
    await expectButtons(page, [REBUILD, SAVE_PERIOD], [NEW_VERSION]);

    // 公開中: 設問は変えない。回答期間は直せる。後の版（下書き）があるので、新しい版の代わりにそちらを指す
    await page.goto(`/admin/forms/${published.id}`);
    await expectButtons(page, [SAVE_PERIOD], [REBUILD, NEW_VERSION]);
    await expect(page.getByRole("link", { name: "第3版を開く", exact: true })).toHaveAttribute("href", `/admin/forms/${draft.id}`);

    // 締め切り済み: 回答期間の欄も出さず、理由を1行で出す
    await page.goto(`/admin/forms/${closed.id}`);
    await expect(page.getByText("締め切ったアンケートは回答期間を変えられません。")).toBeVisible();
    await expectButtons(page, [], [REBUILD, SAVE_PERIOD, NEW_VERSION]);
    await expect(page.getByRole("link", { name: "第3版を開く", exact: true })).toBeVisible();
  });

  test("回答一覧は、締め切り済みと下書きに延長と催促を出さず、公開中は締切を過ぎると催促だけを止める", async ({ page }) => {
    const { closed, published, draft } = threeVersions();

    // 締め切り済み: 延長の欄も催促の文面も出さず、代わりに理由を出す（未回答の2人がいても）
    await openAsAdmin(page, `/admin/forms/${closed.id}/responses`);
    await expect(page.getByText("2人がまだ回答していません")).toBeVisible();
    await expect(page.getByText("締め切ったため、催促の文面は出しません。")).toBeVisible();
    await expect(page.getByText("締め切ったアンケートは期限を延ばせません。")).toBeVisible();
    await expectButtons(page, [], [EXTEND, REMIND]);

    // 下書き: まだ配っていないので、どちらも出さない
    await page.goto(`/admin/forms/${draft.id}/responses`);
    await expect(page.getByText("まだ公開していないため、催促の文面は出しません。")).toBeVisible();
    await expect(page.getByText("このアンケートはまだ公開されていません。")).toBeVisible();
    await expectButtons(page, [], [EXTEND, REMIND]);

    // 公開中（期限なし）: 延長も催促も出す
    await page.goto(`/admin/forms/${published.id}/responses`);
    await expectButtons(page, [EXTEND, REMIND], []);

    // 公開中で締切を過ぎた: 催促だけ止め（期限が過去の文面になる）、延長は残す
    fixture.db.prepare("UPDATE forms SET closes_at = ? WHERE id = ?").run(jstDate(-2), published.id);
    await page.reload();
    await expect(page.getByText("回答期限を過ぎたため、催促の文面は出しません。")).toBeVisible();
    await expectButtons(page, [EXTEND], [REMIND]);
  });

  test("締め切り済みのいちばん後の版は「新しい版を作る」だけを出し、評価期間が終わるとそれも出さない", async ({ page }) => {
    fixture.db.prepare("UPDATE forms SET status = 'closed' WHERE id = ?").run(fixture.formId);
    const form = fixtureForm();

    await openAsAdmin(page, `/admin/forms?cycle=${fixture.cycleId}`);
    const card = formCard(page, form.title);
    await expect(card).toContainText("締め切り済み");
    await expectButtons(card, [NEW_VERSION], [PUBLISH, CLOSE, REOPEN]);
    await expect(card.getByText(SHARE, { exact: true })).toHaveCount(0);

    await page.goto(`/admin/forms/${form.id}`);
    await expect(page.getByText("締め切ったアンケートは回答期間を変えられません。")).toBeVisible();
    await expectButtons(page, [NEW_VERSION], [REBUILD, SAVE_PERIOD]);

    await page.goto(`/admin/forms/${form.id}/responses`);
    await expect(page.getByText("締め切ったため、催促の文面は出しません。")).toBeVisible();
    await expect(page.getByText("締め切ったアンケートは期限を延ばせません。")).toBeVisible();
    await expectButtons(page, [], [EXTEND, REMIND]);

    // 評価期間の終了: 回答を保存できず版も作れないので、新しい版も出さない
    fixture.db.prepare("UPDATE evaluation_cycles SET status = 'closed' WHERE id = ?").run(fixture.cycleId);
    await page.goto(`/admin/forms?cycle=${fixture.cycleId}`);
    await expect(formCard(page, form.title)).toContainText("締め切り済み");
    await expectButtons(formCard(page, form.title), [], [PUBLISH, CLOSE, REOPEN, NEW_VERSION]);
    await page.goto(`/admin/forms/${form.id}`);
    await expect(page.getByText("締め切ったアンケートは回答期間を変えられません。")).toBeVisible();
    await expectButtons(page, [], [NEW_VERSION, SAVE_PERIOD]);
  });
});

test("古い版の配布URLを開いた人には、いま配っている版へのリンクを出す（下書きの版は指さない）", async ({ browser }) => {
  fixture.db.prepare("UPDATE forms SET version = 2 WHERE id = ?").run(fixture.formId);
  const old = addVersion(1, "closed");
  const current = fixtureForm();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: test.info().project.use.baseURL });
  try {
    // 回答するのは E2E 等級の社員（どちらの版にも答えていない）
    const page = await context.newPage();
    await signIn(page, fixture.employee.account);
    await page.goto(`/f/${old.token}`);
    await expect(page.getByText("このアンケートは新しい版に切り替わったため、")).toBeVisible();
    const link = page.getByRole("link", { name: "新しい版のアンケート", exact: true });
    await expect(link).toHaveAttribute("href", `/f/${current.token}`);
    // 回答できる版があるときに「上長へ連絡」の締め切りの案内を出すと、行き止まりになる
    await expect(page.getByText("このアンケートは締め切られました。")).toHaveCount(0);
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === `/me/forms/${current.id}`);

    // 後の版が下書きだけなら、まだ配っていないので指さない。締め切りの案内に戻る
    fixture.db.prepare("UPDATE forms SET status = 'draft' WHERE id = ?").run(current.id);
    await page.goto(`/f/${old.token}`);
    await expect(page.getByText("このアンケートは締め切られました。")).toBeVisible();
    await expect(page.getByRole("link", { name: "新しい版のアンケート", exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

interface GapItem {
  kind: "等級要件" | "行動指針" | "KPI項目";
  id: string;
  name: string;
  href: string;
}

/**
 * 比べる警告に出る3種類の行を用意し、それぞれの行の飛び先を返す。
 * fixture のアンケートはどれも聞いていないので、3つとも「いまの設定にあって、このアンケートに無い」行になる
 */
function gapItems(): { requirement: GapItem; behavior: GapItem; kpi: [GapItem, GapItem] } {
  const now = Date.now();
  const gradeId = fixture.grade.id;
  const requirement = { id: `${gradeId}_req`, name: "E2E 記録をその日のうちに残す" };
  fixture.db
    .prepare(
      "INSERT INTO grade_requirements (id, company_id, grade_id, category, seq, text, is_active, created_at, updated_at) VALUES (?, ?, ?, 'support', 1, ?, 1, ?, ?)",
    )
    .run(requirement.id, fixture.company.id, gradeId, requirement.name, now, now);
  const grade = fixture.db.prepare("SELECT point_group AS pointGroup, behavior_band AS band FROM grades WHERE id = ?").get(gradeId) as {
    pointGroup: string;
    band: string | null;
  };
  const behavior = grade.band
    ? (fixture.db
        .prepare("SELECT id, aspect_name AS name FROM behavior_guidelines WHERE company_id = ? AND band = ? AND is_active = 1 ORDER BY seq LIMIT 1")
        .get(fixture.company.id, grade.band) as { id: string; name: string } | undefined)
    : undefined;
  const kpi = fixture.db
    .prepare(
      `SELECT k.id, k.name FROM scheme_items si JOIN kpi_items k ON k.id = si.kpi_item_id
       JOIN evaluation_cycles c ON c.scheme_id = si.scheme_id
       WHERE c.id = ? AND si.point_group = ? AND si.is_fixed_slot = 0 ORDER BY si.display_order`,
    )
    .all(fixture.cycleId, grade.pointGroup) as { id: string; name: string }[];
  if (!grade.band || !behavior || kpi.length < 2) {
    throw new Error("見本データに、regular の行動指針の基準（使う観点1つ以上）と、使用中の評価セットの regular の区分の固定枠でないKPI項目2つが必要です");
  }
  const kpiItem = (k: { id: string; name: string }): GapItem => ({
    kind: "KPI項目",
    ...k,
    href: `/admin/scheme?item=${encodeURIComponent(k.id)}#${encodeURIComponent(`kpi-item-${k.id}`)}`,
  });
  return {
    requirement: {
      kind: "等級要件",
      ...requirement,
      href: `/admin/masters/requirements?grade=${encodeURIComponent(gradeId)}#${encodeURIComponent(`grade-requirement-${requirement.id}`)}`,
    },
    behavior: {
      kind: "行動指針",
      ...behavior,
      href: `/admin/behavior?${new URLSearchParams({ grade: gradeId, band: grade.band })}#${encodeURIComponent(`behavior-guideline-${behavior.id}`)}`,
    },
    kpi: [kpiItem(kpi[0]), kpiItem(kpi[1])],
  };
}

/** 1本の画面で比べる警告を開き、その表を返す */
async function openGapTable(page: Page, formId: string): Promise<Locator> {
  await page.goto(`/admin/forms/${formId}`);
  await page.getByText(OPEN_GAP, { exact: true }).click();
  const table = page.getByRole("table", { name: GAP_TABLE });
  await expect(table).toBeVisible();
  return table;
}

/** 飛んだ先の URL（パス・クエリ・#）が行のリンクと同じ */
async function expectAt(page: Page, href: string) {
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === href);
}

/** KPI項目の画面で、opened の行だけが入力欄を開いている */
async function expectKpiOpened(page: Page, opened: GapItem, closed: GapItem) {
  const row = page.locator(`[id="kpi-item-${opened.id}"]`);
  await expect(row.getByRole("button", { name: "保存する", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "内容を直す", exact: true })).toHaveCount(0);
  await expect(page.locator(`[id="kpi-item-${closed.id}"]`).getByRole("button", { name: "内容を直す", exact: true })).toBeVisible();
}

test.describe("比べる警告の3種類の行（comparison-gap.ts）", () => {
  test("等級要件・行動指針・KPI項目の行を種類つきで出し、項目名からその行へ飛べる", async ({ page }) => {
    const items = gapItems();
    await openAsAdmin(page, `/admin/forms?cycle=${fixture.cycleId}`);
    const table = await openGapTable(page, fixture.formId);
    await expect(table.getByRole("columnheader")).toHaveText(["種類", "項目", "いまの設定", "このアンケート"]);
    for (const item of [items.requirement, items.behavior, ...items.kpi]) {
      const link = table.getByRole("link", { name: item.name, exact: true });
      await expect(link).toHaveAttribute("href", item.href);
      // has の内側は行の中で探すので、表を起点にしない（表から始めると「行の中の表」を探して見つからない）
      const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: item.name, exact: true }) });
      await expect(row.getByRole("cell").first()).toHaveText(item.kind);
    }

    // 等級要件 → その等級の等級要件の画面の、その行（id は系列の起点）
    await table.getByRole("link", { name: items.requirement.name, exact: true }).click();
    await expectAt(page, items.requirement.href);
    await expect(page.locator(`[id="grade-requirement-${items.requirement.id}"]`)).toBeInViewport();

    // 行動指針 → その等級の基準を開いた行動指針の画面の、その観点のカード
    const behaviorTable = await openGapTable(page, fixture.formId);
    await behaviorTable.getByRole("link", { name: items.behavior.name, exact: true }).click();
    await expectAt(page, items.behavior.href);
    await expect(page.locator(`[id="behavior-guideline-${items.behavior.id}"]`)).toBeInViewport();

    // KPI項目 → KPI項目の画面の、その項目の行を入力欄を開いた状態で
    const kpiTable = await openGapTable(page, fixture.formId);
    await kpiTable.getByRole("link", { name: items.kpi[0].name, exact: true }).click();
    await expectAt(page, items.kpi[0].href);
    await expect(page.locator(`[id="kpi-item-${items.kpi[0].id}"]`)).toBeInViewport();
    await expectKpiOpened(page, items.kpi[0], items.kpi[1]);
  });

  test("KPI項目の画面を開いたまま別の項目を指されても、その項目を開く", async ({ page }) => {
    const { kpi } = gapItems();
    const [first, second] = kpi;
    await openAsAdmin(page, first.href);
    await waitForHydration(page, "main fieldset button");
    await expectKpiOpened(page, first, second);

    // # だけが変わる（同じ画面の中のリンク）。?item= は変わらないので、部品が # を拾って開き直す
    await page.evaluate((id) => {
      window.location.hash = `kpi-item-${id}`;
    }, second.id);
    await expectKpiOpened(page, second, first);

    // 戻る（# が前の項目に戻る）
    await page.goBack();
    await expect(page).toHaveURL((url) => url.hash === `#${encodeURIComponent(`kpi-item-${first.id}`)}`);
    await expectKpiOpened(page, first, second);

    // 警告の別の行から来る（?item= が変わる）。画面の部品が作り直されなくても、指された項目を開く
    const table = await openGapTable(page, fixture.formId);
    await table.getByRole("link", { name: second.name, exact: true }).click();
    await expectAt(page, second.href);
    await expectKpiOpened(page, second, first);
  });
});
