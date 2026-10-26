import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { rollForward } from "./compensation";
import { chunkRowsForD1, estimateInsertBoundParameters, insertMany, summarizeErrorForLog } from "./db";

/**
 * データベースは1回の登録で渡せる値が100個までなので、
 * 設問が数十件あるアンケートは分けて登録する必要がある。
 * 実際にこれで保存に失敗したため、再発しないよう固定しておく。
 */
describe("insertMany（まとめて登録するときの分割）", () => {
  const row = (i: number) => ({
    id: `x${i}`,
    companyId: "c",
    responseId: "r",
    questionId: `q${i}`,
    valueNumber: 1,
    valueText: "はい",
  });

  it("値の個数が100を超えないように分けて登録する", async () => {
    const calls: ReturnType<typeof row>[][] = [];
    const rows = Array.from({ length: 49 }, (_, i) => row(i));

    await insertMany(async (chunk) => {
      calls.push(chunk);
    }, rows);

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.flat()).toEqual(rows);
    for (const chunk of calls) {
      expect(chunk.reduce((sum, x) => sum + estimateInsertBoundParameters(x), 0)).toBeLessThan(100);
    }
  });

  it("列数が行ごとに違っても、先頭行だけで決めず全行を安全に分ける", () => {
    const small: Record<string, unknown> = { id: "small" };
    const wide: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 91 }, (_, i) => [`field${i}`, i]),
    );
    const rows = [small, wide, small];

    const chunks = chunkRowsForD1(rows);

    expect(chunks.flat()).toEqual(rows);
    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) {
      expect(chunk.reduce((sum, x) => sum + estimateInsertBoundParameters(x), 0)).toBeLessThan(100);
    }
  });

  it("1行だけで安全上限を超えるデータは発行前に止める", () => {
    const tooWide = Object.fromEntries(Array.from({ length: 96 }, (_, i) => [`field${i}`, i]));
    expect(() => chunkRowsForD1([tooWide])).toThrow("D1の安全上限");
  });

  it("0件のときは登録しない", async () => {
    let called = 0;
    await insertMany(async () => {
      called++;
    }, []);
    expect(called).toBe(0);
  });

  it("100個に収まるときは1回で登録する", async () => {
    const calls: number[] = [];
    await insertMany(async (chunk) => {
      calls.push(chunk.length);
    }, [row(0), row(1)]);
    expect(calls).toEqual([2]);
  });
});

/**
 * DB のエラーのログは、種類と場所だけを残す（DD-032 の7）。
 * Drizzle の失敗の文面には SQL の全文と渡した値が入り、D1 の原因の文面にも SQL が入りうる
 * （D1_EXEC_ERROR は失敗した行をそのまま載せる）。ログへは名前・原因の種類・操作と表の名前だけを出し、
 * 社員の氏名やメールのような値が Workers Logs に残らないようにする。
 */
describe("summarizeErrorForLog（ログ用の要約）", () => {
  const SECRET = "見本の値-ログに出さない";
  const INSERT_SQL = 'insert into "users" ("id", "email", "name") values (?, ?, ?)';
  const queryError = (sql = INSERT_SQL) =>
    new DrizzleQueryError(
      sql,
      ["usr_x", SECRET, "社員A"],
      new Error(`D1_ERROR: UNIQUE constraint failed: users.email (${SECRET}): SQLITE_CONSTRAINT`),
    );

  it("DB の失敗は、名前・D1 の原因の種類・SQL の先頭の操作と表の名前を残す", () => {
    const text = summarizeErrorForLog(queryError());
    expect(text).toContain("DrizzleQueryError");
    expect(text).toContain("D1_ERROR");
    expect(text).toContain("SQLITE_CONSTRAINT");
    expect(text).toMatch(/\binsert\b/i);
    expect(text).toContain("users");
  });

  it("SQL の全文・DB へ渡した値・原因の文面は載せない", () => {
    const text = summarizeErrorForLog(queryError());
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("社員A");
    expect(text).not.toContain('"email", "name"');
    expect(text).not.toContain("UNIQUE constraint failed");
  });

  it("select・update・delete も、先頭の操作と表の名前を取り出す", () => {
    expect(summarizeErrorForLog(queryError('select "id" from "form_answers" where "value_text" = ?'))).toMatch(
      /select[^]*form_answers/i,
    );
    expect(summarizeErrorForLog(queryError('update "evaluations" set "score" = ? where "id" = ?'))).toMatch(
      /update[^]*evaluations/i,
    );
    expect(summarizeErrorForLog(queryError('delete from "sessions" where "token" = ?'))).toMatch(/delete[^]*sessions/i);
  });

  it("包まれた失敗でも、cause の鎖をたどって DB の失敗と見分ける", () => {
    const wrapped = new Error("登録できませんでした", { cause: queryError() });
    const text = summarizeErrorForLog(wrapped);
    expect(text).toContain("DrizzleQueryError");
    expect(text).toContain("users");
    expect(text).not.toContain(SECRET);
  });

  it("文面が DB の失敗に似ていても、型で見分ける（文面の照合はしない）", () => {
    const lookalike = new Error(`Failed query: ${INSERT_SQL}\nparams: usr_x,${SECRET}`);
    const text = summarizeErrorForLog(lookalike);
    expect(text).not.toContain("DrizzleQueryError");
    expect(text).not.toMatch(/\binsert\b/i);
    expect(text).not.toContain(SECRET);
  });

  it("ほかの失敗は、名前とスタックの先頭の1行（起きた場所）だけを1行で残す", () => {
    const text = summarizeErrorForLog(new TypeError(`読めない値: ${SECRET}`));
    expect(text).toContain("TypeError");
    expect(text).toContain("db.test.ts");
    expect(text).not.toContain(SECRET);
    expect(text.split("\n")).toHaveLength(1);
  });

  it("Error でない値を投げられても、中身は載せない", () => {
    expect(summarizeErrorForLog(`文字列の失敗 ${SECRET}`)).not.toContain(SECRET);
    expect(typeof summarizeErrorForLog(null)).toBe("string");
  });

  it("補償の記録（rollForward）も要約を通し、DB へ渡した値を残さない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ok = await rollForward("account.password", { userId: "u1" }, async () => {
        throw queryError();
      });
      expect(ok).toBe(false);
      const logged = inspect([...warn.mock.calls, ...error.mock.calls], { depth: 5 });
      expect(logged).toContain("DrizzleQueryError");
      expect(logged).not.toContain(SECRET);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("利用状況の古い記録の掃除の警告も、エラーをそのまま渡さず要約を通す", () => {
    const text = readFileSync(join(process.cwd(), "src/lib/usage.ts"), "utf8");
    // 本文全体を差分に出さないよう、真偽で比べる
    expect(text.includes("summarizeErrorForLog("), "usage.ts が要約を通す").toBe(true);
    expect(/console\.\w+\([^)]*,\s*(e|err|error|cause)\s*\)/.test(text), "usage.ts がエラーをそのまま渡す").toBe(false);
  });
});
