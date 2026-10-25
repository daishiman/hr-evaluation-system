import { describe, expect, it } from "vitest";
import { routeOf } from "@/lib/route-access";
import type { Role } from "@/lib/roles";
import {
  COMPARISON_KIND_LABEL,
  COMPARISON_LEAD,
  COMPARISON_OPEN_LABEL,
  DELETED_ITEM_NAME,
  FORM_LEDGER_PATH,
  NO_TEMPLATE_HINT,
  REBUILD_LABEL,
  SELECTION_LEDGER_PATH,
  comparisonGapOf,
  comparisonSummary,
  fixConfirm,
  fixLabel,
  noTemplateNamesOf,
  noTemplateNote,
  rebuildConfirm,
  rebuildWontFixNote,
  type ComparisonForm,
  type ComparisonGap,
  type ComparisonGapInput,
  type ComparisonPageKey,
} from "./comparison-gap";
import { NO_TEMPLATE_BADGE } from "./scheme";

/*
 * 比べる警告（DD-012・受入 AC1）。
 * 2つのページ（使うKPIを選ぶ・このアンケート）を、どの状態でも必ず持つこと、
 * 直す操作を上から順に1つだけ選ぶこと、見る人の役割で絞ることを確かめる。
 */

const NAMES: Record<string, string> = { kpi_a: "稼働率", kpi_b: "残業率", kpi_c: "粗利率", kpi_d: "定着率" };
const nameOf = (id: string): string | undefined => NAMES[id];
/** 等級要件の系列（起点の id → いまの版の本文） */
const REQUIREMENTS: Record<string, string> = { gr_1: "支援計画を期限内に作る", gr_2: "記録を当日中に残す", gr_3: "新人に手順を教える" };
/** 行動指針の観点（id → 呼び名・基準） */
const GUIDELINES: Record<string, { name: string; band: string }> = {
  bg_1: { name: "創造性について", band: "g1_2" },
  bg_2: { name: "専門性について", band: "g1_2" },
  bg_old: { name: "個性について", band: "g3_4" },
};
/** 等級要件・行動指針は、既定ではズレが無い（KPI項目の行だけを見るテストを変えない） */
const NO_REQUIREMENT_GAP: ComparisonGapInput["requirements"] = {
  expected: ["gr_1"],
  asked: ["gr_1"],
  nameOf: (id) => REQUIREMENTS[id],
};
const NO_BEHAVIOR_GAP: ComparisonGapInput["behaviors"] = {
  expected: ["bg_1"],
  asked: ["bg_1"],
  nameOf: (id) => GUIDELINES[id]?.name,
  bandOf: (id) => GUIDELINES[id]?.band,
  band: "g1_2",
};

function form(over: Partial<ComparisonForm> = {}): ComparisonForm {
  return {
    id: "frm_1",
    title: null,
    cycleName: "2026年度上期",
    gradeName: "等級２：Regular",
    cycleId: "cyc_1",
    gradeId: "grd_1",
    status: "published",
    version: 1,
    responseCount: 0,
    cycleStatus: "open",
    ...over,
  };
}

/** 足りない2件（kpi_b・kpi_c）と余分1件（kpi_d）のズレがある入力 */
function input(over: Partial<ComparisonGapInput> = {}): ComparisonGapInput {
  return {
    form: form(),
    pointGroup: "Regular",
    groupLabel: "等級２：Regular",
    selected: ["kpi_a", "kpi_b", "kpi_c"],
    asked: ["kpi_d", "kpi_a"],
    unaskable: [],
    nameOf,
    requirements: NO_REQUIREMENT_GAP,
    behaviors: NO_BEHAVIOR_GAP,
    newer: null,
    schemeGap: null,
    current: null,
    role: "COMPANY_ADMIN",
    ...over,
  };
}

function gapOf(over: Partial<ComparisonGapInput> = {}): ComparisonGap {
  const gap = comparisonGapOf(input(over));
  if (!gap) throw new Error("ズレがあるのに null が返った");
  return gap;
}

/**
 * より新しい版。asked を省くと、まだ選んだ項目と一致していない版（kpi_a だけを聞いている）にする。
 * 等級要件と行動指針は、既定ではいまの設定どおりに聞いている
 */
function newerForm(
  id: string,
  version: number,
  status: string,
  asked: readonly string[] = ["kpi_a"],
  over: Partial<NonNullable<ComparisonGapInput["newer"]>> = {},
): NonNullable<ComparisonGapInput["newer"]> {
  return { id, version, status, asked, askedRequirements: ["gr_1"], askedBehaviors: ["bg_1"], ...over };
}

