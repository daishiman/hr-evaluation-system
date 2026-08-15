import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 画面から発行する鍵。
 *
 * ここで確かめるのは「盗まれたときに何が起きないか」だけに絞る。
 * 生の鍵がどこにも残らないこと、止めた鍵が即座に通らなくなること、
 * そして発行できる人が限られていること。見た目の話は含めない。
 */

const ENV_KEY = "env-side-agent-key-0123456789abcdef";

const mocked = vi.hoisted(() => ({
  apiViewer: vi.fn(),
  getDb: vi.fn(),
  env: {} as Record<string, unknown>,
}));

vi.mock("@/lib/session", async () => ({
  ...(await vi.importActual<typeof import("@/lib/session")>("@/lib/session")),
  apiViewer: mocked.apiViewer,
}));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

import { DELETE, POST } from "@/app/api/agent-keys/route";
import { GET } from "@/app/api/improvements/route";

let testDb: TestDatabase;

function viewer(role: Viewer["role"] = "SUPER_ADMIN"): Viewer {
  return {
    id: "usr_super",
    name: "システム管理者",
    email: "super@example.com",
    role,
    companyId: IDS.company,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  };
}

/** 発行された生の鍵を取り出す（画面がこの1回だけ受け取るのと同じ経路）。 */
async function issue(): Promise<{ key: string; prompt: string; exportLine: string }> {
  const response = await POST();
  expect(response.status).toBe(200);
  return (await response.json()) as { key: string; prompt: string; exportLine: string };
}

/** 払い出しの入口を、その鍵で叩く。 */
function fetchWithKey(key: string | null) {
  return GET(
    new Request("http://localhost/api/improvements?id=improve_target", {
      headers: key ? { authorization: `Bearer ${key}` } : {},
    }),
  );
}

async function seedImprovement() {
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
    diagnostics: null,
  });
}

beforeEach(async () => {
  testDb = createTestDatabase();
  await seedCompany(testDb);
  await testDb.db.insert(s.users).values({
    id: "usr_super",
    name: "システム管理者",
    email: "super@example.com",
    companyId: IDS.company,
    role: "SUPER_ADMIN",
  });
  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(testDb.db);
  mocked.apiViewer.mockReset();
  mocked.apiViewer.mockResolvedValue(viewer());
  // 既定は「サーバーの設定値なし」。画面の鍵だけで判定される状態から始める。
  mocked.env = {};
  _resetRateLimitStoreForTest();
});

afterEach(() => testDb.close());

describe("鍵を発行する", () => {
  it("生の鍵は応答にだけ現れ、保管場所には残らない", async () => {
    const { key } = await issue();
    const rows = await testDb.db.select().from(s.agentApiKeys);

    expect(key.length).toBeGreaterThanOrEqual(32);
    expect(rows).toHaveLength(1);
    // 行の値をすべて文字にして、鍵の全文が混ざっていないことを見る
    expect(JSON.stringify(rows)).not.toContain(key);
    expect(rows[0].keyHash).not.toBe(key);
    expect(rows[0].keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("あとから読み出す道がない（記録に出るのは先頭数文字まで）", async () => {
    const { key } = await issue();
    const { listAgentKeys } = await import("@/lib/agent-keys");
    const shown = await listAgentKeys();

    expect(shown).toHaveLength(1);
    expect(JSON.stringify(shown)).not.toContain(key);
    expect(key.startsWith(shown[0].keyPrefix)).toBe(true);
    expect(shown[0].keyPrefix.length).toBeLessThan(key.length / 2);
  });

  it("誰がいつ発行したかは残るが、鍵そのものは残らない", async () => {
    const { key } = await issue();
    const row = (await testDb.db.select().from(s.agentApiKeys))[0];

    expect(row.createdById).toBe("usr_super");
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.keyPrefix).not.toBe(key);
  });

  it("その場で使える文言にだけ鍵が入り、記録には入らない", async () => {
    const { key, prompt, exportLine } = await issue();

    expect(prompt).toContain(key);
    expect(exportLine).toContain(key);
    expect(JSON.stringify(await testDb.db.select().from(s.agentApiKeys))).not.toContain(key);
  });
});

describe("発行できる人", () => {
  it("システム全体管理者以外は発行できない（画面で隠すだけにしない）", async () => {
    const { HttpError } = await import("@/lib/session");
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));

    expect((await POST()).status).toBe(403);
    expect((await DELETE()).status).toBe(403);
    expect(await testDb.db.select().from(s.agentApiKeys)).toHaveLength(0);
  });

  it("止める鍵が無いのに押されたら、黙って成功にしない", async () => {
    const response = await DELETE();
    expect(response.status).toBe(400);
    expect(await testDb.db.select().from(s.agentApiKeys)).toHaveLength(0);
  });
});

