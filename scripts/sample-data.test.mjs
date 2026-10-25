import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { createTestDatabase } from "../src/test-support/sqlite-d1";
import {
  buildSampleSeed,
  assertSampleOnly,
  buildRemoveSql,
  SAMPLE_COMPANY_ID,
  SAMPLE_EMPLOYEES,
  SAMPLE_CYCLES,
  sampleEvaluatorComment,
} from "./sample-data.mjs";

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual("@/lib/db");
  return { ...actual, getDb: async () => globalThis.__sampleDb };
});

const { listStalledEvaluations } = await import("@/lib/stalled");
const { listCycleSubmissionRows, listFormSubmissionRows } = await import("@/lib/submission-queries");
const { buildEvaluationsForCycle } = await import("@/lib/evaluate");

/**
 * サンプルデータの検査。
 *
 * 見るのは2つ。
 *  1. 既にあるデータに触らないこと（今回いちばん壊してはいけない約束）。
 *  2. 画面で確かめたいこと（推移・等級ごとの違い・ランクのばらつき・コメントの有無・
 *     受付中の期で評価を作る流れ）が実際にデータとして入っていること。
 *     データが薄いと、画面を開いても何も分からない。
 */

/** 本物のパスワード作成は遅いので、検査では固定の文字列に置き換える。 */
const fakeHash = async (userId) => `hashed:${userId}`;

/** 受付中の期の締切は作った日で決まる。検査では日を決めて作り、いつ流しても同じ結果にする。 */
const TODAY = "2026-10-22";
/** 受付中の期（DD-029） */
const OPEN_CYCLE_ID = "cyc_sample_2026h2";
/** 利用者のIDから社員のキー（s1 など）を取り出す */
const keyOf = (userId) => userId.replace(/^usr_sample_/, "");

let seed;
const rowsOf = (table) => seed.tableRows.find(([t]) => t === table)?.[1] ?? [];

beforeAll(async () => {
  seed = await buildSampleSeed({ passwordHashFor: fakeHash, today: TODAY });
});

describe("既にあるデータに触らないこと", () => {
  it("投入SQLは INSERT だけで、他社の行を1つも指さない", () => {
    expect(assertSampleOnly(seed.sql)).toBe(true);
    expect(seed.sql.every((s) => s.trim().startsWith("INSERT INTO"))).toBe(true);
  });

  it("削除SQLはサンプル会社を指す文だけでできている", () => {
    expect(assertSampleOnly(seed.removeSql)).toBe(true);
    const deletes = seed.removeSql.filter((s) => s.startsWith("DELETE"));
    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes.every((s) => s.includes(SAMPLE_COMPANY_ID))).toBe(true);
  });

  it("入れた表はすべて削除SQLに出てくる（消し漏れがない）", () => {
    const removed = seed.removeSql.join("\n");
    for (const [table, rows] of seed.tableRows) {
      if (rows.length === 0) continue;
      expect(removed, `${table} を消す文がありません`).toContain(`DELETE FROM ${table} `);
    }
  });

  it("他社のIDが混ざった削除SQLは組み立て段階で止まる", () => {
    expect(() => assertSampleOnly(["DELETE FROM users WHERE company_id = 'cmp_kyufu';"])).toThrow();
    expect(() => assertSampleOnly(["UPDATE users SET name = 'x';"])).toThrow();
  });

  it("作る会社・利用者・評価はすべてサンプル会社のもの", () => {
    expect(rowsOf("companies").map((c) => c.id)).toEqual([SAMPLE_COMPANY_ID]);
    expect(rowsOf("users").every((u) => u.company_id === SAMPLE_COMPANY_ID)).toBe(true);
    // 所属も1人1件、サンプル会社だけ（他社との兼務の見本はサンプルには入れない）
    expect(rowsOf("company_memberships").map((m) => m.user_id)).toEqual(rowsOf("users").map((u) => u.id));
    expect(rowsOf("company_memberships").every((m) => m.company_id === SAMPLE_COMPANY_ID)).toBe(true);
    expect(rowsOf("evaluations").every((e) => e.company_id === SAMPLE_COMPANY_ID)).toBe(true);
  });
});

