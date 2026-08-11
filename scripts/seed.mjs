/**
 * シードSQLを生成して D1 に流し込む。
 *   pnpm run db:seed:local   … ローカルD1へ
 *   pnpm run db:seed:remote  … 本番D1へ
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildSeed, DEMO_PASSWORD } from "./seed-data.mjs";

const remote = process.argv.includes("--remote");
const generateOnly = process.argv.includes("--generate-only");

const TABLES = [
  "employee_notes", "kgi_coefficients",
  "raise_revisions", "raise_exceptions", "raise_patterns", "raise_policies", "raise_settings",
  "evaluation_gates", "evaluation_requirements", "evaluation_behaviors", "evaluation_items", "evaluations",
  "form_answers", "form_responses", "form_questions", "forms", "evaluation_cycles",
  "form_deadline_extensions",
  "scheme_rank_ratios", "scheme_items", "evaluation_schemes", "grade_point_rules",
  "kpi_questions", "kpi_reference_points", "kpi_rank_criteria", "kpi_items", "kpi_categories",
  "promotion_thresholds", "behavior_levels", "behavior_guidelines",
  "promotion_requirements", "grade_requirements",
  "sessions", "accounts", "verifications", "users", "grades", "offices", "companies",
];

const { sql, counts } = await buildSeed();

const body = [
  "-- 自動生成: scripts/seed.mjs（手で編集しない）",
  "PRAGMA defer_foreign_keys = ON;",
  ...TABLES.map((t) => `DELETE FROM ${t};`),
  ...sql,
].join("\n\n");

mkdirSync(new URL("../drizzle/", import.meta.url), { recursive: true });
const out = new URL("../drizzle/seed.sql", import.meta.url);
writeFileSync(out, body + "\n", "utf8");

console.log("投入件数:");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`\nSQL: drizzle/seed.sql (${(body.length / 1024).toFixed(0)} KB)`);
console.log(`デモ用パスワード: ${DEMO_PASSWORD}`);

if (generateOnly) process.exit(0);

const args = ["wrangler", "d1", "execute", "hr-evaluation-db", "--file=drizzle/seed.sql", remote ? "--remote" : "--local", "-y"];
console.log(`\n実行: pnpm ${args.join(" ")}`);
execFileSync("pnpm", args, { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname });
