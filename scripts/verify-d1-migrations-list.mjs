#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Wrangler の `d1 migrations list` には JSON 出力がないため、人向け表示を
// 最小限の意味シグナルだけで判定する。表の罫線・列幅・絵文字・色には依存しない。
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
  "g",
);
const NO_PENDING_LINE_PATTERN =
  /^\s*[^\p{L}\p{N}\r\n]*no\s+migrations?\s+to\s+apply[.!]?\s*$/iu;
const PENDING_HEADING_PATTERN = /\bmigrations?\s+to\s+be\s+applied\s*:/iu;
const MIGRATION_FILENAME_PATTERN = /\b\d+[_-][^\s│|]+\.sql\b/giu;

function normalize(output) {
  return output.replace(ANSI_ESCAPE_PATTERN, "").replaceAll("\r", "");
}

/**
 * Wrangler の終了コードが 0 だったときの出力を分類する。
 *
 * clear 以外は必ずデプロイを停止する。未知の正常出力を推測で clear にしないことで、
 * Wrangler の文言変更や空出力も fail-closed にする。
 */
export function classifyMigrationListOutput(output) {
  const normalized = normalize(output);
  const lines = normalized.split("\n");
  const hasNoPendingSignal = lines.some((line) =>
    NO_PENDING_LINE_PATTERN.test(line),
  );
  const hasPendingHeading = PENDING_HEADING_PATTERN.test(normalized);
  const migrationNames = [...normalized.matchAll(MIGRATION_FILENAME_PATTERN)].map(
    ([name]) => name,
  );

  // 矛盾する出力は「未適用あり」側へ倒す。誤停止はしても誤配布はしない。
  if (hasPendingHeading || migrationNames.length > 0) {
    return {
      status: "pending",
      migrationNames: [...new Set(migrationNames)],
      contradictory: hasNoPendingSignal,
    };
  }

  if (hasNoPendingSignal) {
    return { status: "clear", migrationNames: [], contradictory: false };
  }

  return { status: "unknown", migrationNames: [], contradictory: false };
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

async function main() {
  const reportPath = process.argv[2];
  const mode = process.argv[3] ?? "--verify-clear";
  if (!reportPath) {
    fail("Wrangler の migrations list 出力ファイルを指定してください。");
    return;
  }

  let output;
  try {
    output = await readFile(reportPath, "utf8");
  } catch (error) {
    fail(`Wrangler の migrations list 出力を読めません: ${error.message}`);
    return;
  }

  const result = classifyMigrationListOutput(output);
  if (mode === "--print-status") {
    if (result.status === "unknown") {
      fail(
        "Wrangler の出力からマイグレーション状態を判定できません。認証・通信状態または Wrangler の出力変更を確認してください。",
      );
      return;
    }
    console.log(result.status);
    return;
  }

  if (mode !== "--verify-clear") {
    fail(`未知の実行モードです: ${mode}`);
    return;
  }

  if (result.status === "clear") {
    console.log("D1 の未適用マイグレーションはありません。");
    return;
  }

  if (result.status === "pending") {
    const names = result.migrationNames.length
      ? ` (${result.migrationNames.join(", ")})`
      : "";
    const contradiction = result.contradictory
      ? " 出力内に矛盾するシグナルもあったため、安全側で停止しました。"
      : "";
    fail(
      `D1 に未適用のマイグレーションがあります${names}。適用処理が完了していないためデプロイを停止します。${contradiction}`,
    );
    return;
  }

  fail(
    "Wrangler の出力から未適用マイグレーションが 0 件だと確認できません。認証・通信状態または Wrangler の出力変更を確認してください。",
  );
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) await main();
