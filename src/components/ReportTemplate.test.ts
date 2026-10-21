import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EvaluationReport, ReportDecision, ReportRadar, ReviewerReport, SelfReport } from "@/lib/domain/report";

/*
 * 評価レポート（DD-024）の並べ方を確かめる。中身の計算は report.test.ts が持ち、ここは
 * 「評価者向けと本人向けで出す欄が違う」「印刷の2枚目の頭がある」「図と表が同じ値を指す」を見る。
 *
 * 図は next/dynamic の遅延読み込みなので、ここでは名前と大きさだけを出す部品に置き換える。
 */
vi.mock("@/components/LazyCharts", () => {
  const stub =
    (name: string) =>
    ({ width }: { width?: number }) =>
      createElement("span", { "data-chart": name, "data-width": width ?? "fluid" });
  return {
    ReportRadarChart: stub("radar"),
    ReportTrendChart: stub("trend"),
    ReportGradeBars: stub("grade-bars"),
  };
});

import { ReportTemplate } from "./ReportTemplate";

const GENERATED_AT = new Date("2026-10-20T01:00:00Z");

function decision(subject: ReportDecision["subject"], overrides: Partial<ReportDecision> = {}): ReportDecision {
  return {
    subject,
    label: subject === "raise" ? "昇給" : "昇格",
    conclusion: subject === "raise" ? "昇給：可" : "昇格：見送り",
    approved: subject === "raise",
    overridden: false,
    unrecorded: false,
    scoreJudgement: subject === "raise",
    decision: "follow",
    scoreJudgementText: subject === "raise" ? "点数の判定では可" : "点数の判定では見送り",
    scoreReason: "KPI評価点が基準に届いています。",
    decisionKind: "点数の判定どおり",
    decisionReason: null,
    recordedBy: "見本の上長",
    recordedAt: GENERATED_AT,
    ...overrides,
  };
}

function radar(overrides: Partial<ReportRadar> = {}): ReportRadar {
  return {
    axes: [
      { item: "稼働率", value: 90, rank: "A", unrated: false, previousValue: 80, previousRank: "B" },
      { item: "残業率", value: 60, rank: "C", unrated: false, previousValue: 60, previousRank: "C" },
      { item: "提案件数", value: null, rank: null, unrated: true, previousValue: null, previousRank: null },
    ],
    asBars: false,
    previousCycleName: "2025下期",
    basis: "ratio",
    ...overrides,
  };
}

const HEADER = {
  employeeName: "見本 太郎",
  currentGradeName: "Regular",
  officeName: "本社",
  baseCycleName: "2026上期",
  basePeriodStart: "2026-04-01",
  basePeriodEnd: "2026-09-30",
  generatedAt: GENERATED_AT,
};

function reviewer(overrides: Partial<ReviewerReport> = {}): ReviewerReport {
  return {
    kind: "reviewer",
    header: HEADER,
    decisions: [decision("raise"), decision("promotion")],
    radar: radar(),
    trendGradeName: "Regular",
    comment: "次の期は提案件数を伸ばしましょう。",
    scores: {
      kpiTotal: 42,
      kpiMax: 60,
      kpiRatio: 70,
      requirementRate: 80,
      requirementAchieved: 4,
      requirementTotal: 5,
      behaviorTotal: 12,
      behaviors: [{ aspectName: "誠実さ", score: 4, levelLabel: "できている" }],
    },
    trend: [
      { cycleName: "2025下期", periodStart: "2025-10-01", periodEnd: "2026-03-31", value: 65, peer: null },
      {
        cycleName: "2026上期",
        periodStart: "2026-04-01",
        periodEnd: "2026-09-30",
        value: 70,
        peer: { average: 62, min: 40, max: 85, people: 4 },
      },
    ],
    grades: [{ gradeName: "Regular", periods: 2, average: 67.5, peer: { average: 62, min: 40, max: 85, people: 4 } }],
    history: [
      {
        cycleName: "2026上期",
        periodStart: "2026-04-01",
        periodEnd: "2026-09-30",
        gradeName: "Regular",
        kpiTotal: 42,
        kpiMax: 60,
        kpiRatio: 70,
        requirementRate: 80,
        raise: "可",
        promotion: "見送り",
      },
    ],
    ...overrides,
  };
}

/** 本人向けの理由は、保存場所の段階で本人向けの文（raiseReasonEmployee）に入れ替わっている */
const SELF_REASON = { scoreReason: "基準を満たしています。" };

