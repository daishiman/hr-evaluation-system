import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isClosedPublicPath } from "./public-surface";

/**
 * 使っていない公開の口を閉じる（DD-032 の12）。
 * 画像の変換の口は使っていないので、Next.js へ渡す前に 404 にする。
 * next.config.ts は末尾で開発用の初期化を呼ぶので、import せず文字列として読む。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("isClosedPublicPath", () => {
  it("画像の変換の口は閉じる", () => {
    for (const pathname of [
      "/_next/image",
      "/_next/image/",
      "/_next/image/anything",
      "/cdn-cgi/image",
      "/cdn-cgi/image/",
      "/cdn-cgi/image/width=100/https://evil.example/a.png",
    ]) {
      expect(isClosedPublicPath(pathname), pathname).toBe(true);
    }
  });

  it("画面と静的な資産の口は閉じない", () => {
    for (const pathname of ["/", "/login", "/forms/1", "/_next/static/chunks/main.js", "/favicon.ico", "/api/auth/get-session"]) {
      expect(isClosedPublicPath(pathname), pathname).toBe(false);
    }
  });
});

describe("worker.ts", () => {
  it("handler.fetch の前に isClosedPublicPath で 404 を返す", () => {
    const worker = read("worker.ts");
    expect(worker).toContain("isClosedPublicPath");
    const check = worker.indexOf("isClosedPublicPath(");
    const fetchCall = worker.indexOf("handler.fetch(");
    expect(check).toBeGreaterThan(-1);
    expect(fetchCall).toBeGreaterThan(check);
    expect(worker).toMatch(/status:\s*404/);
  });
});

describe("next.config.ts", () => {
  const config = read("next.config.ts");

  it("X-Powered-By を付けない", () => {
    expect(config).toMatch(/poweredByHeader:\s*false/);
  });

  it("画像の最適化を使わない", () => {
    expect(config).toMatch(/images:\s*\{[^}]*unoptimized:\s*true/);
  });

  it("Server Action の本文の上限は 6.5mb", () => {
    expect(config).toMatch(/bodySizeLimit:\s*"6\.5mb"/);
    expect(config).not.toMatch(/bodySizeLimit:\s*"8mb"/);
  });
});
