import { describe, expect, it } from "vitest";
import { userNameSchema } from "./user-name-schema";

describe("氏名の共通スキーマ", () => {
  it("trim後の60文字を許可する", () => {
    expect(userNameSchema.parse("  " + "名".repeat(60) + "  ")).toBe("名".repeat(60));
  });
  it.each(["", "　 \t", "名".repeat(61)])("空白だけ・上限超過を拒否する", (name) => {
    expect(userNameSchema.safeParse(name).success).toBe(false);
  });
});
