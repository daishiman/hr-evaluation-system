import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { switchCompany, waitForHydration } from "./support";

/**
 * 後から保存した方を正とする双方向の追従（DD-028・O27 の 3 件目・製品仕様 §27）を、画面から確かめる。
 *
 * 1. 設定 → アンケート: 行動指針の呼び名を直して保存すると、成功の直後に開いた下書きのアンケートが新しい名前で出る。
 *    そのアンケートを開いていた別のタブは、1秒以内に新しくなる
 * 2. アンケート → 設定: 下書きのアンケートで行動指針の設問の文を直して保存すると、行動指針の画面が新しい名前で出る。
 *    行動指針の画面を開いていた別のタブは、1秒以内に新しくなる
 *
 * 試験の行動指針は、この試験だけの基準セット（e2e_ の code）に置く。見本の会社の行動指針の名前は変えない。
 * 回答の無い下書きは improvementFixture のアンケートを下書きに戻して使い、行動指針の設問を1問足す。
 */

/** O3 の「1 秒以内」（e2e/data-freshness.spec.ts と同じ） */
const WITHIN_ONE_SECOND = 1_000;

const FORM_SAVED = "設問を保存しました";
const SETTING_SAVED = "保存しました";

let fixture: ReturnType<typeof improvementFixture>;
let guideline: { id: string; band: string; oldName: string; newName: string };

