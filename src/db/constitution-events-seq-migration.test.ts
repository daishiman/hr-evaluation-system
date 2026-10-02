import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isConstitutionSeqConflict } from "@/lib/domain/constitution-events";

const read = (name: string) => readFileSync(join(process.cwd(), "drizzle/migrations", name), "utf8");
const statements = (migration: string) => migration.split("--> statement-breakpoint").filter((st) => st.trim() !== "");
/** 先頭のコメントを除いた本文が CREATE で始まる文（0014 のうち表と索引だけ。バックフィルは流さない）。 */
const isCreate = (st: string) =>
  st
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "")
    .trim()
    .startsWith("CREATE");

function insert(db: DatabaseSync, id: string, companyId: string, entityId: string, seq: number, occurredAt: number) {
  db.prepare(
    "INSERT INTO constitution_events (id, company_id, entity_type, entity_id, event_type, seq, occurred_at) VALUES (?, ?, 'grade', ?, 'updated', ?, ?)",
  ).run(id, companyId, entityId, seq, occurredAt);
}

function seqs(db: DatabaseSync, companyId: string, entityId: string) {
  return db
    .prepare("SELECT id, seq FROM constitution_events WHERE company_id = ? AND entity_id = ? ORDER BY seq")
    .all(companyId, entityId);
}

describe("監査記録の番号を実体ごとに一意にする移行（0032）", () => {
  it("既にある重なりを並び順のまま振り直し、以後の重なりを拒む", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("CREATE TABLE companies (id text PRIMARY KEY NOT NULL)");
    db.exec("CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    for (const st of statements(read("0014_constitution_events.sql")).filter(isCreate)) db.exec(st);
    db.exec("INSERT INTO companies (id) VALUES ('c1'), ('c2')");

    // 同時保存で 2 が重なった実体
    insert(db, "e1", "c1", "grade-a", 1, 100);
    insert(db, "e2", "c1", "grade-a", 2, 200);
    insert(db, "e3", "c1", "grade-a", 2, 201);
    insert(db, "e4", "c1", "grade-a", 3, 300);
    // 重なりの無い実体と、別の会社の同じID
    insert(db, "e5", "c1", "grade-b", 1, 100);
    insert(db, "e6", "c1", "grade-b", 2, 200);
    insert(db, "e7", "c2", "grade-a", 1, 100);

    for (const st of statements(read("0032_constitution_events_seq_unique.sql"))) db.exec(st);

    expect(seqs(db, "c1", "grade-a")).toEqual([
      { id: "e1", seq: 1 },
      { id: "e2", seq: 2 },
      { id: "e3", seq: 3 },
      { id: "e4", seq: 4 },
    ]);
    expect(seqs(db, "c1", "grade-b")).toEqual([
      { id: "e5", seq: 1 },
      { id: "e6", seq: 2 },
    ]);
    expect(seqs(db, "c2", "grade-a")).toEqual([{ id: "e7", seq: 1 }]);

    let conflict: unknown;
    try {
      insert(db, "e8", "c1", "grade-a", 4, 400);
    } catch (error) {
      conflict = error;
    }
    expect(conflict).toBeInstanceOf(Error);
    expect(isConstitutionSeqConflict(conflict)).toBe(true);
    db.close();
  });

  it("ほかの一意制約（記録のID）は、番号の重なりとして扱わない", () => {
    const sameId = new Error("UNIQUE constraint failed: constitution_events.id");
    const formVersion = new Error("UNIQUE constraint failed: forms.cycle_id, forms.grade_id, forms.version");
    const wrapped = new Error("D1_ERROR", {
      cause: new Error(
        "UNIQUE constraint failed: constitution_events.company_id, constitution_events.entity_type, constitution_events.entity_id, constitution_events.seq",
      ),
    });

    expect(isConstitutionSeqConflict(sameId)).toBe(false);
    expect(isConstitutionSeqConflict(formVersion)).toBe(false);
    expect(isConstitutionSeqConflict(wrapped)).toBe(true);
  });
});
