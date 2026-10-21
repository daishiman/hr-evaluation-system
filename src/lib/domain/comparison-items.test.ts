import { describe, expect, it } from "vitest";
import { routeOf } from "@/lib/route-access";
import {
  BEHAVIOR_LEDGER_PATH,
  REQUIREMENTS_LEDGER_PATH,
  behaviorGuidelineAnchor,
  behaviorGuidelinesPath,
  gradeRequirementAnchor,
  gradeRequirementsPath,
  guidelineCatalog,
  requirementSeries,
  type GuidelineMasterRow,
  type RequirementMasterRow,
} from "./comparison-items";

/*
 * 比べる警告の、等級要件と行動指針の材料（DD-012）。
 * 聞くはずの項目を form-build.ts と同じ選び方で作ること、等級要件を版の系列で数えること、
 * 行から飛ぶ先が台帳の画面で、行の位置の錨を持つことを確かめる。
 */

function req(over: Partial<RequirementMasterRow> & { id: string }): RequirementMasterRow {
  return { gradeId: "grd_1", category: "support", seq: 1, text: over.id, isActive: true, previousVersionId: null, ...over };
}

describe("requirementSeries: 等級要件を版の系列で数える", () => {
  // gr_a → gr_a2（本文を直した新版）。gr_b は使わない。gr_c は運営。gr_x は別の等級。gr_z は区分の外
  const ROWS: RequirementMasterRow[] = [
    req({ id: "gr_c", category: "operation", seq: 1, text: "運営の項目" }),
    req({ id: "gr_a2", seq: 2, text: "直したあとの本文", previousVersionId: "gr_a" }),
    req({ id: "gr_a", seq: 2, text: "直す前の本文" }),
    req({ id: "gr_d", seq: 1, text: "支援の先頭" }),
    req({ id: "gr_b", seq: 3, isActive: false }),
    req({ id: "gr_x", gradeId: "grd_2" }),
    req({ id: "gr_z", category: "other" }),
  ];
  const series = requirementSeries(ROWS);

  it("聞くはずの系列は、いまの版のうち使う項目を、支援 → 運営、seq の順に。系列の起点の id で返す", () => {
    expect(series.expectedOf("grd_1")).toEqual(["gr_d", "gr_a", "gr_c"]);
    expect(series.expectedOf("grd_2")).toEqual(["gr_x"]);
    expect(series.expectedOf("grd_none")).toEqual([]);
  });

  it("設問が持つ版の id を起点の id に読み替える（直す前の版を聞いていても、同じ系列）。マスタに無い id はそのまま", () => {
    expect(series.rootsOf(["gr_a", "gr_a2", "gr_b", "gr_gone"])).toEqual(["gr_a", "gr_a", "gr_b", "gr_gone"]);
  });

  it("系列の名前は、いまの版の本文。マスタに無い系列は undefined", () => {
    expect(series.nameOf("gr_a")).toBe("直したあとの本文");
    expect(series.nameOf("gr_b")).toBe("gr_b");
    expect(series.nameOf("gr_a2")).toBeUndefined();
    expect(series.nameOf("gr_gone")).toBeUndefined();
  });
});

describe("guidelineCatalog: 行動指針の観点", () => {
  const ROWS: GuidelineMasterRow[] = [
    { id: "bg_2", band: "g1_2", aspectName: "専門性について", seq: 2, isActive: true },
    { id: "bg_1", band: "g1_2", aspectName: "創造性について", seq: 1, isActive: true },
    { id: "bg_off", band: "g1_2", aspectName: "個性について", seq: 3, isActive: false },
    { id: "bg_3", band: "g3_4", aspectName: "平等性について", seq: 1, isActive: true },
  ];
  const catalog = guidelineCatalog(ROWS);

  it("聞くはずの観点は、等級の基準の使う観点を seq の順に。基準の無い等級は聞かない", () => {
    expect(catalog.expectedOf("g1_2")).toEqual(["bg_1", "bg_2"]);
    expect(catalog.expectedOf("g3_4")).toEqual(["bg_3"]);
    expect(catalog.expectedOf(null)).toEqual([]);
  });

  it("呼び名と基準を引く。マスタに無い観点は undefined", () => {
    expect(catalog.nameOf("bg_off")).toBe("個性について");
    expect(catalog.bandOf("bg_3")).toBe("g3_4");
    expect(catalog.nameOf("bg_gone")).toBeUndefined();
    expect(catalog.bandOf("bg_gone")).toBeUndefined();
  });
});

describe("行から飛ぶ先", () => {
  it("等級要件の画面は、等級を開き、系列を渡せばその行の錨へ飛ぶ", () => {
    expect(gradeRequirementAnchor("gr_a")).toBe("grade-requirement-gr_a");
    expect(gradeRequirementsPath("grd_1")).toBe("/admin/masters/requirements?grade=grd_1");
    expect(gradeRequirementsPath("grd 1", "gr a")).toBe("/admin/masters/requirements?grade=grd%201#grade-requirement-gr%20a");
  });

  it("行動指針の画面は、等級と基準を開き、観点を渡せばそのカードの錨へ飛ぶ", () => {
    expect(behaviorGuidelineAnchor("bg_1")).toBe("behavior-guideline-bg_1");
    expect(behaviorGuidelinesPath("grd_1", "g1_2", "bg_1")).toBe("/admin/behavior?grade=grd_1&band=g1_2#behavior-guideline-bg_1");
    expect(behaviorGuidelinesPath("grd_1", "g1_2")).toBe("/admin/behavior?grade=grd_1&band=g1_2");
    expect(behaviorGuidelinesPath("grd_1", null)).toBe("/admin/behavior?grade=grd_1");
  });

  it("どちらの画面も台帳にある", () => {
    expect(routeOf(REQUIREMENTS_LEDGER_PATH)).not.toBeNull();
    expect(routeOf(BEHAVIOR_LEDGER_PATH)).not.toBeNull();
  });
});
