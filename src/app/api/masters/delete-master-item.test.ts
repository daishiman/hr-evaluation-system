import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { deleteMasterItem } from "./delete-master-item";

/**
 * 「完全に消す」を、本物のデータの上で動かして確かめる。
 *
 * ここで守りたい約束はひとつだけ:
 *   **公開したアンケートと確定済みの評価は、削除によって1文字も変わらない。**
 * そのため「一度でも使ったものは消せない」を、画面ではなくこの層で固定する。
 */

let sqlite: DatabaseSync;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

/** この機能が触る表だけの最小の写し（列は本物と同じ名前にする）。 */
const CREATE = `
  CREATE TABLE behavior_band_sets (
    id text PRIMARY KEY, company_id text NOT NULL, code text NOT NULL, name text NOT NULL,
    display_order integer NOT NULL DEFAULT 1, is_active integer NOT NULL DEFAULT 1,
    created_at text, updated_at text
  );
  CREATE TABLE behavior_guidelines (
    id text PRIMARY KEY, company_id text NOT NULL, band text NOT NULL, aspect text NOT NULL,
    aspect_name text NOT NULL, seq integer NOT NULL, is_active integer NOT NULL DEFAULT 1,
    created_at text, updated_at text
  );
  CREATE TABLE behavior_levels (
    id text PRIMARY KEY, company_id text NOT NULL, guideline_id text NOT NULL,
    score integer NOT NULL, label text NOT NULL, text text NOT NULL, created_at text, updated_at text
  );
  CREATE TABLE grades (id text PRIMARY KEY, company_id text NOT NULL, name text NOT NULL, behavior_band text);
  CREATE TABLE grade_requirements (
    id text PRIMARY KEY, company_id text NOT NULL, grade_id text NOT NULL, category text NOT NULL,
    seq integer NOT NULL DEFAULT 1, text text NOT NULL, is_active integer NOT NULL DEFAULT 1,
    created_at text, updated_at text
  );
  CREATE TABLE promotion_requirements (
    id text PRIMARY KEY, company_id text NOT NULL, grade_id text NOT NULL, kind text NOT NULL,
    transition_label text, seq integer NOT NULL DEFAULT 1, text text NOT NULL,
    is_gate integer NOT NULL DEFAULT 1, is_active integer NOT NULL DEFAULT 1, created_at text, updated_at text
  );
  CREATE TABLE forms (id text PRIMARY KEY, company_id text NOT NULL, title text NOT NULL, status text NOT NULL DEFAULT 'published');
  CREATE TABLE form_questions (
    id text PRIMARY KEY, company_id text NOT NULL, form_id text NOT NULL, title text NOT NULL DEFAULT '',
    grade_requirement_id text, promotion_requirement_id text, behavior_guideline_id text
  );
  CREATE TABLE evaluation_behaviors (
    id text PRIMARY KEY, company_id text NOT NULL, evaluation_id text NOT NULL, guideline_id text,
    aspect text NOT NULL DEFAULT '', aspect_name text NOT NULL DEFAULT '', score real NOT NULL DEFAULT 0
  );
  CREATE TABLE evaluation_requirements (
    id text PRIMARY KEY, company_id text NOT NULL, evaluation_id text NOT NULL, grade_requirement_id text,
    category text NOT NULL DEFAULT 'support', text text NOT NULL DEFAULT '', achieved integer NOT NULL DEFAULT 0
  );
  CREATE TABLE evaluation_gates (
    id text PRIMARY KEY, company_id text NOT NULL, evaluation_id text NOT NULL, promotion_requirement_id text,
    kind text NOT NULL DEFAULT 'report', text text NOT NULL DEFAULT '', achieved integer NOT NULL DEFAULT 0
  );
`;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(CREATE);
  db = drizzle(
    async (sql: string, params: unknown[], method: string) => {
      const statement = sqlite.prepare(sql);
      if (method === "run") {
        statement.run(...(params as never[]));
        return { rows: [] };
      }
      const rows = statement.all(...(params as never[])).map((row) => Object.values(row));
      return method === "get" ? { rows: rows[0] ?? [] } : { rows };
    },
    { schema },
  );
});

