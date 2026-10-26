import { beforeAll, describe, expect, it, vi } from "vitest";
import { CLIENT_IP_HEADER } from "./client-ip";
import { PASSWORD_MIN_LENGTH } from "./password";

/**
 * ログインの設定（DD-032 の3・4）。
 * better-auth は、既定では回数制限を production のときだけ有効にし、送り元の IP を
 * x-forwarded-for から読む。Cloudflare の前では偽れるヘッダーなので、cf-connecting-ip だけを
 * 見るように明示し、回数制限も環境に依らず有効にする。
 * getAuth() が betterAuth() へ渡す設定を、外の依存を差し替えて取り出して確かめる。
 */

const captured: { options?: Record<string, any> } = {};

vi.mock("better-auth", () => ({
  betterAuth: vi.fn((options: Record<string, any>) => {
    captured.options = options;
    return { handler: vi.fn() };
  }),
}));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn(() => ({})) }));
vi.mock("drizzle-orm/d1", () => ({ drizzle: vi.fn(() => ({})) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { DB: {}, BETTER_AUTH_SECRET: "s".repeat(32), BETTER_AUTH_URL: "https://hr.example.test" },
  })),
}));

beforeAll(async () => {
  const { getAuth } = await import("@/lib/auth");
  await getAuth();
});

describe("getAuth() の設定", () => {
  it("送り元の IP は cf-connecting-ip だけから読み、IPv6 は /64 でまとめる", () => {
    const ipAddress = captured.options?.advanced?.ipAddress;
    expect(ipAddress?.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
    expect(ipAddress?.ipv6Subnet).toBe(64);
    expect(ipAddress?.disableIpTracking).not.toBe(true);
  });

  it("回数制限は環境に依らず有効にする", () => {
    expect(captured.options?.rateLimit?.enabled).toBe(true);
  });

  it("パスワードの最短の長さは決まりの定数で、登録は閉じたまま", () => {
    expect(captured.options?.emailAndPassword?.minPasswordLength).toBe(PASSWORD_MIN_LENGTH);
    expect(captured.options?.emailAndPassword?.disableSignUp).toBe(true);
  });
});
