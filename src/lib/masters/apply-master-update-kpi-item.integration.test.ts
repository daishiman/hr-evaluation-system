import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate, KPI_FORMULA_CHANGED_NOTE } from "./apply-master-update";
import type { KpiAskingInput } from "./kpi-asking-update";

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
 *   - 聞き方（設問のひな形と式）は項目と一緒に保存する。式は文字（A, B…）で受けて設問IDで持つ（DD-016）
 *   - 回答を集めたアンケートが使う項目では、聞くことを足したり消したりできない（文言・式は直せる）
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
    /* 聞き方を決めずに作ると設問のひな形が無いので、アンケートに設問が出ないことと、どこで決めるかまで伝える。
       「基準を設定すれば使える」と読める文に戻すと、作り直しても足りないままの理由が分からなくなる */
    expect(result.message).toContain("アンケートに設問は出ず");
    expect(result.message).toContain("「内容を直す」から聞き方を決められます");
    expect(await testDb.db.select().from(s.kpiQuestions)).toEqual([]);
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

  it("名前・聞き方（計算式）・備考は直せ、式を変えたことの一言が返る", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemUpdate",
        id: "ki_2",
        name: "契約件数（改）",
        asking: { questions: [{ text: "契約した件数", validation: "0以上の整数" }], formula: "A × 2" },
        remarks: "備考テスト",
      },
    });

    expect(result.message).toContain("契約件数（改）");
    /* 評価セットで選ばれている（使用中の）項目の式を変えると、確定前の評価の点が変わる */
    expect(result.warnings).toEqual([KPI_FORMULA_CHANGED_NOTE]);
    const after = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(after.name).toBe("契約件数（改）");
    expect(after.formula).toBe("q2_1 × 2");
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