/** A社に「行動指針の基準セット1つ・観点1つ・5段階1つ」を用意する。 */
function seedBandSet() {
  sqlite.exec(`
    INSERT INTO behavior_band_sets (id, company_id, code, name) VALUES ('bbs_a', 'cmp_a', 'band_a', 'Manager向け');
    INSERT INTO behavior_guidelines (id, company_id, band, aspect, aspect_name, seq)
      VALUES ('bg_a', 'cmp_a', 'band_a', 'aspect_a', '創造性について', 1);
    INSERT INTO behavior_levels (id, company_id, guideline_id, score, label, text)
      VALUES ('blv_a', 'cmp_a', 'bg_a', 3, '模範', '手本になっている');
  `);
}

/** すでに公開したアンケートと、確定済みの評価がその観点を指している状態にする。 */
function seedPastRecords() {
  sqlite.exec(`
    INSERT INTO forms (id, company_id, title) VALUES ('f_1', 'cmp_a', '2026年上期（Beginner）');
    INSERT INTO form_questions (id, company_id, form_id, title, behavior_guideline_id)
      VALUES ('fq_1', 'cmp_a', 'f_1', '創造性について', 'bg_a');
    INSERT INTO evaluation_behaviors (id, company_id, evaluation_id, guideline_id, aspect_name, score)
      VALUES ('eb_1', 'cmp_a', 'ev_1', 'bg_a', '創造性について', 3);
  `);
}

const rows = (sql: string) => sqlite.prepare(sql).all();

