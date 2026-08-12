#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const errors = [];

const currentDocs = [
  "README.md",
  "docs/product/backlog.md",
  "docs/product/backlog-session-notes.md",
  "docs/deploy-notes.md",
];

const requiredFiles = [
  ...currentDocs,
  "docs/product/backlog-history-2026-08-13.md",
  "docs/product/spec.md",
  "system-spec/index.md",
  "architecture/index.md",
  ".github/workflows/deploy.yml",
  ".github/workflows/migrate.yml",
];

function read(relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`${relativePath}: ファイルがありません`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(root, relativePath))) {
    errors.push(`${relativePath}: 必須の文書または入口がありません`);
  }
}

const readme = read("README.md");
const staleReadmePatterns = [
  ["技術スタックは未確定", "技術スタック未確定の旧説明"],
  ["現時点ではドキュメントと運用ルールを先行", "実装前提の旧説明"],
];

for (const [sentinel, label] of staleReadmePatterns) {
  if (readme.includes(sentinel)) {
    errors.push(`README.md: ${label}が復活しています（${sentinel}）`);
  }
}

const backlog = read("docs/product/backlog.md");
const closedItemPatterns = [
  [/~~/, "取消線"],
  [/(?:解消|対応|修正|確定|完了)済み/, "完了した項目を示す表現"],
];

for (const [pattern, label] of closedItemPatterns) {
  if (pattern.test(backlog)) {
    errors.push(`docs/product/backlog.md: ${label}があります。current には未解決事項だけを置いてください`);
  }
}

const itemRows = backlog
  .split("\n")
  .filter((line) => /^\|\s*[A-Z][A-Z0-9]*-\d{3}\s*\|/.test(line));

if (itemRows.length === 0) {
  errors.push("docs/product/backlog.md: 安定 ID 付きの項目がありません");
}

const allowedStates = new Set(["ready", "decision", "observe", "blocked"]);
const seenIds = new Set();

for (const row of itemRows) {
  const cells = row
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  if (cells.length !== 6) {
    errors.push(`docs/product/backlog.md: 6 列ではない項目があります: ${row}`);
    continue;
  }

  const [id, state, issue, trigger, nextAction, evidence] = cells;
  if (seenIds.has(id)) {
    errors.push(`docs/product/backlog.md: ID が重複しています: ${id}`);
  }
  seenIds.add(id);

  if (!allowedStates.has(state)) {
    errors.push(`docs/product/backlog.md: ${id} の状態が不正です: ${state}`);
  }
  if (!issue || !trigger || !nextAction || !evidence) {
    errors.push(`docs/product/backlog.md: ${id} に論点・trigger・次アクション・根拠の空欄があります`);
  }
  if (!evidence.includes("](")) {
    errors.push(`docs/product/backlog.md: ${id} の根拠がリンクになっていません`);
  }
}

function checkUniqueNumberedSections(relativePath) {
  const content = read(relativePath);
  const seenNumbers = new Map();

  for (const match of content.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)) {
    const [, sectionNumber, title] = match;
    const firstTitle = seenNumbers.get(sectionNumber);
    if (firstTitle) {
      errors.push(
        `${relativePath}: セクション番号 ${sectionNumber} が重複しています（${firstTitle} / ${title}）`,
      );
    } else {
      seenNumbers.set(sectionNumber, title);
    }
  }
}

checkUniqueNumberedSections("docs/product/spec.md");

function checkLocalLinks(relativePath) {
  const content = read(relativePath);
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/.test(rawTarget)) continue;

    const pathPart = rawTarget.split("#", 1)[0].split("?", 1)[0];
    if (!pathPart) continue;

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch {
      errors.push(`${relativePath}: URL エンコードが不正なリンクです: ${rawTarget}`);
      continue;
    }

    const target = resolve(root, dirname(relativePath), decodedPath);
    if (!existsSync(target)) {
      errors.push(`${relativePath}: リンク先がありません: ${rawTarget}`);
    }
  }
}

for (const relativePath of currentDocs) {
  checkLocalLinks(relativePath);
}

if (errors.length > 0) {
  console.error("文書 drift 検査に失敗しました:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`文書 drift 検査: PASS（current backlog ${itemRows.length} 件、主要リンク確認済み）`);
