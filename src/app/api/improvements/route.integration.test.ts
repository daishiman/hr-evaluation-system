import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { HttpError, type Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
  requireGithubSettings: vi.fn(),
  createGithubIssue: vi.fn(),
}));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

// 記録票づくりは社外（GitHub）へ出す操作。テストからは一歩も外へ出さず、
// 「どんな文面を渡したか」と「返事をどう扱ったか」だけをここで確かめる。
vi.mock("@/lib/github-issue", () => ({
  requireGithubSettings: mocked.requireGithubSettings,
  createGithubIssue: mocked.createGithubIssue,
  appVersion: async () => "v-test",
}));

import { IMPROVEMENT_REQUEST_MAX_BYTES, POST } from "@/app/api/improvements/route";
import { PATCH, POST as POST_ISSUE } from "@/app/api/improvements/[id]/route";

let testDb: TestDatabase;

function viewer(role: Viewer["role"] = "EMPLOYEE", companyId: string | null = IDS.company): Viewer {
  return {
    id: role === "COMPANY_ADMIN" ? "usr_admin" : IDS.employee,
    name: "テスト利用者",
    email: "viewer@example.com",
    role,
    companyId,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  };
}

function postRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/improvements", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "integration-test" },
    body: JSON.stringify({
      path: "/f/acme-secret-token?employee=someone",
      kind: "usability",
      body: "送信ボタンの位置が分かりにくいです。",
      viewport: "375×812",
      shot: null,
      submissionKey: crypto.randomUUID(),
      ...overrides,
    }),
  });
}

