/**
 * 貼り付け取り込みを、本物の表に対して通しで1周させる検査。
 *
 * 数値の読み取りだけを単体で確かめても、「読めなかった値が本当に保存されないか」
 * 「打たれた文字が残っているか」「理由が一覧に出るか」までは分からない。
 * ここでは極端な値を実際に流し、**保存された行の中身**で結果を確かめる。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
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

/** 「件数」（0以上・整数だけ）と「達成率」（0〜1000・小数あり）の2問を用意する */
async function seedTwoQuestions() {
  await seedCompany(current);
  seedMemberships(current);
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
    // 取り込みはこの会社の所属で人を探すので、足した人にも所属を作る
    seedMemberships(current);
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
    seedMemberships(current);
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
    seedMemberships(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,上長", "本人,emp@example.com,"].join("\n"),
    );
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(employee.managerId).toBeNull();
  });

  it("CSV内の変更で上長関係が循環する場合は保存しない", async () => {
    await seedCompany(current);
    seedMemberships(current);
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
    seedMemberships(current);
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
    seedMemberships(current);
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
    seedMemberships(current);
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

describe("社員CSVは会社ごとの値を、この会社の所属の行に書く（S7・D-004）", () => {
  /** 本人が、あとから別の会社にも所属した（元の所属はテスト社のまま） */
  async function joinOtherCompany() {
    await current.db.insert(s.companies).values({ id: "cmp_other", name: "別の会社", slug: "other" });
    await current.db.insert(s.companyMemberships).values({
      id: "mem_other", userId: IDS.employee, companyId: "cmp_other", role: "MANAGER",
      department: "別の会社の部署", createdAt: new Date(Date.now() + 60_000),
    });
  }
  const membershipOf = async (userId: string, companyId: string = IDS.company) =>
    (await current.db.select().from(s.companyMemberships)
      .where(and(eq(s.companyMemberships.userId, userId), eq(s.companyMemberships.companyId, companyId))))[0];

  it("新しく作った人には、この会社の所属の行を作る（社員の一覧・評価はこの行を読む）", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,役割,等級,所属,上長", "新人,new@example.com,マネージャー,Regular,営業部,上長"].join("\n"),
    );
    const [user] = await current.db.select().from(s.users).where(eq(s.users.email, "new@example.com"));
    const membership = await membershipOf(user.id);
    expect(membership).toMatchObject({
      role: "MANAGER", gradeId: IDS.gradeFrom, department: "営業部", managerId: IDS.evaluator,
    });
    // users の写しも元の所属と同じ値になる（版を戻したときの動き）
    expect(user).toMatchObject({ companyId: IDS.company, role: "MANAGER", department: "営業部" });
  });

  it("登録済みの人の変更は、この会社の所属の行に書く", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,役割,所属", "本人,emp@example.com,マネージャー,新しい部署"].join("\n"),
    );
    expect(await membershipOf(IDS.employee)).toMatchObject({ role: "MANAGER", department: "新しい部署" });
  });

  it("ほかの会社にも所属している人の所属は、この会社の行だけを変え、写しは元の所属のまま", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await joinOtherCompany();
    await importMembersCsv(
      "cmp_other",
      ["氏名,メールアドレス,所属", "本人,emp@example.com,別の会社の新しい部署"].join("\n"),
    );
    expect((await membershipOf(IDS.employee, "cmp_other")).department).toBe("別の会社の新しい部署");
    expect((await membershipOf(IDS.employee)).department).toBeNull();
    const [user] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(user).toMatchObject({ companyId: IDS.company, department: null });
  });

  it("ほかの会社にも所属している人の氏名・利用状態は、会社の管理者の取り込みでは変えない", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await joinOtherCompany();
    const rows = ["氏名,メールアドレス,利用状態", "本人（改名）,emp@example.com,利用停止"].join("\n");

    const preview = await importMembersCsv("cmp_other", rows, { dryRun: true });
    expect(preview.failed).toBe(1);
    expect(preview.rows[0].reason).toContain("全体管理者だけ");
    await expect(importMembersCsv("cmp_other", rows)).rejects.toMatchObject({ status: 409 });

    // 全体管理者の取り込みなら変えられる
    await importMembersCsv("cmp_other", rows, { crossesCompanies: true });
    const [user] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(user).toMatchObject({ name: "本人（改名）", isActive: false });
  });

  it("この会社に所属していない人のメールアドレスは、他社の人として止める", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await current.db.insert(s.companies).values({ id: "cmp_other", name: "別の会社", slug: "other" });
    const out = await importMembersCsv(
      "cmp_other",
      ["氏名,メールアドレス", "本人,emp@example.com"].join("\n"),
      { dryRun: true },
    );
    expect(out.rows[0]).toMatchObject({ status: "エラー", reason: "このメールアドレスは他社で使われています" });
  });

  it("社員番号の重なりは、この会社の所属の社員番号で見る", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await joinOtherCompany();
    await current.db.update(s.companyMemberships).set({ employeeCode: "E-1" })
      .where(eq(s.companyMemberships.id, "mem_other"));
    // テスト社では E-1 は誰も使っていない（別の会社の所属の番号とは重ならない）
    const ok = await importMembersCsv(IDS.company, ["氏名,メールアドレス,社員番号", "新人,new@example.com,E-1"].join("\n"), { dryRun: true });
    expect(ok.failed).toBe(0);
    const clash = await importMembersCsv("cmp_other", ["氏名,メールアドレス,社員番号", "新人,new@example.com,E-1"].join("\n"), { dryRun: true });
    expect(clash.rows[0].reason).toContain("本人さんが使っています");
  });
});

