import { describe, expect, it } from "vitest";
import { routeOf } from "@/lib/route-access";
import {
  ASKING_PLACE_HINT,
  isUnaskable,
  unaskableLead,
  validateScheme,
  type SchemeSelection,
  type ValidateSchemeOptions,
} from "./scheme";
import { pointsForSlot, type GradePointRule } from "./grade-points";

/**
 * 等級区分ごとの評価セットの検証。
 *
 * 2026-08-11 に項目選択を自由化した。
 * 「どの項目を選べるか」「どの分類から選ぶか」「どの項目を重い枠に置くか」は制限しない。
 * 残っている制約は、枠の数・配点・固定枠・重複の4つだけ。
 *
 * このファイルは「外した制約が戻っていないこと」も含めて固定する。
 * 制限を復活させたくなったときは、まずここのテストが赤くなる。
 */

const RULES: Record<string, GradePointRule> = {
  Beginner: { pointGroup: "Beginner", totalPoints: 100, fixedSlotPoints: 100, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 0 },
  Regular: { pointGroup: "Regular", totalPoints: 100, fixedSlotPoints: 80, majorSlotPoints: 0, majorSlotCount: 0, minorSlotPoints: 10, minorSlotCount: 2 },
  Chief: { pointGroup: "Chief", totalPoints: 100, fixedSlotPoints: 40, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 4 },
  AM: { pointGroup: "AM", totalPoints: 100, fixedSlotPoints: 30, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 5 },
  Manager: { pointGroup: "Manager", totalPoints: 100, fixedSlotPoints: 20, majorSlotPoints: 20, majorSlotCount: 1, minorSlotPoints: 10, minorSlotCount: 6 },
};

/** 固定枠になれるのは No.1 等級要件達成率だけ。ここは自由化後も変わらない。 */
const FIXED = ["k1"];

function opts(group: string, over?: Partial<ValidateSchemeOptions>): ValidateSchemeOptions {
  return {
    rule: RULES[group],
    fixedSlotItemIds: FIXED,
    ...over,
  };
}

/** 正しい選び方を組み立てる。配点は等級区分の型から入れる（画面と同じ考え方）。 */
function build(group: string, majorId: string | null, minorIds: string[], categoryId = "other"): SchemeSelection[] {
  const rule = RULES[group];
  const rows: SchemeSelection[] = [
    { kpiItemId: "k1", categoryId: null, weight: pointsForSlot(rule, "fixed"), isFixedSlot: true, isMajorSlot: false },
  ];
  if (majorId) {
    rows.push({ kpiItemId: majorId, categoryId: "sales", weight: pointsForSlot(rule, "major"), isFixedSlot: false, isMajorSlot: true });
  }
  for (const id of minorIds) {
    rows.push({ kpiItemId: id, categoryId, weight: pointsForSlot(rule, "minor"), isFixedSlot: false, isMajorSlot: false });
  }
  return rows;
}

const VALID: Record<string, SchemeSelection[]> = {
  Beginner: build("Beginner", null, []),
  Regular: build("Regular", null, ["k2", "k3"]),
  Chief: build("Chief", "k9", ["k2", "k3", "k5", "k7"]),
  AM: build("AM", "k24", ["k2", "k3", "k5", "k7", "k10"]),
  Manager: build("Manager", "k6", ["k2", "k3", "k5", "k7", "k10", "k11"]),
};

describe("validateScheme — 等級区分ごとの正しい組み合わせ", () => {
  for (const [group, rows] of Object.entries(VALID)) {
    it(`${group} は合計100点ちょうどで通る`, () => {
      const r = validateScheme(rows, opts(group));
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.total).toBe(100);
    });
  }

  it("項目数は Beginner=1 / Regular=3 / Chief=6 / AM=7 / Manager=8", () => {
    expect(Object.entries(VALID).map(([g, rows]) => [g, rows.length])).toEqual([
      ["Beginner", 1],
      ["Regular", 3],
      ["Chief", 6],
      ["AM", 7],
      ["Manager", 8],
    ]);
  });
});

