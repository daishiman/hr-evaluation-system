import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMIT_PURPOSE_CAPS,
  RATE_LIMIT_TOTAL_MAX,
  _rateLimitStoreSizeForTest,
  _resetRateLimitStoreForTest,
  consumeRateLimit,
  type RateLimitRule,
} from "./rate-limit";

/**
 * ログイン試行の制限と同じ仕組み（固定ウィンドウ方式）を、
 * パスワード変更の「いまのパスワード」欄にも使えることを確かめる。
 */

const RULE: RateLimitRule = { windowMs: 10_000, max: 3 };

describe("consumeRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitStoreForTest();
  });

  it("上限までは許可する", () => {
    const now = 0;
    expect(consumeRateLimit("user-1", RULE, now).allowed).toBe(true);
    expect(consumeRateLimit("user-1", RULE, now).allowed).toBe(true);
    expect(consumeRateLimit("user-1", RULE, now).allowed).toBe(true);
  });

  it("同じウィンドウ内で上限を超えたら拒否する", () => {
    const now = 0;
    consumeRateLimit("user-1", RULE, now);
    consumeRateLimit("user-1", RULE, now);
    consumeRateLimit("user-1", RULE, now);
    const result = consumeRateLimit("user-1", RULE, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("ウィンドウが変わったら数え直す（正規ユーザーが待てば再開できる）", () => {
    consumeRateLimit("user-1", RULE, 0);
    consumeRateLimit("user-1", RULE, 0);
    consumeRateLimit("user-1", RULE, 0);
    expect(consumeRateLimit("user-1", RULE, 0).allowed).toBe(false);

    // ウィンドウ（10秒）を過ぎたあとは、また3回まで許可される
    const afterWindow = 10_001;
    expect(consumeRateLimit("user-1", RULE, afterWindow).allowed).toBe(true);
  });

  it("途中の許可試行で基準時刻を進めず、最初の試行から10秒で再開する", () => {
    for (const now of [0, 4_000, 8_000]) expect(consumeRateLimit("user-1", RULE, now).allowed).toBe(true);
    expect(consumeRateLimit("user-1", RULE, 9_999).allowed).toBe(false);
    expect(consumeRateLimit("user-1", RULE, 10_000).allowed).toBe(true);
  });

  it("鍵（利用者）ごとに独立して数える", () => {
    const now = 0;
    consumeRateLimit("user-1", RULE, now);
    consumeRateLimit("user-1", RULE, now);
    consumeRateLimit("user-1", RULE, now);
    expect(consumeRateLimit("user-1", RULE, now).allowed).toBe(false);

    // 別の利用者は影響を受けない（同じ会社の他の社員を巻き込まない）
    expect(consumeRateLimit("user-2", RULE, now).allowed).toBe(true);
  });
});

/**
 * 表の件数の上限と掃除の決まり（DD-032 の11）。
 * 鍵の先頭（`:` の前）が表す用途ごとに表と上限を分け、合わせて1万件以内にする。
 * 上限に届いたら、期限切れ → 止めていない古い順 → 止めている古い順に捨てる。
 */
describe("表の件数の上限", () => {
  const LOOSE: RateLimitRule = { windowMs: 60_000, max: 3 };

  beforeEach(() => {
    _resetRateLimitStoreForTest();
  });

  /** 鍵を max 回使って、止めている状態にする */
  const block = (key: string, now: number) => {
    for (let i = 0; i < LOOSE.max; i++) consumeRateLimit(key, LOOSE, now);
  };

  it("用途ごとの上限は、合わせて1万件以内", () => {
    expect(RATE_LIMIT_TOTAL_MAX).toBe(10_000);
    const sum = Object.values(RATE_LIMIT_PURPOSE_CAPS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(RATE_LIMIT_TOTAL_MAX);
  });

  it("src で使っている鍵の用途は、どれも上限を持つ", () => {
    const files = [
      "src/app/api/agent/device/route.ts",
      "src/app/api/agent/token/route.ts",
      "src/app/api/usage/route.ts",
      "src/actions/account.ts",
      "src/lib/improvements/submit.ts",
      "src/lib/agent-api.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      for (const m of text.matchAll(/consumeRateLimit\(\s*`([a-z-]+):/g)) {
        expect(RATE_LIMIT_PURPOSE_CAPS, `${file} の ${m[1]}`).toHaveProperty(m[1]);
      }
    }
  });

  it("上限に届いたら、まず期限切れを消す", () => {
    const cap = RATE_LIMIT_PURPOSE_CAPS["usage"];
    for (let i = 0; i < cap; i++) consumeRateLimit(`usage:k${i}`, LOOSE, 0);
    expect(_rateLimitStoreSizeForTest("usage")).toBe(cap);

    consumeRateLimit("usage:new", LOOSE, LOOSE.windowMs + 1);
    expect(_rateLimitStoreSizeForTest("usage")).toBe(1);
  });

  it("新しい鍵が大量に来ても、止めている項目は押し出されない", () => {
    const cap = RATE_LIMIT_PURPOSE_CAPS["agent-api"];
    block("agent-api:attacker", 0);
    for (let i = 0; i < cap * 2; i++) consumeRateLimit(`agent-api:k${i}`, LOOSE, 1);

    expect(_rateLimitStoreSizeForTest("agent-api")).toBeLessThanOrEqual(cap);
    expect(consumeRateLimit("agent-api:attacker", LOOSE, 2).allowed).toBe(false);
  });

  it("止めていない項目は、入れた順の古いものから捨てる", () => {
    const cap = RATE_LIMIT_PURPOSE_CAPS["agent-api"];
    for (let i = 0; i < cap; i++) consumeRateLimit(`agent-api:k${i}`, LOOSE, 0);
    consumeRateLimit("agent-api:new", LOOSE, 1);

    // いちばん古い k0 は捨てられ、数え直しになる（3回とも通る）
    expect([0, 1, 2].map(() => consumeRateLimit("agent-api:k0", LOOSE, 2).allowed)).toEqual([true, true, true]);
    // 新しい側は残っている（1回使った分に2回足すと上限）
    consumeRateLimit(`agent-api:k${cap - 1}`, LOOSE, 2);
    consumeRateLimit(`agent-api:k${cap - 1}`, LOOSE, 2);
    expect(consumeRateLimit(`agent-api:k${cap - 1}`, LOOSE, 2).allowed).toBe(false);
  });

  it("全てが止めている項目のときだけ、止めている項目を古い順に捨てる", () => {
    const cap = RATE_LIMIT_PURPOSE_CAPS["agent-api"];
    for (let i = 0; i < cap; i++) block(`agent-api:b${i}`, 0);
    consumeRateLimit("agent-api:new", LOOSE, 1);

    expect(_rateLimitStoreSizeForTest("agent-api")).toBeLessThanOrEqual(cap);
    expect(consumeRateLimit(`agent-api:b${cap - 1}`, LOOSE, 2).allowed).toBe(false);
    expect(consumeRateLimit("agent-api:b0", LOOSE, 2).allowed).toBe(true);
  });

  it("ある用途の表が埋まっても、ほかの用途の数え方に響かない", () => {
    block("account-password:usr_1", 0);
    for (let i = 0; i < RATE_LIMIT_PURPOSE_CAPS["agent-api"] * 2; i++) consumeRateLimit(`agent-api:k${i}`, LOOSE, 1);

    expect(_rateLimitStoreSizeForTest("account-password")).toBe(1);
    expect(consumeRateLimit("account-password:usr_1", LOOSE, 2).allowed).toBe(false);
  });

  it("決まっていない用途の鍵も、表全体を1万件より増やさない", () => {
    for (let i = 0; i < 20_000; i++) consumeRateLimit(`unlisted:k${i}`, LOOSE, 0);
    for (let i = 0; i < 20_000; i++) consumeRateLimit(`k${i}`, LOOSE, 0);
    expect(_rateLimitStoreSizeForTest()).toBeLessThanOrEqual(RATE_LIMIT_TOTAL_MAX);
  });
});