const SCHEME_GAP = { href: "/admin/scheme/Regular/criteria", linkLabel: "基準を決める" };
const ROLES: Role[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"];

/** 台帳の道筋（/admin/forms/[id]）を、実際の道筋に当てる正規表現にする */
function ledgerPattern(ledgerPath: string): RegExp {
  const escaped = ledgerPath.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\\?\[[^\]]+\\?\]/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

describe("comparisonGapOf: 2つのページ（AC1）", () => {
  it("状態の組み合わせの全件で、2つのページ（階層つきの名前・台帳の道筋）を持つ", () => {
    let count = 0;
    for (const status of ["draft", "published", "closed"])
      for (const responseCount of [0, 3])
        for (const cycleStatus of ["planning", "open", "closed"])
          for (const newer of [null, newerForm("frm_2", 2, "draft"), newerForm("frm_3", 3, "published")])
            for (const schemeGap of [null, SCHEME_GAP])
              for (const current of [null, "form", "selection"] as (ComparisonPageKey | null)[])
                for (const unaskable of [[], ["kpi_b", "kpi_c"]])
                for (const role of ROLES) {
                  const gap = gapOf({ form: form({ status, responseCount, cycleStatus }), newer, schemeGap, current, unaskable, role });
                  expect(gap.pages).toHaveLength(2);
                  expect(gap.pages.map((p) => p.key)).toEqual(["selection", "form"]);
                  for (const page of gap.pages) {
                    const route = routeOf(page.ledgerPath);
                    expect(route, page.ledgerPath).not.toBeNull();
                    expect(page.label).toContain(" › ");
                    if (page.href !== null) expect(page.href).toMatch(ledgerPattern(page.ledgerPath));
                    expect(page.current).toBe(page.key === current);
                  }
                  count++;
                }
    expect(count).toBe(3 * 2 * 3 * 3 * 2 * 3 * 2 * 4);
  });

  it("名前は台帳の親の画面名と見出しをつなぎ、リンクは手順とアンケートの道筋", () => {
    const [selection, formPage] = gapOf().pages;
    expect(selection).toEqual({
      key: "selection",
      label: `${routeOf("/admin/scheme")!.label} › 等級２：Regular：使うKPIを選ぶ`,
      href: "/admin/scheme/Regular",
      ledgerPath: SELECTION_LEDGER_PATH,
      current: false,
    });
    expect(formPage).toEqual({
      key: "form",
      label: `${routeOf("/admin/forms")!.label} › 2026年度上期 等級２：Regular 実績アンケート（第1版）`,
      href: "/admin/forms/frm_1",
      ledgerPath: FORM_LEDGER_PATH,
      current: false,
    });
    expect(selection.label).toBe("KPI・評価セット › 等級２：Regular：使うKPIを選ぶ");
  });

  it("題名があれば題名を使い、道筋の id と区分は URL に使える形にする", () => {
    const gap = gapOf({ form: form({ id: "frm 1/x", title: "春の実績アンケート", version: 3 }), pointGroup: "Chief Plus" });
    expect(gap.pages[0].href).toBe("/admin/scheme/Chief%20Plus");
    expect(gap.pages[1].href).toBe("/admin/forms/frm%201%2Fx");
    expect(gap.pages[1].label).toBe("アンケート › 春の実績アンケート（第3版）");
    expect(gap.formTitle).toBe("春の実績アンケート");
  });

  it("版の違う2本は、名前が違う（版の番号で区別できる）", () => {
    const first = gapOf({ form: form({ id: "frm_1", version: 1 }) });
    const second = gapOf({ form: form({ id: "frm_2", version: 2 }) });
    expect(first.pages[1].label).not.toBe(second.pages[1].label);
    expect(first.formTitle).toBe(second.formTitle);
  });

  it("いま開いているページに印を付ける（無ければどちらにも付けない）", () => {
    expect(gapOf({ current: "form" }).pages.map((p) => p.current)).toEqual([false, true]);
    expect(gapOf({ current: "selection" }).pages.map((p) => p.current)).toEqual([true, false]);
    expect(gapOf({ current: null }).pages.map((p) => p.current)).toEqual([false, false]);
    expect(gapOf({ current: "form" }).current).toBe("form");
  });

  it("アンケートと区分の識別子を持つ", () => {
    const gap = gapOf();
    expect(gap.formId).toBe("frm_1");
    expect(gap.pointGroup).toBe("Regular");
    expect(gap.formTitle).toBe("2026年度上期 等級２：Regular 実績アンケート");
  });
});

describe("comparisonGapOf: ズレた項目の行", () => {
  it("足りない項目（選んだ順）のあとに、余分な項目（聞いた順）を並べる", () => {
    const gap = gapOf();
    expect(gap.rows).toEqual([
      { kind: "kpi", itemId: "kpi_b", name: "残業率", href: "/admin/scheme/items?item=kpi_b#kpi-item-kpi_b", inSelection: true, inForm: false, noTemplate: false },
      { kind: "kpi", itemId: "kpi_c", name: "粗利率", href: "/admin/scheme/items?item=kpi_c#kpi-item-kpi_c", inSelection: true, inForm: false, noTemplate: false },
      { kind: "kpi", itemId: "kpi_d", name: "定着率", href: "/admin/scheme/items?item=kpi_d#kpi-item-kpi_d", inSelection: false, inForm: true, noTemplate: false },
    ]);
    expect(gap.missingCount).toBe(2);
    expect(gap.extraCount).toBe(1);
  });

  it("足りないだけ・余分だけでも行を作る", () => {
    expect(gapOf({ asked: ["kpi_a"] }).rows.map((r) => r.itemId)).toEqual(["kpi_b", "kpi_c"]);
    expect(gapOf({ selected: ["kpi_a"], asked: ["kpi_a", "kpi_d"] }).rows.map((r) => r.itemId)).toEqual(["kpi_d"]);
  });

  it("設問のひな形が無い項目は、足りない行にだけ印を付ける（余分な行・ズレていない項目には付けない）", () => {
    // kpi_a はひな形が無くても聞けている（この版に設問がある）ので行にならない。kpi_d は余分な行
    const gap = gapOf({ unaskable: ["kpi_a", "kpi_c", "kpi_d"] });
    expect(gap.rows.map((r) => [r.itemId, r.noTemplate])).toEqual([
      ["kpi_b", false],
      ["kpi_c", true],
      ["kpi_d", false],
    ]);
    expect(gap.rows.filter((r) => r.noTemplate).every((r) => r.inSelection && !r.inForm)).toBe(true);
  });

  it("ズレが0件なら警告を作らない（並び順の違いはズレではない）", () => {
    expect(comparisonGapOf(input({ selected: ["kpi_a", "kpi_b"], asked: ["kpi_b", "kpi_a"] }))).toBeNull();
    expect(comparisonGapOf(input({ selected: [], asked: [] }))).toBeNull();
  });
});

describe("comparisonGapOf: 一番新しい版が一致していれば、古い版に出さない（DD-012 の5）", () => {
  /** 選んだ項目（kpi_a・kpi_b・kpi_c）を、並び順だけ変えて聞いている新しい版 */
  const IN_SYNC = ["kpi_c", "kpi_a", "kpi_b"];

  it("新しい版が一致していれば古い版の警告を作らない（古い版が回答0件の下書きでも）。下書きの新しい版は、公開中の版の警告だけは消さない", () => {
    for (const status of ["draft", "published", "closed"])
      for (const [formStatus, responseCount] of [["draft", 0], ["published", 3], ["closed", 3]] as const)
        for (const cycleStatus of ["planning", "open", "closed"])
          for (const role of ROLES) {
            const gap = comparisonGapOf(
              input({ form: form({ status: formStatus, cycleStatus, responseCount }), newer: newerForm("frm_2", 2, status, IN_SYNC), role }),
            );
            // 配っているのは公開中の版で、下書きの新しい版はまだ誰も答えていない（公開するまで直っていない）
            const keeps = status === "draft" && formStatus === "published";
            expect({ status, formStatus, cycleStatus, role, shown: gap !== null }).toEqual({ status, formStatus, cycleStatus, role, shown: keeps });
          }
  });

  it("3つの画面のどれで開いても、出さない", () => {
    for (const current of [null, "form", "selection"] as (ComparisonPageKey | null)[]) {
      expect(comparisonGapOf(input({ newer: newerForm("frm_2", 2, "published", IN_SYNC), current }))).toBeNull();
    }
  });

  it("一致した下書きの新しい版があるとき、公開中の版はその下書きを開かせ、公開すれば締め切られると添える", () => {
    const gap = gapOf({ newer: newerForm("frm_2", 2, "draft", IN_SYNC) });
    expect(gap.fix).toEqual({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true });
    expect(gap.note).toBe(
      "第2版の下書きは、いまの設定と一致しています。公開すると、この版は自動で締め切られます。公開後や回答のあるアンケートは設問を差し替えません",
    );
    // 一致していない下書きには、この1文を添えない
    expect(gapOf({ newer: newerForm("frm_2", 2, "draft") }).note).toBe("公開後や回答のあるアンケートは設問を差し替えません");
  });

  it("一致は3種類とも見る。等級要件か行動指針が1つでも違う新しい版では、古い版の警告を消さない", () => {
    for (const over of [{ askedRequirements: [] }, { askedRequirements: ["gr_1", "gr_9"] }, { askedBehaviors: [] }]) {
      const gap = gapOf({ newer: newerForm("frm_2", 2, "published", IN_SYNC, over) });
      expect(gap.fix?.kind).toBe("openNewer");
    }
    // 等級要件は系列で比べる。新しい版が同じ系列（起点の id）を聞いていれば一致
    expect(comparisonGapOf(input({ newer: newerForm("frm_2", 2, "closed", IN_SYNC, { askedRequirements: ["gr_1", "gr_1"] }) }))).toBeNull();
  });

  it("新しい版がまだ一致していなければ、古い版に警告を出し、その版を開かせる", () => {
    // 足りないまま（kpi_a だけ）・余分があるまま（kpi_d が残る）・作り直して設問0件（何も聞いていない）
    for (const asked of [["kpi_a"], ["kpi_a", "kpi_b", "kpi_c", "kpi_d"], []]) {
      const gap = gapOf({ newer: newerForm("frm_2", 2, "draft", asked) });
      expect(gap.fix).toEqual({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true });
      // 表の行は、新しい版ではなくこの版と選んだ項目の違い
      expect(gap.rows.map((r) => r.itemId)).toEqual(["kpi_b", "kpi_c", "kpi_d"]);
    }
  });
});

describe("comparisonGapOf: 3種類の項目（等級要件・行動指針・KPI項目）", () => {
  /** 等級要件は gr_2 が足りず gr_3 が余分、行動指針は bg_2 が足りず bg_old が余分、KPI項目は既定のズレ */
  const THREE: Partial<ComparisonGapInput> = {
    requirements: { ...NO_REQUIREMENT_GAP, expected: ["gr_1", "gr_2"], asked: ["gr_3", "gr_1"] },
    behaviors: { ...NO_BEHAVIOR_GAP, expected: ["bg_1", "bg_2"], asked: ["bg_1", "bg_old"] },
  };

  it("足りない行（等級要件 → 行動指針 → KPI項目）のあとに余分な行（同じ順）。件数は3種類の合計", () => {
    const gap = gapOf(THREE);
    expect(gap.rows.map((r) => [r.kind, r.itemId, r.name, r.inSelection, r.inForm])).toEqual([
      ["requirement", "gr_2", "記録を当日中に残す", true, false],
      ["behavior", "bg_2", "専門性について", true, false],
      ["kpi", "kpi_b", "残業率", true, false],
      ["kpi", "kpi_c", "粗利率", true, false],
      ["requirement", "gr_3", "新人に手順を教える", false, true],
      ["behavior", "bg_old", "個性について", false, true],
      ["kpi", "kpi_d", "定着率", false, true],
    ]);
    expect(gap.missingCount).toBe(4);
    expect(gap.extraCount).toBe(3);
    expect(comparisonSummary([gap])).toBe("評価項目とのズレ 7件（足りない4・余分3）");
  });

  it("各行は、その項目を直す画面へのリンクを持ち、行の位置へ飛ぶ錨を付ける", () => {
    const hrefs = Object.fromEntries(gapOf(THREE).rows.map((r) => [r.itemId, r.href]));
    expect(hrefs).toEqual({
      // 足りない等級要件は、等級を開いた画面のその系列の行へ。余分（今後使わない項目）は版の履歴の段にあり、等級の画面まで
      gr_2: "/admin/masters/requirements?grade=grd_1#grade-requirement-gr_2",
      gr_3: "/admin/masters/requirements?grade=grd_1",
      // 行動指針は、その観点の基準で開く（余分な観点が別の基準でも、そのカードへ飛べる）
      bg_2: "/admin/behavior?grade=grd_1&band=g1_2#behavior-guideline-bg_2",
      bg_old: "/admin/behavior?grade=grd_1&band=g3_4#behavior-guideline-bg_old",
      kpi_b: "/admin/scheme/items?item=kpi_b#kpi-item-kpi_b",
      kpi_c: "/admin/scheme/items?item=kpi_c#kpi-item-kpi_c",
      kpi_d: "/admin/scheme/items?item=kpi_d#kpi-item-kpi_d",
    });
  });

  it("マスタから消えた項目は「消された項目」と出し、一覧の画面まで（行が無いので錨を付けない）", () => {
    const gap = gapOf({
      selected: ["kpi_a"],
      asked: ["kpi_a", "kpi_gone"],
      requirements: { ...NO_REQUIREMENT_GAP, asked: ["gr_1", "gr_gone"] },
      behaviors: { ...NO_BEHAVIOR_GAP, asked: ["bg_1", "bg_gone"] },
    });
    expect(gap.rows.map((r) => [r.kind, r.name, r.href])).toEqual([
      ["requirement", "消された項目", "/admin/masters/requirements?grade=grd_1"],
      ["behavior", "消された項目", "/admin/behavior?grade=grd_1&band=g1_2"],
      ["kpi", "消された項目", "/admin/scheme"],
    ]);
    // 等級に基準が無ければ、行動指針の画面の既定の基準で開く
    const noBand = gapOf({ behaviors: { ...NO_BEHAVIOR_GAP, asked: ["bg_1", "bg_gone"], band: null } });
    expect(noBand.rows.find((r) => r.kind === "behavior")?.href).toBe("/admin/behavior?grade=grd_1");
  });

  it("開けない役割には、どの種類の行にもリンクを出さない（名前は残す）", () => {
    for (const role of ["MANAGER", "EMPLOYEE"] as Role[]) {
      const gap = gapOf({ ...THREE, role });
      expect(gap.rows.map((r) => r.href)).toEqual(gap.rows.map(() => null));
      expect(gap.rows.every((r) => r.name !== "")).toBe(true);
    }
    for (const role of ["COMPANY_ADMIN", "SUPER_ADMIN"] as Role[]) {
      expect(gapOf({ ...THREE, role }).rows.every((r) => r.href !== null)).toBe(true);
    }
  });

  it("行のリンクは台帳にある画面", () => {
    for (const row of gapOf(THREE).rows) expect(routeOf(row.href!.split(/[?#]/)[0]), row.href!).not.toBeNull();
  });

  it("聞き方（設問のひな形）の印は KPI項目の行だけ。等級要件・行動指針の行には付けない", () => {
    const gap = gapOf({ ...THREE, unaskable: ["gr_2", "bg_2", "kpi_b"] });
    expect(gap.rows.filter((r) => r.noTemplate).map((r) => r.itemId)).toEqual(["kpi_b"]);
  });

  it("等級要件か行動指針だけが違っても警告を作り、作り直しで直る（聞き方を決める必要は無い）", () => {
    const draft = form({ status: "draft", responseCount: 0 });
    const onlyRequirement = gapOf({ form: draft, selected: ["kpi_a"], asked: ["kpi_a"], requirements: THREE.requirements });
    expect(onlyRequirement.rows.map((r) => r.kind)).toEqual(["requirement", "requirement"]);
    expect(onlyRequirement.fix).toEqual({ kind: "rebuild", formId: "frm_1" });
    const onlyBehavior = gapOf({ selected: ["kpi_a"], asked: ["kpi_a"], behaviors: THREE.behaviors });
    expect(onlyBehavior.rows.map((r) => r.kind)).toEqual(["behavior", "behavior"]);
    expect(onlyBehavior.fix?.kind).toBe("newVersion");
    // 3種類とも一致していれば作らない
    expect(comparisonGapOf(input({ selected: ["kpi_a"], asked: ["kpi_a"] }))).toBeNull();
  });
});

describe("comparisonGapOf: 直す操作（上から順に1つだけ）", () => {
  it("より新しい版がまだ一致していなければ、状態を問わずその版を開く", () => {
    expect(gapOf({ newer: newerForm("frm_2", 2, "draft") }).fix).toEqual({
      kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true,
    });
    expect(gapOf({ newer: newerForm("frm_3", 3, "published") }).fix).toEqual({
      kind: "openNewer", formId: "frm_3", href: "/admin/forms/frm_3", version: 3, draft: false,
    });
    // 下書きで回答0件・締め切った評価期間・評価セットの準備中より、新しい版を開くのが先
    const draft = form({ status: "draft", responseCount: 0 });
    expect(gapOf({ form: draft, newer: newerForm("frm_2", 2, "closed") }).fix?.kind).toBe("openNewer");
    expect(gapOf({ form: form({ cycleStatus: "closed" }), newer: newerForm("frm_2", 2, "closed") }).fix?.kind).toBe("openNewer");
    expect(gapOf({ schemeGap: SCHEME_GAP, newer: newerForm("frm_2", 2, "draft") }).fix?.kind).toBe("openNewer");
  });

  it("下書きで回答0件なら作り直す。アンケート1本の画面では部品に出さない", () => {
    const draft = form({ status: "draft", responseCount: 0 });
    expect(gapOf({ form: draft }).fix).toEqual({ kind: "rebuild", formId: "frm_1" });
    expect(gapOf({ form: draft, current: "selection" }).fix).toEqual({ kind: "rebuild", formId: "frm_1" });
    expect(gapOf({ form: draft, current: "form" }).fix).toBeNull();
    // 作り直しは新しい版を作らないので、評価セットの準備中でも作り直しを選ぶ
    expect(gapOf({ form: draft, schemeGap: SCHEME_GAP }).fix?.kind).toBe("rebuild");
  });

  it("締め切った評価期間では、直す操作を出さない", () => {
    expect(gapOf({ form: form({ cycleStatus: "closed" }) }).fix).toBeNull();
    expect(gapOf({ form: form({ cycleStatus: "closed" }), schemeGap: SCHEME_GAP }).fix).toBeNull();
  });

  it("評価セットの準備が整っていなければ、残っている手順へのリンク", () => {
    expect(gapOf({ schemeGap: SCHEME_GAP }).fix).toEqual({ kind: "finishScheme", ...SCHEME_GAP });
  });

  it("それ以外は、この等級だけ新しい版の下書きを作る", () => {
    const expected = { kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" };
    expect(gapOf().fix).toEqual(expected);
    expect(gapOf({ form: form({ status: "draft", responseCount: 2 }) }).fix).toEqual(expected);
    expect(gapOf({ form: form({ status: "closed" }) }).fix).toEqual(expected);
    expect(gapOf({ form: form({ cycleStatus: "planning" }), current: "form" }).fix).toEqual(expected);
  });
});

describe("comparisonGapOf: 実績の聞き方（設問のひな形）が決まっていない項目があるとき", () => {
  /** 足りないのは残業率・粗利率で、どちらも聞き方が決まっていない（余分は無い） */
  const ONLY_UNASKABLE: Partial<ComparisonGapInput> = { asked: ["kpi_a"], unaskable: ["kpi_b", "kpi_c"] };
  const DEFINE = { kind: "defineAsking", href: "/admin/scheme/items?item=kpi_b#kpi-item-kpi_b", names: ["残業率", "粗利率"] };

  it("作り直しも新しい版も直らないので、どの状態でも先に、先頭の項目を開いた KPI項目の画面へ案内する", () => {
    for (const [status, responseCount] of [["draft", 0], ["draft", 2], ["published", 0], ["closed", 3]] as const)
      for (const cycleStatus of ["planning", "open"])
        for (const newer of [null, newerForm("frm_2", 2, "draft"), newerForm("frm_3", 3, "published")])
          for (const schemeGap of [null, SCHEME_GAP])
            for (const current of [null, "form", "selection"] as (ComparisonPageKey | null)[]) {
              const fix = gapOf({ ...ONLY_UNASKABLE, form: form({ status, responseCount, cycleStatus }), newer, schemeGap, current }).fix;
              expect({ status, responseCount, cycleStatus, newer, schemeGap, current, fix }).toEqual({
                status, responseCount, cycleStatus, newer, schemeGap, current, fix: DEFINE,
              });
            }
  });

  it("作り直せば直る行と混ざっていても、先に聞き方を決めさせる（先に作り直すと、決めたあとにもう一度作り直すことになる）", () => {
    const draft = form({ status: "draft", responseCount: 0 });
    // 余分（定着率）がある
    expect(gapOf({ unaskable: ["kpi_b", "kpi_c"], form: draft }).fix).toEqual(DEFINE);
    expect(gapOf({ unaskable: ["kpi_b", "kpi_c"] }).fix).toEqual(DEFINE);
    // 足りない項目の片方には聞き方がある
    const one = { kind: "defineAsking", href: "/admin/scheme/items?item=kpi_c#kpi-item-kpi_c", names: ["粗利率"] };
    expect(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], form: draft }).fix).toEqual(one);
    expect(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], newer: newerForm("frm_2", 2, "draft") }).fix).toEqual(one);
    expect(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], schemeGap: SCHEME_GAP }).fix).toEqual(one);
  });

  it("聞き方を決めたあとは（unaskable が空になれば）、従来の順で直す操作を選ぶ", () => {
    const draft = form({ status: "draft", responseCount: 0 });
    expect(gapOf({ asked: ["kpi_a"], form: draft }).fix?.kind).toBe("rebuild");
    expect(gapOf({ asked: ["kpi_a"], newer: newerForm("frm_2", 2, "draft") }).fix?.kind).toBe("openNewer");
    expect(gapOf({ asked: ["kpi_a"] }).fix?.kind).toBe("newVersion");
  });

  it("締め切った評価期間では、決めたあとに直せる版（回答の無い下書き・新しい下書きの版）があるときだけ出す", () => {
    const closed = (over: Partial<ComparisonForm> = {}) => form({ cycleStatus: "closed", ...over });
    expect(gapOf({ ...ONLY_UNASKABLE, form: closed({ status: "draft", responseCount: 0 }) }).fix).toEqual(DEFINE);
    expect(gapOf({ ...ONLY_UNASKABLE, form: closed(), newer: newerForm("frm_2", 2, "draft") }).fix).toEqual(DEFINE);
    // 新しい版を作れず、作り直せる版も無い
    expect(gapOf({ ...ONLY_UNASKABLE, form: closed() }).fix).toBeNull();
    expect(gapOf({ ...ONLY_UNASKABLE, form: closed({ status: "draft", responseCount: 2 }) }).fix).toBeNull();
    expect(gapOf({ ...ONLY_UNASKABLE, form: closed(), newer: newerForm("frm_3", 3, "published") }).fix).toBeNull();
  });

  it("注記の先頭で、聞き方の決まっていない項目を名指しし、決めるまではどの操作でも直らないと伝える", () => {
    const lead =
      "「残業率」・「粗利率」は、実績の聞き方がまだ決まっていません。決めるまでは、作り直しても新しい版でも、設問は出ず点も付きません。";
    expect(noTemplateNote(["残業率", "粗利率"])).toBe(lead);
    // 下書きで回答0件は、これまで注記が無かったが、聞き方の決まっていない項目があれば出す
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ status: "draft", responseCount: 0 }) }).note).toBe(lead);
    expect(gapOf(ONLY_UNASKABLE).note).toBe(`${lead}公開後や回答のあるアンケートは設問を差し替えません`);
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ cycleStatus: "closed" }) }).note).toBe(`${lead}締め切った評価期間には新しい版を作れません`);
    // 聞き方のある項目のズレと混ざっていても、聞き方の決まっていない項目だけを名指しする
    expect(gapOf({ unaskable: ["kpi_c"] }).note).toBe(
      "「粗利率」は、実績の聞き方がまだ決まっていません。決めるまでは、作り直しても新しい版でも、設問は出ず点も付きません。公開後や回答のあるアンケートは設問を差し替えません",
    );
  });

  it("札と、リンクを置けない返事のための直し方。画面名は台帳の名前と同じ字面", () => {
    expect(NO_TEMPLATE_BADGE).toBe("設問なし");
    expect(NO_TEMPLATE_HINT).toBe(
      "聞き方は、KPI・評価セットの「KPI項目」で決められます。その項目の「内容を直す」を押してください。決めたあとに、もう一度作り直してください。",
    );
    expect(NO_TEMPLATE_HINT).toContain(routeOf("/admin/scheme")!.label);
  });
});

