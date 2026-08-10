import { describe, expect, it } from "vitest";
import {
  formatByRank,
  indexReferencePoints,
  referenceFor,
  type ReferencePointRow,
} from "@/lib/domain/reference-points";

/** 元の配点表の一部（項目6 単価率 ＝ Chief以上のみ対象、Beginner/Regularは「-」で行が無い） */
const rows: ReferencePointRow[] = [
  { kpiItemId: "kpi_6", pointGroup: "Chief", rank: "C", points: 8 },
  { kpiItemId: "kpi_6", pointGroup: "Chief", rank: "A", points: 20 },
  { kpiItemId: "kpi_6", pointGroup: "Chief", rank: "E", points: 0 },
  { kpiItemId: "kpi_6", pointGroup: "Chief", rank: "B", points: 15 },
  { kpiItemId: "kpi_6", pointGroup: "Chief", rank: "D", points: 5 },
  { kpiItemId: "kpi_2", pointGroup: "Regular", rank: "A", points: 10 },
  { kpiItemId: "kpi_2", pointGroup: "Regular", rank: "B", points: 8 },
];

describe("元の配点表の引き当て", () => {
  it("Aの点数をその項目の配点として取り出す", () => {
    const index = indexReferencePoints(rows);
    expect(referenceFor(index, "kpi_6", "Chief")?.maxPoints).toBe(20);
    expect(referenceFor(index, "kpi_2", "Regular")?.maxPoints).toBe(10);
  });

  it("並び順が崩れていても A→E の順に整える", () => {
    const index = indexReferencePoints(rows);
    expect(referenceFor(index, "kpi_6", "Chief")?.byRank.map((r) => r.rank)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(formatByRank(referenceFor(index, "kpi_6", "Chief")!)).toBe("A20 ／ B15 ／ C8 ／ D5 ／ E0");
  });

  it("その等級区分で対象外だった項目は参考値を返さない", () => {
    const index = indexReferencePoints(rows);
    expect(referenceFor(index, "kpi_6", "Beginner")).toBeNull();
    expect(referenceFor(index, "kpi_2", "Manager")).toBeNull();
  });

  it("Aの行が無い組み合わせは配点を言えないため参考値にしない", () => {
    const index = indexReferencePoints([
      { kpiItemId: "kpi_9", pointGroup: "AM", rank: "B", points: 7 },
    ]);
    expect(referenceFor(index, "kpi_9", "AM")).toBeNull();
  });
});
