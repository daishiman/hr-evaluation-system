#!/usr/bin/env node
// 直した型の脆弱性が、別の場所で同じ形で戻ってこないことを見張る静的検査（DD-032 の16）。
//
// 使い方:
//   pnpm run check:security                         # リポジトリ（src と .github/workflows）を見る
//   node scripts/check-security-patterns.mjs --dir .open-next   # ビルドの成果物を見る（ビルドの後）
//
// リポジトリで見る型（テストのファイルは違反の見本を持つので見ない）:
//   db-dump-artifact      : ワークフローが DB の中身を書き出して、成果物に上げる
//   client-ip-header      : 偽れる送信元の見出しで、相手を見分ける
//   raw-csv               : 式の無害化（src/lib/csv.ts の toCsv）を通さずに、CSV を組み立てて返す
//   prefix-redirect-check : 先頭の / だけを見て、戻り先を自サイトの中と決める
//   raw-error-log         : 例外をそのままログに書く（SQL の値や個人の情報が載る）
// 成果物（--dir）で見る型:
//   source-map   : 公開する assets の .map と sourceMappingURL の注記
//   secret-value : 秘密の名前に書かれた値と、鍵の本体（依存のライブラリの定数の名前は見ない）
//   env-file     : 環境の値を書いたファイル（.dev.vars・.env*）
//
// 終了コード: 0 = 違反なし、1 = 違反あり、2 = 検査できない（--dir の先が無い・assets が無い）。
// 見つけた結果には、規則・ファイル・行だけを出す。秘密の値そのものは出さない。

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const SKIPPED_DIRS = new Set(["node_modules", ".git", ".next", ".open-next", "coverage"]);

/** テストのファイルと試験用の補助（違反の見本を持つ） */
function isTestFile(file) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith("e2e/") || file.startsWith("src/test-support/");
}

/* ───────────────────────── 注釈と文字列を読み分ける ───────────────────────── */

const REGEX_BEFORE = new Set([..."(,=:[!&|?{};+-*%<>~^"]);
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|do|else|yield|await)$/;

/**
 * JS/TS の注釈を空白に置き換えた文と、さらに文字列の中身も空白にした文を返す（行の位置は変えない）。
 * 文字列の中の // は注釈として読まない。正規表現の literal は前の字から見分ける。
 */
function maskCode(text) {
  const noComments = text.split("");
  const codeOnly = text.split("");
  const blank = (from, to, both) => {
    for (let i = from; i < to; i += 1) {
      if (text[i] === "\n") continue;
      codeOnly[i] = " ";
      if (both) noComments[i] = " ";
    }
  };
  const stack = []; // テンプレートの ${ の深さ
  let i = 0;
  let prev = ""; // 直前の空白でない字
  let word = ""; // 直前の語（正規表現の見分けに使う）
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const to = end === -1 ? text.length : end;
      blank(i, to, true);
      i = to;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const to = end === -1 ? text.length : end + 2;
      blank(i, to, true);
      i = to;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      blank(i + 1, j, false);
      i = j + 1;
      prev = c;
      word = "";
      continue;
    }
    if (c === "`" || (c === "}" && stack.length > 0 && stack[stack.length - 1] === 0)) {
      if (c === "}") stack.pop();
      let j = i + 1;
      while (j < text.length && text[j] !== "`" && !(text[j] === "$" && text[j + 1] === "{")) j += text[j] === "\\" ? 2 : 1;
      blank(i + 1, j, false);
      if (text[j] === "$") {
        stack.push(0);
        i = j + 2;
        prev = "{";
      } else {
        i = j + 1;
        prev = "`";
      }
      word = "";
      continue;
    }
    if (c === "/" && (prev === "" || REGEX_BEFORE.has(prev) || REGEX_KEYWORDS.test(word))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== "\n") {
        if (text[j] === "\\") j += 1;
        else if (text[j] === "[") inClass = true;
        else if (text[j] === "]") inClass = false;
        else if (text[j] === "/" && !inClass) break;
        j += 1;
      }
      blank(i + 1, j, false);
      i = j + 1;
      prev = "/";
      word = "";
      continue;
    }
    if (stack.length > 0) {
      if (c === "{") stack[stack.length - 1] += 1;
      else if (c === "}") stack[stack.length - 1] -= 1;
    }
    if (!/\s/.test(c)) {
      prev = c;
      word = /[\w$]/.test(c) ? `${word}${c}` : "";
    } else if (word) {
      word = `${word} `.trimEnd();
    }
    i += 1;
  }
  return { noComments: noComments.join(""), codeOnly: codeOnly.join("") };
}

