/**
 * 貼り付け取り込みを、本物の表に対して通しで1周させる検査。
 *
 * 数値の読み取りだけを単体で確かめても、「読めなかった値が本当に保存されないか」
 * 「打たれた文字が残っているか」「理由が一覧に出るか」までは分からない。
 * ここでは極端な値を実際に流し、**保存された行の中身**で結果を確かめる。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: async () => (globalThis as { __testDb?: unknown }).__testDb };
});

const { importResponsesCsv } = await import("@/lib/import");

beforeEach(() => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

/** 「件数」（0以上・整数だけ）と「達成率」（0〜1000・小数あり）の2問を用意する */
async function seedTwoQuestions() {
  await seedCompany(current);
  await current.db.insert(s.formQuestions).values([
    {
      id: "fq_count", companyId: IDS.company, formId: IDS.form, section: "kpi",
      questionType: "number", title: "件数", displayOrder: 1, unit: "件",
      validationMin: 0, validationMax: null, validationInteger: true,
    },
    {
      id: "fq_rate", companyId: IDS.company, formId: IDS.form, section: "kpi",
      questionType: "number", title: "達成率", displayOrder: 2, unit: "%",
      validationMin: 0, validationMax: 1000, validationInteger: false,
    },
  ]);
}

const csv = (countCell: string, rateCell = "80") =>
  ["氏名,件数,達成率", `本人,${countCell},${rateCell}`].join("\n");

/** 保存された「件数」の答え1行を読む */
async function savedCount() {
  const rows = await current.db.select().from(s.formAnswers).where(eq(s.formAnswers.questionId, "fq_count"));
  return rows[0];
}

describe("受け付けられない値を実際に流したとき、何が保存されるか", () => {
  it("普通の値はそのまま保存される", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv("42"));

    expect(out.imported).toBe(1);
    expect(out.rows[0].unreadable).toBeUndefined();
    expect((await savedCount()).valueNumber).toBe(42);
  });

  it.each([
    ["マイナス", "-5", "0以上の数字"],
    ["整数だけの設問への小数", "3.7", "整数"],
    ["16進のような書き方", "0x10", "数字で入力"],
    ["1兆を超える数", "1000000000001", "桁を間違えていないか"],
    ["400桁の数", "9".repeat(400), "桁を間違えていないか"],
  ])("%s（%s）は点数に入れず、理由を一覧に出す", async (_label, cell, expectedWord) => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv(cell));

    // 行そのものは取り込む（1セルのために行を丸ごと捨てない）
    expect(out.imported).toBe(1);
    expect(out.skipped).toBe(0);

    // 理由が「何の設問の、どの値が、なぜ」の形で出ている
    const reasons = out.rows[0].unreadable ?? [];
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("件数");
    expect(reasons[0]).toContain(expectedWord);

    const saved = await savedCount();
    // 点数には入らない
    expect(saved.valueNumber).toBeNull();
    // 打たれた文字は消さずに残す（打ち間違いを直す手がかりを失わないため）
    expect(saved.valueText).toBe(cell);

    // 同じ行のもう1問（達成率）は、巻き添えにならず保存されている
    const rate = await current.db.select().from(s.formAnswers).where(eq(s.formAnswers.questionId, "fq_rate"));
    expect(rate[0].valueNumber).toBe(80);
  });

  it("400桁のような長いセルでも、一覧の文が短く収まる", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv("9".repeat(400)));
    const reason = (out.rows[0].unreadable ?? [])[0];
    expect(reason).toContain("全400文字");
    expect(reason.length).toBeLessThan(120);
  });

  it("上限ちょうど（1兆）は取り込む", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv("1000000000000"));
    expect(out.rows[0].unreadable).toBeUndefined();
    expect((await savedCount()).valueNumber).toBe(1_000_000_000_000);
  });

  it("表計算から混ざる書き方（全角・桁区切り・単位）は今までどおり読む", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, ["氏名,件数,達成率", "本人,\"1,200件\",８７.５"].join("\n"));
    expect(out.rows[0].unreadable).toBeUndefined();
    expect((await savedCount()).valueNumber).toBe(1200);
    const rate = await current.db.select().from(s.formAnswers).where(eq(s.formAnswers.questionId, "fq_rate"));
    expect(rate[0].valueNumber).toBe(87.5);
  });

  it("取り込む前の確認（保存しない）でも、同じ理由が出る", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv("-5"), { dryRun: true });
    expect(out.dryRun).toBe(true);
    expect((out.rows[0].unreadable ?? [])[0]).toContain("0以上の数字");
    // 確認だけなので、答えは1行も保存されていない
    expect(await current.db.select().from(s.formAnswers)).toHaveLength(0);
  });
});