describe("社員CSVの等級（移行 0034 で書き換える前の名前）", () => {
  it("前の等級名でも同じ等級に結び、今の名前と重なるときは今の名前の等級を選ぶ", async () => {
    await seedCompany(current);
    seedMemberships(current);
    await current.db.update(s.grades).set({ name: "等級2" }).where(eq(s.grades.id, IDS.gradeFrom));
    await current.db.update(s.grades).set({ name: "等級3" }).where(eq(s.grades.id, IDS.gradeTo));
    // 移行のあとに、会社が前の名前「一般職」で新しい等級を作った
    await current.db.insert(s.grades).values([
      { id: "grd_beginner", companyId: IDS.company, code: "beginner", name: "等級1", pointGroup: "Beginner", displayOrder: 1, targetCap: 5 },
      { id: "grd_new", companyId: IDS.company, code: "ippan", name: "一般職", pointGroup: "Beginner", displayOrder: 9, targetCap: 5 },
    ]);
    const rewrite = {
      tableName: "grades",
      columnName: "name",
      companyId: IDS.company,
      migration: "0034_grade_display_names",
      recordedAt: new Date(),
    };
    await current.db.insert(s.displayNameRewrites).values([
      { ...rewrite, rowId: IDS.gradeFrom, oldValue: "等級２：Regular", newValue: "等級2" },
      { ...rewrite, rowId: IDS.gradeTo, oldValue: "等級３：Chief", newValue: "等級3" },
      { ...rewrite, rowId: "grd_beginner", oldValue: "一般職", newValue: "等級1" },
    ]);

    const out = await importMembersCsv(
      IDS.company,
      ["氏名,メールアドレス,等級", "本人,emp@example.com,等級３：Chief", "上長,mgr@example.com,一般職"].join("\n"),
    );

    expect(out.failed).toBe(0);
    const [employee] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    const [manager] = await current.db.select().from(s.users).where(eq(s.users.id, IDS.evaluator));
    expect(employee.gradeId).toBe(IDS.gradeTo);
    expect(manager.gradeId).toBe("grd_new");
  });
});

describe("回答CSVの設問（移行 0035 で直す前の設問名）", () => {
  it("前の設問名の列も同じ設問に結び、今の設問名と重なるときは今の名前の設問を選ぶ", async () => {
    await seedTwoQuestions();
    await current.db.insert(s.formQuestions).values({
      id: "fq_training", companyId: IDS.company, formId: IDS.form, section: "gate",
      questionType: "number", title: "スキルアップ研修（等級3以上）", displayOrder: 3, unit: "回",
      validationMin: 0, validationMax: null, validationInteger: true,
    });
    const rewrite = {
      tableName: "form_questions",
      columnName: "title",
      companyId: IDS.company,
      migration: "0035_migration_corrections",
      recordedAt: new Date(),
    };
    await current.db.insert(s.displayNameRewrites).values([
      { ...rewrite, rowId: "fq_training", oldValue: "スキルアップ研修（チーフ以上）", newValue: "スキルアップ研修（等級3以上）" },
      // 前の名前が、今ある別の設問の名前と同じ（今の名前の設問を選ぶ）
      { ...rewrite, rowId: "fq_rate", oldValue: "件数", newValue: "達成率" },
      // このアンケートに無い設問の記録（結ばない）
      { ...rewrite, rowId: "fq_other_form", oldValue: "別のアンケートの設問", newValue: "直したあとの設問" },
    ]);

    const out = await importResponsesCsv(
      IDS.company,
      IDS.form,
      ["氏名,件数,スキルアップ研修（チーフ以上）,別のアンケートの設問", "本人,7,2,9"].join("\n"),
    );

    expect(out.imported).toBe(1);
    expect(out.unmatchedHeaders).toEqual(["別のアンケートの設問"]);
    const answers = await current.db.select().from(s.formAnswers);
    const byQuestion = Object.fromEntries(answers.map((a) => [a.questionId, a.valueNumber]));
    expect(byQuestion).toEqual({ fq_count: 7, fq_training: 2 });
  });
});
