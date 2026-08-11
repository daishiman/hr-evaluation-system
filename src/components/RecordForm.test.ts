import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "components", "RecordForm.tsx"), "utf8");

describe("RecordForm の発行済みパスワード", () => {
  it("保存成功時は送信した値を控えにし、その場で次の値へ置き換えない", () => {
    const success = source.slice(source.indexOf('setMessage(json.message ?? "保存しました。")'), source.indexOf("onSaved?.()"));

    expect(success).toContain("setIssuedGenerated(issued)");
    expect(success).toContain('String(payload[name] ?? "")');
    expect(success).not.toContain("generateInitialPassword()");
  });

  it("新しい値は管理者が次の入力を始めたときだけ作る", () => {
    const begin = source.slice(source.indexOf("const beginNextSubmission"), source.indexOf("const onKeyDown"));

    expect(begin).toContain("generateInitialPassword()");
    expect(source).toContain("今回発行した値です");
    expect(source).toContain("次の入力を始める");
  });
});
