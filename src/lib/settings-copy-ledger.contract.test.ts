import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { stripComments } from "@/test-support/source-code";

/*
 * 設定の写しの一覧（docs/product/settings-copy-ledger.md）とコードの突き合わせ（DD-028 の5・O27 の 3 件目の契約）。
 *
 * 一覧の「契約テストが見ること」の4つを確かめる。
 * 1. 設定の表を外部キーで指す表の集合が、一覧の 1（写しを持つ表）と 2（設定そのものの表）の集合と一致する
 * 2. 1 と 4（記録）の写しの列が、その表の列として schema にある
 * 3. 1 と 3（画面と書き出し）の関数が、書いたファイルから export されている
 * 4. 1 の分け方が 3 種類の言葉だけで書かれ、4 は全て確定時点の写しである
 *
 * 表を足して一覧に書き忘れると 1 が、列や関数の名前を変えて一覧を直し忘れると 2・3 が落ちる。
 */

const ROOT = process.cwd();
const LEDGER = readFileSync(path.join(ROOT, "docs/product/settings-copy-ledger.md"), "utf8");
const SCHEMA = stripComments(readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8"));

/** 設定の表（一覧の「契約テストが見ること」の 1 の括弧の中と同じ） */
const SETTING_TABLES = [
  "kpi_items",
  "kpi_categories",
  "kpi_questions",
  "behavior_guidelines",
  "grade_requirements",
  "promotion_requirements",
  "evaluation_schemes",
  "scheme_items",
  "form_questions",
];

const KINDS = ["参照", "追従", "確定時点の写し"];

type SchemaTable = { name: string; columns: Set<string>; refs: Set<string> };

/** schema.ts を `export const x = sqliteTable("name", …)` ごとに切り、列と外部キーの先（JS の変数名）を集める */
function readSchema(): Map<string, SchemaTable> {
  const blocks = SCHEMA.split(/(?=^export const \w+ = sqliteTable\()/m).slice(1);
  const varToName = new Map<string, string>();
  const tables = new Map<string, SchemaTable & { refVars: string[] }>();
  for (const block of blocks) {
    const head = /^export const (\w+) = sqliteTable\(\s*"([a-z_0-9]+)"/.exec(block);
    if (!head) continue;
    const [, variable, name] = head;
    varToName.set(variable, name);
    const columns = new Set([...block.matchAll(/\b(?:text|integer|real|blob|numeric)\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]));
    const refVars = [...block.matchAll(/\.references\(\s*\([^)]*\)\s*(?::\s*\w+\s*)?=>\s*(\w+)\./g)].map((m) => m[1]);
    tables.set(name, { name, columns, refs: new Set(), refVars });
  }
  for (const table of tables.values()) {
    for (const v of table.refVars) {
      const target = varToName.get(v);
      if (target) table.refs.add(target);
    }
  }
  return tables;
}

/** 一覧の「## n.」の節を返す（次の「## 」まで） */
function section(n: number): string {
  const start = LEDGER.search(new RegExp(`^## ${n}\\. `, "m"));
  expect(start, `一覧に「## ${n}.」の節が無い`).toBeGreaterThanOrEqual(0);
  const rest = LEDGER.slice(start + 1);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

/** 節の中の最初の表を、見出しの名前で引ける行の配列にする */
function tableRows(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.startsWith("|"));
  const cells = (line: string) =>
    line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim());
  const [header, , ...body] = lines;
  const keys = cells(header);
  return body.map((line) => Object.fromEntries(cells(line).map((c, i) => [keys[i], c])));
}

const unquote = (cell: string) => cell.replace(/`/g, "").trim();
const listOf = (cell: string) => cell.split(/[,、]/).map((c) => unquote(c)).filter(Boolean);

/**
 * 「`a`・`b`（`src/x.ts`）、`c`（`src/y.ts`）」を [{file, name}] にする。
 * 括弧の中のパスが、その前に並んだ関数の名前の書いたファイル。
 */
function functionsIn(cell: string): { file: string; name: string }[] {
  const out: { file: string; name: string }[] = [];
  let pending: string[] = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const token = m[1];
    if (/\.(?:ts|tsx|mjs)$/.test(token) && token.includes("/")) {
      for (const name of pending) out.push({ file: token, name });
      pending = [];
    } else {
      pending.push(token);
    }
  }
  expect(pending, `ファイルの書かれていない関数がある: ${cell}`).toEqual([]);
  return out;
}

function exports(file: string, name: string): boolean {
  const src = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
  const declared = new RegExp(`^export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${name}\\b`, "m");
  const listed = new RegExp(`^export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`, "m");
  return declared.test(src) || listed.test(src);
}

const schema = readSchema();
const copyRows = tableRows(section(1));
const settingRows = tableRows(section(2));
const screenRows = tableRows(section(3));
const recordRows = tableRows(section(4));

describe("一覧の表の形", () => {
  it("1〜4 の表が読める", () => {
    expect(copyRows.length).toBeGreaterThan(0);
    expect(settingRows.length).toBeGreaterThan(0);
    expect(screenRows.length).toBeGreaterThan(0);
    expect(recordRows.length).toBeGreaterThan(0);
    for (const row of [...copyRows, ...settingRows, ...recordRows]) expect(row["表"], JSON.stringify(row)).toBeTruthy();
  });
});

describe("1. 設定の表を外部キーで指す表が、一覧の 1 と 2 にそろっている", () => {
  it("一覧の設定の表は、全て schema にある", () => {
    for (const name of SETTING_TABLES) expect(schema.has(name), name).toBe(true);
  });

  it("抜けも余りも無い（自分自身を指す版の鎖は写しではないので数えない）", () => {
    const referring = [...schema.values()]
      .filter((t) => [...t.refs].some((r) => r !== t.name && SETTING_TABLES.includes(r)))
      .map((t) => t.name)
      .sort();
    const listed = [...copyRows, ...settingRows].map((r) => unquote(r["表"])).sort();
    expect(listed).toEqual(referring);
  });
});

describe("2. 写しの列が schema にある", () => {
  it("1（写しを持つ表）", () => {
    for (const row of copyRows) {
      const table = schema.get(unquote(row["表"]));
      expect(table, row["表"]).toBeDefined();
      const columns = listOf(row["写しの列"]);
      expect(columns.length, row["表"]).toBeGreaterThan(0);
      for (const c of columns) expect(table?.columns.has(c), `${row["表"]}.${c}`).toBe(true);
    }
  });

  it("4（記録）", () => {
    for (const row of recordRows) {
      const table = schema.get(unquote(row["表"]));
      expect(table, row["表"]).toBeDefined();
      for (const c of listOf(row["列"])) expect(table?.columns.has(c), `${row["表"]}.${c}`).toBe(true);
    }
  });
});

describe("3. 一覧の関数が、書いたファイルから export されている", () => {
  const cells = [
    ...copyRows.flatMap((r) => [r["書く関数"], r["追従の関数"]]),
    ...screenRows.map((r) => r["関数"]),
  ].filter((c) => c && c !== "なし");
  const functions = cells.flatMap(functionsIn);

  it("一覧から関数が読める", () => {
    expect(functions.length).toBeGreaterThan(0);
  });

  it.each(functions.map((f) => [`${f.name}（${f.file}）`, f] as const))("%s", (_label, f) => {
    expect(existsSync(path.join(ROOT, f.file)), `${f.file} が無い`).toBe(true);
    expect(exports(f.file, f.name), `${f.file} が ${f.name} を export していない`).toBe(true);
  });
});

describe("4. 分け方の言葉", () => {
  it("1 の分け方は、文ごとに 3 種類（参照・追従・確定時点の写し）のどれかで書かれている", () => {
    for (const row of copyRows) {
      const sentences = row["分け方"].split("。").map((s) => s.trim()).filter(Boolean);
      expect(sentences.length, row["表"]).toBeGreaterThan(0);
      for (const s of sentences) expect(KINDS.some((k) => s.includes(k)), `${row["表"]}: ${s}`).toBe(true);
    }
  });

  it("4 の記録は、全て確定時点の写しとしている", () => {
    expect(section(4)).toContain("分け方は全て「確定時点の写し」");
  });
});
