import { describe, expect, it } from "vitest";
import { bodySchema } from "./body-schema";

describe("制度要件の並べ替え入力（並び全体を送る・S11）", () => {
  it.each(["gradeRequirementOrder", "promotionRequirementOrder"] as const)("%s は id の並びを受け付ける", (kind) => {
    expect(bodySchema.safeParse({ kind, ids: ["req_1", "req_2"] }).success).toBe(true);
  });

  it("空の並び・空の id・1つずつの移動方向は受け付けない", () => {
    expect(bodySchema.safeParse({ kind: "gradeRequirementOrder", ids: [] }).success).toBe(false);
    expect(bodySchema.safeParse({ kind: "gradeRequirementOrder", ids: [""] }).success).toBe(false);
    expect(bodySchema.safeParse({ kind: "gradeRequirementOrder", id: "greq_1", direction: "up" }).success).toBe(false);
  });
});