describe("comparisonGapOf: 見る人の役割", () => {
  const cases: { name: string; over: Partial<ComparisonGapInput> }[] = [
    { name: "新しい版を開く", over: { newer: newerForm("frm_2", 2, "draft") } },
    { name: "作り直す", over: { form: form({ status: "draft", responseCount: 0 }) } },
    { name: "評価セットの残りの手順", over: { schemeGap: SCHEME_GAP } },
    { name: "新しい版を作る", over: {} },
    {
      name: "聞き方を決める",
      over: { selected: ["kpi_a", "kpi_b", "kpi_c", "kpi_d"], asked: ["kpi_a"], unaskable: ["kpi_b", "kpi_c", "kpi_d"] },
    },
  ];

  it.each(cases)("会社の管理者と全体管理者には、$name を出す", ({ over }) => {
    for (const role of ["COMPANY_ADMIN", "SUPER_ADMIN"] as Role[]) {
      const gap = gapOf({ ...over, role });
      expect(gap.fix).not.toBeNull();
      expect(gap.pages.every((p) => p.href !== null)).toBe(true);
    }
  });

  it.each(cases)("マネージャーと一般には、$name もリンクも出さず、名前だけを残す", ({ over }) => {
    for (const role of ["MANAGER", "EMPLOYEE"] as Role[]) {
      const gap = gapOf({ ...over, role });
      expect(gap.fix).toBeNull();
      expect(gap.pages.map((p) => p.href)).toEqual([null, null]);
      expect(gap.pages.every((p) => p.label.includes(" › "))).toBe(true);
      expect(gap.rows).toHaveLength(3);
    }
  });
});

