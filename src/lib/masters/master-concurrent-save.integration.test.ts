import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate } from "./apply-master-update";
import { MASTER_CONFLICT_MESSAGE } from "./write-batch";

/**
 * 同じ制度マスタの項目を2人が同時に保存したとき。
 *
 * どちらも「監査記録の最新番号」を読んでから書くので、そのままでは同じ番号を取り合う。
 * 番号は一意索引で守っており、本体と記録は同じ batch なので、
 * 後から書いたほうは本体の変更ごと書かれず、再読み込みを頼む 409 になる。
 * 先に保存した人の変更が黙って上書きされないこと・記録の番号が重ならないことを確かめる。
 */

let testDb: TestDatabase;
const COMPANY = "cmp_concurrent";

/** 2つの保存がそろって batch の直前まで進んでから、順に書かせる（読み→書きの間に割り込ませる）。 */
function holdBatchesUntil(count: number) {
  const original = testDb.db.batch.bind(testDb.db);
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return vi.spyOn(testDb.db, "batch").mockImplementation((async (queries: unknown) => {
    arrived += 1;
    if (arrived === count) release();
    await gate;
    return original(queries as never);
  }) as never);
}

const rename = (name: string) =>
  applyMasterUpdate({
    db: testDb.db,
    companyId: COMPANY,
    viewerId: "viewer",
    body: { kind: "kpiItemUpdate", id: "ki_1", name },
  });

beforeEach(async () => {
  testDb = createTestDatabase();
  await testDb.db.insert(s.companies).values({ id: COMPANY, name: "同時保存社", slug: "concurrent" });
  await testDb.db.insert(s.users).values({
    id: "viewer",
    name: "テスト操作者",
    email: "viewer-concurrent@example.com",
    companyId: COMPANY,
    role: "COMPANY_ADMIN",
  });
  await testDb.db.insert(s.kpiCategories).values({ id: "cat_a", companyId: COMPANY, code: "cat_a", name: "営業", displayOrder: 1 });
  await testDb.db.insert(s.kpiItems).values({
    id: "ki_1",
    companyId: COMPANY,
    no: 1,
    name: "契約件数",
    categoryId: "cat_a",
    measureType: "個人実績",
    unit: "件",
    direction: "higher",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  testDb.close();
});

describe("同じ項目を2人が同時に保存する", () => {
  it("先の保存だけが残り、後の保存は本体ごと書かれずに再読み込みを頼む", async () => {
    holdBatchesUntil(2);

    const [first, second] = await Promise.allSettled([rename("新規契約件数"), rename("既存契約件数")]);

    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    if (second.status === "rejected") {
      expect(second.reason).toBeInstanceOf(HttpError);
      expect((second.reason as HttpError).status).toBe(409);
      expect((second.reason as HttpError).message).toBe(MASTER_CONFLICT_MESSAGE);
    }

    const item = (await testDb.db.select().from(s.kpiItems).where(eq(s.kpiItems.id, "ki_1")))[0];
    expect(item.name).toBe("新規契約件数");

    const events = await testDb.db
      .select({ seq: s.constitutionEvents.seq, afterJson: s.constitutionEvents.afterJson })
      .from(s.constitutionEvents)
      .where(and(eq(s.constitutionEvents.companyId, COMPANY), eq(s.constitutionEvents.entityId, "ki_1")));
    expect(events).toHaveLength(1);
    expect(events[0].afterJson).toContain("新規契約件数");
  });

  it("時間をずらして保存すれば、番号は続きから振られ両方とも残る", async () => {
    await rename("新規契約件数");
    await rename("既存契約件数");

    const seqs = await testDb.db
      .select({ seq: s.constitutionEvents.seq })
      .from(s.constitutionEvents)
      .where(and(eq(s.constitutionEvents.companyId, COMPANY), eq(s.constitutionEvents.entityId, "ki_1")))
      .orderBy(s.constitutionEvents.seq);
    expect(seqs.map((r) => r.seq)).toEqual([1, 2]);
  });
});
