import { describe, expect, it } from "vitest";
import { canAnswerForm, judgeFormEntry } from "./form-entry";

describe("canAnswerForm", () => {
  it("自分の等級のアンケートには回答できる", () => {
    expect(canAnswerForm("grd_b", "grd_b")).toBe(true);
  });

  it("別の等級のアンケートには回答できない", () => {
    expect(canAnswerForm("grd_b", "grd_c")).toBe(false);
  });

  it("等級が割り当てられていない人（管理者など）は回答できない", () => {
    expect(canAnswerForm(null, "grd_b")).toBe(false);
  });

  it("どちらも等級なしでも、一致とはみなさない", () => {
    expect(canAnswerForm(null, null)).toBe(false);
  });
});

describe("judgeFormEntry", () => {
  it("自分の等級のアンケートは回答画面へ", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_b", formGradeId: "grd_b", hasResponse: false })).toBe("answer");
  });

  it("別の等級のアンケートは、閉ざさずに中身の確認画面へ", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_b", formGradeId: "grd_c", hasResponse: false })).toBe("content-only");
  });

  it("等級のない管理者も、中身の確認画面までは通す", () => {
    expect(judgeFormEntry({ viewerGradeId: null, formGradeId: "grd_c", hasResponse: false })).toBe("content-only");
  });

  it("昇格して等級が変わっても、自分が答えたアンケートは回答画面で読み返せる", () => {
    expect(judgeFormEntry({ viewerGradeId: "grd_a", formGradeId: "grd_b", hasResponse: true })).toBe("answer");
  });
});
