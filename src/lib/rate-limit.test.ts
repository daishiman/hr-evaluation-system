import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimitStoreForTest, consumeRateLimit, type RateLimitRule } from "./rate-limit";

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