function patchRequest(status: string, note: string) {
  return new Request("http://localhost/api/improvements/improve_target", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
}

beforeEach(async () => {
  testDb = createTestDatabase();
  await seedCompany(testDb);
  await testDb.db.insert(s.users).values({
    id: "usr_admin",
    name: "会社管理者",
    email: "admin@example.com",
    companyId: IDS.company,
    role: "COMPANY_ADMIN",
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(testDb.db);
  mocked.apiViewer.mockReset();
  mocked.apiViewer.mockResolvedValue(viewer());
  mocked.requireGithubSettings.mockReset();
  mocked.requireGithubSettings.mockResolvedValue({ repo: "owner/repo", token: "dummy" });
  mocked.createGithubIssue.mockReset();
  mocked.createGithubIssue.mockResolvedValue({ number: 123, url: "https://github.com/owner/repo/issues/123" });
  _resetRateLimitStoreForTest();
});

afterEach(() => testDb.close());

describe("POST /api/improvements", () => {
  it("実URLを保持し、動的URLはroute patternへ集約して文章だけで保存する", async () => {
    const response = await POST(postRequest());
    const rows = await testDb.db.select().from(s.improvementRequests);

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      path: "/f/acme-secret-token",
      routePattern: "/f/[token]",
      screenLabel: "配布されたアンケート",
    });
    expect(await testDb.db.select().from(s.improvementShots)).toHaveLength(0);
  });

  it("技術情報は受け取ったまま保存せず、伏せて件数を切ってから保存する", async () => {
    const response = await POST(
      postRequest({
        kind: "bug",
        expected: "押したら保存されてほしい",
        diagnostics: {
          userAgent: "integration",
          logs: [{ agoMs: 10, level: "error", text: "failed for taro@example.com token=abcdefgh" }],
          network: Array.from({ length: 30 }, (_, i) => ({
            agoMs: i,
            method: "GET",
            path: `https://hr.example.com/api/x${i}?q=1`,
            status: 500,
            durationMs: 5,
          })),
        },
      }),
    );
    const row = (await testDb.db.select().from(s.improvementRequests))[0];
    const saved = JSON.parse(row.diagnostics!) as { logs: { text: string }[]; network: { path: string }[] };

    expect(response.status).toBe(200);
    expect(row.kind).toBe("bug");
    expect(row.expected).toBe("押したら保存されてほしい");
    expect(saved.logs[0].text).not.toContain("taro@example.com");
    expect(saved.logs[0].text).toContain("***");
    expect(saved.network).toHaveLength(20);
    expect(saved.network[0].path).toBe("/api/x10");
  });

  it("技術情報が付かない送信もそのまま受け取る", async () => {
    expect((await POST(postRequest())).status).toBe(200);
    expect((await testDb.db.select().from(s.improvementRequests))[0].diagnostics).toBeNull();
  });

  it("画像あり投稿を本文と同じbatchで保存する", async () => {
    const response = await POST(postRequest({ shot: "data:image/png;base64,iVBORw0KGgo=" }));
    expect(response.status).toBe(200);
    expect(await testDb.db.select().from(s.improvementRequests)).toHaveLength(1);
    expect(await testDb.db.select().from(s.improvementShots)).toHaveLength(1);
  });

  it("同じsubmission keyの再送は同じIDを返して1件だけ残す", async () => {
    const submissionKey = crypto.randomUUID();
    const first = await POST(postRequest({ submissionKey }));
    const second = await POST(postRequest({ submissionKey }));
    const firstBody = (await first.json()) as { id: string };
    const secondBody = (await second.json()) as { id: string };

    expect(secondBody.id).toBe(firstBody.id);
    expect(await testDb.db.select().from(s.improvementRequests)).toHaveLength(1);
  });

  it("本文上限と解析前body上限を拒否する", async () => {
    const bodyTooLong = await POST(postRequest({ body: "あ".repeat(1001) }));
    const declaredTooLarge = new Request("http://localhost/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(IMPROVEMENT_REQUEST_MAX_BYTES + 1) },
      body: "{}",
    });
    const bodyTooLarge = await POST(declaredTooLarge);

    expect(bodyTooLong.status).toBe(400);
    expect(bodyTooLarge.status).toBe(413);
    expect(await testDb.db.select().from(s.improvementRequests)).toHaveLength(0);
  });

  it("偽装画像を拒否する", async () => {
    const response = await POST(postRequest({ shot: "data:image/png;base64,AAAA" }));
    expect(response.status).toBe(400);
    expect(await testDb.db.select().from(s.improvementRequests)).toHaveLength(0);
  });

  it("投稿者単位で6件目を429にし、待ち時間を返す", async () => {
    for (let i = 0; i < 5; i += 1) expect((await POST(postRequest())).status).toBe(200);
    const limited = await POST(postRequest());
    const body = (await limited.json()) as { message: string };

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(body.message).toContain("入力内容は残っています");
    expect(await testDb.db.select().from(s.improvementRequests)).toHaveLength(5);
  });

  it("有効セッションがなければ保存しない", async () => {
    mocked.apiViewer.mockRejectedValue(new HttpError(401, "ログインが必要です。"));
    const response = await POST(postRequest());
    expect(response.status).toBe(401);
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/improvements/[id]", () => {
  async function seedRequest(companyId: string = IDS.company) {
    if (companyId !== IDS.company) {
      await testDb.db.insert(s.companies).values({ id: companyId, name: "別会社", slug: "other" });
    }
    await testDb.db.insert(s.improvementRequests).values({
      id: "improve_target",
      companyId,
      reporterId: IDS.employee,
      submissionKey: crypto.randomUUID(),
      path: "/admin",
      routePattern: "/admin",
      screenLabel: "ホーム",
      body: "改善要望",
      status: "doing",
      handledNote: "最初のメモ",
    });
  }

  it("同じ状態のままメモを修正し、空にもできる", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("COMPANY_ADMIN"));
    expect((await PATCH(patchRequest("doing", "修正メモ"), { params: Promise.resolve({ id: "improve_target" }) })).status).toBe(200);
    expect((await PATCH(patchRequest("doing", ""), { params: Promise.resolve({ id: "improve_target" }) })).status).toBe(200);

    const row = (await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_target")))[0];
    expect(row.handledNote).toBeNull();
  });

  it("見送りは理由なしでは保存しない", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("COMPANY_ADMIN"));
    const response = await PATCH(patchRequest("dropped", ""), { params: Promise.resolve({ id: "improve_target" }) });
    expect(response.status).toBe(400);
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });

  it("他社IDは404にして更新しない", async () => {
    await seedRequest("cmp_other");
    mocked.apiViewer.mockResolvedValue(viewer("COMPANY_ADMIN"));
    const response = await PATCH(patchRequest("done", "確認済み"), { params: Promise.resolve({ id: "improve_target" }) });
    expect(response.status).toBe(404);
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });

  it("一般とマネージャーは管理更新を拒否する", async () => {
    await seedRequest();
    for (const role of ["EMPLOYEE", "MANAGER"] as const) {
      mocked.apiViewer.mockRejectedValueOnce(new HttpError(403, `${role} cannot handle`));
      const response = await PATCH(patchRequest("done", ""), { params: Promise.resolve({ id: "improve_target" }) });
      expect(response.status).toBe(403);
    }
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });
});

