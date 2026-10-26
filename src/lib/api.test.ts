import { inspect } from "node:util";
import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { API_CACHE_CONTROL, handle, jsonError, SMALL_JSON_MAX_BYTES, UNEXPECTED_ERROR_MESSAGE } from "@/lib/api";
import { HttpError, type Viewer } from "@/lib/session";

const mocked = vi.hoisted(() => ({ apiViewer: vi.fn(), getDb: vi.fn() }));
vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

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

/*
 * 本文の上限（DD-032 の9）。Route Handler は全て readJsonBodyWithinLimit で読むので、
 * 上限を超えた本文は中身を解析する前に 413 で断り、保存の指示も同じに付ける。
 * 外観の保存（/api/theme-choice）も、短い JSON の上限を超えたら DB に触れずに断る。
 * 認証の口（/api/auth/*）も同じ上限で先に読む（試験は src/lib/security/auth-route-allowlist.test.ts）。
 */
describe("上限を超えた本文", () => {
  const user: Viewer = {
    id: "usr_1", name: "見本 太郎", email: "usr_1", role: "EMPLOYEE", companyId: "cmp_1",
    gradeId: null, managerId: null, department: null, employeeCode: null, hiredAt: null,
    companyName: null, mustChangePassword: false,
  };
  const oversized = (url: string, method: string) =>
    new Request(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ palette: "azure", mode: "light", resolved: "light", pad: "x".repeat(SMALL_JSON_MAX_BYTES) }),
    });

  it("handle の中で読んだ本文が上限を超えたら 413 で返す", async () => {
    const { readJsonBodyWithinLimit } = await import("@/lib/request-body");
    const res = await handle(async () => readJsonBodyWithinLimit(oversized("http://localhost/api/x", "POST"), SMALL_JSON_MAX_BYTES));

    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe(API_CACHE_CONTROL);
  });

  it("外観の保存も、短い JSON の上限を超えた本文を 413 で断り、DB に触れない", async () => {
    mocked.apiViewer.mockResolvedValue(user);
    const { PUT } = await import("@/app/api/theme-choice/route");

    const res = await PUT(oversized("http://localhost/api/theme-choice", "PUT"));

    expect(res.status).toBe(413);
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
});

/*
 * DB のエラーのログは、種類と場所だけを残す（DD-032 の7）。
 * describeError は想定外の失敗をログへ出すが、Drizzle の失敗の文面には SQL の全文と渡した値が入る。
 * ログには要約だけを出し、利用者には決まった文言だけを返す。
 */
describe("想定外の失敗のログ", () => {
  it("想定外の失敗は、要約だけをログに出し、決まった文言で 500 を返す", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handle(async () => {
      throw new DrizzleQueryError(
        'insert into "users" ("email") values (?)',
        ["見本の値-ログに出さない"],
        new Error("D1_ERROR: SQLITE_CONSTRAINT"),
      );
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, message: UNEXPECTED_ERROR_MESSAGE });
    expect(spy).toHaveBeenCalled();
    expect(inspect(spy.mock.calls, { depth: 5 })).not.toContain("見本の値");
  });
});
