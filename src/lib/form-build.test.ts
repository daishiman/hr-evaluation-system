import { describe, expect, it } from "vitest";
import { isFormVersionConflict } from "./form-build";

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