describe("comparisonGapOf: 注記の1行", () => {
  const PUBLISHED = "公開後や回答のあるアンケートは設問を差し替えません";
  const CLOSED = "締め切った評価期間には新しい版を作れません";

  it("下書きで回答0件なら出さない", () => {
    expect(gapOf({ form: form({ status: "draft", responseCount: 0 }) }).note).toBeNull();
    expect(gapOf({ form: form({ status: "draft", responseCount: 0, cycleStatus: "closed" }) }).note).toBeNull();
    expect(gapOf({ form: form({ status: "draft", responseCount: 0 }), newer: newerForm("frm_2", 2, "draft") }).note).toBeNull();
  });

  it("公開後か回答があれば、差し替えない理由を出す", () => {
    expect(gapOf().note).toBe(PUBLISHED);
    expect(gapOf({ form: form({ status: "draft", responseCount: 1 }) }).note).toBe(PUBLISHED);
    expect(gapOf({ form: form({ status: "closed" }) }).note).toBe(PUBLISHED);
    expect(gapOf({ schemeGap: SCHEME_GAP }).note).toBe(PUBLISHED);
  });

  it("締め切った評価期間で新しい版が無ければ、作れない理由を出す", () => {
    expect(gapOf({ form: form({ cycleStatus: "closed" }) }).note).toBe(CLOSED);
    expect(gapOf({ form: form({ cycleStatus: "closed" }), newer: newerForm("frm_2", 2, "published") }).note).toBe(PUBLISHED);
  });
});