describe("validateScheme — 項目の選び方は自由", () => {
  it("どの項目でも選べる（元の配点表にその等級区分の行が無かった項目も含む）", () => {
    // k24 利益率は移行前の配点表では Chief 対象外だった。自由化後は選べる。
    const r = validateScheme(build("Chief", "k24", ["k30", "k31", "k32", "k33"]), opts("Chief"));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("金銭系でない項目も重い枠（20点枠）に置ける", () => {
    const rows = VALID.Manager.map((x, i) => (i === 1 ? { ...x, kpiItemId: "k13", categoryId: "quality" } : x));
    const r = validateScheme(rows, opts("Manager", { itemNameOf: () => "支援計画期限遵守率" }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("同じ分類から何項目でも選べる（分類の網羅は求めない）", () => {
    const rows = build("Manager", "k6", ["k2", "k3", "k5", "k7", "k10", "k11"], "sales");
    const r = validateScheme(rows, opts("Manager"));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("分類が無い項目（categoryId が null）でも選べる", () => {
    const rows = build("Regular", null, ["k2", "k3"]).map((x) => ({ ...x, categoryId: null }));
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("validateScheme — 項目数", () => {
  it("足りないときは「あと何件」を日本語で伝える", () => {
    const rows = VALID.Manager.slice(0, 6);
    const r = validateScheme(rows, opts("Manager"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("8件です") && e.includes("あと2件選んで"))).toBe(true);
  });

  it("多すぎるときは「何件外すか」を伝える", () => {
    const rows = [...VALID.Regular, { kpiItemId: "k5", categoryId: null, weight: 10, isFixedSlot: false, isMajorSlot: false }];
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("1件外して"))).toBe(true);
  });
});

describe("validateScheme — 固定枠", () => {
  it("固定枠がないと弾く", () => {
    const rows = VALID.Chief.map((x, i) => (i === 0 ? { ...x, isFixedSlot: false } : x));
    const r = validateScheme(rows, opts("Chief"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("固定枠") && e.includes("1件"))).toBe(true);
  });

  it("等級要件達成率でない項目を固定枠にできない（APIを直接叩かれても通さない）", () => {
    const rows = VALID.Chief.map((x, i) => (i === 0 ? { ...x, kpiItemId: "k13" } : x));
    const r = validateScheme(rows, opts("Chief", { itemNameOf: (id) => (id === "k13" ? "支援計画期限遵守率" : id) }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("支援計画期限遵守率") && e.includes("固定枠にできません"))).toBe(true);
  });
});

describe("validateScheme — 重い枠（20点枠）の数", () => {
  it("Chief以上はちょうど1件選ぶ", () => {
    const rows = VALID.Chief.map((x) => ({ ...x, isMajorSlot: false, weight: x.isFixedSlot ? x.weight : 10 }));
    const r = validateScheme(rows, opts("Chief"));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("20点枠はちょうど1件"))).toBe(true);
  });

  it("Beginner・Regular に20点枠は無い", () => {
    for (const group of ["Beginner", "Regular"]) {
      const rows = [
        ...VALID[group],
        { kpiItemId: "k9", categoryId: "sales", weight: 20, isFixedSlot: false, isMajorSlot: true },
      ];
      const r = validateScheme(rows, opts(group));
      expect(r.ok, group).toBe(false);
      // 呼び名を渡さなければ「この等級区分」と呼ぶ（区分の鍵は出さない）
      expect(r.errors.some((e) => e.startsWith("この等級区分に") && e.includes("点枠はありません")), group).toBe(true);
    }
  });
});

describe("validateScheme — 配点と重複", () => {
  it("配点が等級区分の型と違えば弾く（ユーザー入力は信用しない）", () => {
    const rows = VALID.Manager.map((x, i) => (i === 0 ? { ...x, weight: 40 } : x));
    const r = validateScheme(rows, opts("Manager", { itemNameOf: () => "等級要件達成率" }));
    expect(r.errors.some((e) => e.includes("配点は20点です") && e.includes("いまは40点"))).toBe(true);
    expect(r.errors.some((e) => e.includes("合計が120点"))).toBe(true);
  });

  it("配点0の項目は弾く（評価しない項目は0点の行ではなく行を作らない方針）", () => {
    const rows = VALID.Regular.map((x, i) => (i === 2 ? { ...x, weight: 0 } : x));
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("1点以上"))).toBe(true);
  });

  it("同じ項目を2回選ぶと弾く", () => {
    const rows = build("Regular", null, ["k2", "k2"]);
    const r = validateScheme(rows, opts("Regular"));
    expect(r.errors.some((e) => e.includes("重複"))).toBe(true);
  });
});

describe("validateScheme — ランク基準が未設定の項目", () => {
  it("ratedItemIds を渡さなければ判定しない（未対応の呼び出し元で誤警告を出さない）", () => {
    const r = validateScheme(VALID.Manager, opts("Manager"));
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("すべての項目に基準があれば何も言わない", () => {
    const ids = VALID.Manager.map((x) => x.kpiItemId);
    const r = validateScheme(VALID.Manager, opts("Manager", { ratedItemIds: ids }));
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  /* 基準が無くても保存は通す（errors ではなく warnings）。
     「まず選んでから基準を作る」順序を塞がないため。ここを errors に変えると赤くなる。 */
  it("基準が未設定でも保存は通し、項目名・等級区分名・閾値が厳しすぎうることを警告で伝える", () => {
    const ids = VALID.Manager.map((x) => x.kpiItemId).filter((id) => id !== "k11");
    const r = validateScheme(
      VALID.Manager,
      opts("Manager", {
        ratedItemIds: ids,
        itemNameOf: (id) => (id === "k11" ? "利用率" : id),
        groupLabel: "等級5-1・等級5-2",
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("利用率");
    // 区分は等級名で呼び、英語の区分名（鍵）は文に出さない
    expect(r.warnings[0]).toContain("等級5-1・等級5-2");
    expect(r.warnings[0]).not.toContain("Manager");
    /* 「点が付かない」ではない。採点は target_grades を見ないため点は付く。
       付いたうえで上位等級向けの閾値が当たる、という事実のほうを伝える。 */
    expect(r.warnings[0]).toContain("厳しすぎる可能性");
  });

  it("未設定が複数あれば1つの警告にまとめて全項目名を出す", () => {
    const r = validateScheme(
      VALID.Chief,
      opts("Chief", { ratedItemIds: ["k1", "k9"], itemNameOf: (id) => `項目${id}` }),
    );
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
    for (const id of ["k2", "k3", "k5", "k7"]) expect(r.warnings[0]).toContain(`項目${id}`);
  });
});

describe("validateScheme — 実績の聞き方（設問のひな形）が決まっていない項目", () => {
  /* 画面で足したKPI項目には実績を聞く設問のひな形（kpi_questions）が無く、アンケートを作っても
     作り直しても設問が出ない。作り直しで直ると思わせないよう、選んだ時点で知らせる。 */
  const ALL = VALID.Manager.map((x) => x.kpiItemId);

  it("askableItemIds を渡さなければ判定しない（未対応の呼び出し元で誤警告を出さない）", () => {
    expect(validateScheme(VALID.Manager, opts("Manager")).warnings).toEqual([]);
  });

  it("すべての項目にひな形があれば何も言わない", () => {
    const r = validateScheme(VALID.Manager, opts("Manager", { askableItemIds: ALL }));
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("ひな形が無くても保存は通し、項目名と、作り直しても設問が出ず点も付かないことを伝える", () => {
    const r = validateScheme(
      VALID.Manager,
      opts("Manager", {
        askableItemIds: ALL.filter((id) => id !== "k11"),
        itemNameOf: (id) => (id === "k11" ? "紹介件数" : id),
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("「紹介件数」");
    expect(r.warnings[0]).toContain("作り直しても");
    expect(r.warnings[0]).toContain("点も付きません");
  });

  it("どこで聞き方を決めるかを、台帳と同じ画面名で添える", () => {
    const r = validateScheme(VALID.Manager, opts("Manager", { askableItemIds: ALL.filter((id) => id !== "k11") }));
    expect(r.warnings[0].endsWith(ASKING_PLACE_HINT)).toBe(true);
    expect(ASKING_PLACE_HINT).toContain(`${routeOf("/admin/scheme")!.label}の「KPI項目」`);
  });

  it("固定枠は等級要件の設問から数えるので、ひな形が無くても言わない", () => {
    const r = validateScheme(VALID.Manager, opts("Manager", { askableItemIds: ALL.filter((id) => id !== "k1") }));
    expect(r.warnings).toEqual([]);
  });

  it("ランク基準の警告とは別の1行にし、無い項目が複数でも1つにまとめる", () => {
    const r = validateScheme(
      VALID.Chief,
      opts("Chief", {
        ratedItemIds: ["k1", "k9", "k2", "k3", "k5"],
        askableItemIds: ["k1", "k9", "k2"],
        itemNameOf: (id) => `項目${id}`,
      }),
    );
    expect(r.warnings).toHaveLength(2);
    const [unrated, unaskable] = r.warnings;
    expect(unrated).toContain("項目k7");
    for (const id of ["k3", "k5", "k7"]) expect(unaskable).toContain(`項目${id}`);
    expect(unaskable).not.toContain("項目k2");
  });
});

describe("isUnaskable・unaskableLead — 聞き方が決まっていない項目の線引きと書き出し", () => {
  /* 選んだ時点の警告（validateScheme）と比べる警告の札（comparison-gap-loader.ts）は、isUnaskable の1つで線を引く。
     書き出しの文は、選んだ時点の警告と比べる警告の注記（comparison-gap.ts の noTemplateNote）で同じ字面にする。 */
  const askable = new Set(["k2"]);

  it("固定枠でなく、ひな形も無い項目だけを聞き方が決まっていないとする", () => {
    expect(isUnaskable({ kpiItemId: "k3", isFixedSlot: false }, askable)).toBe(true);
    expect(isUnaskable({ kpiItemId: "k2", isFixedSlot: false }, askable)).toBe(false);
  });

  it("固定枠は等級要件の設問から数えるので、ひな形が無くても聞き方が決まっていないとしない", () => {
    expect(isUnaskable({ kpiItemId: "k1", isFixedSlot: true }, askable)).toBe(false);
    expect(isUnaskable({ kpiItemId: "k1", isFixedSlot: true }, new Set())).toBe(false);
  });

  it("書き出しは項目名を「」で囲み、2件以上は「・」でつなぐ", () => {
    expect(unaskableLead(["粗利率"])).toBe("「粗利率」は、実績の聞き方がまだ決まっていません。");
    expect(unaskableLead(["稼働率", "残業率"])).toBe("「稼働率」・「残業率」は、実績の聞き方がまだ決まっていません。");
  });

  it("選んだ時点の警告は、選んだ順に名指しする書き出しのあとに、この場面の続く文と決める場所を置く", () => {
    const r = validateScheme(
      VALID.Chief,
      opts("Chief", { askableItemIds: ["k1", "k9", "k2"], itemNameOf: (id) => `項目${id}` }),
    );
    expect(r.warnings).toEqual([
      unaskableLead(["項目k3", "項目k5", "項目k7"]) +
        "このまま保存はできます。決めるまでは、アンケートを作っても作り直しても設問が出ず、点も付きません。" +
        ASKING_PLACE_HINT,
    ]);
  });
});
