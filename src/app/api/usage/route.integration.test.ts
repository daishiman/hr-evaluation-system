import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { schema as s } from "@/lib/db";
import { HttpError, ROLES, type Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { FRESHNESS_RESOURCES } from "@/lib/freshness";
import { jstDateKey } from "@/lib/domain/jst";
import { USAGE_MAX_ROWS_PER_COMPANY_DAY } from "@/lib/domain/usage";
import {
  allMeasurableScreens,
  readUsageReport,
  USAGE_KNOWN_API_ROUTES,
  usageScreenLabel,
  withinDailyRowLimit,
} from "@/lib/usage";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 利用状況の受け取り。
 *
 * ここで守りたいのは2つだけ。
 * ①どの会社の記録になるかを**送る側に決めさせない**（他社の数字を汚せない）
 * ②同じ日の同じ画面で行が増えない（無料の範囲に収まる仕組みそのもの）
 */

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

import { POST } from "@/app/api/usage/route";

const COMPANY = "company-1";
const OTHER = "company-2";

let testDb: TestDatabase;

function viewer(role: Viewer["role"] = "EMPLOYEE", companyId: string | null = COMPANY): Viewer {
  return {
    id: "usr_1",
    name: "利用者",
    email: "user@example.com",
    role,
    companyId,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: null,
    mustChangePassword: false,
  };
}

function usageRequest(body: unknown) {
  return new Request("http://localhost/api/usage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  testDb = createTestDatabase();
  mocked.getDb.mockResolvedValue(testDb.db);
  mocked.apiViewer.mockReset();
  _resetRateLimitStoreForTest();
  await testDb.db.insert(s.companies).values([
    { id: COMPANY, name: "自社", slug: "own" },
    { id: OTHER, name: "他社", slug: "other" },
  ]);
});

afterEach(() => testDb.close());

describe("/api/usage", () => {
  it("ログインしていない送信を断り、保管場所に触れない", async () => {
    mocked.apiViewer.mockRejectedValue(new HttpError(401, "ログインが必要です。"));

    const response = await POST(usageRequest({ screens: [{ path: "/me", views: 1 }] }));

    expect(response.status).toBe(401);
    expect(mocked.getDb).not.toHaveBeenCalled();
  });

  it("本文に別の会社を書いても、セッションの会社にしか記録しない", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());

    const response = await POST(
      usageRequest({
        companyId: OTHER,
        role: "SUPER_ADMIN",
        screens: [{ path: "/me", views: 1, dwellMs: 0, dwellSamples: 0, longStays: 0, backtracks: 0, rageClicks: 0, abandons: 0, errors: 0 }],
      }),
    );

    // 知らない項目が入った送信自体を受け付けない（strict）
    expect(response.status).toBe(400);
    const rows = await testDb.db.select().from(s.usageScreenDaily);
    expect(rows).toHaveLength(0);
  });

  it("同じ日に同じ画面を何度送っても行は増えず、数だけが増える", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());
    const batch = {
      screens: [
        {
          path: "/me",
          views: 2,
          dwellMs: 4000,
          dwellSamples: 2,
          longStays: 1,
          backtracks: 0,
          rageClicks: 0,
          abandons: 0,
          errors: 0,
        },
      ],
      apis: [],
    };

    expect((await POST(usageRequest(batch))).status).toBe(200);
    expect((await POST(usageRequest(batch))).status).toBe(200);

    const rows = await testDb.db.select().from(s.usageScreenDaily);
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(4);
    expect(rows[0].dwellMs).toBe(8000);
    expect(rows[0].longStays).toBe(2);
    expect(rows[0].companyId).toBe(COMPANY);
    expect(rows[0].role).toBe("EMPLOYEE");
  });

  it("台帳に無い画面は記録しない（作られたURLで行を増やせない）", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());

    const response = await POST(
      usageRequest({
        screens: [
          {
            path: "/not-a-real-screen",
            views: 1,
            dwellMs: 0,
            dwellSamples: 0,
            longStays: 0,
            backtracks: 0,
            rageClicks: 0,
            abandons: 0,
            errors: 0,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(await testDb.db.select().from(s.usageScreenDaily)).toHaveLength(0);
  });

  it("詳細画面のIDは落として、同じ形の1行にまとめる", async () => {
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN", COMPANY));
    const screen = (path: string) => ({
      path,
      views: 1,
      dwellMs: 1000,
      dwellSamples: 1,
      longStays: 0,
      backtracks: 0,
      rageClicks: 0,
      abandons: 0,
      errors: 0,
    });

    await POST(usageRequest({ screens: [screen("/system/users/usr_abc"), screen("/system/users/usr_xyz")] }));

    const rows = await testDb.db.select().from(s.usageScreenDaily);
    expect(rows).toHaveLength(1);
    expect(rows[0].routePattern).toBe("/system/users/[id]");
    expect(rows[0].views).toBe(2);
  });

  it("通信の記録は、宛先ごとに回数と時間をまとめる", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());

    await POST(
      usageRequest({
        apis: [
          // 実際のIDは「接頭辞_ランダム20桁」（src/lib/id.ts）
          { method: "PATCH", path: "/api/improvements/imp_0a1b2c3d4e5f60718293", calls: 3, durationMs: 900, errors: 0, slowCalls: 0 },
          { method: "PATCH", path: "/api/improvements/imp_ffeeddccbbaa99887766", calls: 2, durationMs: 3000, errors: 1, slowCalls: 1 },
        ],
      }),
    );

    const rows = await testDb.db.select().from(s.usageApiDaily);
    expect(rows).toHaveLength(1);
    expect(rows[0].routePattern).toBe("/api/improvements/[id]");
    expect(rows[0].calls).toBe(5);
    expect(rows[0].errors).toBe(1);
    expect(rows[0].slowCalls).toBe(1);
  });

  it("画面からの保存（Server Action）は種類名の宛先で数え、それ以外の宛先は数えない", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());

    await POST(
      usageRequest({
        apis: [
          { method: "POST", path: "/actions/members", calls: 2, durationMs: 400, errors: 1, slowCalls: 0 },
          { method: "POST", path: "/admin/members", calls: 9, durationMs: 9, errors: 0, slowCalls: 0 },
        ],
      }),
    );

    const rows = await testDb.db.select().from(s.usageApiDaily);
    expect(rows.map((r) => [r.method, r.routePattern, r.calls, r.errors])).toEqual([
      ["POST", "/actions/members", 2, 1],
    ]);
  });

  it("一覧に無い宛先・種類・method は数えない（好きな文字で行を作れない。DD-032 の17）", async () => {
    mocked.apiViewer.mockResolvedValue(viewer());
    const api = (method: string, path: string) => ({ method, path, calls: 1, durationMs: 10, errors: 0, slowCalls: 0 });

    await POST(
      usageRequest({
        apis: [
          api("GET", "/api/not-real"),
          api("GET", "/api/forms/frm_0a1b2c3d4e5f60718293"),
          api("DELETE", "/api/search"),
          api("POST", "/actions/not-a-resource"),
          api("GET", "/actions/members"),
          api("POST", "/api/auth/delete-user"),
          api("POST", "/api/usage"),
          // 数えるもの：実在の API・通している認証の口・名乗りの一覧にある保存の種類
          api("GET", "/api/search?q=abc"),
          api("GET", "/api/auth/get-session"),
          api("POST", "/actions/forms"),
        ],
      }),
    );

    const rows = await testDb.db.select().from(s.usageApiDaily);
    expect(rows.map((r) => `${r.method} ${r.routePattern}`).sort()).toEqual([
      "GET /api/auth/get-session",
      "GET /api/search",
      "POST /actions/forms",
    ]);
  });

  it("1社1日の行数が上限に達したら、新しい行は作らず、既にある行には足す（ほかの会社には響かない）", async () => {
    const date = jstDateKey(new Date());
    const filler = Array.from({ length: USAGE_MAX_ROWS_PER_COMPANY_DAY - 1 }, (_, i) => ({
      key: `${date}:${COMPANY}:/filler/${i}:EMPLOYEE`,
      date,
      companyId: COMPANY,
      routePattern: `/filler/${i}`,
      role: "EMPLOYEE",
      views: 1,
    }));
    for (let i = 0; i < filler.length; i += 50) await testDb.db.insert(s.usageScreenDaily).values(filler.slice(i, i + 50));
    const screen = (path: string) => ({
      path, views: 1, dwellMs: 0, dwellSamples: 0, longStays: 0, backtracks: 0, rageClicks: 0, abandons: 0, errors: 0,
    });

    mocked.apiViewer.mockResolvedValue(viewer());
    // 残り1行ぶん：/me は作れて、/me/forms は作れない（送られた順に通す）
    await POST(usageRequest({ screens: [screen("/me"), screen("/me/forms")] }));
    await POST(usageRequest({ screens: [screen("/me"), screen("/me/forms")] }));

    const own = await testDb.db.select().from(s.usageScreenDaily);
    expect(own).toHaveLength(USAGE_MAX_ROWS_PER_COMPANY_DAY);
    expect(own.find((r) => r.routePattern === "/me")?.views).toBe(2);
    expect(own.some((r) => r.routePattern === "/me/forms")).toBe(false);

    mocked.apiViewer.mockResolvedValue(viewer("EMPLOYEE", OTHER));
    await POST(usageRequest({ screens: [screen("/me/forms")] }));
    const other = await testDb.db.select().from(s.usageScreenDaily);
    expect(other.filter((r) => r.companyId === OTHER).map((r) => r.routePattern)).toEqual(["/me/forms"]);
  });

  it("読み出しは会社で絞れて、絞らなければ全社を合算する", async () => {
    const screen = {
      path: "/me",
      views: 1,
      dwellMs: 1000,
      dwellSamples: 1,
      longStays: 0,
      backtracks: 0,
      rageClicks: 0,
      abandons: 0,
      errors: 0,
    };

    mocked.apiViewer.mockResolvedValue(viewer("EMPLOYEE", COMPANY));
    await POST(usageRequest({ screens: [screen] }));
    mocked.apiViewer.mockResolvedValue(viewer("EMPLOYEE", OTHER));
    await POST(usageRequest({ screens: [screen] }));

    const own = await readUsageReport(testDb.db, { companyId: COMPANY, days: 30 });
    const all = await readUsageReport(testDb.db, { companyId: null, days: 30 });

    expect(own.screens.find((r) => r.routePattern === "/me")?.counters.views).toBe(1);
    expect(all.screens.find((r) => r.routePattern === "/me")?.counters.views).toBe(2);
    // 1件も開かれていない画面も一覧に残す材料が揃っている
    expect(all.allScreens.length).toBeGreaterThan(all.screens.length);
  });

  it("会社に属さない全体管理者の操作は記録しない（記録先が決まらないため）", async () => {
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN", null));

    const response = await POST(usageRequest({ screens: [{ path: "/system", views: 1, dwellMs: 0, dwellSamples: 0, longStays: 0, backtracks: 0, rageClicks: 0, abandons: 0, errors: 0 }] }));

    expect(response.status).toBe(200);
    expect(await testDb.db.select().from(s.usageScreenDaily)).toHaveLength(0);
  });
});

