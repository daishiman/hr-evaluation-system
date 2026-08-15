import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * ブラウザで承認して端末を通す仕組み。
 *
 * ここで確かめるのは「承認していないのに通ってしまわないか」だけに絞る。
 * 承認前は何も渡らない・引き取りは1回だけ・会社は承認した人の会社に
 * 焼き付く・止めた端末は即座に通らない。見た目や文言の話は含めない。
 */

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

import { POST as startDevice, PUT as redeemDevice } from "@/app/api/agent/device/route";
import { POST as exchangeToken } from "@/app/api/agent/token/route";
import { DELETE as stopSession, POST as decide } from "@/app/api/agent-keys/approve/route";
import { GET as readImprovements } from "@/app/api/improvements/route";
import { formatUserCode } from "@/lib/domain/agent-device";

let testDb: TestDatabase;

const OTHER_COMPANY = "cmp_other";

function viewer(role: Viewer["role"] = "SUPER_ADMIN", companyId: string | null = IDS.company): Viewer {
  return {
    id: "usr_super",
    name: "システム管理者",
    email: "super@example.com",
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

/** 承認待ちを1件作る（台本が最初に呼ぶのと同じ経路）。 */
async function start(label = "開発機") {
  const res = await startDevice(
    new Request("http://localhost/api/agent/device", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { userCode: string; deviceCode: string; instructions: string };
}

/** 引き取りを試す。承認前も断りも 200 で返り、state で見分ける。 */
async function redeem(deviceCode: string) {
  const res = await redeemDevice(
    new Request("http://localhost/api/agent/device", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode }),
    }),
  );
  return (await res.json()) as {
    state: string;
    accessToken?: string;
    refreshToken?: string;
    message?: string;
  };
}

/** 画面の「通す／通さない」を押すのと同じ経路。 */
function decideCode(userCode: string, approve: boolean) {
  return decide(
    new Request("http://localhost/api/agent-keys/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode, approve }),
    }),
  );
}

/** 通行証で改善要望を読みにいく。 */
function fetchWith(token: string | null) {
  return readImprovements(
    new Request("http://localhost/api/improvements?id=improve_here", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );
}

/** 承認まで済ませて、通行証を引き取った状態にする。 */
async function approvedTokens(label = "開発機") {
  const grant = await start(label);
  expect((await decideCode(grant.userCode, true)).status).toBe(200);
  const taken = await redeem(grant.deviceCode);
  expect(taken.state).toBe("approved");
  return { grant, access: taken.accessToken!, refresh: taken.refreshToken! };
}

async function seedImprovement(id: string, companyId: string) {
  await testDb.db.insert(s.improvementRequests).values({
    id,
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
    diagnostics: null,
  });
}

beforeEach(async () => {
  testDb = createTestDatabase();
  await seedCompany(testDb);
  await testDb.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "よその会社", slug: "other" });
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
  mocked.env = {};
  _resetRateLimitStoreForTest();
});

afterEach(() => testDb.close());

describe("承認を待つ", () => {
  it("合言葉は画面に出し、長い方は保管場所に残さない", async () => {
    const grant = await start();
    const rows = await testDb.db.select().from(s.agentDeviceGrants);

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(grant.deviceCode);
    expect(rows[0].deviceCodeHash).toMatch(/^[0-9a-f]{64}$/);
    // 案内に出るのは合言葉だけ。長い方は台本の中だけに置く。
    expect(grant.instructions).toContain(formatUserCode(grant.userCode));
    expect(grant.instructions).not.toContain(grant.deviceCode);
    // 開く場所は、いま話している相手そのもの（設定値の本番URLではない）。
    // ここが本番を指すと、ローカルで確かめている人を合言葉の無い場所へ送る。
    expect(grant.instructions).toContain("http://localhost/system/agent-keys");
  });

  it("承認されるまでは通行証を渡さない", async () => {
    const grant = await start();
    const result = await redeem(grant.deviceCode);

    expect(result.state).toBe("pending");
    expect(result.accessToken).toBeUndefined();
    expect(await testDb.db.select().from(s.agentSessions)).toHaveLength(0);
  });

  it("断られた合言葉では、あとから承認しても通らない", async () => {
    const grant = await start();
    expect((await decideCode(grant.userCode, false)).status).toBe(200);
    expect((await decideCode(grant.userCode, true)).status).toBe(400);
    expect((await redeem(grant.deviceCode)).state).toBe("denied");
  });

  it("時間切れの合言葉では通らない", async () => {
    const grant = await start();
    await testDb.db.update(s.agentDeviceGrants).set({ expiresAt: new Date(Date.now() - 1) });
    expect((await redeem(grant.deviceCode)).state).toBe("expired");
  });

  it("知らない長い文字列は、当てにきても手がかりを返さない", async () => {
    const result = await redeem("device-code-that-never-existed");
    expect(result.state).toBe("expired");
  });

  it("通せるのはシステム全体管理者だけ（画面で隠すだけにしない）", async () => {
    const grant = await start();
    const { HttpError } = await import("@/lib/session");
    mocked.apiViewer.mockRejectedValue(new HttpError(403, "権限がありません。"));

    expect((await decideCode(grant.userCode, true)).status).toBe(403);
    expect((await redeem(grant.deviceCode)).state).toBe("pending");
  });
});

