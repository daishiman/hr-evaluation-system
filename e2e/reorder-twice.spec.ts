import { expect, test, type Page } from "@playwright/test";
import { improvementFixture } from "./improvement-db-fixture";
import { switchCompany, waitForHydration } from "./support";

// 並べ替えを2回続けると行が描かれなくなる Chromium の不具合（issues.chromium.org/379030050）の回帰を見る（DD-005。根は DD-017）。
// 報告のとおり、並べ替えて保存してから、もう一度並べ替えて元に戻す。ドラッグと矢印のボタンの両方で確かめる
const TEXTS = ["E2E 要件 一", "E2E 要件 二", "E2E 要件 三"];
const LIST = "支援についての並び";

let fixture: ReturnType<typeof improvementFixture>;
let requirementIds: string[] = [];
test.beforeEach(() => {
  fixture = improvementFixture();
  const now = Date.now();
  requirementIds = TEXTS.map((text, index) => {
    const id = `${fixture.grade.id}_req${index + 1}`;
    fixture.db
      .prepare(
        "INSERT INTO grade_requirements (id, company_id, grade_id, category, seq, text, is_active, created_at, updated_at) VALUES (?, ?, ?, 'support', ?, ?, 1, ?, ?)",
      )
      .run(id, fixture.company.id, fixture.grade.id, index + 1, text, now, now);
    return id;
  });
});
test.afterEach(() => {
  if (!fixture) return;
  // 並べ替えの監査記録は操作した人（全体管理者）の名で残るので、要件の id で消す。要件は等級の削除で一緒に消える
  const marks = requirementIds.map(() => "?").join(",");
  fixture.db
    .prepare(`DELETE FROM constitution_events WHERE entity_type = 'gradeRequirement' AND entity_id IN (${marks})`)
    .run(...requirementIds);
  fixture.close();
});

function list(page: Page) {
  return page.getByRole("list", { name: LIST });
}
function handles(page: Page) {
  return list(page).getByRole("button", { name: /番目『.+』を並べ替え$/ });
}
async function order(page: Page) {
  return handles(page).evaluateAll((els) => els.map((el) => /『(.+)』/.exec(el.getAttribute("aria-label") ?? "")?.[1]));
}
function savedOrder() {
  const rows = fixture.db
    .prepare("SELECT text FROM grade_requirements WHERE grade_id = ? AND is_active = 1 ORDER BY seq")
    .all(fixture.grade.id) as { text: string }[];
  return rows.map((row) => row.text);
}

async function drag(page: Page, from: number, to: number) {
  const source = await handles(page).nth(from).boundingBox();
  const target = await handles(page).nth(to).boundingBox();
  if (!source || !target) throw new Error("並べ替えつまみが見つかりません");
  const x = source.x + source.width / 2;
  await page.mouse.move(x, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** 保存が済み、画面の並びが expected で、どの行も描かれている（不具合では li の高さが 0 になる） */
async function expectSaved(page: Page, expected: string[]) {
  await expect.poll(savedOrder).toEqual(expected);
  await expect(list(page)).not.toHaveAttribute("aria-busy", "true");
  await expect.poll(() => order(page)).toEqual(expected);
  const rows = list(page).getByRole("listitem");
  await expect(rows).toHaveCount(expected.length);
  for (const row of await rows.all()) await expect(row).toBeVisible();
  await expect
    .poll(() => rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height > 0)))
    .toEqual(expected.map(() => true));
}

async function open(page: Page) {
  await page.goto("/admin/masters/requirements");
  await switchCompany(page, fixture.company.name);
  await page.goto(`/admin/masters/requirements?grade=${encodeURIComponent(fixture.grade.id)}`);
  await waitForHydration(page, "[data-reorder-handle]");
  expect(await order(page)).toEqual(TEXTS);
}

test("ドラッグで並べ替えてから、もう一度ドラッグで戻しても、行が消えない（DD-005）", async ({ page }) => {
  await open(page);
  await drag(page, 0, 1);
  await expectSaved(page, ["E2E 要件 二", "E2E 要件 一", "E2E 要件 三"]);
  await drag(page, 1, 0);
  await expectSaved(page, TEXTS);
});

test("矢印のボタンで並べ替えてから戻しても、行が消えない（DD-005）", async ({ page }) => {
  await open(page);
  await list(page).getByRole("button", { name: "『E2E 要件 一』を1つ下に移動", exact: true }).click();
  await expectSaved(page, ["E2E 要件 二", "E2E 要件 一", "E2E 要件 三"]);
  await list(page).getByRole("button", { name: "『E2E 要件 一』を1つ上に移動", exact: true }).click();
  await expectSaved(page, TEXTS);
});
