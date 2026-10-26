import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedAuthRoute } from "./auth-route-allowlist";

/**
 * 認証の口は、画面が使う3つだけを開ける（DD-032 の2）。
 * 自分で登録する口・パスワードを忘れたときの口などは、使っていないので 404 にする。
 */

const handler = vi.fn(async (_request: Request) => new Response("from-better-auth", { status: 200 }));

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(async () => ({ handler })),
}));

afterEach(() => {
  handler.mockClear();
});

describe("isAllowedAuthRoute", () => {
  it("ログイン・ログアウト・セッション取得の3つは通す", () => {
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-in/email")).toBe(true);
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-out")).toBe(true);
    expect(isAllowedAuthRoute("GET", "/api/auth/get-session")).toBe(true);
  });

  it("使っていない口は拒む", () => {
    for (const [method, pathname] of [
      ["POST", "/api/auth/sign-up/email"],
      ["POST", "/api/auth/forget-password"],
      ["POST", "/api/auth/request-password-reset"],
      ["POST", "/api/auth/reset-password"],
      ["POST", "/api/auth/change-password"],
      ["POST", "/api/auth/update-user"],
      ["POST", "/api/auth/delete-user"],
      ["GET", "/api/auth/list-sessions"],
      ["POST", "/api/auth/revoke-sessions"],
      ["GET", "/api/auth/ok"],
      ["GET", "/api/auth/error"],
    ] as const) {
      expect(isAllowedAuthRoute(method, pathname), `${method} ${pathname}`).toBe(false);
    }
  });

  it("口が同じでもメソッドが違えば拒む", () => {
    expect(isAllowedAuthRoute("GET", "/api/auth/sign-in/email")).toBe(false);
    expect(isAllowedAuthRoute("GET", "/api/auth/sign-out")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth/get-session")).toBe(false);
  });

  it("末尾の / や大文字の違いは別の口として拒む", () => {
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-in/email/")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth/Sign-In/email")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-in/email/extra")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth//sign-in/email")).toBe(false);
    expect(isAllowedAuthRoute("post", "/api/auth/sign-in/email")).toBe(false);
  });
});

describe("認証の route", () => {
  it("許可の外は 404 で返し、better-auth の handler を呼ばない", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const res = await POST(new Request("http://localhost/api/auth/sign-up/email", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("許可した口は better-auth の handler へ渡す", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");
    expect((await GET(new Request("http://localhost/api/auth/get-session"))).status).toBe(200);
    expect((await POST(new Request("http://localhost/api/auth/sign-out", { method: "POST" }))).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // better-auth は本文を上限なしに読むので、ほかの Route Handler と同じ上限で先に断る（DD-032 の9）
  it("上限を超えた本文は 413 で返し、better-auth の handler を呼ばない", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const { SMALL_JSON_MAX_BYTES } = await import("@/lib/api");
    const big = JSON.stringify({ email: "a@example.com", password: "x".repeat(SMALL_JSON_MAX_BYTES) });

    const declared = await POST(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-length": String(SMALL_JSON_MAX_BYTES + 1) },
        body: "{}",
      }),
    );
    expect(declared.status).toBe(413);

    const actual = await POST(new Request("http://localhost/api/auth/sign-in/email", { method: "POST", body: big }));
    expect(actual.status).toBe(413);
    expect(await actual.json()).toMatchObject({ ok: false });
    expect(handler).not.toHaveBeenCalled();
  });

  it("上限の内の本文は、中身・メソッド・ヘッダーを保ったまま better-auth の handler へ渡す", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const body = JSON.stringify({ email: "a@example.com", password: "パスワード-2026" });
    const res = await POST(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "a=b" },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const passed = handler.mock.calls[0][0];
    expect(passed.method).toBe("POST");
    expect(passed.url).toBe("http://localhost/api/auth/sign-in/email");
    expect(passed.headers.get("content-type")).toBe("application/json");
    expect(passed.headers.get("cookie")).toBe("a=b");
    expect(await passed.text()).toBe(body);
  });

  it("本文の読み取りが途中で失敗したら、413 にせず 500 で返し、better-auth の handler を呼ばない", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("stream broke"));
      },
    });
    const res = await POST(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        body: broken,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});
