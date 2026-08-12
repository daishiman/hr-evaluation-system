import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate } from "./apply-master-update";

let testDb: TestDatabase;
const COMPANY = "cmp_revision";
const OTHER = "cmp_other";
const GRADE = "grd_revision";

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values([
    { id: COMPANY, name: "版管理社", slug: "revision" },
    { id: OTHER, name: "他社", slug: "other" },
  ]);
  await testDb.db.insert(s.grades).values([
    {
      id: GRADE,
      companyId: COMPANY,
      code: "beginner",
      name: "Beginner",
      pointGroup: "Beginner",
      displayOrder: 1,
    },
    {
      id: "grd_other",
      companyId: OTHER,
      code: "beginner",
      name: "他社Beginner",
      pointGroup: "Beginner",
      displayOrder: 1,
    },
  ]);
});

afterEach(() => testDb.close());

const apply = (body: Parameters<typeof applyMasterUpdate>[0]["body"], companyId = COMPANY) =>
  applyMasterUpdate({ db: testDb.db, companyId, viewerId: "viewer", body });

async function putGrade(id: string, text: string, opts: { seq?: number; active?: boolean; previous?: string } = {}) {
  await testDb.db.insert(s.gradeRequirements).values({
    id,
    companyId: COMPANY,
    gradeId: GRADE,
    category: "support",
    seq: opts.seq ?? 1,
    text,
    isActive: opts.active ?? true,
    previousVersionId: opts.previous,
  });
}

