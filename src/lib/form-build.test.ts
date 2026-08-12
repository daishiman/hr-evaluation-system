import { describe, expect, it } from "vitest";
import { assertFormContentEditable, isFormVersionConflict } from "./form-build";

describe("assertFormContentEditable（アンケート内容の版を守る）", () => {
  it("下書きは内容を変更できる", () => {
    expect(() => assertFormContentEditable({ status: "draft", title: "上期アンケート" })).not.toThrow();
  });

  it.each([
    ["published", "公開中"],
    ["closed", "締め切り済み"],
  ])("%s は既存版を変えず、新しい版へ案内する", (status, stateLabel) => {
    expect(() => assertFormContentEditable({ status, title: "上期アンケート" })).toThrow(
      new RegExp(`${stateLabel}.*新しい版`),
    );
  });

  it("未知の状態もfail-closedにする", () => {
    expect(() => assertFormContentEditable({ status: "unexpected", title: "上期アンケート" })).toThrow(
      /現在の状態.*新しい版/,
    );
  });
});

describe("isFormVersionConflict", () => {
  it("フォーム版の一意制約だけを再試行対象にする", () => {
    expect(
      isFormVersionConflict(
        new Error("D1_ERROR: UNIQUE constraint failed: forms.cycle_id, forms.grade_id, forms.version"),
      ),
    ).toBe(true);
    expect(isFormVersionConflict(new Error("constraint uq_forms_cycle_grade_ver failed"))).toBe(true);
  });

  it("別の一意制約や一般エラーを再試行しない", () => {
    expect(isFormVersionConflict(new Error("UNIQUE constraint failed: forms.public_token"))).toBe(false);
    expect(isFormVersionConflict(new Error("network timeout"))).toBe(false);
  });

  it("ラップされたcauseも確認する", () => {
    expect(
      isFormVersionConflict(
        new Error("Drizzle query failed", {
          cause: new Error("UNIQUE constraint failed: forms.cycle_id, forms.grade_id, forms.version"),
        }),
      ),
    ).toBe(true);
  });
});
