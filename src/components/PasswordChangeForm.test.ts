import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * パスワード変更画面の作法を固定する。
 *
 * この画面は「見えていないと事故が起きる」ものが多い割に、画面テストが無い。
 * 目で見て直したことが次の変更で戻らないよう、コードの側で押さえる。
 */

const SRC = join(process.cwd(), "src");
const FORM = readFileSync(join(SRC, "components", "PasswordChangeForm.tsx"), "utf8");
const ROUTE = readFileSync(join(SRC, "app", "api", "account", "password", "route.ts"), "utf8");
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");

describe("パスワード変更画面", () => {
  it("画面に出す文字数の条件は、サーバーの判定と同じ数字である", () => {
    // 画面だけ「8文字以上」に見えてサーバーが10文字を要求する、が最悪。
    // 「いまのパスワード」の必須指定と混ざらないよう、新しいパスワードの定義だけを見る
    const newPasswordRule = ROUTE.slice(ROUTE.indexOf("newPassword:"));

    const shown = FORM.match(/MIN_LENGTH = (\d+)/)?.[1];
    const required = newPasswordRule.match(/\.min\((\d+),/)?.[1];
    expect(shown).toBeTruthy();
    expect(shown).toBe(required);

    const shownMax = FORM.match(/MAX_LENGTH = (\d+)/)?.[1];
    const requiredMax = newPasswordRule.match(/\.max\((\d+),/)?.[1];
    expect(shownMax).toBeTruthy();
    expect(shownMax).toBe(requiredMax);
  });

  it("ブラウザのパスワード管理と噛み合う指定を持つ", () => {
    // current-password / new-password を取り違えると、
    // 新しいパスワードの欄に古いものが自動で入る事故が起きる。
    expect(FORM).toContain('"current-password"');
    expect(FORM).toContain('"new-password"');
  });

  it("満たすべき条件を、打ち込む前から出している", () => {
    expect(FORM).toContain('className="rule-list"');
    expect(CSS).toContain(".rule-list");
    // 満たしたかどうかを色だけで伝えない（印と読み上げ用の文字を添える）
    expect(FORM).toContain('className="rule-mark"');
    expect(FORM).toContain('className="sr-only"');
  });

  it("表示・非表示の切り替えが、読み上げでもどの欄か分かる", () => {
    expect(FORM).toContain("aria-pressed");
    expect(FORM).toMatch(/aria-label=\{`\$\{label\}を/);
  });

  it("送信中に二重で送らない", () => {
    expect(FORM).toContain("sending.current");
  });

  it("パスワードの欄も、ほかの入力欄と同じ見た目になる", () => {
    // ここが抜けると、この欄だけブラウザ既定の枠になり、隣の欄と揃わない
    expect(CSS).toContain('.field input[type="password"]');
  });
});
