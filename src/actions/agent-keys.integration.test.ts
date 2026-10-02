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
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
}));

// Server Action は成功すると画面を描き直す（refresh）。テストでは呼ばれたかだけを見る。
vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

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

import { createAgentKey, revokeAgentKey, setAgentEnvKey } from "@/actions/agent-keys";
import { GET } from "@/app/api/improvements/route";
import { AGENT_KEY_MAX } from "@/lib/domain/agent-keys";

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
async function issue(label = "自宅の Claude Code"): Promise<{ key: string; prompt: string; envFileLine: string }> {
  const result = await createAgentKey({ label });
  if (!result.ok) throw new Error(`発行できませんでした: ${result.message}`);
  return result;
}

/** 鍵を1本だけ止める。id は画面の一覧から渡されるのと同じ形。 */
function revoke(id: string) {
  return revokeAgentKey({ id });
}

/** 設定値の鍵を受け付けるかを切り替える。 */
function setEnv(enabled: boolean) {
  return setAgentEnvKey({ envKeyEnabled: enabled });
}

/** いま使える鍵のID（新しい順）。 */
async function activeIds(): Promise<string[]> {
  const rows = await testDb.db.select().from(s.agentApiKeys);
  return rows.filter((r) => r.revokedAt === null).map((r) => r.id);
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
  mocked.refresh.mockReset();
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
    // 発行できたら、一覧が新しくなるよう画面を描き直す
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
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
    const { key, prompt, envFileLine } = await issue();

    expect(prompt).toContain(key);
    expect(envFileLine).toContain(key);
    expect(JSON.stringify(await testDb.db.select().from(s.agentApiKeys))).not.toContain(key);
  });
});

describe("発行できる人", () => {
  it("システム全体管理者以外は発行できない（画面で隠すだけにしない）", async () => {
    const { HttpError } = await import("@/lib/session");
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));

    for (const result of [await createAgentKey({ label: "社内PC" }), await revoke("agkey_none"), await setEnv(false)]) {
      expect(result).toEqual({ ok: false, message: "権限がありません。" });
    }
    expect(await testDb.db.select().from(s.agentApiKeys)).toHaveLength(0);
    // 断ったときは画面を描き直さない
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("役割の確認は、入力を読むより先に行う（不正な形でも権限の言葉で断る）", async () => {
    const { HttpError } = await import("@/lib/session");
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));

    expect(await createAgentKey({ label: 1 })).toEqual({ ok: false, message: "権限がありません。" });
    expect(mocked.apiViewer).toHaveBeenCalledWith("SUPER_ADMIN");
  });

  it("止める鍵が選ばれていなければ、黙って成功にしない", async () => {
    expect(await revoke("")).toEqual({ ok: false, message: "止める鍵が選ばれていません。" });
    expect(await testDb.db.select().from(s.agentApiKeys)).toHaveLength(0);
  });

  it("すでに止まっている鍵を押しても、成功にしない", async () => {
    await issue();
    const [id] = await activeIds();
    expect((await revoke(id)).ok).toBe(true);
    expect(await revoke(id)).toEqual({ ok: false, message: "この鍵はすでに止まっています。" });
  });

  it("用途の名前が無いままでは発行できない", async () => {
    const result = await createAgentKey({ label: "   " });
    expect(result.ok).toBe(false);
    expect(result.message).not.toBe("");
    expect(await testDb.db.select().from(s.agentApiKeys)).toHaveLength(0);
  });
});

describe("鍵は複数本を同時に使える", () => {
  it("発行した鍵で払い出しが通る", async () => {
    await seedImprovement();
    const { key } = await issue();

    const response = await fetchWithKey(key);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("保存できません");
  });

  it("1本止めても、他の鍵は動き続ける", async () => {
    await seedImprovement();
    const home = await issue("自宅の Claude Code");
    const office = await issue("社内PC");
    expect(office.key).not.toBe(home.key);
    // 発行しただけでは他の鍵は止まらない
    expect(await activeIds()).toHaveLength(2);

    const rows = await testDb.db.select().from(s.agentApiKeys);
    const homeId = rows.find((r) => r.label === "自宅の Claude Code")!.id;
    expect((await revoke(homeId)).ok).toBe(true);
    _resetRateLimitStoreForTest();

    const stopped = await fetchWithKey(home.key);
    expect(stopped.status).toBe(401);
    expect(await stopped.text()).not.toContain("保存できません");
    _resetRateLimitStoreForTest();
    expect((await fetchWithKey(office.key)).status).toBe(200);
  });

  it("上限を超えては発行できない", async () => {
    for (let i = 0; i < AGENT_KEY_MAX; i += 1) await issue(`端末${i}`);
    expect(await activeIds()).toHaveLength(AGENT_KEY_MAX);

    const over = await createAgentKey({ label: "あふれる分" });
    expect(over.ok).toBe(false);
    expect(await activeIds()).toHaveLength(AGENT_KEY_MAX);

    // 1本止めれば、また発行できる
    const [id] = await activeIds();
    await revoke(id);
    expect((await createAgentKey({ label: "入れ替えた端末" })).ok).toBe(true);
    expect(await activeIds()).toHaveLength(AGENT_KEY_MAX);
  });

  it("止めた記録は消さずに積む（いつ誰が止めたかを追える）", async () => {
    await issue("1本目");
    await issue("2本目");
    const [id] = await activeIds();
    await revoke(id);
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
    const [id] = await activeIds();
    await revoke(id);
    _resetRateLimitStoreForTest();

    expect((await fetchWithKey(key)).status).toBe(401);
    _resetRateLimitStoreForTest();
    expect((await fetchWithKey(ENV_KEY)).status).toBe(200);
  });

  /* v51 の残課題。上の1件が「止めたはずなのに受け取れる」の形。
     画面だけで完全に止められる道を用意し、取り消しもできるようにした。 */
  it("設定値の鍵は、画面から受け付けを止められる", async () => {
    await seedImprovement();
    mocked.env = { AGENT_API_KEY: ENV_KEY };
    expect((await setEnv(false)).ok).toBe(true);
    _resetRateLimitStoreForTest();

    const stopped = await fetchWithKey(ENV_KEY);
    expect(stopped.status).toBe(503);
    expect(await stopped.text()).not.toContain("保存できません");
  });

  it("設定値を止めても、画面の鍵は通り続ける", async () => {
    await seedImprovement();
    mocked.env = { AGENT_API_KEY: ENV_KEY };
    const { key } = await issue();
    await setEnv(false);
    _resetRateLimitStoreForTest();

    expect((await fetchWithKey(key)).status).toBe(200);
  });

  it("止めた設定値は、画面から元に戻せる", async () => {
    await seedImprovement();
    mocked.env = { AGENT_API_KEY: ENV_KEY };
    await setEnv(false);
    expect((await setEnv(true)).ok).toBe(true);
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