describe("画面で見えるべきものが入っていること", () => {
  /* 評価が付くのは「締め済み かつ 回答を作る」期だけ。
     締め済みでも `withResults: false` の期（2026年度上期）は評価を作らない。 */
  const evaluatedCycles = SAMPLE_CYCLES.filter((c) => c.status === "closed" && c.withResults !== false);

  it("確定済みの評価が 利用者数 × 評価のある期 の数だけある", () => {
    const evaluations = rowsOf("evaluations");
    expect(evaluations).toHaveLength(SAMPLE_EMPLOYEES.length * evaluatedCycles.length);
    expect(evaluations.every((e) => e.status === "finalized")).toBe(true);
    expect(evaluations.every((e) => e.finalized_at > 0)).toBe(true);
  });

  it("7つの等級がすべて評価に登場する（等級ごとの配点の違いを見比べられる）", () => {
    const grades = new Set(rowsOf("evaluations").map((e) => e.grade_id));
    expect(grades.size).toBe(7);
  });

  it("項目のランクは A〜E が一通り出る", () => {
    const ranks = new Set(rowsOf("evaluation_items").map((i) => i.rank));
    for (const rank of ["A", "B", "C", "D", "E"]) expect(ranks).toContain(rank);
  });

  it("上長コメントは、入っているものと入っていないものが両方ある", () => {
    const comments = rowsOf("evaluations").map((e) => e.evaluator_comment);
    expect(comments.some((c) => c === null)).toBe(true);
    expect(comments.some((c) => typeof c === "string" && c.length > 0)).toBe(true);
  });

  it("同じ人の点数が期ごとに変わる（推移として読める）", () => {
    const byEmployee = new Map();
    for (const e of rowsOf("evaluations")) {
      byEmployee.set(e.employee_id, [...(byEmployee.get(e.employee_id) ?? []), e.total_score]);
    }
    expect(byEmployee.size).toBe(SAMPLE_EMPLOYEES.length);
    const moved = [...byEmployee.values()].filter((scores) => new Set(scores).size > 1);
    // 全員が横ばいだと折れ線が平らになり、推移の画面が確かめられない
    expect(moved.length).toBeGreaterThanOrEqual(SAMPLE_EMPLOYEES.length - 1);
  });

  it("評価の内訳・行動指針・等級要件・昇格要件がそろっている", () => {
    for (const table of ["evaluation_items", "evaluation_requirements", "evaluation_gates", "evaluation_behaviors"]) {
      expect(rowsOf(table).length, table).toBeGreaterThan(0);
    }
  });

  it("評価はもとになった回答とつながっている（回答まで遡って確かめられる）", () => {
    const responseIds = new Set(rowsOf("form_responses").map((r) => r.id));
    expect(rowsOf("evaluations").every((e) => responseIds.has(e.response_id))).toBe(true);
  });

  it("回答を作らない期には、評価も回答も作らない", () => {
    const withoutResults = SAMPLE_CYCLES.filter((c) => c.withResults === false).map((c) => `cyc_sample_${c.key}`);
    expect(withoutResults.length).toBeGreaterThan(0);
    expect(rowsOf("evaluations").some((e) => withoutResults.includes(e.cycle_id))).toBe(false);
    expect(rowsOf("form_responses").some((r) => withoutResults.includes(r.cycle_id))).toBe(false);
  });

  it("締めた5期と受付中の1期を作る", () => {
    expect(SAMPLE_CYCLES.filter((c) => c.status === "closed")).toHaveLength(5);
    expect(SAMPLE_CYCLES.filter((c) => c.status === "open")).toHaveLength(1);
    expect(rowsOf("evaluation_cycles").map((c) => c.status)).toEqual(SAMPLE_CYCLES.map((c) => c.status));
  });

  it("締めた5期も受付中の期も、放置評価の一覧には1件も混ざらない", async () => {
    const current = createTestDatabase();
    globalThis.__sampleDb = current.db;
    try {
      for (const statement of seed.sql) current.raw.exec(statement);

      const evaluatedCycleIds = new Set(
        current.raw
          .prepare("SELECT cycle_id FROM evaluations WHERE company_id = ? AND status = 'finalized'")
          .all(SAMPLE_COMPANY_ID)
          .map((row) => row.cycle_id),
      );
      expect(evaluatedCycleIds.size).toBe(4);

      const emptyCycleId = "cyc_sample_2026h1";
      const emptyResponses = current.raw
        .prepare("SELECT count(*) AS count FROM form_responses WHERE company_id = ? AND cycle_id = ?")
        .get(SAMPLE_COMPANY_ID, emptyCycleId);
      const emptyEvaluations = current.raw
        .prepare("SELECT count(*) AS count FROM evaluations WHERE company_id = ? AND cycle_id = ?")
        .get(SAMPLE_COMPANY_ID, emptyCycleId);
      expect(emptyResponses.count).toBe(0);
      expect(emptyEvaluations.count).toBe(0);

      // #38 の問い合わせ本体まで通す。結果あり4期は全件確定済み、空期には提出回答も無い。
      // 受付中の期の提出済み（評価はまだ無い）は、締めるまで放置に数えない。
      const stalled = await listStalledEvaluations(SAMPLE_COMPANY_ID, {
        now: new Date("2027-01-01T00:00:00Z"),
      });
      expect(stalled).toEqual([]);
    } finally {
      current.close();
      delete globalThis.__sampleDb;
    }
  });
});

