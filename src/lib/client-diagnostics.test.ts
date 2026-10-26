import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://hr.example.test";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: ORIGIN, href: `${ORIGIN}/admin/forms` }, addEventListener: vi.fn(),
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn(), documentElement: { dataset: { theme: "light" } },
  });
  vi.stubGlobal("navigator", { userAgent: "test", language: "ja", onLine: true });
  vi.stubGlobal("performance", { now: () => 10, getEntriesByType: () => [] });
  vi.stubGlobal("PerformanceObserver", class { observe() {} });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("失敗通信の診断の収集境界", () => {
  it.each([
    "//evil.example/api/search", `${ORIGIN}.evil.example/api/search`,
    "http://hr.example.test/api/search", "data:text/plain,secret", "https://[broken/api/search", "request",
  ])("外部の送信・応答本文を読まず、元の通信を1回だけ呼ぶ: %s", async (raw) => {
    const request = new Request("https://evil.example/api/search", { method: "POST", body: "private-input" });
    // 実際のRequestも含め、本文を読むcloneが呼ばれていないことを確かめる。
    const requestClone = vi.spyOn(request, "clone");
    const response = new Response("private-output", { status: 500 });
    const responseClone = vi.spyOn(response, "clone");
    const originalFetch = vi.fn(async () => response);
    window.fetch = originalFetch;
    const { installDiagnostics, collectDiagnostics } = await import("./client-diagnostics");
    installDiagnostics();
    const input = raw === "request" ? request : raw;
    const init = raw === "request" ? undefined : { method: "POST", body: "private-input" };
    expect(await window.fetch(input, init)).toBe(response);
    expect(originalFetch).toHaveBeenCalledExactlyOnceWith(input, init);
    expect(requestClone).not.toHaveBeenCalled();
    expect(responseClone).not.toHaveBeenCalled();
    expect(collectDiagnostics("bug").network).toMatchObject([
      { external: true, requestBody: null, responseBody: null },
    ]);
  });

  it.each(["relative", "url", "request"])("自社宛ての失敗は本文を複製から読み、呼出側に応答を返す: %s", async (kind) => {
    const body = "local-input";
    const input = kind === "request"
      ? new Request(`${ORIGIN}/api/search`, { method: "POST", body })
      : kind === "url" ? new URL(`${ORIGIN}/api/search`) : "/api/search";
    const response = new Response("local-output", { status: 400 });
    if (kind === "url") vi.spyOn(response, "url", "get").mockReturnValue(`${ORIGIN}/api/result`);
    const originalFetch = vi.fn(async () => response);
    window.fetch = originalFetch;
    const { installDiagnostics, collectDiagnostics } = await import("./client-diagnostics");
    installDiagnostics();
    const init = kind === "request" ? undefined : { method: "POST", body };
    expect(await window.fetch(input, init)).toBe(response);
    await vi.waitFor(() => expect(collectDiagnostics("bug").network[0]?.responseBody).toBe("local-output"));
    expect(collectDiagnostics("bug").network[0]).toMatchObject({ external: false, requestBody: body });
    expect(originalFetch).toHaveBeenCalledExactlyOnceWith(input, init);
    expect(await response.text()).toBe("local-output");
  });

  it("自社から外部へリダイレクトした応答の本文を読まず、呼出側にはそのまま返す", async () => {
    const response = new Response("external-output", { status: 400 });
    vi.spyOn(response, "url", "get").mockReturnValue("https://evil.example/result");
    const clone = vi.spyOn(response, "clone");
    const originalFetch = vi.fn(async () => response);
    window.fetch = originalFetch;
    const { installDiagnostics, collectDiagnostics } = await import("./client-diagnostics");
    installDiagnostics();
    const init = { method: "POST", body: "local-input" };
    expect(await window.fetch("/api/search", init)).toBe(response);
    expect(originalFetch).toHaveBeenCalledExactlyOnceWith("/api/search", init);
    expect(clone).not.toHaveBeenCalled();
    expect(collectDiagnostics("bug").network[0]).toMatchObject({
      external: false, requestBody: "local-input", responseBody: null,
    });
    expect(await response.text()).toBe("external-output");
  });

  it("path相対の宛先を現在ページの階層で解決して記録する", async () => {
    window.fetch = vi.fn(async () => new Response("local-output", { status: 400 }));
    const { installDiagnostics, collectDiagnostics } = await import("./client-diagnostics");
    installDiagnostics();
    await window.fetch("api/search?q=hidden");
    expect(collectDiagnostics("bug").network[0]).toMatchObject({ path: "/admin/api/search", external: false });
  });
});
