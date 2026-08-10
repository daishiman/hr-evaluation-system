import { describe, expect, it } from "vitest";
import { insertMany } from "./db";

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
    const calls: number[] = [];
    const rows = Array.from({ length: 49 }, (_, i) => row(i));
    // 実際に発行される列数（自動で付く作成日時などを含む）
    const columns = Object.keys(rows[0]).length + 4;

    await insertMany(async (chunk) => {
      calls.push(chunk.length);
    }, rows);

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.reduce((a, b) => a + b, 0)).toBe(49);
    for (const n of calls) expect(n * columns).toBeLessThanOrEqual(100);
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
