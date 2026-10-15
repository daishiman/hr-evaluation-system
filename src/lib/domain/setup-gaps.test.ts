import { describe, expect, it } from "vitest";
import { cycleOpenGaps, formSyncGaps, gapsMessage, schemeGaps, staleCycleGaps } from "./setup-gaps";
import type { ComparisonGapInput } from "./comparison-gap";

/*
 * 設定不足の言葉とリンクの細部。リンク先が台帳にあることと英語の区分名を出さないことは
 * setup-gaps-links.test.ts が確かめる。ここでは直し方の文・リンクの組み立て・409 の要約を固定する。
 */

const GRADES = [
  { name: "等級3", pointGroup: "Chief", displayOrder: 3 },
  { name: "等級4-1", pointGroup: "AM", displayOrder: 4 },
];

describe("schemeGaps の直し方", () => {
  it("手順の画面が出す「次にやること」があれば、それを直し方に使う", () => {
    const [select, criteria] = schemeGaps(
      {
        hasScheme: true,
        groups: [
          { pointGroup: "Chief", selectionDone: false, criteriaDone: false, nextAction: "使うKPIをあと2件選んでください。" },
          { pointGroup: "AM", selectionDone: true, criteriaDone: false, nextAction: "選んだ項目のうち1件の基準（A〜E）が未設定です。" },
        ],
      },
      GRADES,
    );
    expect(select.how).toBe("使うKPIをあと2件選んでください。");
    expect(select.linkLabel).toBe("等級3のKPIを選ぶ");
    expect(criteria.how).toMatch(/^選んだ項目のうち1件の基準（A〜E）が未設定です。選んだ項目ごとに/);
    expect(criteria.linkLabel).toBe("等級4-1の基準を決める");
  });

  it("「次にやること」が無ければ、決まった直し方を出す", () => {
    const [select, criteria] = schemeGaps(
      {
        hasScheme: true,
        groups: [
          { pointGroup: "Chief", selectionDone: false, criteriaDone: false },
          { pointGroup: "AM", selectionDone: true, criteriaDone: false },
        ],
      },
      GRADES,
    );
    expect(select.how).toContain("KPIを選び、保存してください");
    expect(criteria.how).toMatch(/^選んだ項目ごとに/);
  });

  it("区分の名前に記号があっても、リンクは1つの区切りに収まる", () => {
    const [gap] = schemeGaps(
      { hasScheme: true, groups: [{ pointGroup: "A/B", selectionDone: false, criteriaDone: false }] },
      [{ name: "等級9", pointGroup: "A/B", displayOrder: 9 }],
    );
    expect(gap.href).toBe("/admin/scheme/A%2FB");
  });
});

describe("cycleOpenGaps のリンク", () => {
  it("評価期間が分かっていれば、その期間のアンケートを開く", () => {
    const [gap] = cycleOpenGaps({ schemeGaps: [], publishedFormCount: 0, cycleId: "c 1" });
    expect(gap.href).toBe("/admin/forms?cycle=c%201");
  });
});

describe("formSyncGaps の片側だけの違い", () => {
  const nameOf = (id: string) => `項目${id}`;
  const input = (selected: string[], asked: string[]): ComparisonGapInput => ({
    form: {
      id: "f1", title: null, cycleName: "2026年度上期", gradeName: "等級2", cycleId: "c1", gradeId: "g2",
      status: "draft", version: 1, responseCount: 0, cycleStatus: "open",
    },
    pointGroup: "Regular",
    groupLabel: "等級2",
    selected,
    asked,
    nameOf,
    newer: null,
    schemeGap: null,
    current: null,
    role: "COMPANY_ADMIN",
  });
  const marks = (selected: string[], asked: string[]) =>
    formSyncGaps(input(selected, asked))?.rows.map((row) => [row.name, row.inSelection, row.inForm]);

  it("足りないだけ・余分だけでも、比べる警告を1つ返し、行は ○ と — で表せる", () => {
    expect(marks(["a", "b"], [])).toEqual([
      ["項目a", true, false],
      ["項目b", true, false],
    ]);
    expect(marks([], ["c"])).toEqual([["項目c", false, true]]);
  });
});

describe("staleCycleGaps（集計し直していない評価期間）", () => {
  it("集計し直せる評価がある期間だけを、その期間の評価画面へ案内する", () => {
    const gaps = staleCycleGaps([
      { cycleId: "c1", cycleName: "2026上期", recomputable: 3, finalized: 2 },
      { cycleId: "c2", cycleName: "2025下期", recomputable: 0, finalized: 5 },
      { cycleId: "c3", cycleName: "2026下期", recomputable: 1, finalized: 0 },
    ]);
    expect(gaps.map((g) => g.href)).toEqual(["/manager/cycles?cycle=c1", "/manager/cycles?cycle=c3"]);
    expect(gaps[0].what).toBe("2026上期：確認中 3件が古い基準のままです（確定済み 2件は当時の基準のまま据え置き）。");
    expect(gaps[1].what).toBe("2026下期：確認中 1件が古い基準のままです。");
    expect(gaps.every((g) => g.linkLabel === "集計し直す" && g.how !== "")).toBe(true);
  });
});

describe("gapsMessage（サーバー処理の失敗の要約）", () => {
  const gap = (n: number) => ({ what: `不足${n}。`, how: `直し方${n}。`, href: "/admin/scheme", linkLabel: "開く" });

  it("不足が無ければ空", () => {
    expect(gapsMessage([])).toBe("");
  });

  it("1件ならその「何が・どう直す」", () => {
    expect(gapsMessage([gap(1)])).toBe("不足1。直し方1。");
  });

  it("2件以上なら先頭の1件と残りの件数", () => {
    expect(gapsMessage([gap(1), gap(2), gap(3)])).toBe("不足1。直し方1。（ほかに2件の不足があります）");
  });
});
