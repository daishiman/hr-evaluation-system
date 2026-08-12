import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate } from "./apply-master-update";

/**
 * KPIカテゴリの追加（kpiCategoryCreate）を、本物の移行ファイルの上で確かめる。
 *
 * 守りたい約束は3つ:
 *   - 追加したカテゴリはその会社に属し、末尾の並び順に入る
 *   - 同じ会社に同じ名前のカテゴリは作れない（画面での連打・二重送信対策）
 *   - 他社の名前とはぶつからない（会社ごとに独立した名前空間）
 */

let testDb: TestDatabase;
const COMPANY = "cmp_kpi_cat";
const OTHER = "cmp_kpi_cat_other";

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values([
    { id: COMPANY, name: "カテゴリ社", slug: "kpi-category" },
    { id: OTHER, name: "他社", slug: "kpi-category-other" },
  ]);
  await testDb.db.insert(s.users).values({
    id: "viewer",
    name: "テスト操作者",
    email: "viewer-kpi-cat@example.com",
    companyId: COMPANY,
    role: "COMPANY_ADMIN",
  });
  await testDb.db.insert(s.kpiCategories).values([
    { id: "cat_existing_1", companyId: COMPANY, code: "cat_existing_1", name: "営業", displayOrder: 1 },
    { id: "cat_existing_2", companyId: COMPANY, code: "cat_existing_2", name: "人事", displayOrder: 2 },
    { id: "cat_other", companyId: OTHER, code: "cat_other", name: "品質", displayOrder: 1 },
  ]);
});

describe("KPIカテゴリを追加する", () => {
  it("末尾の並び順で新しいカテゴリを作る", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: { kind: "kpiCategoryCreate", name: "品質" },
    });

    expect(result.message).toContain("品質");
    const created = await testDb.db.select().from(s.kpiCategories).where(eq(s.kpiCategories.name, "品質"));
    const own = created.filter((c) => c.companyId === COMPANY);
    expect(own).toHaveLength(1);
    expect(own[0].displayOrder).toBe(3);
  });

  it("同じ会社に同じ名前のカテゴリは作れない", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: COMPANY,
        viewerId: "viewer",
        body: { kind: "kpiCategoryCreate", name: "営業" },
      }),
    ).rejects.toMatchObject({ status: 400 });

    const rows = await testDb.db.select().from(s.kpiCategories).where(eq(s.kpiCategories.companyId, COMPANY));
    expect(rows).toHaveLength(2);
  });

  it("他社に同じ名前があっても作れる（会社ごとに独立）", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: { kind: "kpiCategoryCreate", name: "品質" },
    });
    expect(result.message).toContain("品質");
  });
});
