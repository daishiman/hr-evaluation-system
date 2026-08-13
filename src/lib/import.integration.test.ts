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

const { importMembersCsv, importResponsesCsv } = await import("@/lib/import");

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
  ])("%s（%s）は確認で理由を出し、本取込は全体を止める", async (_label, cell, expectedWord) => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv(cell), { dryRun: true });

    expect(out.imported).toBe(0);
    expect(out.skipped).toBe(1);

    // 理由が「何の設問の、どの値が、なぜ」の形で出ている
    const reasons = out.rows[0].unreadable ?? [];
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("件数");
    expect(reasons[0]).toContain(expectedWord);

    await expect(importResponsesCsv(IDS.company, IDS.form, csv(cell))).rejects.toMatchObject({ status: 409 });
    expect(await current.db.select().from(s.formAnswers)).toHaveLength(0);
  });

  it("400桁のような長いセルでも、一覧の文が短く収まる", async () => {
    await seedTwoQuestions();
    const out = await importResponsesCsv(IDS.company, IDS.form, csv("9".repeat(400)), { dryRun: true });
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

  it("2行目が不正なら1行目も保存せず、既存回答を保持する", async () => {
    await seedTwoQuestions();
    await importResponsesCsv(IDS.company, IDS.form, csv("10"));

    await expect(
      importResponsesCsv(
        IDS.company,
        IDS.form,
        ["氏名,件数,達成率", "本人,20,90", "存在しない方,30,95"].join("\n"),
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect((await savedCount()).valueNumber).toBe(10);
    expect(await current.db.select().from(s.formResponses)).toHaveLength(1);
  });

  it("2人目のDB保存に失敗したら、1人目の既存回答も旧値へrollbackする", async () => {
    await seedTwoQuestions();
    await current.db.insert(s.users).values({
      id: "usr_emp_2", name: "本人2", email: "emp2@example.com", companyId: IDS.company,
      role: "EMPLOYEE", gradeId: IDS.gradeFrom, officeId: IDS.office,
    });
    await importResponsesCsv(IDS.company, IDS.form, csv("10"));
    current.raw.exec(`CREATE TRIGGER fail_second_csv_answer BEFORE INSERT ON form_answers
      WHEN NEW.response_id IN (SELECT id FROM form_responses WHERE employee_id = 'usr_emp_2')
      BEGIN SELECT RAISE(ABORT, 'forced second row failure'); END;`);

    await expect(
      importResponsesCsv(
        IDS.company,
        IDS.form,
        ["氏名,件数,達成率", "本人,20,90", "本人2,30,95"].join("\n"),
      ),
    ).rejects.toThrow("forced second row failure");

    expect((await savedCount()).valueNumber).toBe(10);
    const second = await current.db.select().from(s.formResponses).where(eq(s.formResponses.employeeId, "usr_emp_2"));
    expect(second).toHaveLength(0);
  });

  it("成功時は復元用の変更前snapshotを同じbatchで残す", async () => {
    await seedTwoQuestions();
    await importResponsesCsv(IDS.company, IDS.form, csv("10"));
    await importResponsesCsv(IDS.company, IDS.form, csv("20"), { actorId: IDS.evaluator });

    const events = await current.db.select().from(s.importBatches)
      .where(eq(s.importBatches.kind, "responses"));
    expect(events).toHaveLength(2);
    expect(events[1].actorId).toBe(IDS.evaluator);
    expect(events[1].beforeJson).toContain("fq_count");
    expect(events[1].sourceHash).toHaveLength(64);
  });
});

describe("社員CSVの部分更新", () => {
  it("上長列が無いCSVでは、既存の上長を変更しない", async () => {
    await seedCompany(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,所属", "本人,emp@example.com,新しい部署"].join("\n"),
    );
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(employee.managerId).toBe(IDS.evaluator);
    expect(employee.department).toBe("新しい部署");
  });

  it("上長列があり値が空なら、明示的な解除として扱う", async () => {
    await seedCompany(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,上長", "本人,emp@example.com,"].join("\n"),
    );
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(employee.managerId).toBeNull();
  });

  it("CSV内の変更で上長関係が循環する場合は保存しない", async () => {
    await seedCompany(current);
    const out = await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,上長", "上長,mgr@example.com,本人"].join("\n"),
      { dryRun: true },
    );
    expect(out.failed).toBe(1);
    expect(out.rows[0].reason).toContain("循環");
    await expect(importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,上長", "上長,mgr@example.com,本人"].join("\n"),
    )).rejects.toMatchObject({ status: 409 });
    const [manager] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.evaluator));
    expect(manager.managerId).toBeNull();
  });

  it("1行でも不正なら、正しい行を含むファイル全体を保存しない", async () => {
    await seedCompany(current);
    await expect(importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,所属,等級", "本人,emp@example.com,変更後,Regular", "新規,new@example.com,新規部署,存在しない等級"].join("\n"),
    )).rejects.toMatchObject({ status: 409 });
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(employee.department).toBeNull();
    expect(await current.db.select().from(s.users).where(eq(s.users.email, "new@example.com"))).toHaveLength(0);
  });

  it("2人目のDB更新に失敗したら、1人目の変更もrollbackする", async () => {
    await seedCompany(current);
    current.raw.exec(`CREATE TRIGGER fail_second_member_update BEFORE UPDATE ON users
      WHEN NEW.id = '${IDS.evaluator}'
      BEGIN SELECT RAISE(ABORT, 'forced member failure'); END;`);
    await expect(importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,所属", "本人,emp@example.com,変更後1", "上長,mgr@example.com,変更後2"].join("\n"),
    )).rejects.toThrow("forced member failure");
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    const [manager] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.evaluator));
    expect(employee.department).toBeNull();
    expect(manager.department).toBeNull();
  });

  it("成功時は復元用の変更前snapshotを同じbatchで残す", async () => {
    await seedCompany(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,所属", "本人,emp@example.com,変更後"].join("\n"),
      { actorId: IDS.evaluator },
    );
    const [event] = await current.db.select().from(s.importBatches)
      .where(eq(s.importBatches.kind, "members"));
    expect(event.actorId).toBe(IDS.evaluator);
    expect(event.beforeJson).toContain("emp@example.com");
    expect(event.sourceHash).toHaveLength(64);
  });
});
