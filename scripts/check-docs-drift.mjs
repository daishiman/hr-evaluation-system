#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

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
  "system-spec/routes-and-access.md",
  "system-spec/route-ledger.json",
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

function walkPages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walkPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const routeLedger = JSON.parse(read("system-spec/route-ledger.json") || "{}");
const implementedRoutes = walkPages(resolve(root, "src/app"))
  .map((file) => {
    const route = relative(resolve(root, "src/app"), file).split(sep).slice(0, -1).join("/");
    return route ? `/${route}` : "/";
  })
  .sort();
const documentedRoutes = (routeLedger.routes ?? []).map((route) => route.path).sort();
const routeRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"];
const routeWidths = [375, 768, 1280, 1600];
const routeOutcomes = new Set(["200", "redirect", "notFound", "denied"]);

if (new Set(documentedRoutes).size !== documentedRoutes.length) {
  errors.push("system-spec/route-ledger.json: route path が重複しています");
}
if (JSON.stringify(documentedRoutes) !== JSON.stringify(implementedRoutes)) {
  const missing = implementedRoutes.filter((route) => !documentedRoutes.includes(route));
  const stale = documentedRoutes.filter((route) => !implementedRoutes.includes(route));
  errors.push(
    `system-spec/route-ledger.json: page.tsx と一致しません（台帳漏れ: ${missing.join(", ") || "なし"} / 実装に無いroute: ${stale.join(", ") || "なし"}）`,
  );
}
if (JSON.stringify(routeLedger.widths) !== JSON.stringify(routeWidths)) {
  errors.push("system-spec/route-ledger.json: 検証幅は 375 / 768 / 1280 / 1600 の4つにしてください");
}
for (const [className, accessClass] of Object.entries(routeLedger.accessClasses ?? {})) {
  for (const [stateName, state] of Object.entries(accessClass.states ?? {})) {
    const actualRoles = Object.keys(state.expectedByRole ?? {}).sort();
    if (JSON.stringify(actualRoles) !== JSON.stringify([...routeRoles].sort())) {
      errors.push(`system-spec/route-ledger.json: ${className}.${stateName} に4ロールすべての期待結果がありません`);
    }
    for (const outcome of Object.values(state.expectedByRole ?? {})) {
      if (!routeOutcomes.has(outcome)) {
        errors.push(`system-spec/route-ledger.json: ${className}.${stateName} の期待結果が不正です: ${outcome}`);
      }
    }
  }
}
for (const route of routeLedger.routes ?? []) {
  if (!routeLedger.accessClasses?.[route.accessClass]) {
    errors.push(`system-spec/route-ledger.json: ${route.path} の accessClass が不明です`);
  }
  if (route.widthPolicy !== "all") {
    errors.push(`system-spec/route-ledger.json: ${route.path} は4幅すべてを検証対象にしてください`);
  }
}

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
