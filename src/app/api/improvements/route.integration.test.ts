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
  updateGithubIssue: vi.fn(),
  commentOnGithubIssue: vi.fn(),
  closeGithubIssue: vi.fn(),
  readGithubIssueState: vi.fn(),
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
vi.mock("@/lib/github-issue", async () => ({
  // 失敗の見分け（作られたかもしれない／確実に届いていない）は本物の型で判定するので、
  // 例外クラスだけは本物を使う。
  IssueMaybeCreatedError: (await vi.importActual<typeof import("@/lib/github-issue")>("@/lib/github-issue"))
    .IssueMaybeCreatedError,
  requireGithubSettings: mocked.requireGithubSettings,
  createGithubIssue: mocked.createGithubIssue,
  updateGithubIssue: mocked.updateGithubIssue,
  commentOnGithubIssue: mocked.commentOnGithubIssue,
  closeGithubIssue: mocked.closeGithubIssue,
  readGithubIssueState: mocked.readGithubIssueState,
  appVersion: async () => "v-test",
}));

import { IMPROVEMENT_REQUEST_MAX_BYTES, POST, PUT } from "@/app/api/improvements/route";
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
  mocked.updateGithubIssue.mockReset();
  mocked.updateGithubIssue.mockResolvedValue({
    missing: false,
    closed: false,
    url: "https://github.com/owner/repo/issues/123",
  });
  mocked.commentOnGithubIssue.mockReset();
  mocked.commentOnGithubIssue.mockResolvedValue(undefined);
  mocked.closeGithubIssue.mockReset();
  mocked.closeGithubIssue.mockResolvedValue({ missing: false });
  mocked.readGithubIssueState.mockReset();
  mocked.readGithubIssueState.mockResolvedValue({
    missing: false,
    closed: false,
    url: "https://github.com/owner/repo/issues/123",
  });
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

/*
 * 一覧からのまとめ送りは、この入口を1件ずつ順番に呼ぶ。
 * つまり「いろいろなパターン」は、この1件ぶんの結果の並びとして現れる。
 * 依頼で挙がった場面をここで固定する。
 */
