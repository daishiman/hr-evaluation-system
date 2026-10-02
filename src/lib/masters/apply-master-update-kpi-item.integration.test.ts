import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate } from "./apply-master-update";

/**
 * KPI項目の追加（kpiItemCreate）・更新（kpiItemUpdate）を、本物の移行ファイルの上で確かめる。
 *
 * 守りたい約束:
 *   - 追加した項目はその会社に属し、既存の番号の次の番号が振られる
 *   - 存在しないカテゴリは指定できない（作成・更新どちらも）
 *   - 使われていない項目は、単位・向き・実績区分・分類・金銭系も含めて自由に直せる
 *   - 一度でも使われた項目は、名前・計算式・備考は直せるが、単位・向き・実績区分・
 *     分類・金銭系は直せない（送っても無視され、警告が返る）
 *   - 他社の項目・カテゴリとは独立している
 */

let testDb: TestDatabase;
const COMPANY = "cmp_kpi_item";
const OTHER = "cmp_kpi_item_other";

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values([
    { id: COMPANY, name: "項目社", slug: "kpi-item" },
    { id: OTHER, name: "他社", slug: "kpi-item-other" },
  ]);
  await testDb.db.insert(s.users).values({
    id: "viewer",
    name: "テスト操作者",
    email: "viewer-kpi-item@example.com",
    companyId: COMPANY,
    role: "COMPANY_ADMIN",
  });
  await testDb.db.insert(s.kpiCategories).values([
    { id: "cat_a", companyId: COMPANY, code: "cat_a", name: "営業", displayOrder: 1 },
    { id: "cat_other", companyId: OTHER, code: "cat_other", name: "品質", displayOrder: 1 },
  ]);
  await testDb.db.insert(s.kpiItems).values([
    { id: "ki_1", companyId: COMPANY, no: 1, name: "等級要件達成率", categoryId: "cat_a", measureType: "個人実績", unit: "%", direction: "higher", isFixedSlot: true },
    { id: "ki_2", companyId: COMPANY, no: 2, name: "契約件数", categoryId: "cat_a", measureType: "個人実績", unit: "件", direction: "higher" },
  ]);
});

describe("KPI項目を追加する", () => {
  it("既存の番号の次で新しい項目を作る", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemCreate",
        name: "解約率",
        categoryId: "cat_a",
        measureType: "個人実績",
        unit: "%",
        direction: "lower",
      },
    });

    expect(result.message).toContain("解約率");
    const created = await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.name, "解約率"));
    expect(created).toHaveLength(1);
    expect(created[0].no).toBe(3);
    expect(created[0].isFixedSlot).toBe(false);
    expect(created[0].isActive).toBe(true);
  });

  it("存在しないカテゴリは指定できない", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: COMPANY,
        viewerId: "viewer",
        body: {
          kind: "kpiItemCreate",
          name: "解約率",
          categoryId: "cat_missing",
          measureType: "個人実績",
          unit: "%",
          direction: "lower",
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("他社のカテゴリは指定できない", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: COMPANY,
        viewerId: "viewer",
        body: {
          kind: "kpiItemCreate",
          name: "解約率",
          categoryId: "cat_other",
          measureType: "個人実績",
          unit: "%",
          direction: "lower",
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("KPI項目を更新する（使われていない場合は自由に直せる）", () => {
  it("単位・向き・実績区分・分類・金銭系も含めて直せる", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemUpdate",
        id: "ki_2",
        name: "新規契約件数",
        unit: "万円",
        direction: "lower",
        measureType: "チーム実績",
        isMonetary: true,
      },
    });

    expect(result.message).toBe("「新規契約件数」を保存しました。");
    const after = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(after.name).toBe("新規契約件数");
    expect(after.unit).toBe("万円");
    expect(after.direction).toBe("lower");
    expect(after.measureType).toBe("チーム実績");
    expect(after.isMonetary).toBe(true);
  });

  it("変更が無ければその旨を返す", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: { kind: "kpiItemUpdate", id: "ki_2" },
    });
    expect(result.message).toBe("変更はありませんでした。");
  });

  it("存在しないカテゴリへは変更できない", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: COMPANY,
        viewerId: "viewer",
        body: { kind: "kpiItemUpdate", id: "ki_2", categoryId: "cat_missing" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("他社の項目は見つからない扱いになる", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: OTHER,
        viewerId: "viewer",
        body: { kind: "kpiItemUpdate", id: "ki_2", name: "改ざん" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("KPI項目を更新する（使われている場合は一部の列だけ直せる）", () => {
  beforeEach(async () => {
    await testDb.db.insert(s.evaluationSchemes).values({ id: "scheme_1", companyId: COMPANY, name: "本体制度" });
    await testDb.db.insert(s.schemeItems).values({
      id: "si_1",
      companyId: COMPANY,
      schemeId: "scheme_1",
      pointGroup: "Chief",
      kpiItemId: "ki_2",
      weight: 10,
      displayOrder: 1,
    });
  });

  it("名前・計算式・備考は直せる", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemUpdate",
        id: "ki_2",
        name: "契約件数（改）",
        formula: "契約数 / 目標数",
        remarks: "備考テスト",
      },
    });

    expect(result.message).toContain("契約件数（改）");
    const after = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(after.name).toBe("契約件数（改）");
    expect(after.formula).toBe("契約数 / 目標数");
    expect(after.remarks).toBe("備考テスト");
  });

  it("単位・向き・実績区分・分類・金銭系は直せず、警告が返る", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemUpdate",
        id: "ki_2",
        unit: "万円",
        direction: "lower",
        measureType: "チーム実績",
        categoryId: null,
        isMonetary: true,
      },
    });

    expect(result.warnings).toBeDefined();
    const after = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(after.unit).toBe("件");
    expect(after.direction).toBe("higher");
    expect(after.measureType).toBe("個人実績");
    expect(after.categoryId).toBe("cat_a");
    expect(after.isMonetary).toBe(false);
  });
});
