import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("改善した画面の回復経路と用語", () => {
  it("会社切替はlabel内にブロック要素を入れず、失敗を読み上げる", () => {
    const source = read("src/components/CompanyScopeSwitcher.tsx");
    expect(source).toContain('htmlFor="company-scope"');
    expect(source).toContain('id="company-scope"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).not.toMatch(/<label[\s\S]*<select[\s\S]*<div[\s\S]*<\/label>/);
  });

  it("利用者0件の案内は、追加欄の上下位置に依存しない", () => {
    const source = read("src/app/system/users/page.tsx");
    expect(source).toContain('body="別の会社を選ぶか、「新しい利用者を作る」から追加してください。"');
    expect(source).not.toContain("下から追加してください");
  });

  it("評価状態は一覧でも確認中に統一し、未確定は作業件数の表現だけに使う", () => {
    const source = read("src/app/manager/cycles/page.tsx");
    expect(source).toContain("確認中（{drafts.length}件）");
    expect(source).not.toContain("確認待ち（{drafts.length}件）");
  });

  it("利用者追加の入口を一覧より先に置き、空状態はその入口名を案内する", () => {
    const source = read("src/app/system/users/page.tsx");
    expect(source.indexOf("新しい利用者を作る")).toBeLessThan(source.indexOf("会社でしぼる"));
    expect(source).toContain("「新しい利用者を作る」から追加してください");
  });

  it("パスワード変更画面では、全画面バナーと同じ仮パスワード案内を重ねない", () => {
    const source = read("src/app/account/password/page.tsx");
    expect(source).not.toContain("<ReasonNote>");
    expect(source).not.toContain("viewer.mustChangePassword &&");
    expect(source).toContain("<PasswordChangeForm />");
  });

  it("設問の直後追加は位置と自由設問であることを画面上でも明示する", () => {
    const source = read("src/components/FormBuilder.tsx");
    expect(source).toContain("この下に追加");
    expect(source).toContain("この下に自由設問を追加");
    expect(source).toContain("自由設問（評価集計には使いません）");
  });
});
