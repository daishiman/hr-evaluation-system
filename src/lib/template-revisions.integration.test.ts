import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { copyCompanyMasters } from "@/lib/template";

let testDb: TestDatabase;

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values([
    { id: "cmp_template_revision", name: "テンプレート", slug: "template-revision", isTemplate: true },
    { id: "cmp_new_revision", name: "新会社", slug: "new-revision" },
  ]);
  await testDb.db.insert(s.grades).values({
    id: "grd_template_revision",
    companyId: "cmp_template_revision",
    code: "beginner",
    name: "Beginner",
    pointGroup: "Beginner",
    displayOrder: 1,
  });
  await testDb.db.insert(s.gradeRequirements).values({
    id: "greq_template_v1",
    companyId: "cmp_template_revision",
    gradeId: "grd_template_revision",
    category: "support",
    seq: 1,
    text: "旧本文",
  });
  await testDb.db.insert(s.gradeRequirements).values({
    id: "greq_template_v2",
    companyId: "cmp_template_revision",
    gradeId: "grd_template_revision",
    category: "support",
    seq: 1,
    text: "現行本文",
    previousVersionId: "greq_template_v1",
  });
  await testDb.db.insert(s.promotionRequirements).values({
    id: "preq_template_v1",
    companyId: "cmp_template_revision",
    gradeId: "grd_template_revision",
    kind: "report",
    seq: 1,
    text: "旧昇格条件",
  });
  await testDb.db.insert(s.promotionRequirements).values({
    id: "preq_template_v2",
    companyId: "cmp_template_revision",
    gradeId: "grd_template_revision",
    kind: "report",
    seq: 1,
    text: "現行昇格条件",
    previousVersionId: "preq_template_v1",
  });
});

afterEach(() => testDb.close());

describe("版のある制度テンプレートの複製", () => {
  it("現在版だけを、新会社では系譜の起点として複製する", async () => {
    const counts = await copyCompanyMasters(testDb.db, "cmp_template_revision", "cmp_new_revision");

    expect(counts["等級要件"]).toBe(1);
    expect(counts["昇格要件"]).toBe(1);
    expect(testDb.raw.prepare("SELECT text, previous_version_id FROM grade_requirements WHERE company_id = ?").all("cmp_new_revision"))
      .toEqual([{ text: "現行本文", previous_version_id: null }]);
    expect(testDb.raw.prepare("SELECT text, previous_version_id FROM promotion_requirements WHERE company_id = ?").all("cmp_new_revision"))
      .toEqual([{ text: "現行昇格条件", previous_version_id: null }]);
  });
});