describe("PUT /api/improvements（一覧から記録票へ送る）", () => {
  async function seed(status = "open") {
    await testDb.db.insert(s.improvementRequests).values({
      id: "improve_target",
      companyId: IDS.company,
      reporterId: IDS.employee,
      submissionKey: crypto.randomUUID(),
      path: "/admin/members",
      routePattern: "/admin/members",
      screenLabel: "社員",
      kind: "bug",
      body: "保存できません",
      expected: "保存できてほしい",
      status,
    });
  }

  function putRequest(id = "improve_target") {
    return new Request("http://localhost/api/improvements", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const resultOf = async (response: Response) =>
    ((await response.json()) as { result: { action: string; issueNumber: number | null; reason: string } }).result;

  it("未起票なら新規に作り、行き先と送った時点の内容を控える", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const result = await resultOf(await PUT(putRequest()));

    expect(result).toMatchObject({ action: "created", issueNumber: 123 });
    const link = (await testDb.db.select().from(s.improvementIssueLinks))[0];
    expect(link.contentFingerprint).not.toBe("");
    expect(link.syncedAt).not.toBeNull();
  });

  it("内容が変わっていない起票済みは、送っても何もしない", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    const again = await resultOf(await PUT(putRequest()));

    expect(again.action).toBe("skipped");
    expect(mocked.createGithubIssue).toHaveBeenCalledTimes(1);
    expect(mocked.updateGithubIssue).not.toHaveBeenCalled();
  });

  it("起票後に内容が変わったら、同じ記録票を書き換えて経緯をコメントに残す", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    await testDb.db
      .update(s.improvementRequests)
      .set({ handledNote: "来週の版で直します" })
      .where(eq(s.improvementRequests.id, "improve_target"));
    const result = await resultOf(await PUT(putRequest()));

    expect(result).toMatchObject({ action: "updated", issueNumber: 123 });
    expect(mocked.createGithubIssue).toHaveBeenCalledTimes(1);
    expect(mocked.updateGithubIssue).toHaveBeenCalledTimes(1);
    expect(mocked.commentOnGithubIssue.mock.calls[0][2]).toContain("対応メモ");
  });

  it("閉じている記録票でも、こちらから開き直さずコメントだけ添える", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    mocked.updateGithubIssue.mockResolvedValue({
      missing: false,
      closed: true,
      url: "https://github.com/owner/repo/issues/123",
    });
    await testDb.db
      .update(s.improvementRequests)
      .set({ body: "やはり保存できません" })
      .where(eq(s.improvementRequests.id, "improve_target"));
    const result = await resultOf(await PUT(putRequest()));

    expect(result.action).toBe("updated");
    expect(mocked.updateGithubIssue.mock.calls[0][2]).not.toHaveProperty("state");
    expect(mocked.commentOnGithubIssue.mock.calls[0][2]).toContain("開き直すことはしていません");
  });

  it("GitHub 側に記録票が無いときは、止めずにリンク切れとして次の一手を示す", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    mocked.updateGithubIssue.mockResolvedValue({ missing: true });
    await testDb.db
      .update(s.improvementRequests)
      .set({ body: "やはり保存できません" })
      .where(eq(s.improvementRequests.id, "improve_target"));
    const broken = await resultOf(await PUT(putRequest()));

    expect(broken.action).toBe("failed");
    expect(broken.reason).toContain("もう一度送ると作り直します");
    expect((await testDb.db.select().from(s.improvementIssueLinks))[0].linkState).toBe("missing");

    // もう一度押すと作り直す（行き止まりにしない）
    const again = await resultOf(await PUT(putRequest()));
    expect(again.action).toBe("created");
    expect(mocked.createGithubIssue).toHaveBeenCalledTimes(2);
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(1);
  });

  it("1件が失敗しても例外にせず、結果として返す（続きの行が止まらない）", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    mocked.createGithubIssue.mockRejectedValue(new HttpError(403, "受付の上限に達しました。"));
    const response = await PUT(putRequest());
    const result = await resultOf(response);

    expect(response.status).toBe(200);
    expect(result.action).toBe("failed");
    // 席は空けてある（同じ行をすぐ送り直せる）
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(0);
  });

  it("たくさん選んでも、1件ずつ別の記録票になる（取り違えない）", async () => {
    // 画面での目視確認の代わりに、まとめ送りの現実量をここで通す。
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const ids = Array.from({ length: 30 }, (_, i) => `improve_bulk_${i}`);
    for (const id of ids) {
      await testDb.db.insert(s.improvementRequests).values({
        id,
        companyId: IDS.company,
        reporterId: IDS.employee,
        submissionKey: crypto.randomUUID(),
        path: "/admin/members",
        routePattern: "/admin/members",
        screenLabel: "社員",
        kind: "bug",
        body: `保存できません（${id}）`,
        status: "open",
      });
    }
    let next = 200;
    mocked.createGithubIssue.mockImplementation(async () => {
      next += 1;
      return { number: next, url: `https://github.com/owner/repo/issues/${next}` };
    });

    const actions: string[] = [];
    for (const id of ids) actions.push((await resultOf(await PUT(putRequest(id)))).action);

    expect(actions.every((a) => a === "created")).toBe(true);
    const links = await testDb.db.select().from(s.improvementIssueLinks);
    expect(links).toHaveLength(30);
    // 番号の使い回しが起きていない（1つの記録票に複数の要望が乗らない）
    expect(new Set(links.map((l) => l.issueNumber)).size).toBe(30);
  });

  it("同時に2回押されても、記録票は1つしか立たない", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const responses = await Promise.all([PUT(putRequest()), PUT(putRequest())]);
    const actions = await Promise.all(responses.map(async (r) => (await resultOf(r)).action));

    expect(actions.filter((a) => a === "created")).toHaveLength(1);
    expect(mocked.createGithubIssue).toHaveBeenCalledTimes(1);
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(1);
  });

  it("会社の管理者は押せない（社外へ出る操作のため）", async () => {
    await seed();
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));
    const response = await PUT(putRequest());

    expect(response.status).toBe(403);
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
  });

  it("他社の要望は404にして外へ送らない", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN", "cmp_other"));
    const response = await PUT(putRequest());

    expect(response.status).toBe(404);
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
  });
});

/*
 * 誤って届いたもの・対応しないものの片付け。
 *
 * ここで守りたいのは「戻せること」。落とす操作そのものより、
 * 取り消しが効かなくなる壊れ方のほうが困る（依頼者の指摘、2026-08-15）。
 */
