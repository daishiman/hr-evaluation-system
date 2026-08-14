import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import { HttpError, type Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

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

import { GET, PUT } from "@/app/api/theme-choice/route";

let testDb: TestDatabase;

function viewer(id: string, role: Viewer["role"] = "EMPLOYEE"): Viewer {
  return {
    id,
    name: `利用者 ${id}`,
    email: `${id}@example.com`,
    role,
    companyId: role === "SUPER_ADMIN" ? null : "company-1",
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: null,
    mustChangePassword: false,
  };
}

async function addUser(id: string, role: Viewer["role"] = "EMPLOYEE") {
  await testDb.db.insert(s.users).values({
    id,
    name: `利用者 ${id}`,
    email: `${id}@example.com`,
    role,
  });
}

function preferenceRequest(body: unknown) {
  return new Request("http://localhost/api/theme-choice", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  testDb = createTestDatabase();
  mocked.getDb.mockResolvedValue(testDb.db);
  mocked.apiViewer.mockReset();
});

afterEach(() => testDb.close());

describe("/api/theme-choice", () => {
  it("未認証の保存を401で拒否し、保管場所に触れない", async () => {
    mocked.apiViewer.mockRejectedValue(new HttpError(401, "ログインが必要です。"));

    const response = await PUT(preferenceRequest({ palette: "azure", mode: "light", resolved: "light" }));

    expect(response.status).toBe(401);
    expect(mocked.getDb).not.toHaveBeenCalled();
  });

  it("本文の利用者IDを受け付けず、セッション由来のIDだけを使う", async () => {
    await addUser("session-user");
    mocked.apiViewer.mockResolvedValue(viewer("session-user"));

    const response = await PUT(
      preferenceRequest({
        userId: "body-user",
        palette: "azure",
        mode: "light",
        resolved: "light",
      }),
    );

    expect(response.status).toBe(400);
    expect(testDb.raw.prepare("SELECT COUNT(*) AS count FROM theme_user_preferences").get()).toEqual({ count: 0 });
  });

  it("制度全体管理者以外の集計閲覧を403で拒否する", async () => {
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "この操作を行う権限がありません。"));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocked.apiViewer).toHaveBeenCalledWith("SUPER_ADMIN");
    expect(mocked.getDb).not.toHaveBeenCalled();
  });

  it("不正値と明暗の矛盾値を400で拒否する", async () => {
    await addUser("user-1");
    mocked.apiViewer.mockResolvedValue(viewer("user-1"));

    const invalid = await PUT(preferenceRequest({ palette: "red", mode: "light", resolved: "light" }));
    const contradictory = await PUT(preferenceRequest({ palette: "azure", mode: "light", resolved: "dark" }));

    expect(invalid.status).toBe(400);
    expect(contradictory.status).toBe(400);
  });

  it("同じ利用者は1行のまま最新選択へ上書きする", async () => {
    await addUser("user-1");
    mocked.apiViewer.mockResolvedValue(viewer("user-1"));

    expect((await PUT(preferenceRequest({ palette: "azure", mode: "dark", resolved: "dark" }))).status).toBe(200);
    expect((await PUT(preferenceRequest({ palette: "moss", mode: "light", resolved: "light" }))).status).toBe(200);

    expect(testDb.raw.prepare("SELECT user_id, palette, mode, resolved FROM theme_user_preferences").all()).toEqual([
      { user_id: "user-1", palette: "moss", mode: "light", resolved: "light" },
    ]);
  });

  it("制度全体管理者だけに、個人データを含まない人数・割合・母数を返す", async () => {
    await addUser("admin", "SUPER_ADMIN");
    await addUser("user-2");

    mocked.apiViewer.mockResolvedValueOnce(viewer("admin", "SUPER_ADMIN"));
    await PUT(preferenceRequest({ palette: "graphite", mode: "auto", resolved: "light" }));
    mocked.apiViewer.mockResolvedValueOnce(viewer("user-2"));
    await PUT(preferenceRequest({ palette: "azure", mode: "dark", resolved: "dark" }));
    mocked.apiViewer.mockResolvedValueOnce(viewer("admin", "SUPER_ADMIN"));

    const response = await GET();
    const body = (await response.json()) as {
      ok: boolean;
      activeUsers: number;
      measuredUsers: number;
      coverageRate: number;
      rows: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, activeUsers: 2, measuredUsers: 2, coverageRate: 100 });
    expect(body.rows).toEqual([
      { palette: "azure", mode: "dark", resolved: "dark", users: 1, percentage: 50 },
      { palette: "graphite", mode: "auto", resolved: "light", users: 1, percentage: 50 },
    ]);
    expect(JSON.stringify(body)).not.toContain("user-2");
    expect(JSON.stringify(body)).not.toContain("@example.com");
    expect(mocked.apiViewer).toHaveBeenLastCalledWith("SUPER_ADMIN");
  });
});
