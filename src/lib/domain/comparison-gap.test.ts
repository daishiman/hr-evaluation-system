import { describe, expect, it } from "vitest";
import { routeOf } from "@/lib/route-access";
import type { Role } from "@/lib/roles";
import {
  COMPARISON_LEAD,
  COMPARISON_OPEN_LABEL,
  FORM_LEDGER_PATH,
  NO_TEMPLATE_BADGE,
  NO_TEMPLATE_HINT,
  SELECTION_LEDGER_PATH,
  comparisonGapOf,
  comparisonSummary,
  fixConfirm,
  fixLabel,
  noTemplateNote,
  type ComparisonForm,
  type ComparisonGap,
  type ComparisonGapInput,
  type ComparisonPageKey,
} from "./comparison-gap";

/*
 * 比べる警告（DD-012・受入 AC1）。
 * 2つのページ（使うKPIを選ぶ・このアンケート）を、どの状態でも必ず持つこと、
 * 直す操作を上から順に1つだけ選ぶこと、見る人の役割で絞ることを確かめる。
 */

const NAMES: Record<string, string> = { kpi_a: "稼働率", kpi_b: "残業率", kpi_c: "粗利率", kpi_d: "定着率" };
const nameOf = (id: string) => NAMES[id] ?? id;

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

/** より新しい版。asked を省くと、まだ選んだ項目と一致していない版（kpi_a だけを聞いている）にする */
function newerForm(id: string, version: number, status: string, asked: readonly string[] = ["kpi_a"]): NonNullable<ComparisonGapInput["newer"]> {
  return { id, version, status, asked };
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
      { itemId: "kpi_b", name: "残業率", inSelection: true, inForm: false, noTemplate: false },
      { itemId: "kpi_c", name: "粗利率", inSelection: true, inForm: false, noTemplate: false },
      { itemId: "kpi_d", name: "定着率", inSelection: false, inForm: true, noTemplate: false },
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

  it("新しい版がどの状態でも、一致していれば古い版の警告を作らない（古い版が回答0件の下書きでも）", () => {
    for (const status of ["draft", "published", "closed"])
      for (const [formStatus, responseCount] of [["draft", 0], ["published", 3], ["closed", 3]] as const)
        for (const cycleStatus of ["planning", "open", "closed"])
          for (const role of ROLES) {
            const gap = comparisonGapOf(
              input({ form: form({ status: formStatus, cycleStatus, responseCount }), newer: newerForm("frm_2", 2, status, IN_SYNC), role }),
            );
            expect({ status, formStatus, cycleStatus, role, gap }).toEqual({ status, formStatus, cycleStatus, role, gap: null });
          }
  });

  it("3つの画面のどれで開いても、出さない", () => {
    for (const current of [null, "form", "selection"] as (ComparisonPageKey | null)[]) {
      expect(comparisonGapOf(input({ newer: newerForm("frm_2", 2, "draft", IN_SYNC), current }))).toBeNull();
    }
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

describe("comparisonGapOf: 設問のひな形が無い項目だけが足りないとき", () => {
  /** 足りないのは残業率・粗利率で、どちらにもひな形が無い（余分は無い） */
  const ONLY_UNASKABLE: Partial<ComparisonGapInput> = { asked: ["kpi_a"], unaskable: ["kpi_b", "kpi_c"] };
  const RESELECT = { kind: "reselect", href: "/admin/scheme/Regular" };

  it("作り直しも新しい版も直らないので、どの状態でも使うKPIを選ぶへ案内する", () => {
    for (const [status, responseCount] of [["draft", 0], ["draft", 2], ["published", 0], ["closed", 3]] as const)
      for (const cycleStatus of ["planning", "open"])
        for (const newer of [null, newerForm("frm_2", 2, "draft"), newerForm("frm_3", 3, "published")])
          for (const schemeGap of [null, SCHEME_GAP])
            for (const current of [null, "form"] as (ComparisonPageKey | null)[]) {
              const fix = gapOf({ ...ONLY_UNASKABLE, form: form({ status, responseCount, cycleStatus }), newer, schemeGap, current }).fix;
              expect({ status, responseCount, cycleStatus, newer, schemeGap, current, fix }).toEqual({
                status, responseCount, cycleStatus, newer, schemeGap, current, fix: RESELECT,
              });
            }
  });

  it("使うKPIを選ぶの画面（今いるページ）と、締め切った評価期間では出さない", () => {
    expect(gapOf({ ...ONLY_UNASKABLE, current: "selection" }).fix).toBeNull();
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ cycleStatus: "closed" }) }).fix).toBeNull();
    // 締め切った期の下書きを作り直しても、ひな形の無い項目は入らない
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ status: "draft", responseCount: 0, cycleStatus: "closed" }) }).fix).toBeNull();
    // 新しい版があっても開かせない（その版にもひな形の無い項目は入らず、締め切った期では選び直しても変わらない）
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ cycleStatus: "closed" }), newer: newerForm("frm_2", 2, "draft") }).fix).toBeNull();
  });

  it("ひな形のある項目のズレも残っていれば、従来の順で直す操作を選ぶ", () => {
    const draft = form({ status: "draft", responseCount: 0 });
    // 余分（定着率）がある
    expect(gapOf({ unaskable: ["kpi_b", "kpi_c"], form: draft }).fix?.kind).toBe("rebuild");
    expect(gapOf({ unaskable: ["kpi_b", "kpi_c"] }).fix?.kind).toBe("newVersion");
    // 足りない項目の片方にはひな形がある
    expect(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], form: draft }).fix?.kind).toBe("rebuild");
    expect(gapOf({ asked: ["kpi_a"], unaskable: ["kpi_c"], newer: newerForm("frm_2", 2, "draft") }).fix?.kind).toBe("openNewer");
  });

  it("注記の先頭で、ひな形の無い項目を名指しし、どの操作でも直らないと伝える", () => {
    const lead = "「残業率」・「粗利率」には設問のひな形がありません。作り直しても新しい版でも、設問は出ず点も付きません。";
    expect(noTemplateNote(["残業率", "粗利率"])).toBe(lead);
    // 下書きで回答0件は、これまで注記が無かったが、ひな形の無い項目があれば出す
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ status: "draft", responseCount: 0 }) }).note).toBe(lead);
    expect(gapOf(ONLY_UNASKABLE).note).toBe(`${lead}公開後や回答のあるアンケートは設問を差し替えません`);
    expect(gapOf({ ...ONLY_UNASKABLE, form: form({ cycleStatus: "closed" }) }).note).toBe(`${lead}締め切った評価期間には新しい版を作れません`);
    // ひな形のある項目のズレと混ざっていても、ひな形の無い項目だけを名指しする
    expect(gapOf({ unaskable: ["kpi_c"] }).note).toBe(
      "「粗利率」には設問のひな形がありません。作り直しても新しい版でも、設問は出ず点も付きません。公開後や回答のあるアンケートは設問を差し替えません",
    );
  });

  it("札と、リンクを置けない返事のための直し方", () => {
    expect(NO_TEMPLATE_BADGE).toBe("設問なし");
    expect(NO_TEMPLATE_HINT).toBe("使うKPIを選ぶで、ひな形のある項目に選び直してください。");
  });
});