describe("受付中の期で、提出済みの回答から評価を作れること（DD-029）", () => {
  const openResponses = () => rowsOf("form_responses").filter((r) => r.cycle_id === OPEN_CYCLE_ID);
  const formsOf = (s) => s.tableRows.find(([t]) => t === "forms")[1].filter((f) => f.cycle_id === OPEN_CYCLE_ID);

  it("受付中の期は「2026年度 下期（サンプル）」の1つだけで、期間は 2026-10-01〜2027-03-31", () => {
    const open = rowsOf("evaluation_cycles").filter((c) => c.status === "open");
    expect(open.map(({ id, name, period_start, period_end }) => ({ id, name, period_start, period_end }))).toEqual([
      { id: OPEN_CYCLE_ID, name: "2026年度 下期（サンプル）", period_start: "2026-10-01", period_end: "2027-03-31" },
    ]);
  });

  it("アンケートは全等級ぶん公開中で、締切は期の終わりと作った日から14日後の遅い方", async () => {
    const forms = formsOf(seed);
    expect(forms).toHaveLength(rowsOf("grades").length);
    expect(forms.every((f) => f.status === "published")).toBe(true);
    // 期の終わりのほうが遅い日に作ったときは、期の終わりまで
    expect(forms.every((f) => f.closes_at === "2027-03-31")).toBe(true);
    // 期の終わりの直前に作ったときは、作った日から14日後まで（締切切れのまま見本を入れない）
    const late = await buildSampleSeed({ passwordHashFor: fakeHash, today: "2027-03-25" });
    expect(formsOf(late).every((f) => f.closes_at === "2027-04-08")).toBe(true);
  });

  it("提出済み（s1・s3・s5・s7・s9）、入力途中（s2・s6）、未回答（s4・s8・s10）が混ざる", () => {
    const statusOf = Object.fromEntries(openResponses().map((r) => [keyOf(r.employee_id), r.status]));
    // 未回答の人（管理者・マネージャーも含む）には回答の行そのものが無い
    expect(statusOf).toEqual({
      s1: "submitted", s3: "submitted", s5: "submitted", s7: "submitted", s9: "submitted",
      s2: "draft", s6: "draft",
    });
    const submitted = openResponses().filter((r) => r.status === "submitted");
    expect(submitted.every((r) => r.submitted_at > 0)).toBe(true);
    expect(openResponses().filter((r) => r.status === "draft").every((r) => r.submitted_at === null)).toBe(true);
  });

  it("提出済みは全設問に答え、入力途中は一部の設問だけに答えている", () => {
    expect(openResponses().length).toBeGreaterThan(0);
    for (const r of openResponses()) {
      const total = rowsOf("form_questions").filter((q) => q.form_id === r.form_id).length;
      const answered = rowsOf("form_answers").filter((a) => a.response_id === r.id).length;
      if (r.status === "submitted") expect(answered, keyOf(r.employee_id)).toBe(total);
      else {
        expect(answered, keyOf(r.employee_id)).toBeGreaterThan(0);
        expect(answered, keyOf(r.employee_id)).toBeLessThan(total);
      }
    }
  });

  it("回答はその人の等級のアンケートに付き、答えには答えた時点の設問の写し（question_*）が入る", () => {
    const users = new Map(rowsOf("users").map((u) => [u.id, u]));
    const forms = new Map(rowsOf("forms").map((f) => [f.id, f]));
    const questions = new Map(rowsOf("form_questions").map((q) => [q.id, q]));
    for (const r of openResponses()) {
      expect(forms.get(r.form_id).grade_id, keyOf(r.employee_id)).toBe(users.get(r.employee_id).grade_id);
      expect(r.grade_id).toBe(users.get(r.employee_id).grade_id);
    }
    const ids = new Set(openResponses().map((r) => r.id));
    const answers = rowsOf("form_answers").filter((a) => ids.has(a.response_id));
    expect(answers.length).toBeGreaterThan(0);
    for (const a of answers) {
      const q = questions.get(a.question_id);
      expect({
        title: a.question_title, type: a.question_type, section: a.question_section,
        unit: a.question_unit, options: a.question_options_json, order: a.question_display_order,
      }).toEqual({
        title: q.title, type: q.question_type, section: q.section,
        unit: q.unit, options: q.options_json, order: q.display_order,
      });
    }
  });

  it("受付中の期の評価はまだ無い（「提出済みの回答から評価を作る」を見本で試すため）", () => {
    expect(openResponses().some((r) => r.status === "submitted")).toBe(true);
    expect(rowsOf("evaluations").filter((e) => e.cycle_id === OPEN_CYCLE_ID)).toEqual([]);
  });

  it("答えた人の氏名・期・会社に見本の印がある", () => {
    const users = new Map(rowsOf("users").map((u) => [u.id, u]));
    expect(openResponses().length).toBeGreaterThan(0);
    expect(openResponses().every((r) => users.get(r.employee_id).name.startsWith("サンプル"))).toBe(true);
    expect(rowsOf("evaluation_cycles").find((c) => c.id === OPEN_CYCLE_ID)?.name).toContain("（サンプル）");
    expect(rowsOf("companies")[0].name).toContain("サンプル");
  });

  it("増えた回答と答えは見本の会社の行で、削除SQLが答え→回答の順に消す", () => {
    const ids = new Set(openResponses().map((r) => r.id));
    const answers = rowsOf("form_answers").filter((a) => ids.has(a.response_id));
    expect(answers.length).toBeGreaterThan(0);
    expect([...openResponses(), ...answers].every((row) => row.company_id === SAMPLE_COMPANY_ID)).toBe(true);
    expect(assertSampleOnly(seed.sql)).toBe(true);
    const answersAt = seed.removeSql.indexOf(`DELETE FROM form_answers WHERE company_id = '${SAMPLE_COMPANY_ID}';`);
    const responsesAt = seed.removeSql.indexOf(`DELETE FROM form_responses WHERE company_id = '${SAMPLE_COMPANY_ID}';`);
    expect(answersAt).toBeGreaterThan(-1);
    expect(responsesAt).toBeGreaterThan(answersAt);
  });
});

