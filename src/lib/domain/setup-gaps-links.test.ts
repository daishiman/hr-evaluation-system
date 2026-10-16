import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cycleOpenGaps,
  formPublicationGaps,
  formSyncGaps,
  schemeGaps,
  type SetupGap,
} from "@/lib/domain/setup-gaps";
import type { ComparisonGapInput } from "@/lib/domain/comparison-gap";

/*
 * 設定不足の示し方（S9・A8）。
 *
 * 準備の確認・制度の手順・公開や受付開始の 409 の理由・アンケートの同期は、
 * 文ではなく { what, how, href, linkLabel } を返す。全件に
 * 「何が足りないか」「どう直すか」「直す画面へのリンク」がそろっていることを確かめる。
 * リンク先は台帳（route-ledger.json）にある画面に限る。
 */

const GRADES = [
  { id: "g1", code: "beginner", name: "等級1", pointGroup: "Beginner", displayOrder: 1 },
  { id: "g2", code: "regular", name: "等級2", pointGroup: "Regular", displayOrder: 2 },
  { id: "g3", code: "chief", name: "等級3", pointGroup: "Chief", displayOrder: 3 },
  { id: "g41", code: "am1", name: "等級4-1", pointGroup: "AM", displayOrder: 4 },
  { id: "g42", code: "am2", name: "等級4-2", pointGroup: "AM", displayOrder: 5 },
];

const ledger = JSON.parse(readFileSync(path.join(process.cwd(), "system-spec/route-ledger.json"), "utf8")) as {
  routes: { path: string }[];
};
/** 台帳のパスを正規表現にする（[id] などの動的な部分は1つの区切りに合う） */
const ROUTE_PATTERNS = ledger.routes.map(
  (r) => new RegExp(`^${r.path.replace(/\[[^\]]+\]/g, "[^/?#]+")}$`),
);