describe("通行証を引き取る", () => {
  it("引き取れるのは1回だけ", async () => {
    const { grant } = await approvedTokens();
    const second = await redeem(grant.deviceCode);

    expect(second.state).toBe("taken");
    expect(second.refreshToken).toBeUndefined();
    expect(await testDb.db.select().from(s.agentSessions)).toHaveLength(1);
  });

  it("保管場所に平文は残らない", async () => {
    const { access, refresh } = await approvedTokens();
    const rows = JSON.stringify(await testDb.db.select().from(s.agentSessions));

    expect(rows).not.toContain(access);
    expect(rows).not.toContain(refresh);
  });

  it("会社は承認した人の会社が焼き付く", async () => {
    await approvedTokens();
    const row = (await testDb.db.select().from(s.agentSessions))[0];
    expect(row.companyId).toBe(IDS.company);
  });
});

describe("通行証で読む", () => {
  it("焼き付いた会社の要望だけが読める", async () => {
    await seedImprovement("improve_here", IDS.company);
    const { access } = await approvedTokens();

    expect((await fetchWith(access)).status).toBe(200);

    // よその会社の要望に付け替えると、同じ通行証では中身が返らなくなる。
    // 「見つかりません」と「他社のものです」は言い分けない（IDを当てる手がかりにさせない）。
    await testDb.db.update(s.improvementRequests).set({ companyId: OTHER_COMPANY });
    const denied = await fetchWith(access);
    const body = await denied.text();
    expect(body).toContain("見つかりません");
    expect(body).not.toContain("保存できません");
  });

  it("期限が切れた短い方は通らない", async () => {
    await seedImprovement("improve_here", IDS.company);
    const { access } = await approvedTokens();
    await testDb.db.update(s.agentSessions).set({ accessExpiresAt: new Date(Date.now() - 1) });

    expect((await fetchWith(access)).status).toBe(401);
  });

  it("長い方で短い方を取り直せる（長い方は作り替えない）", async () => {
    await seedImprovement("improve_here", IDS.company);
    const { refresh } = await approvedTokens();
    await testDb.db.update(s.agentSessions).set({ accessExpiresAt: new Date(Date.now() - 1) });

    const res = await exchangeToken(
      new Request("http://localhost/api/agent/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      }),
    );
    expect(res.status).toBe(200);
    const issued = (await res.json()) as { accessToken: string };
    expect((await fetchWith(issued.accessToken)).status).toBe(200);
  });

  it("止めた端末は、その場で読めなくなる", async () => {
    await seedImprovement("improve_here", IDS.company);
    const { access, refresh } = await approvedTokens();
    const id = (await testDb.db.select().from(s.agentSessions))[0].id;

    const stopped = await stopSession(
      new Request(`http://localhost/api/agent-keys/approve?id=${id}`, { method: "DELETE" }),
    );
    expect(stopped.status).toBe(200);
    expect((await fetchWith(access)).status).toBe(401);

    // 取り直しの道も同時に閉じる（片方だけ閉じても止めたことにならない）
    const retry = await exchangeToken(
      new Request("http://localhost/api/agent/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      }),
    );
    expect(retry.status).toBe(401);
  });
});