function self(overrides: Partial<SelfReport> = {}): SelfReport {
  return {
    kind: "self",
    header: HEADER,
    decisions: [decision("raise", SELF_REASON), decision("promotion", SELF_REASON)],
    radar: radar({ basis: "rank" }),
    trendGradeName: "Regular",
    comment: null,
    judgements: {
      kpiRanks: [{ item: "稼働率", rank: "A" }],
      rankCounts: [
        { rank: "A", count: 1 },
        { rank: "C", count: 1 },
      ],
      requirementRate: 80,
      requirementAchieved: 4,
      requirementTotal: 5,
      behaviors: [{ aspectName: "誠実さ", levelLabel: "できている" }],
    },
    trend: [{ cycleName: "2026上期", periodStart: "2026-04-01", periodEnd: "2026-09-30", value: 80 }],
    grades: [{ gradeName: "Regular", periods: 1, averageRequirementRate: 80 }],
    history: [
      {
        cycleName: "2026上期",
        periodStart: "2026-04-01",
        periodEnd: "2026-09-30",
        gradeName: "Regular",
        requirementRate: 80,
        raise: "可",
        promotion: "見送り",
      },
    ],
    ...overrides,
  };
}

function render(report: EvaluationReport) {
  return renderToStaticMarkup(
    createElement(ReportTemplate, { report, emptyHref: "/me/results", emptyLabel: "評価の結果を見るへ戻る" }),
  );
}

/** 出た図の名前と大きさ（画面用は fluid、印刷用は決まった幅） */
function charts(html: string) {
  return [...html.matchAll(/data-chart="([^"]+)" data-width="([^"]+)"/g)].map(([, name, width]) => `${name}:${width}`);
}

