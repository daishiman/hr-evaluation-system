import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { API_CACHE_CONTROL, handle, jsonError, UNEXPECTED_ERROR_MESSAGE } from "@/lib/api";
import { HttpError } from "@/lib/session";

/*
 * API の応答は、成功でも失敗でも保存させない。
 * 検索は氏名を返し、失敗の文面も利用者ごとに違う。どちらもブラウザや配信網に残ると、
 * 古い中身や他の人の中身が出うる（docs/product/spec.md §27）。
 */

afterEach(() => vi.restoreAllMocks());

describe("API の応答に付ける保存の指示", () => {
  it("成功した応答は private, no-store で返す", async () => {
    const res = await handle(async () => ({ people: [{ name: "見本 太郎" }] }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(API_CACHE_CONTROL);
    expect(await res.json()).toEqual({ ok: true, people: [{ name: "見本 太郎" }] });
  });

  it("権限・入力・想定外のどの失敗も、同じ指示で返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failures = [
      new HttpError(403, "この操作を行う権限がありません。"),
      z.object({ q: z.string() }).safeParse({ q: 1 }).error,
      new Error("内部の詳細"),
    ];

    for (const e of failures) {
      const res = await handle(async () => {
        throw e;
      });
      expect(res.headers.get("cache-control")).toBe(API_CACHE_CONTROL);
    }
  });

  it("失敗に添えたヘッダー（待ち時間など）は残し、保存の指示だけを固定する", async () => {
    const res = jsonError(
      new HttpError(429, "しばらく待ってから試してください。", { "Retry-After": "30", "cache-control": "max-age=60" }),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("cache-control")).toBe(API_CACHE_CONTROL);
  });

  it("想定外の失敗は、中身を出さずに決まった文面で返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = jsonError(new Error("SQLITE_CONSTRAINT: users.email"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, message: UNEXPECTED_ERROR_MESSAGE });
  });
});
