import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";

/*
 * 版の設問が、いまの計算式の変数をそろえているかを公開の前に見る（DD-016）。
 *
 * 回答を集めていない項目は聞くことを足し・消しでき、式の key も変わる。作り直していない下書きを
 * そのまま公開すると、式の key が版に無く点が付かない。公開の処理はこれを 409 で止め、直し方を返す。
 * 見本のデータで止めすぎていないことも、ここで確かめる。
 */

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: {} }) }));

import { rebuildFormQuestions, updateForm } from "@/actions/forms";
import { loadStaleAsking } from "@/lib/stale-asking-loader";

let t: TestDatabase;

afterEach(() => t.close());

describe("見本のデータ（drizzle/seed.sql）", () => {
  beforeEach(() => {
    t = createTestDatabase();
    t.raw.exec(readFileSync(join(process.cwd(), "drizzle/seed.sql"), "utf8"));
    mocked.getDb.mockReset();
    mocked.getDb.mockResolvedValue(t.db);
  });

  it("どの会社のどの版も、設問が式の変数をそろえている（公開の前の検査で止めすぎない）", async () => {
    const cycles = await t.db.select().from(s.evaluationCycles);
    const forms = await t.db.select().from(s.forms);
    const found: string[] = [];
    let checked = 0;
    for (const cycle of cycles) {
      const mine = forms.filter((f) => f.cycleId === cycle.id && f.companyId === cycle.companyId);
      // 評価セットが結び付いていない評価期間は、検査より先に評価セットの不足で止まる
      if (cycle.schemeId) checked += mine.length;
      const stale = await loadStaleAsking(cycle.companyId, cycle.schemeId, mine);
      for (const [formId, items] of stale) found.push(`${formId}: ${items.map((i) => i.name).join("・")}`);
    }
    expect(checked).toBeGreaterThan(0);
    expect(found).toEqual([]);
  });
});

describe("公開の処理（updateForm）", () => {
  const admin = {
    id: "usr_admin",
    name: "会社の管理者",
    email: "admin@example.com",
    role: "COMPANY_ADMIN",
    companyId: IDS.company,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: false,
  } as Viewer;

  const template = (id: string, kpiItemId: string, questionKey: string, text: string) => ({
    id,
    companyId: IDS.company,
    kpiItemId,
    questionKey,
    text,
    role: "direct",
  });

  const publish = () => updateForm({ formId: IDS.form, status: "published" });
  const messageOf = (result: unknown) => (result as { message?: string }).message ?? "";

  beforeEach(async () => {
    t = createTestDatabase();
    t.raw.exec("PRAGMA foreign_keys = ON");
    await seedCompany(t);
    await t.db.insert(s.users).values({ id: "usr_admin", name: "会社の管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" });
    seedMemberships(t);
    // 公開の判定は評価セットの型も見る。固定枠1つと10点枠2つで、見本の3項目がそのまま収まる型（scheme-askable-warning.test.ts と同じ）
    await t.db.insert(s.gradePointRules).values({
      id: "gpr_regular",
      companyId: IDS.company,
      pointGroup: "Regular",
      totalPoints: 40,
      fixedSlotPoints: 20,
      majorSlotPoints: 0,
      majorSlotCount: 0,
      minorSlotPoints: 10,
      minorSlotCount: 2,
    });
    await t.db.update(s.forms).set({ status: "draft" }).where(eq(s.forms.id, IDS.form));
    // 残業率（式 q3_1）は聞き方と式がそろっている。稼働率（式 q2_1 ÷ q2_2 × 100）は古い聞き方 q_h で版を作る
    await t.db.insert(s.kpiQuestions).values([
      template("kq_old", IDS.itemHigher, "q_h", "稼働時間"),
      template("kq_lower", IDS.itemLower, "q3_1", "残業時間"),
    ]);
    // 見本の行動指針には段階が無く、選択肢0の設問になる。本番と同じく段階を置く
    await t.db.insert(s.behaviorLevels).values(
      [3, 2, 1].map((score) => ({ id: `blv_${score}`, companyId: IDS.company, guidelineId: IDS.guideline, score, label: `段階${score}`, text: "説明" })),
    );
    mocked.viewer = admin;
    mocked.getDb.mockReset();
    mocked.getDb.mockResolvedValue(t.db);
    mocked.refresh.mockReset();
    expect(await rebuildFormQuestions({ formId: IDS.form })).toMatchObject({ ok: true });
  });

  async function statusOfForm() {
    const row = await t.db.select({ status: s.forms.status }).from(s.forms).where(and(eq(s.forms.id, IDS.form), eq(s.forms.companyId, IDS.company)));
    return row[0]?.status;
  }

  it("聞き方を変えたあと作り直していない下書きは公開できず、作り直すと公開できる", async () => {
    // KPI項目の画面で、稼働率の聞き方を式に合わせて決め直した（回答を集めていないので変えられる）
    await t.db.delete(s.kpiQuestions).where(eq(s.kpiQuestions.id, "kq_old"));
    await t.db.insert(s.kpiQuestions).values([
      template("kq_a", IDS.itemHigher, "q2_1", "稼働した時間"),
      template("kq_b", IDS.itemHigher, "q2_2", "稼働できた時間"),
    ]);

    const refused = await publish();
    expect(refused).toMatchObject({ ok: false });
    expect(messageOf(refused)).toContain("の設問が、いまの聞き方と合っていません。");
    expect(messageOf(refused)).toContain("いまの制度の設定から設問を作り直す");
    expect(await statusOfForm()).toBe("draft");

    expect(await rebuildFormQuestions({ formId: IDS.form })).toMatchObject({ ok: true });
    expect(await publish()).toMatchObject({ ok: true });
    expect(await statusOfForm()).toBe("published");
  });

  it("作り直しても式の変数がそろわないときは、KPI項目の画面で直すよう返す", async () => {
    // 稼働率の聞き方は q_h のまま。式は q2_1・q2_2 を使うので、作り直しても点が付かない
    const refused = await publish();
    expect(refused).toMatchObject({ ok: false });
    expect(messageOf(refused)).toContain("の計算式が、いまの聞き方と合っていません。");
    expect(messageOf(refused)).toContain("KPI項目の画面で");
    expect(await statusOfForm()).toBe("draft");
  });
});
