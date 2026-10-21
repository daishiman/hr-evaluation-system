/**
 * シードSQLを生成して D1 に流し込む。
 *   pnpm run db:seed:local   … ローカルD1へ
 *
 * 全テーブルを削除し、既知の共通デモパスワードを含むデータへ置き換えるため、
 * 本番D1への実行は常に拒否する。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertFullSeedTargetIsLocal } from "./seed-target.mjs";

try {
  // seed-data の読込み、SQL生成、ファイル書込み、wrangler起動より先に止める。
  assertFullSeedTargetIsLocal(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const generateOnly = process.argv.includes("--generate-only");
const { buildSeed, DEMO_PASSWORD, seedFileBody } = await import("./seed-data.mjs");

const { sql, counts } = await buildSeed();

// 消す表の一覧と本文の組み立ては seed-data.mjs に置く（冪等の試験が同じ本文を流して確かめるため）
const body = seedFileBody(sql);

mkdirSync(new URL("../drizzle/", import.meta.url), { recursive: true });
const out = new URL("../drizzle/seed.sql", import.meta.url);
writeFileSync(out, body + "\n", "utf8");

console.log("投入件数:");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`\nSQL: drizzle/seed.sql (${(body.length / 1024).toFixed(0)} KB)`);
console.log(`デモ用パスワード: ${DEMO_PASSWORD}`);

if (generateOnly) process.exit(0);

// guardに加えて実行先もローカルへ固定し、後続の条件分岐から本番へ届かないようにする。
const args = ["wrangler", "d1", "execute", "hr-evaluation-db", "--file=drizzle/seed.sql", "--local", "-y"];
console.log(`\n実行: pnpm ${args.join(" ")}`);
execFileSync("pnpm", args, { stdio: "inherit", cwd: fileURLToPath(new URL("..", import.meta.url)) });
