/**
 * 本番に登録済みのランク基準が、新しい桁の検査で1件も弾かれないことを実データで確かめる。
 *
 * ふだんの試験と性格が違う。実データのファイルを渡されたときだけ動き、渡されなければ黙って飛ばす
 * （実データはこのリポジトリに入れないため。CI では常に飛ぶ）。
 *
 * 使い方（数値の決まりを変えるときに、必ず1回通す）:
 *   1. 本番から取り出す
 *      wrangler d1 execute hr-evaluation-db --remote --json --command \
 *        "SELECT c.kpi_item_id AS k, c.rank AS r, c.lower_bound AS lo, c.upper_bound AS hi, \
 *         i.direction AS d FROM kpi_rank_criteria c JOIN kpi_items i ON i.id=c.kpi_item_id"
 *      （出力の中の results 配列だけを JSON ファイルに保存する）
 *   2. そのファイルを指して走らせる
 *      PROD_ROWS=/path/to/rows.json npx vitest run --reporter=verbose src/lib/domain/production-bounds.check.test.ts
 *
 * 2026-08-12 の実測: 165項目・825行、桁で弾かれたもの 0件。
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRankBoundaries } from "@/lib/domain/rank-bounds";

const PATH = process.env.PROD_ROWS ?? "";

describe.skipIf(!PATH || !existsSync(PATH))("本番のランク基準（実データ）", () => {
  it("登録済みの行はすべて、新しい桁の検査を通る", () => {
    const rows = JSON.parse(readFileSync(PATH, "utf8")) as {
      k: string;
      r: string;
      lo: number | null;
      hi: number | null;
      d: string;
    }[];
    const byItem = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byItem.get(row.k) ?? [];
      list.push(row);
      byItem.set(row.k, list);
    }
    const rejected: string[] = [];
    for (const [item, list] of byItem) {
      const r = checkRankBoundaries(
        list.map((x) => ({ rank: x.r, lowerBound: x.lo, upperBound: x.hi })),
        list[0].d === "lower" ? "lower" : "higher",
      );
      if (!r.ok) {
        const digits = r.issues.filter((i) => i.message.includes("桁を間違えていないか"));
        if (digits.length > 0) rejected.push(`${item}: ${digits.map((i) => i.message).join(" / ")}`);
      }
    }
    console.log(`検査した項目数: ${byItem.size}（行数 ${rows.length}）／桁で弾かれた項目数: ${rejected.length}`);
    expect(rejected).toEqual([]);
  });
});
