import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_USAGE_PREFIX as SHARED_ACTION_PREFIX } from "@/lib/domain/usage";

const ORIGIN = "https://hr.example.test";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: ORIGIN, href: `${ORIGIN}/admin/forms` }, addEventListener: vi.fn(), setInterval: vi.fn(),
  });
  vi.stubGlobal("document", { addEventListener: vi.fn() });
  vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });
});

afterEach(() => vi.unstubAllGlobals());

describe("利用状況を数える通信", () => {
  it("相対URL・絶対URL・URL・Requestの自社APIだけを数え、記録送信と外部は除く", async () => {
    const originalFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("ok"));
    window.fetch = originalFetch;
    const { installUsageTracking, flush } = await import("./usage-client");
    installUsageTracking();
    const inputs = [
      "/api/search?q=hidden", `${ORIGIN}/api/search`, new URL(`${ORIGIN}/api/theme-choice`),
      new Request(`${ORIGIN}/api/export`), "//hr.example.test/api/search",
      "//evil.example/api/search", `${ORIGIN}.evil.example/api/search`,
      "http://hr.example.test/api/search", `${ORIGIN}:8443/api/search`,
      "data:text/plain,secret", "https://[broken/api/search", "/api/usage", "/admin/forms",
    ];
    for (const input of inputs) await window.fetch(input);
    expect(originalFetch).toHaveBeenCalledTimes(inputs.length);
    for (const [index, input] of inputs.entries()) expect(originalFetch.mock.calls[index]).toEqual([input, undefined]);
    flush();
    const beacon = vi.mocked(navigator.sendBeacon);
    expect(beacon).toHaveBeenCalledTimes(1);
    const blob = beacon.mock.calls[0][1] as Blob;
    const batch = JSON.parse(await blob.text());
    expect(batch.apis).toEqual([
      expect.objectContaining({ method: "GET", path: "/api/search", calls: 3 }),
      expect.objectContaining({ method: "GET", path: "/api/theme-choice", calls: 1 }),
      expect.objectContaining({ method: "GET", path: "/api/export", calls: 1 }),
    ]);
  });

  it("Server Actionの送信は共有した宛先の頭を使い、従来のexportも保つ", async () => {
    window.fetch = vi.fn(async () => new Response("ok"));
    const { ACTION_USAGE_PREFIX, installUsageTracking, recordActionCall, flush } = await import("./usage-client");
    expect(ACTION_USAGE_PREFIX).toBe(SHARED_ACTION_PREFIX);
    installUsageTracking();
    recordActionCall("members", 100, true);
    flush();
    const blob = vi.mocked(navigator.sendBeacon).mock.calls[0][1] as Blob;
    expect(JSON.parse(await blob.text()).apis).toEqual([
      expect.objectContaining({ method: "POST", path: `${SHARED_ACTION_PREFIX}members`, calls: 1 }),
    ]);
  });

  it("階層内のpath相対URLをルート直下のAPIと取り違えない", async () => {
    const originalFetch = vi.fn(async () => new Response("ok"));
    window.fetch = originalFetch;
    const { installUsageTracking, flush } = await import("./usage-client");
    installUsageTracking();
    await window.fetch("api/search"); // 実際の宛先は /admin/api/search
    await window.fetch("../api/search"); // 実際の宛先は /api/search
    flush();
    expect(originalFetch).toHaveBeenCalledTimes(2);
    const blob = vi.mocked(navigator.sendBeacon).mock.calls[0][1] as Blob;
    expect(JSON.parse(await blob.text()).apis).toEqual([
      expect.objectContaining({ path: "/api/search", calls: 1 }),
    ]);
  });
});