describe("実績の聞き方（DD-016）", () => {
  const questionsOf = async (itemId: string) =>
    (await testDb.db.select().from(s.kpiQuestions).where(eq(s.kpiQuestions.kpiItemId, itemId))).sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  const update = (asking: KpiAskingInput) =>
    applyMasterUpdate({ db: testDb.db, companyId: COMPANY, viewerId: "viewer", body: { kind: "kpiItemUpdate", id: "ki_2", asking } });
  const asksTwo = {
    questions: [
      { key: "q2_1", text: "契約した件数", unit: "件", validation: "0以上の整数" as const },
      { key: "q2_2", text: "商談した件数", unit: "", validation: "1以上の整数" as const },
    ],
    formula: "A ÷ B × 100",
  };

  /* 見本と同じく、設問の並びは会社全体の通し番号、単位なしは「-」で入っている */
  const seedTwoQuestions = async () => {
    await testDb.db.insert(s.kpiQuestions).values([
      { id: "kq_2_1", companyId: COMPANY, kpiItemId: "ki_2", questionKey: "q2_1", text: "契約した件数", unit: "件", validation: "0以上の整数", role: "numerator", targetGrades: "Chief以上", displayOrder: 10 },
      { id: "kq_2_2", companyId: COMPANY, kpiItemId: "ki_2", questionKey: "q2_2", text: "商談した件数", unit: "-", validation: "1以上の整数", role: "denominator", targetGrades: "Chief以上", displayOrder: 11 },
    ]);
    await testDb.db.update(s.kpiItems).set({ formula: "q2_1 ÷ q2_2 × 100" }).where(eq(s.kpiItems.id, "ki_2"));
  };

  const seedForm = async (status: "draft" | "published" | "closed", keys: string[]) => {
    await testDb.db.insert(s.grades).values({ id: "g_1", companyId: COMPANY, code: "G1", name: "等級1", pointGroup: "Chief", displayOrder: 1 });
    await testDb.db.insert(s.evaluationCycles).values({ id: "cy_1", companyId: COMPANY, name: "2026年度上期", periodStart: "2026-04-01", periodEnd: "2026-09-30" });
    await testDb.db.insert(s.forms).values({ id: "f_1", companyId: COMPANY, gradeId: "g_1", cycleId: "cy_1", title: "上期の振り返り", status, publicToken: "tok_kpi_item" });
    await testDb.db.insert(s.formQuestions).values(
      keys.map((key, i) => ({
        id: `fq_${i}`,
        companyId: COMPANY,
        formId: "f_1",
        section: "kpi",
        questionType: "number",
        title: key,
        displayOrder: i + 1,
        kpiItemId: "ki_2",
        kpiQuestionKey: key,
      })),
    );
  };

  it("作るときに聞き方を決めると、設問のひな形と設問IDの式ができ、役割は式から決まる", async () => {
    const result = await applyMasterUpdate({
      db: testDb.db,
      companyId: COMPANY,
      viewerId: "viewer",
      body: {
        kind: "kpiItemCreate",
        name: "成約率",
        measureType: "個人実績",
        unit: "%",
        direction: "higher",
        asking: {
          questions: [
            { text: "成約した件数", unit: "件", validation: "0以上の整数" },
            { text: "提案した件数", unit: "件", validation: "1以上の整数" },
          ],
          formula: "A ÷ B × 100",
        },
      },
    });

    expect(result.message).toContain("2つのこと");
    expect(result.message).toContain("ランクの基準");
    const item = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, result.id!)))[0];
    expect(item.formula).toBe("q3_1 ÷ q3_2 × 100");
    expect(
      (await questionsOf(result.id!)).map((q) => [q.questionKey, q.text, q.role, q.inputType, q.required, q.displayOrder]),
    ).toEqual([
      ["q3_1", "成約した件数", "numerator", "number", true, 301],
      ["q3_2", "提案した件数", "denominator", "number", true, 302],
    ]);
    const events = await testDb.db.select().from(s.constitutionEvents).where(eq(s.constitutionEvents.entityId, result.id!));
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].afterJson!).asking).toBe("q3_1 成約した件数（件・0以上の整数）／q3_2 提案した件数（件・1以上の整数）");
  });

  it("設問の無い項目に聞き方を足せる", async () => {
    const result = await update({ questions: [{ text: "契約した件数", validation: "0以上の整数" }], formula: "A" });
    expect(result.message).toBe("「契約件数」を保存しました。");
    expect((await questionsOf("ki_2")).map((q) => [q.questionKey, q.role])).toEqual([["q2_1", "direct"]]);
  });

  it("見た目の変わらない保存では、設問も監査記録も書き換えない（単位の「-」と空は同じ）", async () => {
    await seedTwoQuestions();
    const before = await questionsOf("ki_2");

    const result = await update(asksTwo);

    expect(result.message).toBe("変更はありませんでした。");
    expect(await questionsOf("ki_2")).toEqual(before);
    expect(await testDb.db.select().from(s.constitutionEvents)).toEqual([]);
  });

  it("文言と並びを変えると、変わった設問だけを直し、役割は並べ替えた後の式から決め直す", async () => {
    await seedTwoQuestions();

    await update({
      questions: [
        { key: "q2_2", text: "商談した件数", validation: "1以上の整数" },
        { key: "q2_1", text: "契約まで進んだ件数", unit: "件", validation: "0以上の整数" },
      ],
      formula: "B ÷ A × 100",
    });

    expect((await questionsOf("ki_2")).map((q) => [q.questionKey, q.text, q.role, q.displayOrder, q.unit, q.targetGrades])).toEqual([
      ["q2_2", "商談した件数", "denominator", 10, null, "Chief以上"],
      ["q2_1", "契約まで進んだ件数", "numerator", 11, "件", "Chief以上"],
    ]);
    const item = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(item.formula).toBe("q2_1 ÷ q2_2 × 100");
    const events = await testDb.db.select().from(s.constitutionEvents);
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].beforeJson!).asking).toContain("q2_1 契約した件数");
    expect(JSON.parse(events[0].afterJson!).asking).toContain("q2_1 契約まで進んだ件数");
  });

  it("足した設問には、作ったアンケートの設問が覚えているIDとも重ならない番号を振り、消した設問は消える", async () => {
    await seedTwoQuestions();
    /* 前に消した設問 q2_3 を、下書きのアンケートがまだ覚えている */
    await seedForm("draft", ["q2_1", "q2_3"]);

    await update({
      questions: [
        { key: "q2_1", text: "契約した件数", unit: "件", validation: "0以上の整数" },
        { text: "解約した件数", unit: "件", validation: "0以上の整数" },
      ],
      formula: "A − B",
    });

    expect((await questionsOf("ki_2")).map((q) => [q.questionKey, q.role, q.targetGrades])).toEqual([
      ["q2_1", "numerator", "Chief以上"],
      ["q2_4", "numerator", "Chief以上"],
    ]);
    const item = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_2")))[0];
    expect(item.formula).toBe("q2_1 − q2_4");
  });

  it.each(["published", "closed"] as const)("回答を集めた（%s の）アンケートが使う項目では、聞くことを足せず消せない", async (status) => {
    await seedTwoQuestions();
    await seedForm(status, ["q2_1", "q2_2"]);

    await expect(
      update({ questions: [...asksTwo.questions, { text: "解約した件数", validation: "0以上の整数" }], formula: "A ÷ B × 100 + C" }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("アンケート「上期の振り返り」がこの項目の設問で回答を集めている") });
    await expect(update({ questions: [asksTwo.questions[0]], formula: "A" })).rejects.toMatchObject({ status: 400 });
    expect((await questionsOf("ki_2")).map((q) => q.questionKey)).toEqual(["q2_1", "q2_2"]);
  });

  it("回答を集めたアンケートが使う項目でも、文言と式は直せる", async () => {
    await seedTwoQuestions();
    await seedForm("published", ["q2_1", "q2_2"]);

    const result = await update({
      questions: [{ ...asksTwo.questions[0], text: "契約まで進んだ件数" }, asksTwo.questions[1]],
      formula: "A ÷ B × 1000",
    });

    expect(result.warnings).toEqual([KPI_FORMULA_CHANGED_NOTE]);
    expect((await questionsOf("ki_2"))[0].text).toBe("契約まで進んだ件数");
  });

  it("この項目に無い設問IDは 409、同じ設問IDの2回送りは 400 で断り、何も書かない", async () => {
    await seedTwoQuestions();
    await testDb.db.insert(s.kpiItems).values({ id: "ki_9", companyId: COMPANY, no: 9, name: "別項目", measureType: "個人実績", unit: "件", direction: "higher" });
    await testDb.db.insert(s.kpiQuestions).values({ id: "kq_9_1", companyId: COMPANY, kpiItemId: "ki_9", questionKey: "q9_1", text: "別の設問", validation: "0以上の整数", role: "direct" });

    await expect(update({ questions: [{ key: "q9_1", text: "乗っ取り", validation: "0以上の整数" }], formula: "A" })).rejects.toMatchObject({ status: 409 });
    await expect(
      update({ questions: [asksTwo.questions[0], asksTwo.questions[0]], formula: "A ÷ B" }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await testDb.db.select().from(s.kpiQuestions).where(eq(s.kpiQuestions.id, "kq_9_1")))[0].text).toBe("別の設問");
  });

  it.each([
    ["A ÷ C", "計算式の「C」は使えません"],
    ["A × 100", "設問Bが計算式に入っていません"],
    ["A ÷ 【目標】", "【目標】は使えません"],
  ])("使えない式「%s」は画面と同じ文で断る", async (formula, message) => {
    await seedTwoQuestions();
    await expect(update({ ...asksTwo, formula })).rejects.toMatchObject({ status: 400, message: expect.stringContaining(message) });
  });

  it("固定枠と、画面で表せない設問を持つ項目は、聞き方を変えられない", async () => {
    await expect(
      applyMasterUpdate({
        db: testDb.db,
        companyId: COMPANY,
        viewerId: "viewer",
        body: { kind: "kpiItemUpdate", id: "ki_1", asking: { questions: [{ text: "達成件数", validation: "0以上の整数" }], formula: "A" } },
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("固定枠") });

    await testDb.db.insert(s.kpiQuestions).values({ id: "kq_2_1", companyId: COMPANY, kpiItemId: "ki_2", questionKey: "q2_1", text: "評価", validation: "3,2,1,0,-1 から選択", role: "direct", inputType: "select" });
    await expect(update({ questions: [{ key: "q2_1", text: "評価", validation: "0以上の整数" }], formula: "A" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("決まった値から選ぶ設問"),
    });
  });
});
