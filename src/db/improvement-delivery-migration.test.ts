import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "drizzle/migrations/0019_improvement_delivery.sql"),
  "utf8",
);

function applyMigration(db: DatabaseSync) {
  for (const statement of MIGRATION.split("--> statement-breakpoint")) {
    if (statement.trim() !== "") db.exec(statement);
  }
}

describe("改善要望の配信契約への移行（0019）", () => {
  it("既存の実URLを現行route ledgerと同じ14個の動的patternへ移す", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE improvement_requests (
        id text PRIMARY KEY NOT NULL,
        company_id text NOT NULL,
        reporter_id text NOT NULL,
        path text NOT NULL
      );
    `);

    const paths: [string, string][] = [
      ["/forms/form_1", "/forms/[id]"],
      ["/me/forms/form_1", "/me/forms/[id]"],
      ["/me/responses/response_1", "/me/responses/[id]"],
      ["/me/results/result_1", "/me/results/[id]"],
      ["/f/token_1", "/f/[token]"],
      ["/manager/members/user_1", "/manager/members/[id]"],
      ["/manager/evaluations/eval_1", "/manager/evaluations/[id]"],
      ["/admin/scheme/general", "/admin/scheme/[group]"],
      ["/admin/scheme/general/criteria", "/admin/scheme/[group]/criteria"],
      ["/admin/forms/form_1", "/admin/forms/[id]"],
      ["/admin/forms/form_1/responses", "/admin/forms/[id]/responses"],
      ["/admin/improvements/improve_1", "/admin/improvements/[id]"],
      ["/admin/members/user_1", "/admin/members/[id]"],
      ["/system/users/user_1", "/system/users/[id]"],
      ["/admin/members/policy", "/admin/members/policy"],
    ];
    const insert = db.prepare(
      "INSERT INTO improvement_requests (id, company_id, reporter_id, path) VALUES (?, 'cmp_1', 'usr_1', ?)",
    );
    paths.forEach(([path], index) => insert.run(`ir_${index}`, path));

    applyMigration(db);

    const rows = db
      .prepare("SELECT path, route_pattern FROM improvement_requests ORDER BY id")
      .all() as { path: string; route_pattern: string }[];
    expect(new Map(rows.map((row) => [row.path, row.route_pattern]))).toEqual(new Map(paths));
    db.close();
  });
});
