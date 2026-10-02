import { describe, expect, it } from "vitest";
import { GENERATED_AT_HEADER, stampGeneratedAt } from "./generated-at";

const AT = new Date("2026-10-01T03:04:05.678Z");

describe("stampGeneratedAt", () => {
  it("保存前に読んだ本文にも保存後の時刻が付く（時刻は鮮度の証拠ではない）", async () => {
    let stored = "保存前の一覧";
    const readBeforeSave = new Response(stored);
    stored = "保存後の一覧";

    const stamped = stampGeneratedAt(readBeforeSave, AT);

    expect(stamped.headers.get(GENERATED_AT_HEADER)).toBe(AT.toISOString());
    expect(await stamped.text()).toBe("保存前の一覧");
    expect(stored).toBe("保存後の一覧");
  });

  it("生成時刻を ISO 形式で付け、状態・ヘッダー・本文はそのまま残す", async () => {
    const original = new Response("<p>一覧</p>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
    });

    const stamped = stampGeneratedAt(original, AT);

    expect(stamped.headers.get(GENERATED_AT_HEADER)).toBe("2026-10-01T03:04:05.678Z");
    expect(stamped.status).toBe(200);
    expect(stamped.headers.get("cache-control")).toBe("private, no-store");
    expect(stamped.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await stamped.text()).toBe("<p>一覧</p>");
  });

  it("ヘッダーが書き換え不可の応答（転送）にも付けられる", () => {
    const redirect = Response.redirect("https://example.test/login", 307);
    expect(() => redirect.headers.set("x-probe", "1")).toThrow();

    const stamped = stampGeneratedAt(redirect, AT);

    expect(stamped.status).toBe(307);
    expect(stamped.headers.get("location")).toBe("https://example.test/login");
    expect(stamped.headers.get(GENERATED_AT_HEADER)).toBe(AT.toISOString());
  });

  it("失敗の応答にも付ける（失敗が新しく作られたかも切り分けに使う）", () => {
    const stamped = stampGeneratedAt(new Response(null, { status: 500 }), AT);
    expect(stamped.status).toBe(500);
    expect(stamped.headers.get(GENERATED_AT_HEADER)).toBe(AT.toISOString());
  });

  it("作り直せない応答（101 など）はそのまま返す", () => {
    const switching = { status: 101 } as Response;
    expect(stampGeneratedAt(switching, AT)).toBe(switching);
  });
});
