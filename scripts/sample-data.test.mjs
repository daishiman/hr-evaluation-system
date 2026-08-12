import { describe, expect, it, beforeAll } from "vitest";
import {
  buildSampleSeed,
  assertSampleOnly,
  buildRemoveSql,
  SAMPLE_COMPANY_ID,
  SAMPLE_EMPLOYEES,
  SAMPLE_CYCLES,
  sampleEvaluatorComment,
} from "./sample-data.mjs";

/**
 * サンプルデータの検査。
 *
 * 見るのは2つ。
 *  1. 既にあるデータに触らないこと（今回いちばん壊してはいけない約束）。
 *  2. 画面で確かめたいこと（推移・等級ごとの違い・ランクのばらつき・コメントの有無）が
 *     実際にデータとして入っていること。データが薄いと、画面を開いても何も分からない。
 */

/** 本物のパスワード作成は遅いので、検査では固定の文字列に置き換える。 */
const fakeHash = async (userId) => `hashed:${userId}`;

let seed;
const rowsOf = (table) => seed.tableRows.find(([t]) => t === table)?.[1] ?? [];

beforeAll(async () => {
  seed = await buildSampleSeed({ passwordHashFor: fakeHash });
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

  it("受付中の期は1つも作らない（本番の未回答一覧に見本の方が混ざらないように）", () => {
    expect(SAMPLE_CYCLES.every((c) => c.status === "closed")).toBe(true);
    expect(rowsOf("evaluation_cycles").every((c) => c.status === "closed")).toBe(true);
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
