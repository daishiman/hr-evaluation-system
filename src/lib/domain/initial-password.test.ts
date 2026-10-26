import { describe, it, expect } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/security/password";
import {
  generateInitialPassword,
  generateUniqueInitialPassword,
  PASSWORD_ALPHABET,
  PASSWORD_LENGTH,
} from "./initial-password";

/**
 * 発行するパスワードの決まりごとを、実装から独立して確かめる。
 *
 * ここで守りたいのは強さそのものよりも「渡した相手が確実にログインできること」と
 * 「本人がそのまま変更画面を通せること」。どちらも文字種と長さの選び方で決まる。
 */
describe("generateInitialPassword", () => {
  it("12文字で発行し、画面・サーバー・CLI共通の長さの決まりを満たす", () => {
    expect(PASSWORD_LENGTH).toBe(12);
    expect(PASSWORD_LENGTH).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(PASSWORD_LENGTH).toBeLessThanOrEqual(PASSWORD_MAX_LENGTH);
    const password = generateInitialPassword();
    expect(password).toHaveLength(PASSWORD_LENGTH);
    expect(validateNewPassword(password)).toBeNull();
  });

  it("読み違えやすい文字を使わない（口頭・紙で渡すため）", () => {
    for (const ng of ["0", "1", "2", "l", "o", "I", "O", "Z"]) {
      expect(PASSWORD_ALPHABET).not.toContain(ng);
    }
  });

  it("同じ文字を二重に並べない（並べた文字だけ出やすくなるため）", () => {
    expect(new Set(PASSWORD_ALPHABET).size).toBe(PASSWORD_ALPHABET.length);
  });

  it("決めた文字以外は出さない", () => {
    for (const c of generateInitialPassword()) {
      expect(PASSWORD_ALPHABET).toContain(c);
    }
  });

  it("呼ぶたびに別のものになる（前の人と同じ値を渡さない）", () => {
    const made = new Set(Array.from({ length: 100 }, () => generateInitialPassword()));
    expect(made.size).toBe(100);
  });

  it("一括発行では衝突した値を捨て、前の人と異なる値を返す", () => {
    const candidates = ["same-password", "same-password", "next-password"];
    const issued = new Set(["same-password"]);

    expect(generateUniqueInitialPassword(issued, () => candidates.shift() ?? "never-used")).toBe("next-password");
  });

  it("乱数源が同じ値しか返さないときは無限に待たず停止する", () => {
    expect(() => generateUniqueInitialPassword(new Set(["same-password"]), () => "same-password")).toThrow(
      "重複しない初期パスワード",
    );
  });
});
