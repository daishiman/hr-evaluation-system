import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { listConstitutionEvents, recordConstitutionEvent, replayConstitutionEntity } from "./constitution-events";

/**
 * イベントストアの核心となる約束を、実際のDB（本番と同じmigration）の上で確かめる。
 *   1) 変わった列だけを保存する（丸ごとの複製は残さない）
 *   2) 記録したイベントを古い順に重ねると、現在の内容に戻る（再生できる）
 *   3) 削除イベントの後は再生結果が null になる
 *   4) 何も変わっていない更新は行を増やさない（無意味な記録をしない）
 */

let testDb: TestDatabase;
const COMPANY = "cmp_events";

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values({ id: COMPANY, name: "イベント社", slug: "events" });
  await testDb.db.insert(s.users).values({
    id: "actor_1",
    name: "操作者",
    email: "actor@example.com",
    companyId: COMPANY,
    role: "COMPANY_ADMIN",
  });
});

afterEach(() => testDb.close());

describe("recordConstitutionEvent / replayConstitutionEntity", () => {
  it("created→updated→updated の列を再生すると、現在の内容と一致する", async () => {
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "grade",
      entityId: "g_1",
      eventType: "created",
      actorId: "actor_1",
      after: { id: "g_1", name: "初期名", targetCap: 10 },
    });
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "grade",
      entityId: "g_1",
      eventType: "updated",
      actorId: "actor_1",
      before: { id: "g_1", name: "初期名", targetCap: 10 },
      after: { id: "g_1", name: "改名後", targetCap: 10 },
    });
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "grade",
      entityId: "g_1",
      eventType: "updated",
      actorId: "actor_1",
      before: { id: "g_1", name: "改名後", targetCap: 10 },
      after: { id: "g_1", name: "改名後", targetCap: 20 },
    });

    const state = await replayConstitutionEntity({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "grade",
      entityId: "g_1",
    });
    expect(state).toEqual({ id: "g_1", name: "改名後", targetCap: 20 });

    const events = await listConstitutionEvents({ db: testDb.db, companyId: COMPANY, entityId: "g_1" });
    expect(events).toHaveLength(3);
    // 2件目のupdatedは、変わった列（name）だけを持ち、変わっていないtargetCapは持たない
    const secondEvent = events.find((e) => e.seq === 2)!;
    expect(JSON.parse(secondEvent.afterJson!)).toEqual({ name: "改名後" });
  });

  it("deleted イベントの後は再生結果が null になる", async () => {
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "office",
      entityId: "o_1",
      eventType: "created",
      actorId: "actor_1",
      after: { id: "o_1", name: "本社" },
    });
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "office",
      entityId: "o_1",
      eventType: "deleted",
      actorId: "actor_1",
      before: { id: "o_1", name: "本社" },
    });

    const state = await replayConstitutionEntity({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "office",
      entityId: "o_1",
    });
    expect(state).toBeNull();
  });

  it("何も変わっていない更新はイベント行を増やさない", async () => {
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "raiseSetting",
      entityId: "r_1",
      eventType: "created",
      actorId: "actor_1",
      after: { id: "r_1", monthlyAmount: 3000 },
    });
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "raiseSetting",
      entityId: "r_1",
      eventType: "updated",
      actorId: "actor_1",
      before: { id: "r_1", monthlyAmount: 3000 },
      after: { id: "r_1", monthlyAmount: 3000 },
    });

    const events = await listConstitutionEvents({ db: testDb.db, companyId: COMPANY, entityId: "r_1" });
    expect(events).toHaveLength(1);
  });

  it("会社をまたいで参照できない（company_id で必ず絞る）", async () => {
    await testDb.db.insert(s.companies).values({ id: "cmp_other", name: "他社", slug: "other" });
    await recordConstitutionEvent({
      db: testDb.db,
      companyId: "cmp_other",
      entityType: "grade",
      entityId: "g_shared_id",
      eventType: "created",
      actorId: "actor_1",
      after: { id: "g_shared_id", name: "他社の等級" },
    });

    const state = await replayConstitutionEntity({
      db: testDb.db,
      companyId: COMPANY,
      entityType: "grade",
      entityId: "g_shared_id",
    });
    expect(state).toBeNull();
  });
});
