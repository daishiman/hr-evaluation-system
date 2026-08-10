import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeRank, matchesCriterion, type Direction, type Rank, type RankCriterion } from "./scoring";
import { checkRangeCoverage } from "./kgi";

/**
 * 正本（data/_authoritative-kpi-criteria.tsv）のランク基準165行を読み込み、
 * 範囲判定が正本どおりに動くことを固定する。
 *
 * 正本のTSVは「ユーザーから提示された制度そのもの」であり、
 * DBに入れる値もここから作る。コードに閾値を書かない代わりに、
 * このテストで「正本の全行が、隙間なく・重なりなく・境界も含めて」
 * 判定できることを担保する。
 *
 * 注意: これは元シートの制度を再現できているかを固定するテストであり、
 * 閾値そのものの妥当性を検証したものではない。実運用のデータはまだ1件も無い。
 */

interface Row {
  no: number;
  name: string;
  rank: Rank;
  label: string;
  lower: number | null;
  upper: number | null;
  expr: string;
  unit: string;
  direction: Direction;
}

function loadAuthoritative(): Row[] {
  const path = join(process.cwd(), "data", "_authoritative-kpi-criteria.tsv");
  const rows: Row[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const c = line.split("\t");
    if (!/^\d+$/.test(c[0]) || c.length < 13) continue;
    if (!["A", "B", "C", "D", "E"].includes(c[2])) continue;
    rows.push({
      no: Number(c[0]),
      name: c[1],
      rank: c[2] as Rank,
      label: c[3],
      lower: c[4].trim() === "" ? null : Number(c[4]),
      upper: c[5].trim() === "" ? null : Number(c[5]),
      expr: c[6],
      unit: c[7],
      // 評価方向カラムから導出する。項目Noはハードコードしない。
      direction: c[8].includes("逆転") ? "lower" : "higher",
    });
  }
  return rows;
}

const ALL = loadAuthoritative();
const ITEMS = [...new Set(ALL.map((r) => r.no))];

describe("正本のランク基準TSV", () => {
  it("165行（33項目 × 5ランク）ある", () => {
    expect(ALL).toHaveLength(165);
    expect(ITEMS).toHaveLength(33);
  });

  it("どの項目もA〜Eの5行がそろっている", () => {
    for (const no of ITEMS) {
      const ranks = ALL.filter((r) => r.no === no).map((r) => r.rank).sort();
      expect(ranks, `項目No.${no}`).toEqual(["A", "B", "C", "D", "E"]);
    }
  });

  it("逆転指標は残業率・欠員日数・ミス件数の3項目だけ", () => {
    const reversed = [...new Set(ALL.filter((r) => r.direction === "lower").map((r) => r.no))].sort((a, b) => a - b);
    expect(reversed).toEqual([8, 15, 31]);
    expect(ALL.filter((r) => r.no === 8)[0].name).toBe("残業率");
    expect(ALL.filter((r) => r.no === 15)[0].name).toBe("欠員日数");
    expect(ALL.filter((r) => r.no === 31)[0].name).toBe("ミス件数");
  });

  it("下限・上限は「境界の判定条件」欄と矛盾しない", () => {
    for (const r of ALL) {
      const label = `No.${r.no} ${r.name} ${r.rank}`;
      if (r.lower !== null) expect(r.expr, label).toContain(String(r.lower));
      if (r.upper !== null) expect(r.expr, label).toContain(String(r.upper));
      // 逆転指標は「下限 < x ≦ 上限」、通常は「下限 ≦ x < 上限」
      if (r.direction === "lower") {
        expect(r.expr.includes("≦ x") ? r.expr : `${r.expr} `, label).toBeTruthy();
      }
    }
  });
});

