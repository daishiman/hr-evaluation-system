import { describe, expect, it } from "vitest";
import { issueImportConfirmation, verifyImportConfirmation } from "./import-confirmation";

describe("CSV取り込み前確認トークン", () => {
  it("確認したフォームと同じCSVだけを本取り込みへ進める", async () => {
    const token = await issueImportConfirmation("secret", "form-a", "氏名,回答\n田中,10");
    await expect(verifyImportConfirmation("secret", token, "form-a", "氏名,回答\n田中,10")).resolves.toBe(true);
    await expect(verifyImportConfirmation("secret", token, "form-a", "氏名,回答\n田中,99")).resolves.toBe(false);
    await expect(verifyImportConfirmation("secret", token, "form-b", "氏名,回答\n田中,10")).resolves.toBe(false);
  });

  it("秘密鍵が違うトークンや壊れた文字列は拒否する", async () => {
    const token = await issueImportConfirmation("secret", "form-a", "csv");
    await expect(verifyImportConfirmation("other", token, "form-a", "csv")).resolves.toBe(false);
    await expect(verifyImportConfirmation("secret", "broken", "form-a", "csv")).resolves.toBe(false);
    await expect(verifyImportConfirmation("secret", "%", "form-a", "csv")).resolves.toBe(false);
  });
});