/** YAML の # の注釈を空白にする（行の位置は変えない） */
function maskYaml(text) {
  return text.replace(/(^|\s)#.*$/gm, (m, lead) => `${lead}${" ".repeat(m.length - lead.length)}`);
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

function eachMatch(text, pattern, fn) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    fn(m);
    if (m[0] === "") re.lastIndex += 1;
  }
}

/* ───────────────────────── リポジトリの型 ───────────────────────── */

/** ① ワークフローが DB を書き出す run と、DB の書き出しを上げる upload */
function checkDbDumpArtifact(file, text, out) {
  const yaml = maskYaml(text);
  eachMatch(yaml, /\bdb:backup\b|\bd1\s+export\b/, (m) => {
    out.push({ rule: "db-dump-artifact", file, line: lineAt(yaml, m.index), message: "ワークフローで DB の中身を書き出しています" });
  });
  const lines = yaml.split("\n");
  lines.forEach((line, n) => {
    if (!/\buses:\s*actions\/upload-artifact@/.test(line)) return;
    const indent = line.search(/\S/);
    for (let k = n + 1; k < lines.length; k += 1) {
      const body = lines[k];
      if (body.trim() === "") continue;
      const bodyIndent = body.search(/\S/);
      if (bodyIndent < indent || (bodyIndent === indent && body.trimStart().startsWith("- "))) break;
      if (/\.(?:sql|sqlite3?|db)\b/i.test(body)) {
        out.push({ rule: "db-dump-artifact", file, line: k + 1, message: "DB の書き出しを成果物に上げています" });
      }
    }
  });
}

