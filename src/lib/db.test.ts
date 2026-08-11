import { describe, expect, it } from "vitest";
import { chunkRowsForD1, estimateInsertBoundParameters, insertMany } from "./db";

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
