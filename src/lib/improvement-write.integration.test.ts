import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";
import { improvementRequestId, saveImprovementRequest } from "@/lib/improvement-write";

let current: TestDatabase;

beforeEach(async () => {
  current = createTestDatabase();
  await seedCompany(current);
});

afterEach(() => current.close());

function input(overrides: Partial<Parameters<typeof saveImprovementRequest>[1]> = {}) {
  return {
    companyId: IDS.company,
    reporterId: IDS.employee,
    submissionKey: "11111111-1111-4111-8111-111111111111",
    path: "/f/acme-secret-token",
    routePattern: "/f/[token]",
    screenLabel: "配布されたアンケート",
    kind: "usability" as const,
    body: "送信ボタンが分かりにくい",
    expected: null,
    diagnostics: null,
    viewport: "375×812",
    userAgent: "integration-test",
    shot: "data:image/png;base64,iVBORw0KGgo=",
    shotBytes: 8,
    ...overrides,
  };
}

describe("改善要望の原子保存と冪等化", () => {
  it("本文と画像を同じrequest idへ保存する", async () => {
    const id = await saveImprovementRequest(current.db, input());
    const request = await current.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, id));
    const shots = await current.db.select().from(s.improvementShots).where(eq(s.improvementShots.requestId, id));

    expect(request).toHaveLength(1);
    expect(request[0]).toMatchObject({ path: "/f/acme-secret-token", routePattern: "/f/[token]" });
    expect(shots).toHaveLength(1);
  });

  it("同じ投稿者とsubmission keyの再送は1件だけになる", async () => {
    const [first, second] = await Promise.all([
      saveImprovementRequest(current.db, input()),
      saveImprovementRequest(current.db, input()),
    ]);

    expect(first).toBe(second);
    expect(await current.db.select().from(s.improvementRequests)).toHaveLength(1);
    expect(await current.db.select().from(s.improvementShots)).toHaveLength(1);
  });

  it("同じ投稿者とsubmission keyでも会社が違えば別の要望として保存する", async () => {
    await current.db.insert(s.companies).values({ id: "cmp_other", name: "別会社", slug: "other" });

    const first = await saveImprovementRequest(current.db, input());
    const second = await saveImprovementRequest(current.db, input({ companyId: "cmp_other" }));

    expect(second).not.toBe(first);
    expect(await current.db.select().from(s.improvementRequests)).toHaveLength(2);
  });

  it("画像保存が失敗したら本文も残さない", async () => {
    current.raw.exec("CREATE TRIGGER fail_improvement_shot BEFORE INSERT ON improvement_shots BEGIN SELECT RAISE(ABORT, 'shot failed'); END");
    const id = await improvementRequestId(IDS.company, IDS.employee, input().submissionKey);

    await expect(saveImprovementRequest(current.db, input())).rejects.toThrow("shot failed");
    expect(await current.db.select().from(s.improvementRequests).where(eq(s.improvementRequests.id, id))).toHaveLength(0);
    expect(await current.db.select().from(s.improvementShots)).toHaveLength(0);
  });

  it("画像なしでも本文だけを保存できる", async () => {
    await saveImprovementRequest(current.db, input({ shot: null, shotBytes: 0 }));
    expect(await current.db.select().from(s.improvementRequests)).toHaveLength(1);
    expect(await current.db.select().from(s.improvementShots)).toHaveLength(0);
  });
});
