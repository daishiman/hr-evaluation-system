import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/**
 * 「基準を直したのに、集計し直していない評価」の見つけ方を、本物の保管場所で確かめる。
 *
 * これは日時の大小だけで決まる判定なので、境目（同時刻・1ミリ秒差）で
 * 出たり出なかったりする。実際に行を入れて、境目の挙動を固定する。
 */

let current: TestDatabase;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: async () => (globalThis as { __testDb?: unknown }).__testDb };
});

const { listMasterChanges, detectStaleCycles, isEvaluationStale } = await import("@/lib/impact");

const T = (iso: string) => new Date(iso);
const OLD = T("2026-01-01T00:00:00Z");
const NEW = T("2026-06-01T00:00:00Z");

/** 判定に効くマスタ（src/lib/impact.ts の WATCHED と同じ並び） */
const WATCHED_TABLES = [
  "kpi_rank_criteria",
  "scheme_items",
  "scheme_rank_ratios",
  "promotion_thresholds",
  "kpi_items",
  "grade_requirements",
  "promotion_requirements",
  "kgi_coefficients",
];

/** 下ごしらえで入った行の更新時刻をそろえ、「いつ変えたか」を試験の側で決められるようにする。 */
function resetMasterTimestamps(at: Date) {
  for (const t of WATCHED_TABLES) {
    current.raw.prepare(`update ${t} set updated_at = ?`).run(at.getTime());
  }
}

/** 更新時刻を持つマスタを空にする（何も変わっていない状態を作る）。 */
function clearMasters() {
  // 参照関係の順番はここでの関心事ではないので、消す間だけ外す
  current.raw.exec("PRAGMA foreign_keys = OFF");
  for (const t of [...WATCHED_TABLES].reverse()) {
    current.raw.prepare(`delete from ${t}`).run();
  }
  current.raw.exec("PRAGMA foreign_keys = ON");
}

beforeEach(async () => {
  current = createTestDatabase();
  (globalThis as { __testDb?: unknown }).__testDb = current.db;
  await seedCompany(current);
  resetMasterTimestamps(OLD);
});

afterEach(() => {
  current.close();
  delete (globalThis as { __testDb?: unknown }).__testDb;
});

/** 評価を1件、指定した「集計した時刻」で作る。 */
async function putEvaluation(opts: {
  id?: string;
  computedAt: Date | null;
  status?: string;
  cycleId?: string;
  employeeId?: string;
}) {
  await current.db.insert(s.evaluations).values({
    id: opts.id ?? "ev_1",
    companyId: IDS.company,
    cycleId: opts.cycleId ?? IDS.cycle,
    employeeId: opts.employeeId ?? IDS.employee,
    gradeId: IDS.gradeFrom,
    schemeId: IDS.scheme,
    totalScore: 100,
    maxScore: 100,
    computedAt: opts.computedAt,
    status: opts.status ?? "draft",
  });
  return opts.id ?? "ev_1";
}

/** ランク基準の更新時刻を指定の時刻に書き換える。 */
async function touchCriteria(at: Date) {
  current.raw
    .prepare("update kpi_rank_criteria set updated_at = ?")
    .run(at.getTime());
}

