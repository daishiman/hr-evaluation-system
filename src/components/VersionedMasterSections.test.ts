import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { classifyVersionedItems, VersionedMasterSections, type VersionedMasterItem } from "./VersionedMasterSections";

type Row = VersionedMasterItem & { seq: number };

const rows: Row[] = [
  { id: "old", text: "以前の文章", seq: 1, isActive: true },
  { id: "current", text: "現在の文章", seq: 1, isActive: true, previousVersionId: "old" },
  { id: "stopped", text: "停止中の文章", seq: 2, isActive: false },
];

describe("版を持つ制度マスタの共通表示", () => {
  it("後続がない行だけを現在版にし、履歴から現在版までたどる", () => {
    const result = classifyVersionedItems(rows);

    expect(result.current.map((row) => row.id)).toEqual(["current", "stopped"]);
    expect(result.history).toEqual([{ row: rows[0], currentId: "current" }]);
  });

  it("停止中と履歴を別Disclosureに分け、再開できない理由を関連付ける", () => {
    const html = renderToStaticMarkup(
      createElement(VersionedMasterSections<Row>, {
        sectionId: "grade-g1-support",
        rows,
        busy: false,
        maxActive: 1,
        onReactivate: vi.fn(),
        onRestoreContent: vi.fn(),
      }),
    );

    expect(html).toContain("以前使っていた項目");
    expect(html).toContain("変更履歴");
    expect(html).toContain("もう一度使う");
    expect(html).toContain("この内容をもとに新版を作る");
    expect(html).toContain('id="grade-g1-support-reactivation-reason"');
    expect(html).toContain('aria-describedby="grade-g1-support-reactivation-reason"');
    expect(html).toContain("先に1項目を「今後使わない」にしてください。");
    expect(html).toContain("disabled");
  });

  it("現在版が停止中なら、履歴からの新版作成を理由付きで止める", () => {
    const stoppedLineage: Row[] = [
      { id: "old", text: "以前の文章", seq: 1, isActive: false },
      { id: "current", text: "現在の文章", seq: 1, isActive: false, previousVersionId: "old" },
    ];
    const html = renderToStaticMarkup(
      createElement(VersionedMasterSections<Row>, {
        sectionId: "promotion-g1-report",
        rows: stoppedLineage,
        busy: false,
        onReactivate: vi.fn(),
        onRestoreContent: vi.fn(),
      }),
    );

    expect(html).toContain("先に現在版を「もう一度使う」にしてください。");
    expect(html).toContain('aria-describedby="promotion-g1-report-old-restore-reason"');
  });

  it("参照先が一覧に無いpreviousVersionIdを誤って履歴にしない", () => {
    const orphan: Row = {
      id: "visible",
      text: "表示できる現在版",
      seq: 1,
      isActive: true,
      previousVersionId: "not-loaded",
    };

    expect(classifyVersionedItems([orphan])).toEqual({ current: [orphan], history: [] });
  });
});