describe("33項目すべてで、A〜Eが数直線を過不足なく覆っている", () => {
  for (const no of ITEMS) {
    const rows = ALL.filter((r) => r.no === no);
    const name = rows[0].name;
    it(`No.${no} ${name}`, () => {
      /* 逆転指標は「下限超・上限以下」なので、覆いの検査では
         下限と上限の開閉が通常項目と逆になる。数直線を覆えているかどうかは
         開閉に関係なく「隣の区間と端が一致しているか」で判定できるため、
         checkRangeCoverage をそのまま使える。 */
      const problems = checkRangeCoverage(
        rows.map((r) => ({ label: `${r.rank} ${r.label}`, lowerBound: r.lower, upperBound: r.upper })),
        "実績値",
      );
      expect(problems.map((p) => p.message)).toEqual([]);
    });
  }
});

describe("境界の値がどちらか一方のランクにだけ当たる（重複も抜けも無い）", () => {
  for (const no of ITEMS) {
    const rows = ALL.filter((r) => r.no === no);
    const name = rows[0].name;
    const direction = rows[0].direction;
    const criteria: RankCriterion[] = rows.map((r) => ({
      rank: r.rank,
      displayLabel: r.label,
      lowerBound: r.lower,
      upperBound: r.upper,
    }));

    it(`No.${no} ${name}（${direction === "lower" ? "逆転指標" : "通常"}）`, () => {
      // 表に出てくるすべての境界値と、その前後をあたる
      const bounds = [...new Set(rows.flatMap((r) => [r.lower, r.upper]).filter((v): v is number => v !== null))];
      const probes = bounds.flatMap((b) => [b - 0.1, b, b + 0.1]);
      // 表の外側（極端に大きい／小さい値）も必ずどれかに当たること
      probes.push(-9999, 9999);

      for (const v of probes) {
        const hits = criteria.filter((c) => matchesCriterion(v, c, direction));
        expect(hits.map((h) => h.rank), `No.${no} ${name} 実績値${v}`).toHaveLength(1);
      }
    });
  }
});

describe("A水準の代表値が正本どおりAと判定される", () => {
  it("完全達成型（A＝100%）の項目は100でAになる", () => {
    for (const no of ITEMS) {
      const rows = ALL.filter((r) => r.no === no);
      const a = rows.find((r) => r.rank === "A")!;
      if (a.direction === "lower" || a.lower === null) continue;
      const criteria: RankCriterion[] = rows.map((r) => ({
        rank: r.rank,
        displayLabel: r.label,
        lowerBound: r.lower,
        upperBound: r.upper,
      }));
      // 下限ちょうどはAに含まれる
      expect(judgeRank(a.lower, criteria, a.direction).rank, `No.${no} ${a.name}`).toBe("A");
      // 下限をわずかに下回るとAではなくなる
      expect(judgeRank(a.lower - 0.1, criteria, a.direction).rank, `No.${no} ${a.name}`).not.toBe("A");
    }
  });

  it("逆転指標は上限ちょうどまでがA（No.8 残業率95%以下 / No.15 欠員0日 / No.31 ミス0件）", () => {
    for (const no of [8, 15, 31]) {
      const rows = ALL.filter((r) => r.no === no);
      const a = rows.find((r) => r.rank === "A")!;
      const criteria: RankCriterion[] = rows.map((r) => ({
        rank: r.rank,
        displayLabel: r.label,
        lowerBound: r.lower,
        upperBound: r.upper,
      }));
      expect(judgeRank(a.upper!, criteria, "lower").rank, `No.${no} ${a.name}`).toBe("A");
      expect(judgeRank(a.upper! + 0.1, criteria, "lower").rank, `No.${no} ${a.name}`).toBe("B");
    }
  });

  it("判定根拠には実績値と基準の表示文とランクが日本語で入る", () => {
    const rows = ALL.filter((r) => r.no === 1);
    const criteria: RankCriterion[] = rows.map((r) => ({
      rank: r.rank,
      displayLabel: r.label,
      lowerBound: r.lower,
      upperBound: r.upper,
    }));
    const j = judgeRank(85, criteria, "higher");
    expect(j.rank).toBe("B");
    expect(j.rationale).toContain("85");
    expect(j.rationale).toContain("80%以上 100%未満");
    expect(j.fellThrough).toBe(false);
  });
});