describe("POST /api/improvements/[id]（記録票を作る）", () => {
  const params = { params: Promise.resolve({ id: "improve_target" }) };

  async function seedRequest(companyId: string = IDS.company) {
    if (companyId !== IDS.company) {
      await testDb.db.insert(s.companies).values({ id: companyId, name: "別会社", slug: "other" });
    }
    await testDb.db.insert(s.improvementRequests).values({
      id: "improve_target",
      companyId,
      reporterId: IDS.employee,
      submissionKey: crypto.randomUUID(),
      path: "/admin/members",
      routePattern: "/admin/members",
      screenLabel: "社員",
      kind: "bug",
      body: "保存できません",
      expected: "保存できてほしい",
      status: "open",
    });
  }

  function issueRequest() {
    return new Request("http://localhost/api/improvements/improve_target", { method: "POST" });
  }

  it("要望の中身を記録票の文面にして送り、行き先を残して対応中へ進める", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const response = await POST_ISSUE(issueRequest(), params);
    const sent = mocked.createGithubIssue.mock.calls[0][1] as { title: string; body: string; labels: string[] };
    const link = (await testDb.db.select().from(s.improvementIssueLinks))[0];

    expect(response.status).toBe(200);
    expect(sent.title).toContain("社員");
    expect(sent.body).toContain("保存できません");
    expect(sent.body).toContain("保存できてほしい");
    expect(sent.body).toContain("`src/app/admin/members/page.tsx`");
    expect(sent.labels).toEqual(["improvement", "bug", "severity:medium", "area:admin"]);
    expect(link).toMatchObject({ requestId: "improve_target", issueNumber: 123 });
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });

  it("氏名・メールアドレス・画面の写しは記録票へ出さない", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await POST_ISSUE(issueRequest(), params);
    const sent = mocked.createGithubIssue.mock.calls[0][1] as { body: string };

    expect(sent.body).not.toContain("@");
    expect(sent.body).not.toContain("data:image");
  });

  it("二度押しても記録票は1つだけにする", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await POST_ISSUE(issueRequest(), params);
    const second = await POST_ISSUE(issueRequest(), params);

    expect(second.status).toBe(200);
    expect(mocked.createGithubIssue).toHaveBeenCalledTimes(1);
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(1);
  });

  it("出し先やトークンが未設定なら、外へ送る前に止める", async () => {
    await seedRequest();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    mocked.requireGithubSettings.mockRejectedValue(new HttpError(503, "GITHUB_TOKEN が未設定です。"));
    const response = await POST_ISSUE(issueRequest(), params);

    expect(response.status).toBe(503);
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(0);
  });

  it("会社の管理者は押せない（社外へ出る操作のため）", async () => {
    await seedRequest();
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));
    const response = await POST_ISSUE(issueRequest(), params);

    expect(response.status).toBe(403);
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
  });

  it("他社IDは404にして外へ送らない", async () => {
    await seedRequest("cmp_other");
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const response = await POST_ISSUE(issueRequest(), params);

    expect(response.status).toBe(404);
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
  });
});
