import { describe, expect, it } from "vitest";
import { sameOriginUrl } from "./same-origin-url";

const ORIGIN = "https://hr.example.test";

describe("観測する通信のorigin", () => {
  it.each(["/api/search?q=abc", "api/search?q=abc", `${ORIGIN}/api/search?q=abc`, "//hr.example.test/api/search?q=abc"])(
    "自社の相対・絶対URLを解決する: %s", (raw) => {
      expect(sameOriginUrl(raw, ORIGIN)?.href).toBe(`${ORIGIN}/api/search?q=abc`);
    },
  );

  it.each([
    "//evil.example/api/search", `${ORIGIN}.evil.example/api/search`,
    "http://hr.example.test/api/search", `${ORIGIN}:8443/api/search`,
    "data:text/plain,secret", "https://[broken/api/search",
  ])("外部や壊れたURLは除く: %s", (raw) => {
    expect(sameOriginUrl(raw, ORIGIN)).toBeNull();
  });

  it("階層のある現在ページを基準にpath相対URLを解決する", () => {
    expect(sameOriginUrl("api/search?q=abc", `${ORIGIN}/admin/forms`)?.href)
      .toBe(`${ORIGIN}/admin/api/search?q=abc`);
    expect(sameOriginUrl("../api/search", `${ORIGIN}/admin/forms`)?.pathname).toBe("/api/search");
    expect(sameOriginUrl("/api/search", `${ORIGIN}/admin/forms`)?.pathname).toBe("/api/search");
  });
});