describe("基準の変更と、集計し直しの必要性", () => {
  it("変更された基準を、新しい順に返す", async () => {
    await touchCriteria(NEW);
    const changes = await listMasterChanges(IDS.company);
    expect(changes[0].label).toBe("KPIのランク基準（A〜Eの線引き）");
    expect(changes[0].updatedAt.getTime()).toBe(NEW.getTime());
    // 新しい順に並ぶ
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i - 1].updatedAt.getTime()).toBeGreaterThanOrEqual(changes[i].updatedAt.getTime());
    }
  });

  it("会社が違う基準の変更は拾わない", async () => {
    await touchCriteria(NEW);
    expect(await listMasterChanges("cmp_other")).toEqual([]);
  });

  describe("集計した時刻と基準の更新時刻の境目", () => {
    it("基準のほうが1ミリ秒でも新しければ、集計し直しの対象になる", async () => {
      await touchCriteria(NEW);
      const id = await putEvaluation({ computedAt: new Date(NEW.getTime() - 1) });
      const stale = await detectStaleCycles(IDS.company);
      expect(stale).toHaveLength(1);
      expect(stale[0].recomputable).toBe(1);
      expect(await isEvaluationStale(IDS.company, id)).toBe(true);
    });

    it("同じ時刻ちょうどなら、最新の基準で計算済みとみなす", async () => {
      await touchCriteria(NEW);
      const id = await putEvaluation({ computedAt: NEW });
      expect(await detectStaleCycles(IDS.company)).toEqual([]);
      expect(await isEvaluationStale(IDS.company, id)).toBe(false);
    });

    it("集計のほうが1ミリ秒新しければ対象にならない", async () => {
      await touchCriteria(NEW);
      const id = await putEvaluation({ computedAt: new Date(NEW.getTime() + 1) });
      expect(await detectStaleCycles(IDS.company)).toEqual([]);
      expect(await isEvaluationStale(IDS.company, id)).toBe(false);
    });

    it("いつ集計したか分からない評価は、集計し直しの対象になる", async () => {
      await touchCriteria(NEW);
      const id = await putEvaluation({ computedAt: null });
      const stale = await detectStaleCycles(IDS.company);
      expect(stale[0].recomputable).toBe(1);
      expect(stale[0].lastComputedAt).toBeNull();
      expect(await isEvaluationStale(IDS.company, id)).toBe(true);
    });
  });

  it("確定済みの評価は、件数だけ数えて集計し直さない", async () => {
    await touchCriteria(NEW);
    const id = await putEvaluation({ computedAt: OLD, status: "finalized" });
    const stale = await detectStaleCycles(IDS.company);
    expect(stale[0].finalized).toBe(1);
    expect(stale[0].recomputable).toBe(0);
    // 確定済みは、個人ページに再集計ボタンを出さない
    expect(await isEvaluationStale(IDS.company, id)).toBe(false);
  });

  it("サイクル名と状態を添えて返す", async () => {
    await touchCriteria(NEW);
    await putEvaluation({ computedAt: OLD });
    const stale = await detectStaleCycles(IDS.company);
    expect(stale[0]).toMatchObject({
      cycleId: IDS.cycle,
      cycleName: "2026年度上期",
      cycleStatus: "open",
    });
    expect(stale[0].changed.map((c) => c.label)).toContain("KPIのランク基準（A〜Eの線引き）");
  });

  it("基準が1件も変わっていなければ、集計し直しは要らない", async () => {
    clearMasters();
    expect(await listMasterChanges(IDS.company)).toEqual([]);
    expect(await detectStaleCycles(IDS.company)).toEqual([]);
  });

  it("評価そのものが無ければ、集計し直しの案内は出ない", async () => {
    await touchCriteria(NEW);
    expect(await detectStaleCycles(IDS.company)).toEqual([]);
  });

  it("存在しない評価IDを聞かれても、古いとは言わない", async () => {
    await touchCriteria(NEW);
    expect(await isEvaluationStale(IDS.company, "ev_none")).toBe(false);
  });

  describe("複数の評価・複数のサイクルがある場合", () => {
    it("同じサイクルの中では、いちばん新しい集計時刻を代表にする", async () => {
      await touchCriteria(NEW);
      const early = new Date(NEW.getTime() - 10_000);
      const late = new Date(NEW.getTime() - 1_000);
      await putEvaluation({ id: "ev_late", computedAt: late });
      await putEvaluation({ id: "ev_early", computedAt: early, employeeId: IDS.evaluator });
      const stale = await detectStaleCycles(IDS.company);
      expect(stale).toHaveLength(1);
      expect(stale[0].recomputable).toBe(2);
      expect(stale[0].lastComputedAt?.getTime()).toBe(late.getTime());
    });

    it("集計時刻が新しいサイクルから順に並べる（時刻不明は最後）", async () => {
      await touchCriteria(NEW);
      await current.db.insert(s.evaluationCycles).values({
        id: "cyc_2",
        companyId: IDS.company,
        name: "2025年度下期",
        periodStart: "2025-10-01",
        periodEnd: "2026-03-31",
        status: "closed",
        schemeId: IDS.scheme,
      });
      await putEvaluation({ id: "ev_a", computedAt: OLD });
      await putEvaluation({ id: "ev_b", computedAt: null, cycleId: "cyc_2" });
      await current.db.insert(s.evaluationCycles).values({
        id: "cyc_3",
        companyId: IDS.company,
        name: "2025年度上期",
        periodStart: "2025-04-01",
        periodEnd: "2025-09-30",
        status: "closed",
        schemeId: IDS.scheme,
      });
      await putEvaluation({ id: "ev_c", computedAt: null, cycleId: "cyc_3" });
      const stale = await detectStaleCycles(IDS.company);
      expect(stale[0].cycleId).toBe(IDS.cycle);
      // 集計時刻が分からないサイクル同士は、順番を入れ替えない
      expect(stale.map((x) => x.cycleId).slice(1).sort()).toEqual(["cyc_2", "cyc_3"]);
      expect(stale[1].lastComputedAt).toBeNull();
      // 集計時刻が分からないサイクルには、変わった基準をすべて添える
      expect(stale[1].changed.length).toBeGreaterThan(0);
    });

    it("サイクルの行が見当たらない評価でも、名前と状態を埋めて画面に出す", async () => {
      await touchCriteria(NEW);
      // 参照先が失われた行の再現。ここでの関心は「画面が落ちないこと」だけ
      current.raw.exec("PRAGMA foreign_keys = OFF");
      current.raw
        .prepare(
          "insert into evaluations (id, company_id, cycle_id, employee_id, grade_id, scheme_id, total_score, max_score, computed_at, status, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          "ev_orphan",
          IDS.company,
          "cyc_missing",
          IDS.employee,
          IDS.gradeFrom,
          IDS.scheme,
          0,
          100,
          OLD.getTime(),
          "draft",
          OLD.getTime(),
          OLD.getTime(),
        );
      current.raw.exec("PRAGMA foreign_keys = ON");
      const stale = await detectStaleCycles(IDS.company);
      expect(stale[0]).toMatchObject({
        cycleId: "cyc_missing",
        cycleName: "（名称なし）",
        cycleStatus: "draft",
      });
    });
  });

  it("基準が1件も変わっていなければ、個別の評価も古いとは言わない", async () => {
    const id = await putEvaluation({ computedAt: null });
    clearMasters();
    expect(await listMasterChanges(IDS.company)).toEqual([]);
    expect(await isEvaluationStale(IDS.company, id)).toBe(false);
  });
});