describe("等級・昇格要件の版管理", () => {
  it("内容を直すと新IDだけを追加し、旧行の全カラムと過去参照を変えない", async () => {
    await putGrade("greq_old", "以前の本文");
    await testDb.db.insert(s.evaluationCycles).values({
      id: "cyc_old",
      companyId: COMPANY,
      name: "過去期間",
      periodStart: "2025-04-01",
      periodEnd: "2025-09-30",
      status: "closed",
    });
    await testDb.db.insert(s.forms).values({
      id: "frm_old",
      companyId: COMPANY,
      gradeId: GRADE,
      cycleId: "cyc_old",
      title: "過去アンケート",
      status: "draft",
      publicToken: "old-token",
    });
    await testDb.db.insert(s.formQuestions).values({
      id: "fq_old",
      companyId: COMPANY,
      formId: "frm_old",
      section: "support",
      questionType: "yesno",
      title: "以前の本文",
      displayOrder: 1,
      gradeRequirementId: "greq_old",
    });
    testDb.raw.exec("PRAGMA foreign_keys = OFF");
    testDb.raw.exec(`
      INSERT INTO evaluation_requirements
        (id, company_id, evaluation_id, grade_requirement_id, category, text, achieved, created_at)
      VALUES ('er_old', '${COMPANY}', 'ev_old', 'greq_old', 'support', '以前の本文', 1, 1)
    `);
    testDb.raw.exec("PRAGMA foreign_keys = ON");
    const before = testDb.raw.prepare("SELECT * FROM grade_requirements WHERE id = 'greq_old'").get();

    const result = await apply({ kind: "gradeRequirementRevise", id: "greq_old", text: "新しい本文" });

    const oldAfter = testDb.raw.prepare("SELECT * FROM grade_requirements WHERE id = 'greq_old'").get();
    expect(oldAfter).toEqual(before);
    const next = testDb.raw
      .prepare("SELECT id, text, is_active, previous_version_id FROM grade_requirements WHERE id <> 'greq_old'")
      .get() as { id: string; text: string; is_active: number; previous_version_id: string };
    expect(next).toMatchObject({ text: "新しい本文", is_active: 1, previous_version_id: "greq_old" });
    expect(result).toMatchObject({ id: next.id, previousVersionId: "greq_old" });
    expect(testDb.raw.prepare("SELECT grade_requirement_id, title FROM form_questions WHERE id = 'fq_old'").get()).toEqual({
      grade_requirement_id: "greq_old",
      title: "以前の本文",
    });
    expect(
      testDb.raw.prepare("SELECT grade_requirement_id, text FROM evaluation_requirements WHERE id = 'er_old'").get(),
    ).toEqual({ grade_requirement_id: "greq_old", text: "以前の本文" });
    expect(
      testDb.raw
        .prepare(
          "SELECT id, text FROM grade_requirements AS current WHERE id NOT IN (SELECT previous_version_id FROM grade_requirements WHERE previous_version_id IS NOT NULL) AND is_active = 1",
        )
        .all(),
    ).toEqual([{ id: next.id, text: "新しい本文" }]);
  });

  it("同じ現在版への二重改訂は一方だけ成功する", async () => {
    await putGrade("greq_old", "以前の本文");
    const settled = await Promise.allSettled([
      apply({ kind: "gradeRequirementRevise", id: "greq_old", text: "案A" }),
      apply({ kind: "gradeRequirementRevise", id: "greq_old", text: "案B" }),
    ]);

    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    expect(
      Number(testDb.raw.prepare("SELECT count(*) AS n FROM grade_requirements WHERE previous_version_id = 'greq_old'").get()!.n),
    ).toBe(1);
  });

  it("10件ある区分でも改訂は成功し、停止中項目の再開は拒否する", async () => {
    for (let index = 1; index <= 10; index++) await putGrade(`greq_${index}`, `項目${index}`, { seq: index });
    await putGrade("greq_stopped", "停止中", { seq: 11, active: false });

    await expect(apply({ kind: "gradeRequirementRevise", id: "greq_1", text: "改訂後" })).resolves.toMatchObject({
      previousVersionId: "greq_1",
    });
    await expect(
      apply({ kind: "gradeRequirementActivation", id: "greq_stopped", isActive: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("他社IDは404で、id操作に等級・区分を偽装して送る契約自体がない", async () => {
    await testDb.db.insert(s.gradeRequirements).values({
      id: "greq_other",
      companyId: OTHER,
      gradeId: "grd_other",
      category: "operation",
      seq: 1,
      text: "他社本文",
    });

    await expect(apply({ kind: "gradeRequirementRevise", id: "greq_other", text: "攻撃" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("過去版の再開を拒否し、過去本文への復帰は現在版の次の新IDになる", async () => {
    await putGrade("greq_v1", "版1");
    const v2 = await apply({ kind: "gradeRequirementRevise", id: "greq_v1", text: "版2" });

    await expect(
      apply({ kind: "gradeRequirementActivation", id: "greq_v1", isActive: true }),
    ).rejects.toMatchObject({ status: 409 });
    const v3 = await apply({
      kind: "gradeRequirementRestoreContent",
      id: v2.id!,
      sourceVersionId: "greq_v1",
    });
    expect(v3).toMatchObject({ previousVersionId: v2.id });
    expect(
      testDb.raw.prepare("SELECT text, previous_version_id FROM grade_requirements WHERE id = ?").get(v3.id!),
    ).toEqual({ text: "版1", previous_version_id: v2.id });
  });

  it("昇格要件も意味変更を新IDにし、旧行を不変にする", async () => {
    await testDb.db.insert(s.promotionRequirements).values({
      id: "preq_old",
      companyId: COMPANY,
      gradeId: GRADE,
      kind: "report",
      transitionLabel: "Regular→Chief",
      seq: 1,
      text: "旧条件",
      isGate: true,
    });
    const before = testDb.raw.prepare("SELECT * FROM promotion_requirements WHERE id = 'preq_old'").get();

    const result = await apply({
      kind: "promotionRequirementRevise",
      id: "preq_old",
      text: "新条件",
      transitionLabel: "Regular→Chief",
      isGate: false,
    });

    expect(testDb.raw.prepare("SELECT * FROM promotion_requirements WHERE id = 'preq_old'").get()).toEqual(before);
    expect(
      testDb.raw.prepare("SELECT text, is_gate, previous_version_id FROM promotion_requirements WHERE id = ?").get(result.id!),
    ).toEqual({ text: "新条件", is_gate: 0, previous_version_id: "preq_old" });
  });

  it("DB制約が同一IDの意味変更と11件目の使用開始を直接拒否する", async () => {
    await putGrade("greq_immutable", "変更前");
    expect(() =>
      testDb.raw.exec("UPDATE grade_requirements SET text = '直接上書き' WHERE id = 'greq_immutable'"),
    ).toThrow(/semantic_immutable/);
    expect(testDb.raw.prepare("SELECT text FROM grade_requirements WHERE id = 'greq_immutable'").get()).toEqual({
      text: "変更前",
    });

    for (let index = 2; index <= 10; index++) {
      await putGrade(`greq_cap_${index}`, `上限${index}`, { seq: index });
    }
    expect(() =>
      testDb.raw.exec(`
        INSERT INTO grade_requirements
          (id, company_id, grade_id, category, seq, text, is_active)
        VALUES ('greq_eleventh', '${COMPANY}', '${GRADE}', 'support', 11, '11件目', 1)
      `),
    ).toThrow(/active_limit/);
    expect(testDb.raw.prepare("SELECT id FROM grade_requirements WHERE id = 'greq_eleventh'").get()).toBeUndefined();
  });

  it("テストD1のbatchは途中失敗時に先行書き込みもロールバックする", async () => {
    await putGrade("greq_existing", "既存");

    await expect(
      testDb.db.batch([
        testDb.db.insert(s.gradeRequirements).values({
          id: "greq_rolled_back",
          companyId: COMPANY,
          gradeId: GRADE,
          category: "operation",
          seq: 1,
          text: "残ってはいけない",
        }),
        testDb.db.insert(s.gradeRequirements).values({
          id: "greq_existing",
          companyId: COMPANY,
          gradeId: GRADE,
          category: "operation",
          seq: 2,
          text: "重複ID",
        }),
      ] as unknown as Parameters<typeof testDb.db.batch>[0]),
    ).rejects.toThrow();
    expect(testDb.raw.prepare("SELECT id FROM grade_requirements WHERE id = 'greq_rolled_back'").get()).toBeUndefined();
  });
});
