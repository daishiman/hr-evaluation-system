import { describe, expect, it } from "vitest";
import { bodySchema } from "./body-schema";

describe("制度要件の並べ替え入力", () => {
  it.each(["up", "down", "top", "bottom"] as const)("等級要件の %s を受け付ける", (direction) => {
    expect(bodySchema.safeParse({ kind: "gradeRequirementOrder", id: "greq_1", direction }).success).toBe(true);
  });

  it.each(["up", "down", "top", "bottom"] as const)("昇格要件の %s を受け付ける", (direction) => {
    expect(bodySchema.safeParse({ kind: "promotionRequirementOrder", id: "preq_1", direction }).success).toBe(true);
  });

  it("定義外の移動方向は受け付けない", () => {
    expect(bodySchema.safeParse({ kind: "gradeRequirementOrder", id: "greq_1", direction: "first" }).success).toBe(false);
  });
});
