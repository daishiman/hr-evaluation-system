import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 評価レポートの機能で足した移行（0038）と、2回目の公開で流す移行（0039）を、戻す SQL（drizzle/rollback/）で戻せることを確かめる。
 *
 * 戻す SQL を流すのは障害の最中で、ふだんは流さない。書き間違いにそこで初めて気づかないよう、
 * 「その移行の前まで流した DB」と「その移行まで流してから戻した DB」の表の形（列・外部キー・索引）を比べる。
 * 列の並びは比べない（ALTER TABLE ADD は末尾に足すので、戻すと並びが変わる。drizzle は列を名前で引く）。
 *
 * 0039 は P05 の PR に入れず、P08 の PR で入る（DD-020）。0039 のファイルが無い間は、0039 の試験を飛ばす。
 * 0039 が消す表と列の名前は、この試験に書かずに 0039 の SQL から読む（src に消した仕組みの名前を書かないため）。
 */

const MIGRATIONS = "drizzle/migrations";
const ROLLBACK = "drizzle/rollback";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const statements = (sql: string) => sql.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
const sqlFiles = (dir: string) => readdirSync(join(process.cwd(), dir)).filter((f) => f.endsWith(".sql")).sort();
const numbered = (dir: string, no: string) => sqlFiles(dir).find((f) => f.startsWith(`${no}_`));

const ROLLBACK_0038 = read(`${ROLLBACK}/0038_evaluation_decisions_rollback.sql`);
const MIGRATION_0038 = read(`${MIGRATIONS}/0038_evaluation_decisions.sql`);
const FILE_0039 = numbered(MIGRATIONS, "0039");
const ROLLBACK_FILE_0039 = numbered(ROLLBACK, "0039");

type Row = Record<string, unknown>;
const all = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Row[];
const run = (db: DatabaseSync, sql: string) => {
  for (const st of statements(sql)) db.exec(st);
};
const byKey = (key: (row: Row) => string) => (a: Row, b: Row) => key(a).localeCompare(key(b));

const opened: DatabaseSync[] = [];
let t: TestDatabase | null = null;
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  t?.close();
  t = null;
});

/** 番号が upTo までの移行だけを、本番と同じファイルのまま流した空の DB */
function migratedThrough(upTo: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  opened.push(db);
  for (const f of sqlFiles(MIGRATIONS).filter((f) => f.slice(0, 4) <= upTo)) run(db, read(`${MIGRATIONS}/${f}`));
  return db;
}

/** 表ごとの形。列は名前・型・NOT NULL・既定値・主キー、外部キーは参照先と削除時の扱い、索引は名前・一意・列 */
function shape(db: DatabaseSync) {
  const tables = all(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((r) => String(r.name));
  return Object.fromEntries(
    tables.sort().map((table) => [
      table,
      {
        columns: all(db, `PRAGMA table_info(\`${table}\`)`)
          .map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk }))
          .sort(byKey((c) => String(c.name))),
        foreignKeys: all(db, `PRAGMA foreign_key_list(\`${table}\`)`)
          .map(({ table: to, from, to: column, on_update, on_delete }) => ({ to, from, column, on_update, on_delete }))
          .sort(byKey((fk) => JSON.stringify(fk))),
        indexes: all(db, `PRAGMA index_list(\`${table}\`)`)
          .map(({ name, unique, origin, partial }) => ({
            name,
            unique,
            origin,
            partial,
            columns: all(db, `PRAGMA index_info(\`${String(name)}\`)`).map((c) => c.name),
          }))
          .sort(byKey((ix) => String(ix.name))),
      },
    ]),
  );
}

/** 上司の判断と賞与の値を持つ、確定済みの評価を1件入れた DB（いまの移行をすべて流したもの） */
async function withDecidedEvaluation(): Promise<TestDatabase> {
  t = createTestDatabase();
  await seedCompany(t);
  await t.db.insert(s.evaluations).values({
    id: "ev_decided",
    companyId: IDS.company,
    cycleId: IDS.cycle,
    employeeId: IDS.employee,
    gradeId: IDS.gradeFrom,
    schemeId: IDS.scheme,
    status: "finalized",
    totalScore: 72.5,
    personalPoints: 73,
    bonusYen: 73000,
    bonusRationale: "KPI評価点の合計 73点 × 1,000円",
    raiseEligible: true,
    raiseDecision: "override",
    raiseDecisionReason: "期の後半に担当が変わり、評価の対象が半分になったため",
    promotionDecision: "follow",
    decisionRecordedBy: IDS.evaluator,
    decisionRecordedAt: new Date("2026-10-20T09:00:00Z"),
  });
  return t;
}

