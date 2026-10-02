import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "components", "RecordForm.tsx"), "utf8");
const actions = ["companies.ts", "system-users.ts", "members.ts"].map((file) => ({
  file,
  source: readFileSync(join(process.cwd(), "src", "actions", file), "utf8"),
}));

describe("RecordForm の発行済みパスワード", () => {
  it("保存成功時は送信した値を控えにし、その場で次の値へ置き換えない", () => {
    const success = source.slice(source.indexOf("setMessage(result.message)"), source.indexOf("onSaved?.()"));

    expect(success).toContain("setIssuedGenerated(issued)");
    expect(success).toContain('String(payload[name] ?? "")');
    expect(success).not.toContain("generateInitialPassword()");
  });

  it("新しい値は管理者が次の入力を始めたときだけ作り、控えは閉じて始める", () => {
    const begin = source.slice(source.indexOf("const beginNextSubmission"), source.indexOf("const onKeyDown"));

    expect(begin).toContain("generateInitialPassword()");
    expect(begin).toContain("setMemoOpen(false)");
    expect(source).toContain("今回発行した値です");
    expect(source).toContain("次の入力を始める");
  });
});

describe("RecordForm の控えの置き方（一覧の新しい行 ＞ 成功の知らせ ＞ 控え）", () => {
  it("控えは成功の知らせ（RefreshStatus）の後ろに置き、フォームと入れ替えない", () => {
    const status = source.indexOf("<RefreshStatus");
    const memo = source.indexOf("{issuedGenerated !== null && (");

    expect(status).toBeGreaterThan(-1);
    expect(memo).toBeGreaterThan(status);
    // 以前は「フォームか控えか」の三項演算で、控えがフォームの場所を占めていた
    expect(source).not.toContain("issuedGenerated === null ? (");
  });

  it("控えを保存できたときだけ畳んで始め、印が無いときは開いておく", () => {
    const success = source.slice(source.indexOf("setMessage(result.message)"), source.indexOf("onSaved?.()"));

    expect(success).toContain('"memoStored" in result && result.memoStored === true');
    expect(success).toContain("setMemoOpen(!stored)");
  });

  it("開閉のボタンは aria-expanded を持ち、開いたときだけ値を描く", () => {
    const memo = source.slice(source.indexOf("{issuedGenerated !== null && ("));

    expect(memo).toContain("aria-expanded={memoOpen}");
    expect(memo).toContain("aria-controls={memoOpen ? memoId : undefined}");
    expect(memo).toContain("{memoOpen && (");
    // 一覧の行の操作と同じ名前にする（CredentialMemoButton）
    expect(memo).toContain("仮パスワードの控えを見る");
    // 値を読み上げの対象（live region）に入れない
    expect(memo).not.toContain('role="status"');
  });

  it.each(actions)("$file の作成は控えを保存できたかだけを返し、値は返さない", ({ source: action }) => {
    expect(action).toContain("memoStored: credential.stored");
    expect(action).not.toMatch(/return\s*\{[^}]*\bpassword\s*[:,]/);
  });
});
