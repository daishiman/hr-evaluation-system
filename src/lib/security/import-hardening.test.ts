/**
 * 取り込みの入力の検査（DD-032 の10・17。APP-08・APP-14・IO-F5・IO-F6）。
 *
 * - 社員の取り込みは、氏名・所属を60字、メールを254字までにし、メールの形は zod で確かめる。
 * - 他社の人に当たった行は、他社に人がいることを示さない文言で止める。
 * - 回答の取り込みは、氏名だけで2人以上に当たる行を取り込まず、社員番号を求める。
 *
 * 本物の表に流し、返った行の状態と理由で確かめる（import.integration.test.ts と同じ土台）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: async () => (globalThis as { __testDb?: unknown }).__testDb };
});

const { importMembersCsv, importResponsesCsv } = await import("@/lib/import");

beforeEach(() => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

const OTHER_COMPANY_ROW = "この行は取り込めませんでした（全体管理者へお問い合わせください）";

describe("社員の取り込みの長さと形", () => {
  // 1つの試験で何度呼んでも、会社と所属は最初の1回だけ入れる
  const seeded = new WeakSet<object>();
  const preview = async (row: string, header = "氏名,メールアドレス,所属") => {
    if (!seeded.has(current)) {
      await seedCompany(current);
      seedMemberships(current);
      seeded.add(current);
    }
    return importMembersCsv(IDS.company, [header, row].join("\n"), { dryRun: true });
  };

  it("60字の氏名と所属は通す", async () => {
    const out = await preview(`${"氏".repeat(60)},ok@example.com,${"所".repeat(60)}`);
    expect(out.failed).toBe(0);
  });

  it("61字の氏名はエラーの行にする", async () => {
    const out = await preview(`${"氏".repeat(61)},long-name@example.com,`);
    expect(out.rows[0]).toMatchObject({ status: "エラー" });
    expect(out.rows[0].reason).toContain("60");
  });

  it("61字の所属はエラーの行にする", async () => {
    const out = await preview(`新人,long-dept@example.com,${"所".repeat(61)}`);
    expect(out.rows[0]).toMatchObject({ status: "エラー" });
    expect(out.rows[0].reason).toContain("60");
  });

  it("255字のメールはエラーの行にし、理由にメールの全体を写さない", async () => {
    const email = `${"a".repeat(243)}@example.com`;
    expect(email).toHaveLength(255);
    const out = await preview(`新人,${email},`);
    expect(out.rows[0]).toMatchObject({ status: "エラー" });
    expect(out.rows[0].reason ?? "").not.toContain(email);
  });

  it("8万字のメールは、形を見る前に長さで断る（長い値を正規表現に渡さない）", async () => {
    const email = `${"a".repeat(80_000)}@example.com`;
    const out = await preview(`新人,${email},`);
    expect(out.rows[0]).toMatchObject({ status: "エラー" });
    expect(out.rows[0].reason).toContain("254");
  });

  it("形の崩れたメールはエラーの行にする", async () => {
    for (const email of ["a@b..c", "a@@example.com", "a b@example.com"]) {
      const out = await preview(`新人,${email},`);
      expect(out.rows[0], email).toMatchObject({ status: "エラー" });
    }
  });

  it("他社の人に当たった行は、他社に人がいることを示さない文言で止める", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await current.db.insert(s.companies).values({ id: "cmp_other", name: "別の会社", slug: "other" });
    const out = await importMembersCsv(
      "cmp_other",
      ["氏名,メールアドレス", "本人,emp@example.com"].join("\n"),
      { dryRun: true },
    );
    expect(out.rows[0]).toMatchObject({ status: "エラー", reason: OTHER_COMPANY_ROW });
    expect(out.rows[0].reason).not.toContain("他社");
  });
});

describe("回答の取り込みで、同じ氏名の人が2人いるとき", () => {
  async function seedTwoNamesakes() {
    await seedCompany(current);
    await current.db.update(s.users).set({ employeeCode: "E-1" }).where(eq(s.users.id, IDS.employee));
    await current.db.insert(s.users).values({
      id: "usr_emp2",
      name: "本人",
      email: "emp2@example.com",
      companyId: IDS.company,
      role: "EMPLOYEE",
      gradeId: IDS.gradeFrom,
      officeId: IDS.office,
      managerId: IDS.evaluator,
      employeeCode: "E-2",
    });
    seedMemberships(current);
    await current.db.insert(s.formQuestions).values({
      id: "fq_count", companyId: IDS.company, formId: IDS.form, section: "kpi",
      questionType: "number", title: "件数", displayOrder: 1, unit: "件",
      validationMin: 0, validationMax: null, validationInteger: true,
    });
  }

  it("社員番号の無い行は取り込まず、社員番号を求める", async () => {
    await seedTwoNamesakes();
    const out = await importResponsesCsv(IDS.company, IDS.form, ["氏名,件数", "本人,42"].join("\n"), { dryRun: true });
    expect(out.imported).toBe(0);
    expect(out.rows[0].reason).toContain("社員番号");
  });

  it("社員番号の列があれば、その人の回答として取り込める", async () => {
    await seedTwoNamesakes();
    const out = await importResponsesCsv(
      IDS.company,
      IDS.form,
      ["氏名,社員番号,件数", "本人,E-2,42"].join("\n"),
    );
    expect(out.imported).toBe(1);
    const saved = await current.db.select().from(s.formResponses).where(eq(s.formResponses.formId, IDS.form));
    expect(saved.map((r) => r.employeeId)).toEqual(["usr_emp2"]);
  });
});