describe("制度設定の項目を完全に消す", () => {
  it("一度も使っていない観点は消せる（5段階の文章も一緒に消える）", async () => {
    seedBandSet();

    const result = await deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorGuideline", id: "bg_a" } });

    expect(result.message).toContain("創造性について");
    expect(rows("SELECT id FROM behavior_guidelines")).toEqual([]);
    expect(rows("SELECT id FROM behavior_levels")).toEqual([]);
  });

  it("公開したアンケートで使っている観点は消せず、理由と次にすることを返す", async () => {
    seedBandSet();
    seedPastRecords();

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorGuideline", id: "bg_a" } }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("アンケート「2026年上期（Beginner）」"),
    });
    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorGuideline", id: "bg_a" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("「使わない」") });
  });

  it("削除しても、公開したアンケートと確定済みの評価は1件も変わらない", async () => {
    seedBandSet();
    seedPastRecords();
    /* 同じ基準セットの中に、まだ一度も使っていない観点を1つ足す。
       これは消せるが、その削除が過去の記録に触れてはいけない。 */
    sqlite.exec(`
      INSERT INTO behavior_guidelines (id, company_id, band, aspect, aspect_name, seq)
        VALUES ('bg_new', 'cmp_a', 'band_a', 'aspect_new', 'テスト', 2);
    `);
    const questionsBefore = rows("SELECT * FROM form_questions");
    const behaviorsBefore = rows("SELECT * FROM evaluation_behaviors");

    await deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorGuideline", id: "bg_new" } });

    expect(rows("SELECT * FROM form_questions")).toEqual(questionsBefore);
    expect(rows("SELECT * FROM evaluation_behaviors")).toEqual(behaviorsBefore);
    // 使っていた観点はそのまま残る（過去の評価はこの行を指している）
    expect(rows("SELECT id FROM behavior_guidelines")).toEqual([{ id: "bg_a" }]);
  });

  it("他社の項目は消せない（見つからない扱いにする）", async () => {
    seedBandSet();

    await expect(
      deleteMasterItem({ db, companyId: "cmp_b", body: { kind: "behaviorGuideline", id: "bg_a" } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(rows("SELECT id FROM behavior_guidelines")).toEqual([{ id: "bg_a" }]);
  });

  it("等級に出す設定になっている基準セットは消せず、先に外す順番を示す", async () => {
    seedBandSet();
    sqlite.exec(`INSERT INTO grades (id, company_id, name, behavior_band) VALUES ('g_1', 'cmp_a', '等級５：Manager Ⅰ', 'band_a');`);

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorBandSet", id: "bbs_a" } }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("先に「どの等級に出すか」"),
    });
    expect(rows("SELECT id FROM behavior_band_sets")).toEqual([{ id: "bbs_a" }]);
  });

  it("どの等級にも出しておらず一度も使っていない基準セットは、中の観点ごと消せる", async () => {
    seedBandSet();

    const result = await deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorBandSet", id: "bbs_a" } });

    expect(result.message).toContain("観点1件");
    expect(rows("SELECT id FROM behavior_band_sets")).toEqual([]);
    expect(rows("SELECT id FROM behavior_guidelines")).toEqual([]);
    expect(rows("SELECT id FROM behavior_levels")).toEqual([]);
  });

  it("観点を1つでも使っている基準セットは消せない", async () => {
    seedBandSet();
    seedPastRecords();

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorBandSet", id: "bbs_a" } }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("完全には消せません") });
  });

  it("等級要件は、使っていなければ消せて、確定済みの評価にあれば消せない", async () => {
    sqlite.exec(`
      INSERT INTO grade_requirements (id, company_id, grade_id, category, text)
        VALUES ('gr_used', 'cmp_a', 'g_1', 'support', '支援計画を期限内に作れる'),
               ('gr_free', 'cmp_a', 'g_1', 'support', 'テスト');
      INSERT INTO evaluation_requirements (id, company_id, evaluation_id, grade_requirement_id)
        VALUES ('er_1', 'cmp_a', 'ev_1', 'gr_used');
    `);

    await deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "gradeRequirement", id: "gr_free" } });
    expect(rows("SELECT id FROM grade_requirements")).toEqual([{ id: "gr_used" }]);

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "gradeRequirement", id: "gr_used" } }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("確定済みの評価") });
    expect(rows("SELECT id FROM evaluation_requirements")).toEqual([{ id: "er_1" }]);
  });

  it("昇格要件は、使っていなければ消せて、確定済みの評価にあれば消せない", async () => {
    sqlite.exec(`
      INSERT INTO promotion_requirements (id, company_id, grade_id, kind, text)
        VALUES ('pr_used', 'cmp_a', 'g_1', 'report', '新任研修の報告書を出している'),
               ('pr_free', 'cmp_a', 'g_1', 'report', 'テスト');
      INSERT INTO evaluation_gates (id, company_id, evaluation_id, promotion_requirement_id)
        VALUES ('eg_1', 'cmp_a', 'ev_1', 'pr_used');
    `);

    await deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "promotionRequirement", id: "pr_free" } });
    expect(rows("SELECT id FROM promotion_requirements")).toEqual([{ id: "pr_used" }]);

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "promotionRequirement", id: "pr_used" } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(rows("SELECT id FROM evaluation_gates")).toEqual([{ id: "eg_1" }]);
  });

  it("下書きのアンケートに出している項目も消せない（設問は作った時点の写しのため）", async () => {
    seedBandSet();
    sqlite.exec(`
      INSERT INTO forms (id, company_id, title, status) VALUES ('f_d', 'cmp_a', '下書きのアンケート', 'draft');
      INSERT INTO form_questions (id, company_id, form_id, title, behavior_guideline_id)
        VALUES ('fq_d', 'cmp_a', 'f_d', '創造性について', 'bg_a');
    `);

    await expect(
      deleteMasterItem({ db, companyId: "cmp_a", body: { kind: "behaviorGuideline", id: "bg_a" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("下書きのアンケート") });
  });
});

describe("削除の入口（権限と会社の境界）", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/masters/route.ts"), "utf8");

  it("削除できるのは制度設定を扱える人だけで、会社は本人の所属から取る", () => {
    const branch = route.slice(route.indexOf("export async function DELETE"));
    // 画面でボタンを隠すだけにしない。入口で役割を確かめる。
    expect(branch).toContain('apiViewer("COMPANY_ADMIN")');
    // 会社の指定を本文から受け取らない（他社の会社idを送られても効かない）
    expect(branch).toContain("companyId: viewer.companyId");
    expect(branch).not.toContain("body.companyId");
  });
});
