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
  await testDb.db.insert(s.users).values({
    id: "viewer",
    name: "テスト操作者",
    email: "viewer@example.com",
    companyId: COMPANY,
    role: "COMPANY_ADMIN",
  });
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

async function putPromotion(id: string, text: string, opts: { seq?: number; kind?: "report" | "test" } = {}) {
  await testDb.db.insert(s.promotionRequirements).values({
    id,
    companyId: COMPANY,
    gradeId: GRADE,
    kind: opts.kind ?? "report",
    seq: opts.seq ?? 1,
    text,
    isGate: true,
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
    // 保存本体は操作の事実を返す。追従先・実績は saveMaster の followMessage が報告する。
    expect(result.message).toBe("等級要件の新しい版を作りました。");

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

  // 使用中の現行版（後に版が無い行）の並び
  const supportOrder = () =>
    testDb.raw
      .prepare(
        `SELECT id FROM grade_requirements WHERE category = 'support' AND is_active = 1
           AND id NOT IN (SELECT previous_version_id FROM grade_requirements WHERE previous_version_id IS NOT NULL)
         ORDER BY seq, id`,
      )
      .all();
  const reorderEvents = (entityType: string) =>
    testDb.raw
      .prepare("SELECT entity_id, before_json, after_json FROM constitution_events WHERE entity_type = ? AND event_type = 'reordered' ORDER BY entity_id")
      .all(entityType);

  it("等級要件は並び全体で保存し、動いた行だけを書いて行ごとに記録する。別区分・使わない行は動かさない", async () => {
    await putGrade("greq_a", "A", { seq: 10 });
    await putGrade("greq_b", "B", { seq: 30 });
    await putGrade("greq_c", "C", { seq: 70 });
    await putGrade("greq_off", "使わない", { seq: 50, active: false });
    await testDb.db.insert(s.gradeRequirements).values({
      id: "greq_operation",
      companyId: COMPANY,
      gradeId: GRADE,
      category: "operation",
      seq: 20,
      text: "運営",
    });

    // 長押しで中央を先頭へ（1回の操作で何段も動く）
    await expect(apply({ kind: "gradeRequirementOrder", ids: ["greq_c", "greq_a", "greq_b"] })).resolves.toMatchObject({
      message: "並び順を変更しました。",
    });
    expect(supportOrder()).toEqual([{ id: "greq_c" }, { id: "greq_a" }, { id: "greq_b" }]);
    // 今の番号（10・30・70）を配り直すので、使わない行（50）とは重ならない
    expect(
      testDb.raw.prepare("SELECT id, seq FROM grade_requirements WHERE category = 'support' ORDER BY id").all(),
    ).toEqual([
      { id: "greq_a", seq: 30 },
      { id: "greq_b", seq: 70 },
      { id: "greq_c", seq: 10 },
      { id: "greq_off", seq: 50 },
    ]);
    expect(reorderEvents("gradeRequirement")).toEqual([
      { entity_id: "greq_a", before_json: JSON.stringify({ seq: 10 }), after_json: JSON.stringify({ seq: 30 }) },
      { entity_id: "greq_b", before_json: JSON.stringify({ seq: 30 }), after_json: JSON.stringify({ seq: 70 }) },
      { entity_id: "greq_c", before_json: JSON.stringify({ seq: 70 }), after_json: JSON.stringify({ seq: 10 }) },
    ]);
    expect(testDb.raw.prepare("SELECT seq FROM grade_requirements WHERE id = 'greq_operation'").get()).toEqual({ seq: 20 });

    // 同じ並びを送り直しても書かない
    await expect(apply({ kind: "gradeRequirementOrder", ids: ["greq_c", "greq_a", "greq_b"] })).resolves.toEqual({
      message: "並び順は変わっていません。",
    });
    expect(reorderEvents("gradeRequirement")).toHaveLength(3);
  });

  it("等級要件の並びが今と食い違えば 409 で1行も書かない。知らない id は 404", async () => {
    await putGrade("greq_a", "A", { seq: 1 });
    await putGrade("greq_b", "B", { seq: 2 });
    await putGrade("greq_a2", "A改", { seq: 1, previous: "greq_a" });
    await putGrade("greq_off", "使わない", { seq: 3, active: false });
    await testDb.db.insert(s.gradeRequirements).values({
      id: "greq_operation",
      companyId: COMPANY,
      gradeId: GRADE,
      category: "operation",
      seq: 1,
      text: "運営",
    });
    const before = testDb.raw.prepare("SELECT id, seq FROM grade_requirements ORDER BY id").all();

    for (const ids of [
      ["greq_b"], // ほかの人が足した行を知らない
      ["greq_b", "greq_a2", "greq_operation"], // 別区分を混ぜた
      ["greq_b", "greq_a2", "greq_off"], // 使わない行を混ぜた
      ["greq_a", "greq_b"], // 先頭が古い版
      ["greq_off", "greq_b"], // 先頭が使わない行
      ["greq_b", "greq_b"], // 重複
    ]) {
      await expect(apply({ kind: "gradeRequirementOrder", ids })).rejects.toMatchObject({ status: 409 });
    }
    await expect(apply({ kind: "gradeRequirementOrder", ids: ["greq_missing"] })).rejects.toMatchObject({ status: 404 });
    // 別の会社からは見えない
    await expect(apply({ kind: "gradeRequirementOrder", ids: ["greq_b", "greq_a2"] }, OTHER)).rejects.toMatchObject({
      status: 404,
    });
    expect(testDb.raw.prepare("SELECT id, seq FROM grade_requirements ORDER BY id").all()).toEqual(before);
    expect(reorderEvents("gradeRequirement")).toEqual([]);

    // 現行版どうしなら並べ替えられる
    await apply({ kind: "gradeRequirementOrder", ids: ["greq_b", "greq_a2"] });
    expect(supportOrder()).toEqual([{ id: "greq_b" }, { id: "greq_a2" }]);
    // 記録は版の系列の根（最初の版の id）で数える
    expect(reorderEvents("gradeRequirement").map((row) => (row as { entity_id: string }).entity_id)).toEqual([
      "greq_a",
      "greq_b",
    ]);
  });

  it("昇格要件も並び全体で保存し、別種類は動かさない。食い違えば 409", async () => {
    await putPromotion("preq_a", "A", { seq: 2 });
    await putPromotion("preq_b", "B", { seq: 5 });
    await putPromotion("preq_c", "C", { seq: 9 });
    await putPromotion("preq_test", "テスト", { seq: 4, kind: "test" });

    await expect(
      apply({ kind: "promotionRequirementOrder", ids: ["preq_a", "preq_c", "preq_b"] }),
    ).resolves.toMatchObject({ message: "並び順を変更しました。" });
    expect(
      testDb.raw.prepare("SELECT id FROM promotion_requirements WHERE kind = 'report' ORDER BY seq, id").all(),
    ).toEqual([{ id: "preq_a" }, { id: "preq_c" }, { id: "preq_b" }]);
    expect(testDb.raw.prepare("SELECT seq FROM promotion_requirements WHERE id = 'preq_test'").get()).toEqual({ seq: 4 });
    expect(reorderEvents("promotionRequirement")).toHaveLength(2);

    await expect(
      apply({ kind: "promotionRequirementOrder", ids: ["preq_a", "preq_c", "preq_b", "preq_test"] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(apply({ kind: "promotionRequirementOrder", ids: ["preq_missing"] })).rejects.toMatchObject({
      status: 404,
    });
  });
});
