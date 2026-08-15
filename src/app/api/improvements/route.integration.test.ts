import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import { HttpError, type Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { AGENT_BULK_MAX, AGENT_KEY_NAME } from "@/lib/domain/agent-api";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

const AGENT_KEY = "test-agent-key-0123456789abcdefghij";

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
  env: { AGENT_API_KEY: "" } as Record<string, unknown>,
}));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

// 鍵は Workers 側の設定に入っている。テストからは同じ読み口を差し替えて、
// 「設定されていない」「違う鍵」「正しい鍵」の3つを作り分ける。
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

import { GET, POST, PUT, PATCH as agentWriteBack } from "@/app/api/improvements/route";
import { hashAgentKey } from "@/lib/agent-keys";
import { IMPROVEMENT_REQUEST_MAX_BYTES } from "@/lib/domain/improvement";
import { PATCH } from "@/app/api/improvements/[id]/route";

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
  mocked.env = { AGENT_API_KEY: AGENT_KEY };
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

/*
 * 一覧からのまとめ払い出しは、この入口を1件ずつ順番に呼ぶ。
 * つまり「いろいろなパターン」は、この1件ぶんの結果の並びとして現れる。
 */
describe("PUT /api/improvements（払い出しの控え）", () => {
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
    ((await response.json()) as { result: { action: string; reason: string } }).result;

  const handouts = () => testDb.db.select().from(s.improvementHandouts);

  it("未払い出しなら控えを残し、対応中へ進める", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    const result = await resultOf(await PUT(putRequest()));

    expect(result.action).toBe("handed");
    const row = (await handouts())[0];
    expect(row.contentFingerprint).not.toBe("");
    expect(row.handedOutAt).not.toBeNull();
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });

  it("内容が変わっていなければ、二度目は何もしない", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    const again = await resultOf(await PUT(putRequest()));

    expect(again.action).toBe("skipped");
    expect(await handouts()).toHaveLength(1);
  });

  it("渡したあとに内容が変わったら、払い出し直せる", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await PUT(putRequest());
    await testDb.db
      .update(s.improvementRequests)
      .set({ handledNote: "来週の版で直します" })
      .where(eq(s.improvementRequests.id, "improve_target"));
    const result = await resultOf(await PUT(putRequest()));

    expect(result.action).toBe("rehanded");
    expect(await handouts()).toHaveLength(1);
  });

  it("たくさん選んでも、1件ずつ別の控えになる（取り違えない）", async () => {
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

    const actions: string[] = [];
    for (const id of ids) actions.push((await resultOf(await PUT(putRequest(id)))).action);

    expect(actions.every((a) => a === "handed")).toBe(true);
    const rows = await handouts();
    expect(rows).toHaveLength(30);
    expect(new Set(rows.map((r) => r.requestId)).size).toBe(30);
  });

  it("同時に2回押されても、控えは1件にまとまる", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN"));
    await Promise.all([PUT(putRequest()), PUT(putRequest())]);

    expect(await handouts()).toHaveLength(1);
  });

  it("会社の管理者は押せない", async () => {
    await seed();
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));
    expect((await PUT(putRequest())).status).toBe(403);
    expect(await handouts()).toHaveLength(0);
  });

  it("他社の要望は404にする", async () => {
    await seed();
    mocked.apiViewer.mockResolvedValue(viewer("SUPER_ADMIN", "cmp_other"));
    expect((await PUT(putRequest())).status).toBe(404);
    expect(await handouts()).toHaveLength(0);
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
    ((await response.json()) as { result: { action: string; reason: string } }).result;

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

  it("廃棄したものは、まとめ払い出しの対象から自動的に外れる", async () => {
    await seed();
    await PUT(act({ action: "discard", reasonCode: "test" }));
    const result = await resultOf(await PUT(act({ action: "handout" })));

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("払い出しません");
    expect(await testDb.db.select().from(s.improvementHandouts)).toHaveLength(0);
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

/*
 * 作業する側（Claude Code）が読む入口。
 *
 * ここに並ぶのは利用者の生の声と、自動で集めた技術情報。
 * 「鍵が無ければ中身を返さない」が最優先で、それ以外の使い勝手は
 * すべてその後ろに来る。
 */
describe("GET /api/improvements（作業指示の払い出し）", () => {
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
      status: "open",
      diagnostics: JSON.stringify({
        userAgent: "integration",
        logs: [{ agoMs: 10, level: "error", text: "failed for taro@example.com" }],
      }),
      ...over,
    });
  }

  function get(query = "", headers: Record<string, string> = {}) {
    return new Request(`http://localhost/api/improvements${query}`, { headers });
  }

  const withKey = (query = "", headers: Record<string, string> = {}) =>
    get(query, { authorization: `Bearer ${AGENT_KEY}`, ...headers });

  it("鍵が無ければ、要望の中身を1文字も返さない", async () => {
    await seed();
    const response = await GET(get("?id=improve_target"));
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain("保存できません");
    expect(text).not.toContain("improve_target");
  });

  it("違う鍵でも、断り方を変えない（近さを読み取らせない）", async () => {
    await seed();
    const wrong = await GET(get("?id=improve_target", { authorization: "Bearer dummy-key" }));
    _resetRateLimitStoreForTest();
    const none = await GET(get("?id=improve_target"));

    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toBe(await none.text());
  });

  it("鍵が未設定なら、中身の代わりに設定の手順を返す", async () => {
    await seed();
    mocked.env = {};
    const response = await GET(withKey("?id=improve_target"));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain(AGENT_KEY_NAME);
    expect(text).not.toContain("保存できません");
  });

  it("短すぎる鍵は設定されていない扱いにする", async () => {
    await seed();
    mocked.env = { AGENT_API_KEY: "short" };
    const response = await GET(get("?id=improve_target", { authorization: "Bearer short" }));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("保存できません");
  });

  it("回数が続けば、鍵を確かめる前に断る", async () => {
    for (let i = 0; i < 30; i += 1) expect((await GET(get())).status).toBe(401);
    const limited = await GET(withKey());

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });

  it("一覧は、どれを取りにいくかを選ぶ材料だけを返す", async () => {
    await seed();
    const response = await GET(withKey());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(text).toContain("improve_target");
    expect(text).toContain("社員");
    // 一覧には技術情報も本文の全文も出さない
    expect(text).not.toContain("taro@example.com");
  });

  it("既定は Markdown、求められたときだけ JSON にする", async () => {
    await seed();
    const byParam = await GET(withKey("?format=json"));
    const byHeader = await GET(withKey("", { accept: "application/json" }));
    const body = (await byParam.json()) as { count: number; items: { id: string; handedOut: boolean }[] };

    expect(byParam.headers.get("content-type")).toContain("application/json");
    expect(byHeader.headers.get("content-type")).toContain("application/json");
    expect(body.count).toBe(1);
    expect(body.items[0]).toMatchObject({ id: "improve_target", handedOut: false });
  });

  it("1件を取ると、伏せ字ずみの技術情報を含む指示文が返る", async () => {
    await seed();
    const response = await GET(withKey("?id=improve_target"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("保存できません");
    expect(text).toContain("保存できてほしい");
    expect(text).toContain("## 作業のやり方");
    expect(text).toContain("***");
    expect(text).not.toContain("taro@example.com");
  });

  it("受け取れた時点で払い出しの控えが残り、対応中へ進む", async () => {
    await seed();
    await GET(withKey("?id=improve_target"));

    const row = (await testDb.db.select().from(s.improvementHandouts))[0];
    expect(row.contentFingerprint).not.toBe("");
    // API 経由なので押した人は残らない（渡ったことは日時で残る）
    expect(row.handedOutById).toBeNull();
    expect((await testDb.db.select().from(s.improvementRequests))[0].status).toBe("doing");
  });

  it("まとめて取ると、1つの指示文に並ぶ", async () => {
    await seed();
    await seed({ id: "improve_second", body: "並び順が分かりません", kind: "usability", diagnostics: null });
    const text = await (await GET(withKey("?ids=improve_target,improve_second"))).text();

    expect(text).toContain("保存できません");
    expect(text).toContain("並び順が分かりません");
    expect(await testDb.db.select().from(s.improvementHandouts)).toHaveLength(2);
  });

  it("一度に渡せる上限を超えたら、切ったことを本文で伝える", async () => {
    const ids: string[] = [];
    for (let i = 0; i < AGENT_BULK_MAX + 2; i += 1) {
      ids.push(`improve_many_${i}`);
      await seed({ id: `improve_many_${i}`, diagnostics: null });
    }
    const text = await (await GET(withKey(`?ids=${ids.join(",")}`))).text();

    expect(text).toContain(`${AGENT_BULK_MAX}件まで`);
    expect(text).toContain("2件は含めていません");
  });

  it("要望IDが空なら、書き方を返す", async () => {
    const text = await (await GET(withKey("?ids=,,"))).text();
    expect(text).toContain("要望IDがありません");
  });

  it("見つからないIDには、中身の代わりに確かめ方を返す", async () => {
    await seed();
    const text = await (await GET(withKey("?id=improve_missing"))).text();

    expect(text).toContain("見つかりません");
    expect(text).not.toContain("保存できません");
  });

  it("廃棄したものは払い出さない", async () => {
    await seed({ discardedAt: new Date(), discardReason: "誤送信" });
    const single = await (await GET(withKey("?id=improve_target"))).text();
    const list = await (await GET(withKey())).text();

    expect(single).toContain("見つかりません");
    expect(list).not.toContain("improve_target");
  });
});

/* ═══════════ 鍵の届く範囲 ═══════════
 *
 * 2026-08-15、依頼者の確定仕様。鍵には会社を焼き込み、できることを2つに限る。
 * 「他社の要望は読めない」「自分が受け取った要望しか状態を変えられない」は、
 * 画面や呼び出し側の作法ではなくサーバー側で断ることが条件なので、ここで固定する。
 */
describe("鍵の届く範囲（会社と、自分が取った分だけ）", () => {
  const SCOPED_KEY = "scoped-agent-key-0123456789abcdefgh";
  const OTHER = "cmp_other";

  /** 会社を焼き込んだ鍵。読み取りと、自分が取った分の状態更新ができる。 */
  async function seedScopedKey(over: Record<string, unknown> = {}) {
    await testDb.db.insert(s.agentApiKeys).values({
      id: "agkey_scoped",
      label: "自宅の Claude Code",
      keyHash: await hashAgentKey(SCOPED_KEY),
      keyPrefix: SCOPED_KEY.slice(0, 8),
      companyId: IDS.company,
      scopes: "improvements:read,improvements:write-own",
      ...over,
    });
  }

  async function seedRequest(id: string, companyId: string, reporterId: string) {
    await testDb.db.insert(s.improvementRequests).values({
      id,
      companyId,
      reporterId,
      submissionKey: crypto.randomUUID(),
      path: "/admin/members",
      routePattern: "/admin/members",
      screenLabel: "社員",
      kind: "bug",
      body: companyId === OTHER ? "他社だけの秘密の不満" : "保存できません",
      status: "open",
    });
  }

  /** 他社と、その会社の要望を1件用意する。 */
  async function seedOtherCompany() {
    await testDb.db.insert(s.companies).values({ id: OTHER, name: "他社", slug: "other" });
    await testDb.db.insert(s.users).values({
      id: "usr_other",
      name: "他社の社員",
      email: "other@example.com",
      companyId: OTHER,
      role: "EMPLOYEE",
    });
    await seedRequest("improve_other", OTHER, "usr_other");
  }

  const scoped = (query = "") =>
    new Request(`http://localhost/api/improvements${query}`, {
      headers: { authorization: `Bearer ${SCOPED_KEY}` },
    });

  const writeBack = (body: Record<string, unknown>, key = SCOPED_KEY) =>
    new Request("http://localhost/api/improvements", {
      method: "PATCH",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    await seedScopedKey();
    await seedRequest("improve_mine", IDS.company, IDS.employee);
    await seedOtherCompany();
  });

  it("他社の要望は、IDを直接指しても1文字も返さない", async () => {
    const response = await GET(scoped("?id=improve_other"));
    const text = await response.text();

    expect(text).not.toContain("他社だけの秘密の不満");
    expect(text).toContain("見つかりません");
  });

  it("一覧にも他社の要望は並ばない", async () => {
    const text = await (await GET(scoped())).text();

    expect(text).toContain("improve_mine");
    expect(text).not.toContain("improve_other");
  });

  it("会社が焼き込まれていない鍵（設定値の鍵）は、これまでどおり全社を読める", async () => {
    const text = await (
      await GET(
        new Request("http://localhost/api/improvements", {
          headers: { authorization: `Bearer ${AGENT_KEY}` },
        }),
      )
    ).text();

    expect(text).toContain("improve_mine");
    expect(text).toContain("improve_other");
  });

  it("受け取っていない要望は、対応済みにできない", async () => {
    const response = await agentWriteBack(writeBack({ id: "improve_mine", result: "done", detail: "v53" }));
    const row = (
      await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_mine"))
    )[0];

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("まだ受け取っていません");
    expect(row.status).toBe("open");
  });

  it("他社の要望は、状態も変えられない（他社だとは言わない）", async () => {
    const response = await agentWriteBack(writeBack({ id: "improve_other", result: "done", detail: "v53" }));

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("見つかりません");
  });

  it("会社が焼き込まれていない鍵では、状態を変えられない", async () => {
    await GET(
      new Request("http://localhost/api/improvements?id=improve_mine", {
        headers: { authorization: `Bearer ${AGENT_KEY}` },
      }),
    );
    const response = await agentWriteBack(
      writeBack({ id: "improve_mine", result: "done", detail: "v53" }, AGENT_KEY),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("権限がありません");
  });

  it("読み取りだけの鍵では、状態を変えられない", async () => {
    await testDb.db
      .update(s.agentApiKeys)
      .set({ scopes: "improvements:read" })
      .where(eq(s.agentApiKeys.id, "agkey_scoped"));
    await GET(scoped("?id=improve_mine"));

    const response = await agentWriteBack(writeBack({ id: "improve_mine", result: "done", detail: "v53" }));
    expect(response.status).toBe(403);
  });

  it("受け取った要望は、公開先を添えれば対応済みにできる", async () => {
    await GET(scoped("?id=improve_mine"));
    const response = await agentWriteBack(
      writeBack({ id: "improve_mine", result: "done", detail: "https://example.com/v53" }),
    );
    const row = (
      await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_mine"))
    )[0];
    const events = await testDb.db
      .select()
      .from(s.improvementStatusEvents)
      .where(eq(s.improvementStatusEvents.requestId, "improve_mine"));

    expect(response.status).toBe(200);
    expect(row.status).toBe("done");
    // 誰が・いつ・どの公開で変えたかを残す。人が差し戻すときに読む材料になる。
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "agent-done",
      fromStatus: "doing",
      toStatus: "done",
      keyId: "agkey_scoped",
      keyLabel: "自宅の Claude Code",
      releaseRef: "https://example.com/v53",
      actorId: null,
    });
  });

  it("公開先が空なら、対応済みにしない", async () => {
    await GET(scoped("?id=improve_mine"));
    const response = await agentWriteBack(writeBack({ id: "improve_mine", result: "done", detail: "   " }));
    const row = (
      await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_mine"))
    )[0];

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("公開した先");
    expect(row.status).toBe("doing");
  });

  it("直しきれなかったときは、対応中のまま理由だけを残す", async () => {
    await GET(scoped("?id=improve_mine"));
    const response = await agentWriteBack(
      writeBack({ id: "improve_mine", result: "failed", detail: "再現できませんでした" }),
    );
    const row = (
      await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_mine"))
    )[0];

    expect(response.status).toBe(200);
    expect(row.status).toBe("doing");
    expect(row.handledNote).toContain("再現できませんでした");
  });

  it("人はあとから差し戻せる（対応済みを対応中へ戻す）", async () => {
    await GET(scoped("?id=improve_mine"));
    await agentWriteBack(writeBack({ id: "improve_mine", result: "done", detail: "v53" }));

    mocked.apiViewer.mockResolvedValue(viewer("COMPANY_ADMIN"));
    const back = new Request("http://localhost/api/improvements/improve_mine", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "doing", note: "公開できていなかったので戻します" }),
    });
    const response = await PATCH(back, { params: Promise.resolve({ id: "improve_mine" }) });
    const row = (
      await testDb.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, "improve_mine"))
    )[0];

    expect(response.status).toBe(200);
    expect(row.status).toBe("doing");
  });
});
