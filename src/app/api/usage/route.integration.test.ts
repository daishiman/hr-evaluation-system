import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import { HttpError, type Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { allMeasurableScreens, readUsageReport, usageScreenLabel } from "@/lib/usage";
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
          { method: "GET", path: "/api/forms/frm_0a1b2c3d4e5f60718293", calls: 3, durationMs: 900, errors: 0, slowCalls: 0 },
          { method: "GET", path: "/api/forms/frm_ffeeddccbbaa99887766", calls: 2, durationMs: 3000, errors: 1, slowCalls: 1 },
        ],
      }),
    );

    const rows = await testDb.db.select().from(s.usageApiDaily);
    expect(rows).toHaveLength(1);
    expect(rows[0].routePattern).toBe("/api/forms/[id]");
    expect(rows[0].calls).toBe(5);
    expect(rows[0].errors).toBe(1);
    expect(rows[0].slowCalls).toBe(1);
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
