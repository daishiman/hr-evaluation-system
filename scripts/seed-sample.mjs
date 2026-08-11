/**
 * 見本用（サンプル）の会社と過去の評価を入れる／消す。
 *
 *   pnpm run db:sample:local          … 手元のデータに入れる
 *   pnpm run db:sample:remote         … 本番のデータに入れる
 *   pnpm run db:sample:remove:local   … 手元から消す
 *   pnpm run db:sample:remove:remote  … 本番から消す
 *
 * 既にあるデータには触らない。
 * 作るのも消すのも「見本商事（サンプル）」1社ぶんだけで、それ以外の会社・利用者・
 * アンケート・評価には INSERT も UPDATE も DELETE も行わない（scripts/sample-data.mjs の
 * assertSampleOnly で機械的に確かめてから実行する）。
 *
 * パスワードについて:
 *   利用者ごとに、その場で作った仮パスワードをハッシュにして保存する。
 *   平文はどこにも書き出さず、画面にも出さない（このスクリプトも表示しない）。
 *   ログインするときは、管理画面の「仮パスワードを再発行する」から発行してもらう。
 *
 * 型を含むファイル（src/lib/domain/initial-password.ts）をそのまま読み込むため、
 * package.json の scripts では node に --experimental-strip-types を付けて呼んでいる。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { hashPassword } from "better-auth/crypto";
import { buildSampleSeed, assertSampleOnly, SAMPLE_COMPANY } from "./sample-data.mjs";
import { generateUniqueInitialPassword } from "../src/lib/domain/initial-password.ts";

const remote = process.argv.includes("--remote");
const removeOnly = process.argv.includes("--remove");
const generateOnly = process.argv.includes("--generate-only");

/** 発行済みの仮パスワード。重複しない値を作るためだけに持ち、ファイルにも画面にも出さない。 */
const issued = new Set();
const passwordHashFor = async () => {
  const password = generateUniqueInitialPassword(issued);
  issued.add(password);
  return hashPassword(password);
};

const { sql, removeSql, counts } = await buildSampleSeed({ passwordHashFor });

/* 入れるときも、まず同じサンプルを消してから入れる。
   何度実行しても同じ状態になり、途中で失敗しても作りかけが残らない。 */
const statements = removeOnly ? removeSql : [...removeSql, ...sql];
assertSampleOnly(statements);

mkdirSync(new URL("../drizzle/", import.meta.url), { recursive: true });
const fileName = removeOnly ? ".sample-remove.sql" : ".sample.sql";
const out = new URL(`../drizzle/${fileName}`, import.meta.url);
writeFileSync(out, statements.join("\n\n") + "\n", "utf8");

if (removeOnly) {
  console.log(`${SAMPLE_COMPANY.name} を消すSQLを作りました（${removeSql.length} 文）。`);
} else {
  console.log(`${SAMPLE_COMPANY.name} に入れる件数:`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log("\n仮パスワードは表示しません。ログインする方の分は、管理画面の「仮パスワードを再発行する」から発行してください。");
}
console.log(`SQL: drizzle/${fileName}`);

if (generateOnly) process.exit(0);

const args = ["wrangler", "d1", "execute", "hr-evaluation-db", `--file=drizzle/${fileName}`, remote ? "--remote" : "--local", "-y"];
console.log(`\n実行: pnpm ${args.join(" ")}`);
execFileSync("pnpm", args, { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname });
