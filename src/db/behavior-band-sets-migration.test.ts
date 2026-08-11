import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 基準セットの移行（0011）を、実際の SQL ファイルのまま流して確かめる。
 *
 * 保管場所の作り変えは、すでに動いている会社のデータの上で1回だけ走る。
 * 手元で「たぶん大丈夫」と読むのではなく、移行前と同じ形のデータを作って本物の
 * SQL を流し、会社ごとの境界と既存の割り当てが壊れないことをここで固定する。
 */

const MIGRATION = readFileSync(
  join(process.cwd(), "drizzle/migrations/0011_behavior_band_sets.sql"),
  "utf8",
);

/** 移行前の形。0011 が触る列だけを持つ最小の写し。 */
function openBeforeMigration() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE companies (id text PRIMARY KEY, name text NOT NULL);
    CREATE TABLE grades (
      id text PRIMARY KEY, company_id text NOT NULL, name text NOT NULL, behavior_band text
    );
    CREATE TABLE behavior_guidelines (
      id text PRIMARY KEY, company_id text NOT NULL, band text NOT NULL,
      aspect text NOT NULL, aspect_name text NOT NULL, seq integer NOT NULL,
      is_active integer NOT NULL DEFAULT 1
    );
  `);
  return db;
}

function applyMigration(db: DatabaseSync) {
  for (const statement of MIGRATION.split("--> statement-breakpoint")) {
    if (statement.trim() !== "") db.exec(statement);
  }
}

describe("行動指針の基準セットへの移行（0011）", () => {
  it("会社ごとに、いま使っている基準がそのまま行になる", () => {
    const db = openBeforeMigration();
    db.exec(`
      INSERT INTO companies VALUES ('cmp_a', 'A社'), ('cmp_b', 'B社');
      INSERT INTO grades VALUES
        ('g_a1', 'cmp_a', '等級１：Beginner', 'g1_2'),
        ('g_a3', 'cmp_a', '等級３：Chief', 'g3_4'),
        ('g_a5', 'cmp_a', '等級５：Manager Ⅰ', NULL),
        ('g_b1', 'cmp_b', '等級１：Beginner', 'g1_2');
      INSERT INTO behavior_guidelines VALUES
        ('bg_a1', 'cmp_a', 'g1_2', 'creativity', '創造性について', 1, 1),
        ('bg_a2', 'cmp_a', 'g3_4', 'creativity', '創造性について', 1, 1),
        ('bg_b1', 'cmp_b', 'g1_2', 'creativity', '創造性について', 1, 1);
    `);

    applyMigration(db);

    const rows = db
      .prepare("SELECT company_id, code, name, display_order, is_active FROM behavior_band_sets ORDER BY company_id, display_order")
      .all();
    expect(rows).toEqual([
      { company_id: "cmp_a", code: "g1_2", name: "Beginner・Regular向け", display_order: 1, is_active: 1 },
      { company_id: "cmp_a", code: "g3_4", name: "Chief・AM向け", display_order: 2, is_active: 1 },
      // B社は g1_2 しか使っていないので、B社には g3_4 を作らない
      { company_id: "cmp_b", code: "g1_2", name: "Beginner・Regular向け", display_order: 1, is_active: 1 },
    ]);
    db.close();
  });

  it("等級の割り当てと観点は1件も動かない（呼び名だけが変わる）", () => {
    const db = openBeforeMigration();
    db.exec(`
      INSERT INTO companies VALUES ('cmp_a', 'A社');
      INSERT INTO grades VALUES ('g_a1', 'cmp_a', '等級１：Beginner', 'g1_2');
      INSERT INTO behavior_guidelines VALUES ('bg_a1', 'cmp_a', 'g1_2', 'creativity', '創造性について', 1, 1);
    `);
    const gradesBefore = db.prepare("SELECT * FROM grades").all();
    const guidelinesBefore = db.prepare("SELECT * FROM behavior_guidelines").all();

    applyMigration(db);

    expect(db.prepare("SELECT * FROM grades").all()).toEqual(gradesBefore);
    expect(db.prepare("SELECT * FROM behavior_guidelines").all()).toEqual(guidelinesBefore);
    db.close();
  });

  it("観点がまだ無い基準でも、等級に割り当てが残っていれば拾う", () => {
    const db = openBeforeMigration();
    db.exec(`
      INSERT INTO companies VALUES ('cmp_a', 'A社');
      INSERT INTO grades VALUES ('g_a1', 'cmp_a', '等級１：Beginner', 'g1_2');
    `);

    applyMigration(db);

    const codes = db.prepare("SELECT code FROM behavior_band_sets").all().map((r) => r.code);
    expect(codes).toEqual(["g1_2"]);
    db.close();
  });

  it("会社の中でコードは重複しない（同じ基準が二重に作られない）", () => {
    const db = openBeforeMigration();
    db.exec(`
      INSERT INTO companies VALUES ('cmp_a', 'A社');
      INSERT INTO grades VALUES
        ('g_a1', 'cmp_a', '等級１：Beginner', 'g1_2'),
        ('g_a2', 'cmp_a', '等級２：Regular', 'g1_2');
      INSERT INTO behavior_guidelines VALUES
        ('bg_a1', 'cmp_a', 'g1_2', 'creativity', '創造性について', 1, 1),
        ('bg_a2', 'cmp_a', 'g1_2', 'expertise', '専門性について', 2, 1);
    `);

    applyMigration(db);

    const count = db.prepare("SELECT COUNT(*) AS n FROM behavior_band_sets").get();
    expect(count).toEqual({ n: 1 });
    db.close();
  });

  it("行動指針を1つも使っていない会社には、余計な基準を作らない", () => {
    const db = openBeforeMigration();
    db.exec(`
      INSERT INTO companies VALUES ('cmp_a', 'A社');
      INSERT INTO grades VALUES ('g_a5', 'cmp_a', '等級５：Manager Ⅰ', NULL);
    `);

    applyMigration(db);

    expect(db.prepare("SELECT COUNT(*) AS n FROM behavior_band_sets").get()).toEqual({ n: 0 });
    db.close();
  });
});
