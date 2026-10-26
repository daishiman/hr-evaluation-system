import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimitStoreForTest, consumeRateLimit, type RateLimitRule } from "../rate-limit";
import { clientIpKey } from "./client-ip";

/**
 * 送り元ごとの回数制限の鍵（DD-032 の3・11）。
 * IPv6 は1人が /64 の中の番号を自由に変えられるので、/64 でまとめて数えないと制限をすり抜けられる。
 * 鍵を作る3か所が clientIpKey を通り、ヘッダーを直に読まないことも確かめる。
 */

const RULE: RateLimitRule = { windowMs: 60_000, max: 3 };

beforeEach(() => {
  _resetRateLimitStoreForTest();
});

describe("clientIpKey と回数制限", () => {
  const keyOf = (ip: string) => `agent-api:${clientIpKey(new Headers({ "cf-connecting-ip": ip }))}`;

  it("同じ /64 の IPv6 は、番号を変えても同じ数え先として止める", () => {
    for (let i = 1; i <= RULE.max; i++) consumeRateLimit(keyOf(`2001:db8:1:2::${i}`), RULE, 0);
    expect(consumeRateLimit(keyOf("2001:db8:1:2::ffff"), RULE, 0).allowed).toBe(false);
    expect(consumeRateLimit(keyOf("2001:db8:1:3::1"), RULE, 0).allowed).toBe(true);
  });

  it("回数制限の鍵を作る場所は、どれも clientIpKey を通す", () => {
    for (const file of ["src/lib/agent-api.ts", "src/app/api/agent/token/route.ts", "src/app/api/agent/device/route.ts"]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, file).toContain("clientIpKey(");
      expect(text, file).not.toMatch(/\?\?\s*"unknown"/);
    }
  });
});