/**
 * 手元の見本（drizzle/seed.sql のデモの会社）と同じデータベースに入れて、
 * 画面が読む問い合わせ（提出状況・評価づくり）と削除SQLまで通す。
 */
describe("デモの会社と並べて入れても、他社の行に触れないこと（DD-029）", () => {
  let current;
  /** 表ごとの行の数。投入前と削除後で同じなら、他社の行に触れず、見本の消し漏れも無い */
  const countAll = () =>
    Object.fromEntries(
      current.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name")
        .all()
        .map(({ name }) => [name, current.raw.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n]),
    );
  let before;

  beforeEach(() => {
    current = createTestDatabase();
    globalThis.__sampleDb = current.db;
    current.raw.exec(readFileSync(join(process.cwd(), "drizzle/seed.sql"), "utf8"));
    before = countAll();
    for (const statement of seed.sql) current.raw.exec(statement);
  });

  afterEach(() => {
    current.close();
    delete globalThis.__sampleDb;
  });

  it("見本の受付中の期の提出状況は、対象11人のうち提出済み5人・入力途中2人・未回答4人", async () => {
    const { rows, counts } = await listCycleSubmissionRows(SAMPLE_COMPANY_ID, OPEN_CYCLE_ID);
    expect(counts).toEqual({ total: 11, submitted: 5, draft: 2, none: 4 });
    // 未回答は s4・s8・s10 と、等級のあるマネージャー（管理者は等級が無いので対象外）
    expect(rows.filter((r) => r.state === "none").map((r) => keyOf(r.employeeId)).sort()).toEqual(
      ["mgr", "s10", "s4", "s8"],
    );
    expect(rows.every((r) => r.name.includes("サンプル"))).toBe(true);
  });

  it("デモの会社（給付事業）の未回答の一覧と提出状況に、見本の人は混ざらない", async () => {
    const isSample = (r) => r.employeeId.startsWith("usr_sample_") || r.name.includes("サンプル");
    const cycle = await listCycleSubmissionRows("cmp_kyufu", "cyc_kyufu_2026h2");
    expect(cycle.rows.length).toBeGreaterThan(0);
    expect(cycle.rows.filter(isSample)).toEqual([]);
    expect(cycle.rows.some((r) => r.state === "none")).toBe(true);
    const form = await listFormSubmissionRows("cmp_kyufu", "frm_kyufu_2026h2_regular");
    expect(form.rows.length).toBeGreaterThan(0);
    expect(form.rows.filter(isSample)).toEqual([]);
    // 見本のIDで他社の画面を開いても、見本の回答は読めない
    expect(await listFormSubmissionRows("cmp_kyufu", "frm_sample_2026h2_beginner")).toBeNull();
  });

  it("提出済みの5人ぶんの評価を作れ、他社の評価は増えない", async () => {
    const kyufuBefore = current.raw.prepare("SELECT count(*) AS n FROM evaluations WHERE company_id <> ?").get(SAMPLE_COMPANY_ID).n;
    const results = await buildEvaluationsForCycle(SAMPLE_COMPANY_ID, OPEN_CYCLE_ID, "usr_sample_admin");
    expect(results.map((r) => ({ key: keyOf(r.employeeId), ok: r.ok })).sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      ["s1", "s3", "s5", "s7", "s9"].map((key) => ({ key, ok: true })),
    );
    const built = current.raw
      .prepare("SELECT status, total_score FROM evaluations WHERE company_id = ? AND cycle_id = ?")
      .all(SAMPLE_COMPANY_ID, OPEN_CYCLE_ID);
    expect(built).toHaveLength(5);
    expect(built.every((e) => e.status === "draft" && e.total_score !== null)).toBe(true);
    expect(current.raw.prepare("SELECT count(*) AS n FROM evaluations WHERE company_id <> ?").get(SAMPLE_COMPANY_ID).n).toBe(kyufuBefore);
  });

  it("削除SQLを流すと、どの表も見本を入れる前と同じ行の数に戻る", () => {
    expect(countAll()).not.toEqual(before);
    for (const statement of seed.removeSql) current.raw.exec(statement);
    expect(countAll()).toEqual(before);
  });
});