/** この試験だけの基準セット・観点・5段階を作り、試験の等級に割り当て、下書きのアンケートに行動指針の設問を足す */
function seedGuideline(): typeof guideline {
  const suffix = fixture.grade.id.slice(-8);
  const now = Date.now();
  const band = `${fixture.grade.id}_band`;
  const id = `${fixture.grade.id}_guideline`;
  const oldName = `E2E 創造性 ${suffix}`;
  const db = fixture.db;
  db.prepare(
    "INSERT INTO behavior_band_sets (id, company_id, code, name, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 90, 1, ?, ?)",
  ).run(`${band}_set`, fixture.company.id, band, `E2E 基準 ${suffix}`, now, now);
  db.prepare(
    "INSERT INTO behavior_guidelines (id, company_id, band, aspect, aspect_name, seq, is_active, created_at, updated_at) VALUES (?, ?, ?, 'creativity', ?, 1, 1, ?, ?)",
  ).run(id, fixture.company.id, band, oldName, now, now);
  const levels = [
    [3, "模範"],
    [2, "信頼"],
    [1, "安定"],
    [0, "不安定"],
    [-1, "悪影響"],
  ] as const;
  for (const [score, label] of levels) {
    db.prepare(
      "INSERT INTO behavior_levels (id, company_id, guideline_id, score, label, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(`${id}_lv${score}`, fixture.company.id, id, score, label, `${label}の行動の例`, now, now);
  }
  db.prepare("UPDATE grades SET behavior_band = ? WHERE id = ?").run(band, fixture.grade.id);
  db.prepare("UPDATE forms SET status = 'draft' WHERE id = ?").run(fixture.formId);
  const options = levels.map(([score, label]) => ({ value: String(score), label: `【${label}】${label}の行動の例`, score }));
  db.prepare(
    `INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, required, options_json, display_order, behavior_guideline_id, is_gate, created_at, updated_at)
     VALUES (?, ?, ?, 'behavior', 'single', ?, 1, ?, 0, ?, 0, ?, ?)`,
  ).run(`${id}_question`, fixture.company.id, fixture.formId, oldName, JSON.stringify(options), id, now, now);
  return { id, band, oldName, newName: `E2E 挑戦する姿勢 ${suffix}` };
}

/** 設問は観点を外部キーで指す（消しても連鎖しない）ので、アンケートを先に消してから観点と基準セットを消す */
function removeGuideline(): void {
  const db = fixture.db;
  db.prepare("DELETE FROM forms WHERE id = ?").run(fixture.formId);
  db.prepare("DELETE FROM constitution_events WHERE entity_id = ?").run(guideline.id);
  db.prepare("DELETE FROM behavior_guidelines WHERE id = ?").run(guideline.id);
  db.prepare("DELETE FROM behavior_band_sets WHERE company_id = ? AND code = ?").run(fixture.company.id, guideline.band);
}

test.beforeEach(() => {
  fixture = improvementFixture();
  guideline = seedGuideline();
});

test.afterEach(() => {
  if (!fixture) return;
  try {
    removeGuideline();
  } finally {
    fixture.close();
  }
});

const formPath = () => `/admin/forms/${fixture.formId}`;
const behaviorPath = () => `/admin/behavior?band=${encodeURIComponent(guideline.band)}`;

async function openForm(page: Page): Promise<void> {
  await page.goto(formPath());
  await waitForHydration(page, "main button");
}

async function openBehavior(page: Page): Promise<void> {
  await page.goto(behaviorPath());
  await waitForHydration(page, "main button");
}

/** 下書きのアンケートの、行動指針の設問の行（設問の並びの中だけを見る） */
function formQuestion(page: Page, name: string) {
  return page.getByRole("list", { name: "設問の並び" }).getByRole("listitem").filter({ hasText: name });
}

/** 行動指針の画面の、この観点のカード（比べる警告の飛び先と同じ id を持つ） */
function guidelineCard(page: Page) {
  return page.locator(`[id="behavior-guideline-${guideline.id}"]`);
}

async function expectWithin(locator: ReturnType<Page["locator"]>, label: string): Promise<void> {
  const started = Date.now();
  await expect(locator).toBeVisible({ timeout: WITHIN_ONE_SECOND });
  test.info().annotations.push({ type: label, description: String(Date.now() - started) });
}

test.describe("双方向の追従（行動指針の呼び名）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/forms");
    await switchCompany(page, fixture.company.name);
  });

  test("1. 設定 → アンケート: 呼び名を直すと、下書きのアンケートと開いていた別のタブが新しい名前になる", async ({ page, context }) => {
    await openForm(page);
    await expect(formQuestion(page, guideline.oldName)).toBeVisible();

    const writer = await context.newPage();
    await openBehavior(writer);
    const card = guidelineCard(writer);
    await card.getByRole("button", { name: "呼び名を直す" }).click();
    await card.getByRole("textbox", { name: "観点の呼び名" }).fill(guideline.newName);
    await card.getByRole("button", { name: "保存する", exact: true }).click();
    await expect(writer.getByRole("status").filter({ hasText: SETTING_SAVED })).toBeVisible();

    // 開いていた別のタブ（アンケート）は、保存の知らせを受けて1秒以内に取り直す
    await expectWithin(formQuestion(page, guideline.newName), "設定の保存から別のタブのアンケートへの反映（ミリ秒）");
    await expect(formQuestion(page, guideline.oldName)).toHaveCount(0);

    // 保存したタブで成功の直後に開いたアンケートも、新しい名前で出る
    await openForm(writer);
    await expect(formQuestion(writer, guideline.newName)).toBeVisible();
    await expect(formQuestion(writer, guideline.oldName)).toHaveCount(0);

    const saved = fixture.db
      .prepare("SELECT title FROM form_questions WHERE form_id = ? AND behavior_guideline_id = ?")
      .all(fixture.formId, guideline.id);
    expect(saved).toEqual([{ title: guideline.newName }]);
  });

  test("2. アンケート → 設定: 設問の文を直すと、行動指針の画面と開いていた別のタブが新しい名前になる", async ({ page, context }) => {
    await openBehavior(page);
    await expect(guidelineCard(page)).toContainText(guideline.oldName);

    const writer = await context.newPage();
    await openForm(writer);
    await formQuestion(writer, guideline.oldName).getByRole("button", { name: "内容を直す" }).click();
    await writer.getByRole("textbox", { name: "設問文" }).fill(guideline.newName);
    await writer.getByRole("button", { name: "設問を保存する", exact: true }).click();
    await expect(writer.getByRole("status").filter({ hasText: FORM_SAVED })).toBeVisible();

    // 開いていた別のタブ（行動指針）は、保存の知らせを受けて1秒以内に取り直す
    await expectWithin(
      guidelineCard(page).getByText(guideline.newName, { exact: true }),
      "アンケートの保存から別のタブの行動指針への反映（ミリ秒）",
    );

    // 保存したタブで成功の直後に開いた行動指針の画面も、新しい名前で出る
    await openBehavior(writer);
    await expect(guidelineCard(writer)).toContainText(guideline.newName);
    await expect(guidelineCard(writer)).not.toContainText(guideline.oldName);

    const saved = fixture.db.prepare("SELECT aspect_name AS name FROM behavior_guidelines WHERE id = ?").get(guideline.id);
    expect(saved).toEqual({ name: guideline.newName });
  });
});