describe("0038 の戻し方（drizzle/rollback/0038_evaluation_decisions_rollback.sql）", () => {
  it("0038 まで流してから戻すと、0037 までの形に戻る", () => {
    const before = shape(migratedThrough("0037"));
    const db = migratedThrough("0038");
    // 形の比べ方が 0038 の差（6列と索引）を見分けること。見分けられなければ、戻した後の一致は何も言えない
    expect(shape(db)).not.toEqual(before);

    run(db, ROLLBACK_0038);

    expect(shape(db)).toEqual(before);
  });

  it("上司の判断を記録した評価があっても戻せて、評価の行と判断の外の値は残る", async () => {
    const { raw } = await withDecidedEvaluation();
    // 戻す SQL の冒頭に書いた「流す前に件数を確かめる」SELECT が、そのまま流せて記録を数える
    const countBeforeRollback = ROLLBACK_0038.match(/^--\s+(SELECT .+;)$/m)?.[1];
    expect(countBeforeRollback).toBeDefined();
    expect(Object.values(raw.prepare(countBeforeRollback!).get() as Row)).toEqual([1]);

    run(raw, ROLLBACK_0038);

    const row = raw.prepare("SELECT * FROM evaluations WHERE id = 'ev_decided'").get() as Row;
    expect(row).toMatchObject({ status: "finalized", total_score: 72.5, personal_points: 73, bonus_yen: 73000, raise_eligible: 1 });
    expect(Object.keys(row).filter((col) => col.includes("decision"))).toEqual([]);
  });

  it("戻したあとに 0038 をもう一度流すと、0038 の後と同じ形になる", () => {
    const db = migratedThrough("0038");
    const migrated = shape(db);

    run(db, ROLLBACK_0038);
    run(db, MIGRATION_0038);

    expect(shape(db)).toEqual(migrated);
  });
});

describe.skipIf(!FILE_0039 || !ROLLBACK_FILE_0039)("0039 の戻し方（drizzle/rollback/ の 0039 のファイル。0039 が入った後）", () => {
  const migration0039 = () => read(`${MIGRATIONS}/${FILE_0039}`);
  const rollback0039 = () => read(`${ROLLBACK}/${ROLLBACK_FILE_0039}`);
  const names = (pattern: RegExp) => [...migration0039().matchAll(pattern)].map((m) => m[1]);

  it("0039 まで流してから戻すと、0038 までの形に戻る", () => {
    const before = shape(migratedThrough("0038"));
    const db = migratedThrough("0039");
    expect(shape(db)).not.toEqual(before);

    run(db, rollback0039());

    expect(shape(db)).toEqual(before);
  });

  it("0039 を先に、0038 をあとに戻すと、0037 までの形に戻る", () => {
    const before = shape(migratedThrough("0037"));
    const db = migratedThrough("0039");

    run(db, rollback0039());
    run(db, ROLLBACK_0038);

    expect(shape(db)).toEqual(before);
  });

  it("戻るのは形だけで、表は空・評価の2列は NULL で戻り、賞与の値は残る", async () => {
    const { raw } = await withDecidedEvaluation();
    const tables = names(/DROP TABLE IF EXISTS `([^`]+)`/g);
    const columns = names(/DROP COLUMN `([^`]+)`/g);
    expect(tables).toHaveLength(3);
    expect(columns).toHaveLength(2);

    run(raw, rollback0039());

    for (const table of tables) {
      expect(raw.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get(), table).toEqual({ n: 0 });
    }
    const row = raw.prepare("SELECT * FROM evaluations WHERE id = 'ev_decided'").get() as Row;
    for (const column of columns) expect(row[column], column).toBeNull();
    expect(row).toMatchObject({ personal_points: 73, bonus_yen: 73000, raise_decision: "override" });
  });
});