describe("数えてよい宛先の一覧と行数の上限", () => {
  it("API の一覧は、src/app/api の route.ts が出している method と一致する（認証の口と /api/usage 自身は除く）", () => {
    const apiRoot = path.join(process.cwd(), "src/app/api");
    const found = new Set<string>();
    for (const file of readdirSync(apiRoot, { recursive: true, encoding: "utf8" })) {
      if (path.basename(file) !== "route.ts") continue;
      const route = `/api/${path.dirname(file).split(path.sep).join("/")}`;
      if (route.startsWith("/api/auth/") || route === "/api/usage") continue;
      const source = readFileSync(path.join(apiRoot, file), "utf8");
      for (const m of source.matchAll(/^export async function (GET|POST|PUT|PATCH|DELETE)\b/gm)) found.add(`${m[1]} ${route}`);
    }
    expect([...USAGE_KNOWN_API_ROUTES].sort()).toEqual([...found].sort());
  });

  it("ふだんの使い方で作られる行の数は、上限より少ない（上限で本物の記録を落とさない）", () => {
    expect(allMeasurableScreens().length * ROLES.length).toBeLessThan(USAGE_MAX_ROWS_PER_COMPANY_DAY);
    // 通信：API の一覧・認証の3つの口・保存の種類
    expect(USAGE_KNOWN_API_ROUTES.size + 3 + FRESHNESS_RESOURCES.length).toBeLessThan(USAGE_MAX_ROWS_PER_COMPANY_DAY);
  });

  it("withinDailyRowLimit は、既にある行を常に通し、新しい行を残りの数だけ送られた順に通す", () => {
    const rows = ["a", "b", "c", "d"].map((key) => ({ key }));
    expect(withinDailyRowLimit(rows, ["c", "x"], 3).map((r) => r.key)).toEqual(["a", "c"]);
    expect(withinDailyRowLimit(rows, ["x", "y", "z"], 3).map((r) => r.key)).toEqual([]);
    expect(withinDailyRowLimit(rows, [], 10).map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("画面の呼び名", () => {
  it("同じ名前の画面が2つ並ばない（どれを直すか決められなくなるため）", () => {
    const labels = allMeasurableScreens().map((screen) => screen.label);
    const duplicated = labels.filter((label, i) => labels.indexOf(label) !== i);
    expect(duplicated).toEqual([]);
  });

  it("重ならない画面の呼び名には何も足さない", () => {
    expect(usageScreenLabel("/system/usage")).toBe("利用状況");
  });

  it("同じ名前の画面には、誰の画面か・どこから入る画面かを添える", () => {
    expect(usageScreenLabel("/me")).toBe("ホーム（本人）");
    expect(usageScreenLabel("/system")).toBe("ホーム（全体管理）");
    expect(usageScreenLabel("/me/forms/[id]")).toBe("アンケート1本（実績を報告する）");
  });
});
