import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

/**
 * 書き込みの送り元の確認（DD-032 の17。PLT-19・APP-22）。
 * Origin があれば host と比べる。Origin が無いときは、ブラウザが付ける Sec-Fetch-Site が
 * same-origin か none のときだけ通す。どちらも無い送信は、送り元を確かめられないので拒む。
 */

const HOST = "hr.example.test";

describe("isSameOriginRequest", () => {
  it("Origin が host と同じなら通す", () => {
    expect(isSameOriginRequest({ origin: `https://${HOST}`, secFetchSite: null, host: HOST })).toBe(true);
    expect(isSameOriginRequest({ origin: `https://${HOST}`, secFetchSite: "same-origin", host: HOST })).toBe(true);
  });

  it("Origin が違う・null・壊れているときは拒む", () => {
    expect(isSameOriginRequest({ origin: "https://evil.example", secFetchSite: "same-origin", host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: "null", secFetchSite: "same-origin", host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: "%%%", secFetchSite: null, host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: `https://${HOST}`, secFetchSite: null, host: null })).toBe(false);
  });

  it("Origin が無いときは Sec-Fetch-Site が same-origin か none なら通す", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: "same-origin", host: HOST })).toBe(true);
    expect(isSameOriginRequest({ origin: null, secFetchSite: "none", host: HOST })).toBe(true);
  });

  it("Origin が無く、Sec-Fetch-Site が別のサイトを示すときは拒む", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: "cross-site", host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: null, secFetchSite: "same-site", host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: null, secFetchSite: "unexpected", host: HOST })).toBe(false);
  });

  it("Origin も Sec-Fetch-Site も無い送信は拒む", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: null, host: HOST })).toBe(false);
    expect(isSameOriginRequest({ origin: "", secFetchSite: "", host: HOST })).toBe(false);
  });
});

describe("書き込みの入口", () => {
  it("assertSameOrigin は isSameOriginRequest で決め、Origin が無いだけでは通さない", () => {
    const session = readFileSync(join(process.cwd(), "src/lib/session.ts"), "utf8");
    expect(session).toContain("isSameOriginRequest");
    expect(session).toContain("sec-fetch-site");
    expect(session).not.toMatch(/if\s*\(\s*!origin\s*\)\s*return/);
  });
});