describe("止めた鍵・作り直した鍵", () => {
  it("発行した鍵で払い出しが通る", async () => {
    await seedImprovement();
    const { key } = await issue();

    const response = await fetchWithKey(key);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("保存できません");
  });

  it("失効させたら、同じ鍵では中身が1文字も返らない", async () => {
    await seedImprovement();
    const { key } = await issue();
    expect((await DELETE()).status).toBe(200);
    _resetRateLimitStoreForTest();

    const response = await fetchWithKey(key);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain("保存できません");
  });

  it("作り直したら、前の鍵はその場で通らなくなる", async () => {
    await seedImprovement();
    const first = await issue();
    const second = await issue();
    expect(second.key).not.toBe(first.key);
    _resetRateLimitStoreForTest();

    const old = await fetchWithKey(first.key);
    expect(old.status).toBe(401);
    expect(await old.text()).not.toContain("保存できません");
    _resetRateLimitStoreForTest();
    expect((await fetchWithKey(second.key)).status).toBe(200);
  });

  it("止めた記録は消さずに積む（いつ誰が止めたかを追える）", async () => {
    await issue();
    await issue();
    const rows = await testDb.db.select().from(s.agentApiKeys);

    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    expect(rows.find((r) => r.revokedAt !== null)?.revokedById).toBe("usr_super");
  });

  it("使われた時刻が控えられる（配ったのに届いていない、に気づける）", async () => {
    await seedImprovement();
    const { key } = await issue();
    expect((await testDb.db.select().from(s.agentApiKeys))[0].lastUsedAt).toBeNull();

    await fetchWithKey(key);
    expect((await testDb.db.select().from(s.agentApiKeys))[0].lastUsedAt).toBeInstanceOf(Date);
  });
});

describe("2つの置き場所", () => {
  it("サーバーの設定値の鍵でも、画面で発行した鍵でも通る", async () => {
    await seedImprovement();
    mocked.env = { AGENT_API_KEY: ENV_KEY };
    const { key } = await issue();

    expect((await fetchWithKey(ENV_KEY)).status).toBe(200);
    _resetRateLimitStoreForTest();
    expect((await fetchWithKey(key)).status).toBe(200);
  });

  it("画面の鍵を止めても、サーバーの設定値が残っていれば止まらない", async () => {
    await seedImprovement();
    mocked.env = { AGENT_API_KEY: ENV_KEY };
    const { key } = await issue();
    await DELETE();
    _resetRateLimitStoreForTest();

    expect((await fetchWithKey(key)).status).toBe(401);
    _resetRateLimitStoreForTest();
    expect((await fetchWithKey(ENV_KEY)).status).toBe(200);
  });

  it("どちらも無ければ、中身の代わりに発行できる場所を案内する", async () => {
    await seedImprovement();
    const response = await fetchWithKey("any-key-0123456789abcdefghijklmn");
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).not.toContain("保存できません");
    expect(text).toContain("/system/agent-keys");
  });
});