function expectComplete(gaps: SetupGap[]) {
  expect(gaps.length).toBeGreaterThan(0);
  for (const gap of gaps) {
    expect(gap.what.trim(), JSON.stringify(gap)).not.toBe("");
    expect(gap.how.trim(), JSON.stringify(gap)).not.toBe("");
    expect(gap.linkLabel.trim(), JSON.stringify(gap)).not.toBe("");
    const pathname = decodeURIComponent(gap.href.split(/[?#]/)[0]);
    expect(
      ROUTE_PATTERNS.some((re) => re.test(pathname)),
      `${gap.href} は台帳に無い画面です`,
    ).toBe(true);
    // 英語の区分名は出さない（等級名で言う）
    expect(`${gap.what}${gap.how}${gap.linkLabel}`).not.toMatch(/Beginner|Regular|Chief|\bAM\b|Manager/);
  }
}

describe("schemeGaps（評価セットの準備）", () => {
  it("評価セットが無い", () => {
    const gaps = schemeGaps({ hasScheme: false, groups: [] }, GRADES);
    expectComplete(gaps);
    expect(gaps[0].href).toBe("/admin/scheme");
  });

  it("配点ルールが無い", () => {
    expectComplete(schemeGaps({ hasScheme: true, groups: [] }, GRADES));
  });

  it("KPI を選んでいない区分は手順1へ、基準が無い区分は手順2へ案内する（区分ごとに1件）", () => {
    const gaps = schemeGaps(
      {
        hasScheme: true,
        groups: [
          { pointGroup: "Beginner", selectionDone: true, criteriaDone: true },
          { pointGroup: "Chief", selectionDone: false, criteriaDone: false },
          { pointGroup: "AM", selectionDone: true, criteriaDone: false },
        ],
      },
      GRADES,
    );
    expectComplete(gaps);
    expect(gaps.map((g) => g.href)).toEqual(["/admin/scheme/Chief", "/admin/scheme/AM/criteria"]);
    expect(gaps[0].what).toContain("等級3");
    expect(gaps[1].what).toContain("等級4-1・等級4-2");
  });

  it("全て済んでいれば空", () => {
    expect(
      schemeGaps({ hasScheme: true, groups: [{ pointGroup: "Beginner", selectionDone: true, criteriaDone: true }] }, GRADES),
    ).toEqual([]);
  });
});

describe("cycleOpenGaps（回答の受付を始める前）", () => {
  const schemeMissing = schemeGaps({ hasScheme: false, groups: [] }, GRADES);

  it("評価セットの不足をそのまま引き継ぐ", () => {
    const gaps = cycleOpenGaps({ schemeGaps: schemeMissing, publishedFormCount: 3 });
    expectComplete(gaps);
    expect(gaps).toEqual(schemeMissing);
  });

  it("公開したアンケートが無ければアンケートの画面へ", () => {
    const gaps = cycleOpenGaps({ schemeGaps: [], publishedFormCount: 0 });
    expectComplete(gaps);
    expect(gaps[0].href).toBe("/admin/forms");
  });

  it("両方そろえば空", () => {
    expect(cycleOpenGaps({ schemeGaps: [], publishedFormCount: 1 })).toEqual([]);
  });
});

describe("formPublicationGaps（アンケートを公開する前）", () => {
  it("締め切り済みの期間は評価期間の画面へ", () => {
    const gaps = formPublicationGaps({ schemeGaps: [], cycleStatus: "closed", questionCount: 3, formId: "f1", staleAsking: [] });
    expectComplete(gaps);
    expect(gaps[0].href).toBe("/admin/cycles");
  });

  it("設問が無ければそのアンケートの編集へ", () => {
    const gaps = formPublicationGaps({ schemeGaps: [], cycleStatus: "planning", questionCount: 0, formId: "f1", staleAsking: [] });
    expectComplete(gaps);
    expect(gaps[0].href).toBe("/admin/forms/f1");
  });

  it("評価セットの不足が先に出る", () => {
    const schemeMissing = schemeGaps({ hasScheme: false, groups: [] }, GRADES);
    const gaps = formPublicationGaps({ schemeGaps: schemeMissing, cycleStatus: "open", questionCount: 0, formId: "f1", staleAsking: [] });
    expectComplete(gaps);
    expect(gaps[0]).toEqual(schemeMissing[0]);
  });

  it("全てそろえば空", () => {
    expect(formPublicationGaps({ schemeGaps: [], cycleStatus: "open", questionCount: 2, formId: "f1", staleAsking: [] })).toEqual([]);
  });

  it("設問が式と合わない項目は、KPI項目で直すものを項目ごとに先に、作り直しで直るものをまとめて1件出す（DD-016）", () => {
    const gaps = formPublicationGaps({
      schemeGaps: [],
      cycleStatus: "open",
      questionCount: 4,
      formId: "f1",
      staleAsking: [
        { kpiItemId: "kpi_a", name: "稼働率", rebuildFixes: true },
        { kpiItemId: "kpi_b", name: "残業率", rebuildFixes: false },
        { kpiItemId: "kpi_c", name: "定着率", rebuildFixes: true },
      ],
    });
    expectComplete(gaps);
    expect(gaps.map((gap) => [gap.href, gap.linkLabel])).toEqual([
      ["/admin/scheme?item=kpi_b#kpi-item-kpi_b", "「残業率」の聞き方を直す"],
      ["/admin/forms/f1", "設問を作り直す"],
    ]);
    expect(gaps[1].what).toBe("「稼働率」「定着率」の設問が、いまの聞き方と合っていません。");
    expect(gaps[1].how).toContain("「いまの制度の設定から設問を作り直す」を押してください");
    // 設問の key（q13_1 など）は人に見せない
    expect(gaps.map((gap) => `${gap.what}${gap.how}${gap.linkLabel}`).join("")).not.toMatch(/q\d+_\d+/);
  });
});

describe("formSyncGaps（評価セットとアンケートの比べ）", () => {
  const nameOf = (id: string) => (id === "k1" ? "売上" : "訪問数");
  const input = (selected: string[], asked: string[]): ComparisonGapInput => ({
    form: {
      id: "f1", title: null, cycleName: "2026年度上期", gradeName: "等級2", cycleId: "c1", gradeId: "g2",
      status: "draft", version: 1, responseCount: 0, cycleStatus: "open",
    },
    pointGroup: "Regular",
    groupLabel: "等級2",
    selected,
    asked,
    unaskable: [],
    nameOf,
    newer: null,
    schemeGap: null,
    current: null,
    role: "COMPANY_ADMIN",
  });

  it("見比べる2つのページ（使うKPIを選ぶ・そのアンケート）へ案内し、どちらも台帳にある画面", () => {
    const gap = formSyncGaps(input(["k1"], ["k2"]));
    expect(gap?.pages.map((page) => page.href)).toEqual(["/admin/scheme/Regular", "/admin/forms/f1"]);
    for (const page of gap?.pages ?? []) expect(ROUTE_PATTERNS.some((re) => re.test(page.href ?? "")), page.href ?? "").toBe(true);
    expect(gap?.rows.map((row) => row.name)).toEqual(["売上", "訪問数"]);
  });

  it("違いが無ければ null", () => {
    expect(formSyncGaps(input(["k1"], ["k1"]))).toBeNull();
  });
});