describe("PUT /api/improvements（落とす・戻す）", () => {
  async function seed(over: Record<string, unknown> = {}) {
    await testDb.db.insert(s.improvementRequests).values({
      id: "improve_target",
      companyId: IDS.company,
      reporterId: IDS.employee,
      submissionKey: crypto.randomUUID(),
      path: "/admin/members",
      routePattern: "/admin/members",
      screenLabel: "社員",
      kind: "bug",
      body: "保存できません",
      expected: "保存できてほしい",
      status: "doing",
      ...over,
    });
  }

  function act(body: Record<string, unknown>) {
    return new Request("http://localhost/api/improvements", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "improve_target", ...body }),
    });
  }

  const resultOf = async (response: Response) =>
    ((await response.json()) as { result: { action: string; issueNumber: number | null; reason: string } }).result;

  const target = () =>
    testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_target"));

  const events = () =>
    testDb.db.select().from(s.improvementStatusEvents).where(eq(s.improvementStatusEvents.requestId, "improve_target"));

  beforeEach(() => {
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
  });

  it("廃棄しても行は消さず、印を立てるだけにする", async () => {
    await seed();
    const result = await resultOf(await PUT(act({ action: "discard", reasonCode: "mistake" })));

    expect(result.action).toBe("discarded");
    const row = (await target())[0];
    expect(row.discardedAt).not.toBeNull();
    expect(row.discardReason).toBe("誤送信");
    // 対応状況は触らない（戻す先が消えるため）
    expect(row.status).toBe("doing");
  });

  it("廃棄を取り消すと、廃棄する前の状態に戻る", async () => {
    await seed();
    await PUT(act({ action: "discard", reasonCode: "mistake" }));
    const result = await resultOf(await PUT(act({ action: "restore" })));

    expect(result.action).toBe("restored");
    const row = (await target())[0];
    expect(row.discardedAt).toBeNull();
    expect(row.status).toBe("doing");
    // 経緯は上書きせず積み上がる
    expect(await events()).toHaveLength(2);
  });

  it("対応しないを取り消すと、落とす前の状態に戻る", async () => {
    await seed({ status: "open" });
    await PUT(act({ action: "reject", reasonCode: "by-design" }));
    expect((await target())[0].status).toBe("dropped");

    const result = await resultOf(await PUT(act({ action: "restore" })));
    expect(result.action).toBe("restored");
    expect((await target())[0].status).toBe("open");
  });

  it("戻すものが無ければ、何もしないと言って終わる", async () => {
    await seed();
    expect((await resultOf(await PUT(act({ action: "restore" })))).action).toBe("skipped");
  });

  it("廃棄したものは、まとめ送りの対象から自動的に外れる", async () => {
    await seed();
    await PUT(act({ action: "discard", reasonCode: "test" }));
    const result = await resultOf(await PUT(act({ action: "sync" })));

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("記録票へ送りません");
    expect(mocked.createGithubIssue).not.toHaveBeenCalled();
  });

  it("理由を選ばなければ落とせない（画面で隠すだけにしない）", async () => {
    await seed();
    const response = await PUT(act({ action: "discard" }));

    expect(response.status).toBe(400);
    expect((await target())[0].discardedAt).toBeNull();
  });

  it("「その他」を選んだのに書いていなければ落とせない", async () => {
    await seed();
    expect((await PUT(act({ action: "reject", reasonCode: "other" }))).status).toBe(400);
  });

  it("記録票を閉じられなくても、アプリ側の判断は残す", async () => {
    await seed();
    await PUT(act({ action: "sync" }));
    mocked.closeGithubIssue.mockRejectedValue(new HttpError(502, "GitHub に届きませんでした。"));
    const response = await PUT(act({ action: "reject", reasonCode: "infeasible", closeIssue: true }));
    const result = await resultOf(response);

    expect(response.status).toBe(200);
    expect(result.action).toBe("rejected");
    expect(result.reason).toContain("GitHub に届きませんでした");
    // アプリ側は確定している（外の失敗で巻き戻さない）
    expect((await target())[0].status).toBe("dropped");
  });

  it("閉じるときは、閉じる理由を記録票にも残す", async () => {
    await seed();
    await PUT(act({ action: "sync" }));
    await PUT(act({ action: "reject", reasonCode: "by-design", closeIssue: true }));

    expect(mocked.closeGithubIssue.mock.calls[0][2]).toContain("理由：仕様どおり");
    const link = (await testDb.db.select().from(s.improvementIssueLinks))[0];
    expect(link.issueState).toBe("closed");
  });

  it("閉じるを選ばなければ、記録票は開いたままにする", async () => {
    await seed();
    await PUT(act({ action: "sync" }));
    await PUT(act({ action: "discard", reasonCode: "spam" }));

    expect(mocked.closeGithubIssue).not.toHaveBeenCalled();
  });

  it("誤って作った記録票は、ひも付けを外して作り直せる", async () => {
    await seed();
    await PUT(act({ action: "sync" }));
    const result = await resultOf(await PUT(act({ action: "unlink" })));

    expect(result.action).toBe("unlinked");
    expect(await testDb.db.select().from(s.improvementIssueLinks)).toHaveLength(0);

    const again = await resultOf(await PUT(act({ action: "sync" })));
    expect(again.action).toBe("created");
  });

  it("GitHub 側で先に閉じられていたら、アプリ側も追いつく", async () => {
    await seed();
    await PUT(act({ action: "sync" }));
    mocked.readGithubIssueState.mockResolvedValue({
      missing: false,
      closed: true,
      url: "https://github.com/owner/repo/issues/123",
    });
    const result = await resultOf(await PUT(act({ action: "refresh" })));

    expect(result.action).toBe("refreshed");
    expect((await target())[0].status).toBe("done");
  });

  it("記録票がまだ無ければ、取り込みは何もしない", async () => {
    await seed();
    expect((await resultOf(await PUT(act({ action: "refresh" })))).action).toBe("skipped");
    expect(mocked.readGithubIssueState).not.toHaveBeenCalled();
  });

  it("統合先が無い重複は受け付けない", async () => {
    await seed();
    expect((await PUT(act({ action: "duplicate", reasonCode: "duplicate" }))).status).toBe(400);
  });

  it("会社の管理者は落とせない（要望が見えなくなる操作のため）", async () => {
    await seed();
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));
    const response = await PUT(act({ action: "discard", reasonCode: "mistake" }));

    expect(response.status).toBe(403);
    expect((await target())[0].discardedAt).toBeNull();
  });

  it("他社の要望は404にする", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN", "cmp_other"));
    expect((await PUT(act({ action: "discard", reasonCode: "mistake" }))).status).toBe(404);
  });
});
