import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSafeRedirectPath, safeRedirectPath } from "./safe-redirect";

/**
 * 戻り先は自分のサイトの中の path だけにする（DD-032 の6）。
 * 文字の先頭を見るだけの判定では、ブラウザが外のサイトとして読む書き方を通してしまう。
 * 同じ origin の基準の URL で解決し、origin が変わったものは既定の行き先へ送る。
 */

const FALLBACK = "/";

describe("safeRedirectPath", () => {
  it("サイトの中の path は、query と hash も含めてそのまま返す", () => {
    expect(safeRedirectPath("/forms/1?x=1#a", FALLBACK)).toBe("/forms/1?x=1#a");
    expect(safeRedirectPath("/admin/members", FALLBACK)).toBe("/admin/members");
    expect(safeRedirectPath("/", "/home")).toBe("/");
  });

  it("外のサイトとして読まれる書き方は既定の行き先へ送る", () => {
    for (const input of [
      "//evil.example",
      "//evil.example/path",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example/x",
      "http://evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      " //evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "/forms/\u0000",
      "forms/1",
    ]) {
      expect(safeRedirectPath(input, FALLBACK), JSON.stringify(input)).toBe(FALLBACK);
    }
  });

  // 解決で点の区切りが畳まれると、同じ origin のまま path が // で始まり直す。
  // そのまま返すと、受け取った側のブラウザは外のサイトとして読む
  it("点の区切りを畳むと // で始まる値は既定の行き先へ送る", () => {
    for (const input of [
      "/.//evil.example",
      "/x/..//evil.example",
      "/%2e//evil.example",
      "/./%2e//evil.example",
      "/a/../..//evil.example/p?q#h",
    ]) {
      expect(safeRedirectPath(input, FALLBACK), JSON.stringify(input)).toBe(FALLBACK);
    }
  });

  it("点の区切りを畳んでもサイトの中に残る path は、畳んだ形で返す", () => {
    expect(safeRedirectPath("/forms/./1", FALLBACK)).toBe("/forms/1");
    expect(safeRedirectPath("/forms/../admin?x=1", FALLBACK)).toBe("/admin?x=1");
  });

  it("空や文字列でないものは既定の行き先へ送る", () => {
    expect(safeRedirectPath("", "/home")).toBe("/home");
    expect(safeRedirectPath(null, "/home")).toBe("/home");
    expect(safeRedirectPath(undefined, "/home")).toBe("/home");
    expect(safeRedirectPath(["/forms/1"], "/home")).toBe("/home");
  });

  it("isSafeRedirectPath は、そのまま返せる値だけを true にする", () => {
    expect(isSafeRedirectPath("/forms/1?x=1#a")).toBe(true);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
    expect(isSafeRedirectPath("https://evil.example/x")).toBe(false);
  });
});

describe("URL の解決が例外になったとき", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // 形を絞った後の path で解決が失敗する入力は今の URL の仕様には無いが、
  // 実行環境が例外を出したときに、外へ送る側ではなく既定の行き先の側へ倒れることを固定する
  it("通さずに既定の行き先へ送る", () => {
    vi.stubGlobal(
      "URL",
      class {
        constructor() {
          throw new TypeError("Invalid URL");
        }
      },
    );
    expect(isSafeRedirectPath("/forms/1")).toBe(false);
    expect(safeRedirectPath("/forms/1", FALLBACK)).toBe(FALLBACK);
  });
});

describe("戻り先を受ける場所", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("ログインの画面とフォームは、先頭の文字ではなく safeRedirectPath で決める", () => {
    const page = read("src/app/login/page.tsx");
    const form = read("src/app/login/LoginForm.tsx");
    expect(page).toContain("safeRedirectPath");
    expect(form).toContain("safeRedirectPath");
    expect(page).not.toMatch(/startsWith\(\s*["']\/["']\s*\)/);
  });

  it("改善要望の送信は、画面の path を isSafeRedirectPath で確かめる", () => {
    const submit = read("src/lib/improvements/submit.ts");
    expect(submit).toContain("isSafeRedirectPath");
    expect(submit).not.toMatch(/startsWith\(\s*["']\/["']\s*\)/);
  });
});