describe("comparisonGapOf: 見る人の役割", () => {
  const cases: { name: string; over: Partial<ComparisonGapInput> }[] = [
    { name: "新しい版を開く", over: { newer: newerForm("frm_2", 2, "draft") } },
    { name: "作り直す", over: { form: form({ status: "draft", responseCount: 0 }) } },
    { name: "評価セットの残りの手順", over: { schemeGap: SCHEME_GAP } },
    { name: "新しい版を作る", over: {} },
    {
      name: "使うKPIを選び直す",
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

  it("直す操作の札", () => {
    expect(fixLabel({ kind: "rebuild", formId: "frm_1" })).toBe("設問を作り直す");
    expect(fixLabel({ kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" })).toBe("この等級だけ新しい版の下書きを作る");
    expect(fixLabel({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true })).toBe("第2版の下書きを開く");
    expect(fixLabel({ kind: "openNewer", formId: "frm_3", href: "/admin/forms/frm_3", version: 3, draft: false })).toBe("第3版を開く");
    expect(fixLabel({ kind: "finishScheme", ...SCHEME_GAP })).toBe("基準を決める");
    expect(fixLabel({ kind: "reselect", href: "/admin/scheme/Regular" })).toBe("使うKPIを選ぶで選び直す");
  });

  it("作り直しと新しい版は確認つき。リンクは確認しない", () => {
    const title = "春の実績アンケート";
    expect(fixConfirm({ kind: "rebuild", formId: "frm_1" }, title)).toBe(
      "「春の実績アンケート」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。まだ公開前で、回答は1件もありません。よろしいですか？",
    );
    expect(fixConfirm({ kind: "newVersion", cycleId: "cyc_1", gradeId: "grd_1" }, title)).toBe(
      "「春の実績アンケート」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。よろしいですか？",
    );
    expect(fixConfirm({ kind: "openNewer", formId: "frm_2", href: "/admin/forms/frm_2", version: 2, draft: true }, title)).toBeUndefined();
    expect(fixConfirm({ kind: "finishScheme", ...SCHEME_GAP }, title)).toBeUndefined();
    expect(fixConfirm({ kind: "reselect", href: "/admin/scheme/Regular" }, title)).toBeUndefined();
  });
});