describe("サンプルだと分かること・パスワードのこと", () => {
  it("会社名と利用者名にサンプルだと分かる言葉が入っている", () => {
    expect(rowsOf("companies")[0].name).toContain("サンプル");
    const employees = rowsOf("users").filter((u) => u.role === "EMPLOYEE");
    expect(employees.every((u) => u.name.startsWith("サンプル"))).toBe(true);
  });

  it("作った利用者は全員「仮パスワードのまま」になっている", () => {
    expect(rowsOf("users").every((u) => u.must_change_password === 1)).toBe(true);
  });

  it("平文のパスワードはSQLのどこにも出てこない", () => {
    const body = seed.sql.join("\n");
    expect(body).not.toContain("Hyoka2026!demo");
    expect(rowsOf("accounts").every((a) => String(a.password).startsWith("hashed:"))).toBe(true);
  });

  it("全体管理者は作り直さない（本物のアカウントとぶつからない）", () => {
    expect(rowsOf("users").some((u) => u.id === "usr_super")).toBe(false);
  });
});

describe("上長コメントの決め方", () => {
  const employee = { name: "サンプル 一郎" };

  it("最初の期はコメント無し", () => {
    expect(sampleEvaluatorComment({ employee, cycle: { key: "2024h1" }, allA: false })).toBeNull();
  });

  it("全項目Aなら昇給要件を満たす旨を書く", () => {
    const text = sampleEvaluatorComment({ employee, cycle: { key: "2025h1" }, allA: true });
    expect(text).toContain("昇給要件");
    expect(text).toContain("サンプル 一郎");
  });
});

describe("削除SQLの組み立て", () => {
  it("親子の順が逆になっていて、会社を最後に消す", () => {
    const sql = buildRemoveSql([["companies", [{}]], ["users", [{}]], ["evaluations", [{}]]]);
    const deletes = sql.filter((s) => s.startsWith("DELETE"));
    expect(deletes.at(-1)).toContain("DELETE FROM companies");
    expect(deletes[0]).toContain("DELETE FROM sessions");
  });
});
