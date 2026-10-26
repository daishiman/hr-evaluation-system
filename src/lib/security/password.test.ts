import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateNewPassword } from "./password";

/**
 * パスワードの長さの決まりを1か所に置く（DD-032 の4）。
 * 画面・サーバーの検査・better-auth の設定・管理者の追加の script が同じ値を使う。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("validateNewPassword", () => {
  it("長さの決まりは10文字以上200文字以下", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(PASSWORD_MAX_LENGTH).toBe(200);
  });

  it("10文字と200文字は通し、9文字と201文字は理由を返す", () => {
    expect(validateNewPassword("a".repeat(10))).toBeNull();
    expect(validateNewPassword("a".repeat(200))).toBeNull();
    expect(validateNewPassword("a".repeat(9))).toEqual(expect.any(String));
    expect(validateNewPassword("a".repeat(201))).toEqual(expect.any(String));
    expect(validateNewPassword("")).toEqual(expect.any(String));
  });
});

describe("決まりを使う場所", () => {
  it("password.ts は import を持たない（script が素の node で読めるように）", () => {
    expect(read("src/lib/security/password.ts")).not.toMatch(/^\s*import\s/m);
  });

  it("画面のフォームは定数を使い、数字を直に書かない", () => {
    const form = read("src/components/PasswordChangeForm.tsx");
    expect(form).toContain("PASSWORD_MIN_LENGTH");
    expect(form).not.toMatch(/const\s+MIN_LENGTH\s*=\s*\d+/);
    expect(form).not.toMatch(/const\s+MAX_LENGTH\s*=\s*\d+/);
  });

  it("パスワードの変更の検査は定数を使う", () => {
    const account = read("src/actions/account.ts");
    expect(account).toContain("PASSWORD_MIN_LENGTH");
    expect(account).not.toMatch(/\.min\(\s*10\b/);
  });

  it("better-auth の最短の長さは定数を使う", () => {
    const auth = read("src/lib/auth.ts");
    expect(auth).toMatch(/minPasswordLength:\s*PASSWORD_MIN_LENGTH/);
  });

  it("管理者の追加の script は password.ts の決まりを読む", () => {
    const script = read("scripts/add-user.mjs") + read("scripts/add-user-data.mjs");
    expect(script).toContain("src/lib/security/password.ts");
    expect(script).not.toMatch(/password\.length\s*<\s*8/);
    // 警告を消す指定（--disable-warning=…）は、db:sample と同じく間に挟んでよい
    expect(read("package.json")).toMatch(/"user:add":\s*"node --experimental-strip-types(?: --disable-warning=[\w-]+)* scripts\/add-user\.mjs"/);
  });
});
