import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { applyMasterUpdate } from "./apply-master-update";
import { MASTER_CONFLICT_MESSAGE } from "./write-batch";
import { GRADE_ASSIGNMENT_CONFLICT_MESSAGE } from "./grade-assignment-guard";

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

describe("会社全体の等級の割り当てを同時に変える", () => {
  beforeEach(async () => {
    await testDb.db.insert(s.grades).values([1, 2, 3, 4].map((order) => ({
      id: `grade_${order}`, companyId: COMPANY, code: `grade_${order}`, name: `等級${order}`,
      pointGroup: "Regular", displayOrder: order, behaviorBand: order <= 2 ? "band_a" : "band_b",
    })));
    await testDb.db.insert(s.behaviorBandSets).values([
      { id: "set_a", companyId: COMPANY, code: "band_a", name: "A", displayOrder: 1 },
      { id: "set_b", companyId: COMPANY, code: "band_b", name: "B", displayOrder: 2 },
    ]);
  });

  const assign = (id: string, behaviorBand: string) => applyMasterUpdate({
    db: testDb.db, companyId: COMPANY, viewerId: "viewer", body: { kind: "grade", id, behaviorBand },
  });

  it.each([false, true])("単独なら合法な境界変更でも同時保存は片方だけ残る（逆順=%s）", async (reverse) => {
    holdBatchesUntil(2);
    const changes = reverse
      ? [["grade_3", "band_a"], ["grade_2", "band_b"]]
      : [["grade_2", "band_b"], ["grade_3", "band_a"]];
    const results = await Promise.allSettled(changes.map(([id, band]) => assign(id, band)));

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    if (results[1].status === "rejected") {
      expect(results[1].reason).toBeInstanceOf(HttpError);
      expect(results[1].reason.status).toBe(409);
      expect(results[1].reason.message).toBe(GRADE_ASSIGNMENT_CONFLICT_MESSAGE);
    }
    const rows = await testDb.db.select().from(s.grades).where(eq(s.grades.companyId, COMPANY)).orderBy(s.grades.displayOrder);
    expect(rows.map((row) => row.behaviorBand)).toEqual(reverse
      ? ["band_a", "band_a", "band_a", "band_b"]
      : ["band_a", "band_b", "band_b", "band_b"]);
    const events = await testDb.db.select().from(s.constitutionEvents).where(eq(s.constitutionEvents.entityType, "grade"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entityId: changes[0][0], seq: 1 });
    expect(JSON.parse(events[0].afterJson!)).toEqual({ behaviorBand: changes[0][1] });
  });

  it("別等級の改名と割り当ての同時保存は両方残る", async () => {
    holdBatchesUntil(2);
    const results = await Promise.allSettled([
      applyMasterUpdate({
        db: testDb.db, companyId: COMPANY, viewerId: "viewer",
        body: { kind: "grade", id: "grade_1", name: "最初の等級" },
      }),
      assign("grade_2", "band_b"),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const rows = await testDb.db.select().from(s.grades).orderBy(s.grades.displayOrder);
    expect(rows[0].name).toBe("最初の等級");
    expect(rows.map((row) => row.behaviorBand)).toEqual(["band_a", "band_b", "band_b", "band_b"]);
    expect(await testDb.db.select().from(s.constitutionEvents)).toHaveLength(2);
  });

  it("他社の割り当てと同時保存しても両方残る", async () => {
    const otherCompany = "cmp_other";
    await testDb.db.insert(s.companies).values({ id: otherCompany, name: "別会社", slug: "other" });
    await testDb.db.insert(s.grades).values({
      id: "other_grade", companyId: otherCompany, code: "one", name: "別会社等級",
      pointGroup: "Regular", displayOrder: 1, behaviorBand: null,
    });
    await testDb.db.insert(s.behaviorBandSets).values({
      id: "other_set", companyId: otherCompany, code: "band_a", name: "別会社A", displayOrder: 1,
    });
    holdBatchesUntil(2);
    const results = await Promise.allSettled([
      applyMasterUpdate({
        db: testDb.db, companyId: otherCompany, viewerId: "viewer",
        body: { kind: "grade", id: "other_grade", behaviorBand: "band_a" },
      }),
      assign("grade_2", "band_b"),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const events = await testDb.db.select().from(s.constitutionEvents);
    expect(events.map((event) => event.companyId).sort()).toEqual([COMPANY, otherCompany].sort());
    expect((await testDb.db.select().from(s.grades).where(eq(s.grades.id, "other_grade")))[0].behaviorBand).toBe("band_a");
  });

  it.each([
    ["割り当て", "UPDATE grades SET behavior_band = NULL WHERE id = 'grade_4'"],
    ["使用状態", "UPDATE grades SET is_active = 0 WHERE id = 'grade_4'"],
    ["並び順", "UPDATE grades SET display_order = 10 WHERE id = 'grade_4'"],
    ["追加", "INSERT INTO grades (id, company_id, code, name, point_group, display_order, created_at, updated_at) VALUES ('added', 'cmp_concurrent', 'added', '追加', 'Regular', 5, 0, 0)"],
    ["削除", "DELETE FROM grades WHERE id = 'grade_4'"],
    ["同数の入れ替え", "UPDATE grades SET id = 'replaced' WHERE id = 'grade_4'"],
  ])("判定後に%sが変わったら、本体と監査を両方書かず409で止める", async (_, mutation) => {
    const original = testDb.db.batch.bind(testDb.db);
    let beforeBatch: unknown;
    vi.spyOn(testDb.db, "batch").mockImplementationOnce((async (queries: unknown) => {
      testDb.raw.exec(mutation);
      beforeBatch = testDb.raw.prepare("SELECT * FROM grades ORDER BY id").all();
      return original(queries as never);
    }) as never);

    await expect(assign("grade_2", "band_b")).rejects.toMatchObject({
      status: 409, message: GRADE_ASSIGNMENT_CONFLICT_MESSAGE,
    });
    expect(testDb.raw.prepare("SELECT * FROM grades ORDER BY id").all()).toEqual(beforeBatch);
    expect(await testDb.db.select().from(s.constitutionEvents)).toHaveLength(0);
  });

  it("同じ値の保存も、会社内の判定snapshotが変わっていたら409で止める", async () => {
    const original = testDb.db.batch.bind(testDb.db);
    vi.spyOn(testDb.db, "batch").mockImplementationOnce((async (queries: unknown) => {
      testDb.raw.exec("UPDATE grades SET behavior_band = 'band_a' WHERE id = 'grade_3'");
      return original(queries as never);
    }) as never);
    await expect(assign("grade_2", "band_a")).rejects.toMatchObject({ status: 409 });
    expect(await testDb.db.select().from(s.constitutionEvents)).toHaveLength(0);
  });

  it.each(["network error", "integer overflow in another query", "UNIQUE constraint failed: users.email"])(
    "競合guardと無関係なエラー（%s）を409へ変換しない", async (message) => {
      const failure = new Error(message);
      vi.spyOn(testDb.db, "batch").mockRejectedValueOnce(failure);
      await expect(assign("grade_2", "band_b")).rejects.toBe(failure);
      expect((await testDb.db.select().from(s.grades).where(eq(s.grades.id, "grade_2")))[0].behaviorBand).toBe("band_a");
      expect(await testDb.db.select().from(s.constitutionEvents)).toHaveLength(0);
    },
  );

  it("Workers D1のassertion原因を包んだエラーも409で返す", async () => {
    // 独立したローカル workerd の D1.batch で実測した原因チェーン。
    const failure = new Error("D1_ERROR: integer overflow: SQLITE_ERROR", {
      cause: new Error("integer overflow: SQLITE_ERROR"),
    });
    vi.spyOn(testDb.db, "batch").mockRejectedValueOnce(new Error("Failed query", { cause: failure }));
    await expect(assign("grade_2", "band_b")).rejects.toMatchObject({
      status: 409, message: GRADE_ASSIGNMENT_CONFLICT_MESSAGE,
    });
  });

  it("割り当て判定のない改名保存では、integer overflowも競合へ変換しない", async () => {
    const failure = new Error("D1_ERROR: integer overflow: SQLITE_ERROR");
    vi.spyOn(testDb.db, "batch").mockRejectedValueOnce(failure);
    await expect(applyMasterUpdate({
      db: testDb.db, companyId: COMPANY, viewerId: "viewer",
      body: { kind: "grade", id: "grade_1", name: "改名" },
    })).rejects.toBe(failure);
  });
});