const SPOOFABLE_IP_HEADERS = /(["'`])(x-forwarded-for|x-real-ip|true-client-ip|x-client-ip|forwarded)\1/gi;
const CLIENT_IP_HEADER = /(["'`])cf-connecting-ip\1/gi;

/** ② 偽れる見出しで相手を見分ける（cf-connecting-ip を読むのは src/lib/security の1か所だけ） */
function checkClientIpHeader(file, noComments, out) {
  eachMatch(noComments, SPOOFABLE_IP_HEADERS, (m) => {
    out.push({ rule: "client-ip-header", file, line: lineAt(noComments, m.index), message: `偽れる見出し（${m[2].toLowerCase()}）を読んでいます` });
  });
  if (file.startsWith("src/lib/security/")) return;
  eachMatch(noComments, CLIENT_IP_HEADER, (m) => {
    out.push({ rule: "client-ip-header", file, line: lineAt(noComments, m.index), message: "送信元は src/lib/security/client-ip.ts を通して読みます" });
  });
}

/** ③ toCsv を通さない CSV（src/lib/csv.ts の中は見ない） */
function checkRawCsv(file, noComments, out) {
  if (file === "src/lib/csv.ts") return;
  const usesToCsv = /\btoCsv\s*\(/.test(noComments);
  eachMatch(noComments, /(["'`])[^"'`\n]*\btext\/csv\b[^"'`\n]*\1/i, (m) => {
    if (usesToCsv) return;
    const before = noComments.slice(Math.max(0, m.index - 20), m.index);
    if (/\baccept\s*[=:]\s*\{?\s*$/.test(before)) return; // 取り込みの欄が受ける種類
    out.push({ rule: "raw-csv", file, line: lineAt(noComments, m.index), message: "CSV は src/lib/csv.ts の toCsv で組み立てます" });
  });
  noComments.split("\n").forEach((line, n) => {
    if (/\.join\(\s*(["'`]),\1\s*\)/.test(line) && /\.join\(\s*(["'`])(?:\\r)?\\n\1\s*\)/.test(line)) {
      out.push({ rule: "raw-csv", file, line: n + 1, message: "区切りと改行を自分で join して CSV を作っています" });
    }
  });
}

/** ④ 先頭の / と // だけで戻り先を決める（src/lib/security/safe-redirect.ts を通す） */
function checkPrefixRedirect(file, noComments, codeOnly, out) {
  if (file === "src/lib/security/safe-redirect.ts") return;
  // 同じ値に対する旧式の2条件を見る。改行や注釈を挟んでも同じ判定にし、
  // 別の文の startsWith や、文字列・正規表現の中の見本は拾わない。
  eachMatch(noComments, /\b([\w$]+(?:\.[\w$]+)*)\s*\.\s*startsWith\s*\(\s*(["'`])\/\2\s*\)\s*\)*\s*&&\s*!\s*\(*\s*\1\s*\.\s*startsWith\s*\(\s*(["'`])\/\/\3\s*\)/g, (m) => {
    if (!/[\w$]/.test(codeOnly[m.index] ?? "")) return;
    out.push({ rule: "prefix-redirect-check", file, line: lineAt(noComments, m.index), message: "戻り先は src/lib/security/safe-redirect.ts の関数で確かめます" });
  });
}

const ERROR_NAMES = new Set(["e", "err", "error", "cause", "ex", "exception"]);

/** ⑤ console.* にエラーの変数をそのまま渡す（src/lib/db.ts の summarizeErrorForLog を通す） */
function checkRawErrorLog(file, codeOnly, out) {
  eachMatch(codeOnly, /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(/, (m) => {
    const args = [];
    let depth = 0;
    let start = m.index + m[0].length;
    for (let i = start; i < codeOnly.length; i += 1) {
      const c = codeOnly[i];
      if (c === "(" || c === "[" || c === "{") depth += 1;
      else if ((c === ")" || c === "]" || c === "}") && depth > 0) depth -= 1;
      else if (c === ")" || (c === "," && depth === 0)) {
        args.push(codeOnly.slice(start, i).trim());
        start = i + 1;
        if (c === ")") break;
      }
    }
    if (args.some((arg) => ERROR_NAMES.has(arg))) {
      out.push({ rule: "raw-error-log", file, line: lineAt(codeOnly, m.index), message: "例外は summarizeErrorForLog で要約してから書きます" });
    }
  });
}

/**
 * 1つのファイルを見る。file はリポジトリの直下からの path（区切りは /）。
 * テストのファイルと、型の対象でないファイルは空を返す。
 */
export function scanFile(file, text) {
  const out = [];
  if (isTestFile(file)) return out;
  if (WORKFLOW_FILE.test(file)) {
    checkDbDumpArtifact(file, text, out);
    return out;
  }
  if (!CODE_FILE.test(file)) return out;
  const { noComments, codeOnly } = maskCode(text);
  checkClientIpHeader(file, noComments, out);
  checkRawCsv(file, noComments, out);
  checkPrefixRedirect(file, noComments, codeOnly, out);
  checkRawErrorLog(file, codeOnly, out);
  return out.sort((a, b) => a.line - b.line);
}

function walk(dir, fn, skip = () => false) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip(entry.name)) walk(full, fn, skip);
    } else if (entry.isFile()) {
      fn(full);
    }
  }
}

const toPosix = (p) => p.split(sep).join("/");

/** リポジトリの src と .github/workflows を見る（node_modules・ビルドの成果物は見ない） */
export function scanRepository(root) {
  const out = [];
  for (const top of ["src", ".github/workflows"]) {
    walk(
      join(root, top),
      (full) => {
        const file = toPosix(relative(root, full));
        out.push(...scanFile(file, readFileSync(full, "utf8")));
      },
      (name) => SKIPPED_DIRS.has(name),
    );
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/* ───────────────────────── ビルドの成果物 ───────────────────────── */

const SECRET_NAME = String.raw`[A-Z][A-Z0-9_]*(?:SECRET|API_KEY|_KEY|TOKEN|PASSWORD)[A-Z0-9_]*`;
// 名前に値の literal を書いたもの（BETTER_AUTH_SECRET: "…"・"AGENT_API_KEY":"…"・X_TOKEN = "…"）
const SECRET_ASSIGNMENT = new RegExp(String.raw`(["']?)\b(${SECRET_NAME})\b\1\s*[:=]\s*(["'\`])([^"'\`\s]{16,})\3`, "g");
// 値がまるごと1つの差し込み（`${…}`）。テンプレートの中で実行時に組み立てる式で、書かれた値ではない
// （囲みが " でも、外側がテンプレートなら差し込みになる。better-auth の誤りの文がこの形を持つ）
const WHOLE_INTERPOLATION = /^\$\{[^{}]*\}$/;
// 成果物には依存のライブラリのコードもまとめて入る。そのうち、名前だけが秘密に似た定数（値は見出しや
// 属性の名前、開発用の既定値で、鍵ではない）は見ない。足すときは、node_modules の元のファイルに同じ値が
// あって秘密でないことを確かめてから、包みの名前を添えて足す。
const THIRD_PARTY_CONSTANT_NAMES = new Set([
  "DEFAULT_SECRET", // better-auth: 秘密を設定しないときの既定値（このアプリは設定が無ければ起動しない）
  "NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER", // next: 見出しの名前
  "TELEMETRY_KEY_ENABLED", // next: 設定の項目名
  "TELEMETRY_KEY_NOTIFY_DATE", // next: 設定の項目名
  "TELEMETRY_KEY_ID", // next: 設定の項目名
  "PENDING_WRITES_CACHE_KEY", // @opennextjs/aws: cache の項目名
  "TMP_DB_CASSANDRA_KEYSPACE", // @opentelemetry/semantic-conventions: 属性の名前
  "TMP_MESSAGING_RABBITMQ_ROUTING_KEY", // @opentelemetry/semantic-conventions: 属性の名前
  "TMP_MESSAGING_KAFKA_MESSAGE_KEY", // @opentelemetry/semantic-conventions: 属性の名前
]);
// 鍵の本体（頭書きのあとに中身が続くもの。頭書きだけの文字は読み分けの定数なので見ない）
const PRIVATE_KEY_BODY = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\n|\s)+[A-Za-z0-9+/=]{40,}/g;
const ENV_FILE = /^(?:\.dev\.vars(?:\..+)?|\.env(?:\..+)?)$/;
const ENV_EXAMPLE = /\.(?:example|sample|template)$/;
const MAX_TEXT_BYTES = 32 * 1024 * 1024;

function readText(full) {
  if (statSync(full).size > MAX_TEXT_BYTES) return null;
  const buf = readFileSync(full);
  if (buf.subarray(0, 8192).includes(0)) return null; // 画像などの中身は見ない
  return buf.toString("utf8");
}

/** ビルドの成果物の dir（.open-next）を見る。assets の下だけが公開される */
export function scanBuildDir(dir) {
  const out = [];
  walk(dir, (full) => {
    const file = toPosix(relative(dir, full));
    const name = file.split("/").pop();
    const isPublic = file.startsWith("assets/");
    if (ENV_FILE.test(name) && !ENV_EXAMPLE.test(name)) {
      out.push({ rule: "env-file", file, line: null, message: "環境の値のファイルが成果物に入っています" });
      return;
    }
    if (isPublic && name.endsWith(".map")) {
      out.push({ rule: "source-map", file, line: null, message: "公開する assets に source map があります" });
      return;
    }
    const text = readText(full);
    if (text === null) return;
    if (isPublic) {
      eachMatch(text, /[#@]\s*sourceMappingURL=/, (m) => {
        out.push({ rule: "source-map", file, line: lineAt(text, m.index), message: "公開する assets に sourceMappingURL の注記があります" });
      });
    }
    eachMatch(text, SECRET_ASSIGNMENT, (m) => {
      if (THIRD_PARTY_CONSTANT_NAMES.has(m[2])) return;
      if (WHOLE_INTERPOLATION.test(m[4])) return;
      out.push({ rule: "secret-value", file, line: lineAt(text, m.index), message: `${m[2]} に値が書かれています（値は出しません）` });
    });
    eachMatch(text, PRIVATE_KEY_BODY, (m) => {
      out.push({ rule: "secret-value", file, line: lineAt(text, m.index), message: "鍵の本体が書かれています（値は出しません）" });
    });
  });
  return out.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
}

/* ───────────────────────── コマンド ───────────────────────── */

function main(argv) {
  const at = argv.indexOf("--dir");
  let violations;
  if (at !== -1) {
    const dir = argv[at + 1];
    if (!dir || !existsSync(dir) || !existsSync(join(dir, "assets"))) {
      console.error(`::error::検査する成果物（${dir ?? "（未指定）"}）に assets がありません。先にビルドしてください。`);
      return 2;
    }
    violations = scanBuildDir(dir);
  } else {
    violations = scanRepository(process.cwd());
  }
  if (violations.length === 0) {
    console.log("check:security: 違反はありません");
    return 0;
  }
  for (const v of violations) {
    console.error(`::error file=${v.file}${v.line ? `,line=${v.line}` : ""}::[${v.rule}] ${v.message}`);
  }
  console.error(`check:security: ${violations.length} 件の違反があります`);
  if (violations.some((v) => v.rule === "secret-value")) {
    console.error(
      "check:security: 依存のライブラリの定数で名前だけが秘密に似ているときは、値が秘密でないことを確かめてから THIRD_PARTY_CONSTANT_NAMES に足してください",
    );
  }
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