describe("ReportTemplate: 確定した評価が無いとき", () => {
  it("レポートの代わりに案内と戻り先を出す", () => {
    const html = render({
      kind: "empty",
      view: "self",
      employeeName: "見本 太郎",
      currentGradeName: null,
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain("まだ確定した評価がありません");
    expect(html).toContain("見本 太郎さんの評価が確定すると");
    expect(html).toContain('href="/me/results"');
    expect(html).not.toContain("report-page-1");
  });
});

describe("ReportTemplate: 評価者向け", () => {
  const html = render(reviewer());

  it("①〜④を1枚目、⑤〜⑦を2枚目に、コメントを末尾に置く", () => {
    const page1 = html.indexOf("report-page-1");
    const page2 = html.indexOf("report-page-2");
    const comment = html.indexOf("report-comment");
    expect(page1).toBeGreaterThan(-1);
    expect(page2).toBeGreaterThan(page1);
    expect(comment).toBeGreaterThan(page2);
    // 2枚目の頭は、2枚目だけを見てもだれのどの期か分かるようにする
    expect(html).toContain("見本 太郎・2026上期（評価レポートの2枚目）");
    for (const heading of ["評価に値するか", "点数", "KPIの項目ごとの達成度", "その等級の推移", "等級ごとの点数", "過去の実績", "上長からのコメント"]) {
      expect(html).toContain(heading);
    }
  });

  it("点数・同じ等級の平均と幅・コメントを出す", () => {
    expect(html).toContain("KPI評価点");
    expect(html).toContain("行動指針の合計");
    expect(html).toContain("同じ等級の平均");
    expect(html).toContain("同じ等級の幅（最小〜最大）");
    expect(html).toContain("4人");
    expect(html).toContain("次の期は提案件数を伸ばしましょう。");
  });

  it.each(["trend", "grades"] as const)("%s にだけ比較値があるとき、比較の凡例はその図だけに出す", (withPeer) => {
    const report = reviewer();
    if (withPeer === "trend") report.grades = report.grades.map((g) => ({ ...g, peer: null }));
    else report.trend = report.trend.map((t) => ({ ...t, peer: null }));
    const sections = render(report).match(/<section>[\s\S]*?<\/section>/g) ?? [];
    const legend = (heading: string) =>
      sections
        .find((section) => section.includes(`>${heading}</h2>`))
        ?.match(/<ul class="report-legend">([\s\S]*?)<\/ul>/)?.[1];

    expect(legend("その等級の推移")).toBeDefined();
    expect(legend("等級ごとの点数")).toBeDefined();
    if (withPeer === "trend") {
      expect(legend("その等級の推移")).toContain("同じ等級の平均");
      expect(legend("その等級の推移")).toContain("同じ等級の幅");
      expect(legend("等級ごとの点数")).not.toContain("同じ等級の平均");
    } else {
      expect(legend("その等級の推移")).not.toContain("同じ等級の平均");
      expect(legend("その等級の推移")).not.toContain("同じ等級の幅");
      expect(legend("等級ごとの点数")).toContain("同じ等級の平均");
    }
  });

  it("昇給と昇格の結論に、点数の判定と上司の判断と記録した人を添える", () => {
    expect(html).toContain("点数の判定では可");
    expect(html).toContain("点数の判定では見送り");
    expect(html).toContain("点数の判定どおり");
    expect(html).toContain("見本の上長");
  });

  it("上司が変えたとき、点数の判定と理由はカードに1回ずつだけ出す（結論の部品と欄で重ねない）", () => {
    const reason = "期の途中で役割が変わったため。";
    const overridden = render(
      reviewer({
        decisions: [
          decision("raise", { conclusion: "昇給：見送り（上司の判断）", approved: false, overridden: true, decision: "override", decisionKind: "変える", decisionReason: reason }),
          decision("promotion"),
        ],
      }),
    );
    expect(overridden.split(reason)).toHaveLength(2);
    expect(overridden.split("点数の判定では可")).toHaveLength(2);
    expect(overridden).toContain("（上司の判断）");
  });

  it("図は画面用と印刷用を1つずつ描き、読み上げは図の説明から読む", () => {
    expect(charts(html)).toEqual([
      "radar:fluid",
      "radar:380",
      "trend:fluid",
      "trend:300",
      "grade-bars:fluid",
      "grade-bars:300",
    ]);
    expect(html).toContain('aria-label="KPIの項目ごとの達成度のレーダー図。3項目。値は隣の表と同じです。"');
    // 印刷用は二重に読まれないよう読み上げから外す。枠は紙の大きさで先に取る（図が届く前に刷られても紙面が伸びない）
    expect(html.match(/class="report-chart-print" style="[^"]*" aria-hidden="true"/g)).toHaveLength(3);
    expect(html).toContain('class="report-chart-print" style="width:380px;height:190px"');
    expect(html.match(/class="report-chart-print" style="width:300px;height:200px"/g)).toHaveLength(2);
  });

  it("判定していない項目は（※）を付け、0点ではないと断る", () => {
    expect(html).toContain("提案件数（※）");
    expect(html).toContain("※ は実績が未入力で、判定していない項目です。0点ではありません。");
  });

  it("前の期の値が無ければ、前回の列と凡例を出さない", () => {
    const noPrevious = render(reviewer({ radar: radar({ previousCycleName: null }) }));
    expect(noPrevious).not.toContain("前回（");
    expect(noPrevious).not.toContain(">前回<");
  });

  it("コメントが無い期は、無いことを書く", () => {
    expect(render(reviewer({ comment: null }))).toContain("この期のコメントはありません。");
  });
});

describe("ReportTemplate: 本人向け", () => {
  const html = render(self());

  it("点数の数値と、同じ等級の平均と幅を出さない", () => {
    expect(html).toContain("点数は上長と管理者だけが見られます。");
    for (const hidden of ["KPI評価点", "行動指針の合計", "同じ等級の平均", "同じ等級の幅", "KPIの達成率"]) {
      expect(html).not.toContain(hidden);
    }
    expect(html).not.toContain(">点数<");
  });

  it("⑤⑥は等級要件の達成率で描き、判定の内訳を件数で出す", () => {
    expect(html).toContain("等級ごとの達成率");
    expect(html).toContain("その等級の期ごとの等級要件の達成率");
    expect(html).toContain("A 1件・C 1件");
    expect(html).toContain("5件のうち4件");
  });

  it("レーダー図の軸は判定をもとにした形だと断る", () => {
    expect(html).toContain("軸の長さは、判定（A〜E）をもとにした形です。");
  });

  it("上司が変えた理由は本人にも同じ文で見せる", () => {
    const overridden = render(
      self({
        decisions: [
          decision("raise", {
            ...SELF_REASON,
            decision: "override",
            decisionKind: "変える",
            decisionReason: "期の途中で役割が変わったため。",
          }),
          decision("promotion", SELF_REASON),
        ],
      }),
    );
    expect(overridden).toContain("期の途中で役割が変わったため。");
  });
});

describe("ReportTemplate: KPIの項目が3つ未満のとき", () => {
  it("レーダー図をやめ、横棒の一覧で出す（表はそのまま）", () => {
    const html = render(
      reviewer({
        radar: radar({
          axes: [
            { item: "稼働率", value: 90, rank: "A", unrated: false, previousValue: null, previousRank: null },
            { item: "提案件数", value: null, rank: null, unrated: true, previousValue: null, previousRank: null },
          ],
          asBars: true,
          previousCycleName: null,
        }),
      }),
    );
    expect(charts(html).filter((c) => c.startsWith("radar"))).toEqual([]);
    expect(html).toContain('aria-label="KPIの項目ごとの達成度"');
    expect(html).toContain("判定外");
    expect(html).toContain("KPIの項目ごとの達成度（今回と前回）");
  });
});