describe("文言", () => {
  it("閉じた段の件数は、アンケート×項目の組で数える", () => {
    const one = gapOf();
    const two = gapOf({ form: form({ id: "frm_2" }), asked: ["kpi_a", "kpi_b"] });
    expect(comparisonSummary([one])).toBe("評価項目とのズレ 3件（足りない2・余分1）");
    expect(comparisonSummary([one, two])).toBe("評価項目とのズレ 4件（足りない3・余分1）");
  });

  it("開く札と、開いた中の1行目", () => {
    expect(COMPARISON_OPEN_LABEL).toBe("直すところを見る");
    expect(COMPARISON_LEAD).toBe("下記の内容を変更・修正してください");
  });

  it("種類の札は、マスタの画面の名前に合わせる。消えた項目は id ではなく決まった名前", () => {
    expect(COMPARISON_KIND_LABEL).toEqual({ requirement: "等級要件", behavior: "行動指針", kpi: "KPI項目" });
    expect(DELETED_ITEM_NAME).toBe("消された項目");
  });

  it("直す操作の札", () => {
    expect(fixLabel({ kind: "rebuild", formId: "frm_1" })).toBe("いまの制度の設定から設問を作り直す");
    expect(fixLabel({ kind: "rebuild", formId: "frm_1" })).toBe(REBUILD_LABEL);
    expect(fixLabel({ kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" })).toBe("この等級だけ新しい版の下書きを作る");
    expect(fixLabel({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true })).toBe("第2版の下書きを開く");
    expect(fixLabel({ kind: "openNewer", formId: "frm_3", href: "/admin/forms/frm_3", version: 3, draft: false })).toBe("第3版を開く");
    expect(fixLabel({ kind: "finishScheme", ...SCHEME_GAP })).toBe("基準を決める");
    const asking = { kind: "defineAsking", href: "/admin/scheme/items?item=kpi_b#kpi-item-kpi_b" } as const;
    expect(fixLabel({ ...asking, names: ["残業率"] })).toBe("「残業率」の聞き方を決める");
    expect(fixLabel({ ...asking, names: ["残業率", "粗利率", "定着率"] })).toBe("「残業率」ほか2項目の聞き方を決める");
  });

  it("作り直しと新しい版は確認つき。リンクは確認しない", () => {
    const gap = gapOf({ form: form({ title: "春の実績アンケート" }) });
    expect(fixConfirm({ kind: "rebuild", formId: "frm_1" }, gap)).toBe(
      "「春の実績アンケート」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。まだ公開前で、回答は1件もありません。よろしいですか？",
    );
    expect(fixConfirm({ kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" }, gap)).toBe(
      "「春の実績アンケート」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。よろしいですか？",
    );
    expect(fixConfirm({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true }, gap)).toBeUndefined();
    expect(fixConfirm({ kind: "finishScheme", ...SCHEME_GAP }, gap)).toBeUndefined();
    expect(fixConfirm({ kind: "defineAsking", href: "/admin/scheme/items?item=kpi_b#kpi-item-kpi_b", names: ["残業率"] }, gap)).toBeUndefined();
  });

  it("聞き方の決まっていない項目があれば、作り直しにも新しい版にも、押す前にその項目を名指しする", () => {
    const gap = gapOf({ form: form({ title: "春の実績アンケート" }), unaskable: ["kpi_c"] });
    const note = "「粗利率」は、実績の聞き方がまだ決まっていません。決めるまでは、作り直しても新しい版でも、設問は出ず点も付きません。";
    expect(fixConfirm({ kind: "rebuild", formId: "frm_1" }, gap)).toBe(
      `「春の実績アンケート」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。${note}まだ公開前で、回答は1件もありません。よろしいですか？`,
    );
    expect(fixConfirm({ kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" }, gap)).toBe(
      `「春の実績アンケート」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。${note}よろしいですか？`,
    );
  });

  it("アンケート1本の画面のボタンの確認は、警告の中の作り直しと同じ文", () => {
    const gap = gapOf({ form: form({ status: "draft", title: "春の実績アンケート" }), unaskable: ["kpi_b", "kpi_c"] });
    expect(rebuildConfirm(gap.formTitle, noTemplateNamesOf(gap))).toBe(fixConfirm({ kind: "rebuild", formId: "frm_1" }, gap));
    // 警告が無いときは、聞き方の注記を入れない
    expect(noTemplateNamesOf(null)).toEqual([]);
    expect(rebuildConfirm("春の実績アンケート", [])).toBe(
      "「春の実績アンケート」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。まだ公開前で、回答は1件もありません。よろしいですか？",
    );
  });
});

describe("rebuildWontFixNote: 作り直しても警告が消えないときの1行", () => {
  const draft = form({ status: "draft", responseCount: 0 });
  const ONLY_UNASKABLE: Partial<ComparisonGapInput> = { asked: ["kpi_a"], unaskable: ["kpi_b", "kpi_c"], form: draft, current: "form" };
  const LEAD = "下のボタンで作り直しても、上のズレは直りません。足りない項目の聞き方がまだ決まっていないためです。";

  it("足りないのが聞き方の決まっていない項目だけで余分も無いときだけ出す。直し方があれば警告を開くよう促す", () => {
    expect(rebuildWontFixNote(gapOf(ONLY_UNASKABLE))).toBe(`${LEAD}直し方は「直すところを見る」を開いてください。`);
  });

  it("直し方を出せない役割には、開くよう促さない", () => {
    expect(rebuildWontFixNote(gapOf({ ...ONLY_UNASKABLE, role: "MANAGER" }))).toBe(LEAD);
  });

  it("作り直せば直る行が1つでもあれば出さない。警告が無ければ出さない", () => {
    expect(rebuildWontFixNote(null)).toBeNull();
    // 余分（定着率）は作り直せば消える
    expect(rebuildWontFixNote(gapOf({ unaskable: ["kpi_b", "kpi_c"], form: draft, current: "form" }))).toBeNull();
    // 足りない項目の片方には聞き方がある
    expect(rebuildWontFixNote(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], form: draft, current: "form" }))).toBeNull();
  });
});
