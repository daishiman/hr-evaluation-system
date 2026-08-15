#!/usr/bin/env node
// 届いた改善要望を、この作業ディレクトリから直接読み出す。
//
// 使い方:
//   pnpm improvements list              # 手つかずの要望を一覧で見る
//   pnpm improvements get <ID> [<ID>…]  # 作業指示文を読む（最大10件まとめて）
//   pnpm improvements list --json       # 機械処理用（JSONのまま出す）
//
// 鍵は画面（/system/agent-keys）で発行し、リポジトリ直下の .env.local に
//   HR_AGENT_KEY=発行された鍵
// と書いて置く。.env.local は .gitignore で除外済みで、共有されない。
//
// この台本は鍵の値を一切表示しない。出すのは「設定されているか」だけ。
// 失敗したときも、返ってきた本文をそのまま流さず、原因と次の一手に訳して出す。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 鍵を書く変数の名前。画面の案内・.env.example・この台本で同じ名前を使う。 */
export const KEY_VAR = "HR_AGENT_KEY";

/** 宛先を切り替える変数の名前。既定は本番。ローカル確認のときだけ上書きする。 */
export const BASE_VAR = "HR_APP_URL";

/** 宛先の既定値。日常はここに取りにいく。 */
export const DEFAULT_BASE = "https://hr-evaluation-system.daishimanju.workers.dev";

/** 鍵を発行する画面。鍵が無いときの案内に必ず入れる。 */
export const KEY_PAGE_PATH = "/system/agent-keys";

/** 鍵を置くファイル。リポジトリ直下からの相対で書く。 */
export const KEY_FILE = ".env.local";

/** まとめて取れる件数の上限（サーバー側の AGENT_BULK_MAX と同じ）。 */
export const BULK_MAX = 10;

export const USAGE = [
  "使い方:",
  "  pnpm improvements list              手つかずの改善要望を一覧で見る",
  "  pnpm improvements get <ID> [<ID>…]  作業指示文を読む（最大10件）",
  "",
  "付けられるもの:",
  "  --json        機械処理用にJSONのまま出す",
  `  --base <URL>  宛先を変える（既定は本番。環境変数 ${BASE_VAR} でも指定できる）`,
].join("\n");

/* ───────────────────────── 入力を読む ───────────────────────── */

/**
 * 引数を読む。分からない書き方は、その場で理由を付けて止める。
 * 「たぶん list だろう」と推測して動くと、打ち間違いに気づけないまま
 * 別の要望を触ることになる。
 */
export function parseArgs(argv) {
  const rest = [];
  let json = false;
  let base = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--base") {
      base = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg === "--help" || arg === "-h" || arg === "help") {
      return { command: "help", ids: [], json: false, base: null };
    } else if (arg.startsWith("-")) {
      return { error: `${arg} は使えません。`, command: null, ids: [], json: false, base: null };
    } else {
      rest.push(arg);
    }
  }

  if (base !== null && base.trim() === "") {
    return { error: "--base のあとに宛先のURLがありません。", command: null, ids: [], json, base: null };
  }

  const [command, ...ids] = rest;
  if (!command) return { command: "help", ids: [], json, base };
  if (command === "list") {
    if (ids.length > 0) {
      return { error: "list に要望IDは付けられません。1件読むときは get を使ってください。", command: null, ids: [], json, base };
    }
    return { command: "list", ids: [], json, base };
  }
  if (command === "get") {
    if (ids.length === 0) {
      return { error: "要望IDがありません。`pnpm improvements list` で番号を確かめてください。", command: null, ids: [], json, base };
    }
    const unique = [...new Set(ids)];
    return { command: "get", ids: unique.slice(0, BULK_MAX), dropped: Math.max(0, unique.length - BULK_MAX), json, base };
  }
  return { error: `${command} という操作はありません。`, command: null, ids: [], json, base };
}

/**
 * .env.local の中身から値を1つ取り出す。
 * 行の形は KEY=値。引用符は外し、# で始まる行と空行は読み飛ばす。
 * 値の中に = があっても壊れないよう、最初の = だけで切る。
 */
export function readEnvValue(text, name) {
  for (const line of (text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    if (withoutExport.slice(0, eq).trim() !== name) continue;
    const raw = withoutExport.slice(eq + 1).trim();
    const unquoted = /^(["']).*\1$/s.test(raw) ? raw.slice(1, -1) : raw;
    if (unquoted.length > 0) return unquoted;
  }
  return null;
}

/**
 * 鍵が無いときの案内。発行画面 → 書き込み先 → 実行、の順で1行1手順にする。
 * 鍵の値はどこにも出さない（この関数は鍵を受け取らない）。
 */
export function missingKeyMessage(base) {
  return [
    "改善要望を読むための鍵が、この作業ディレクトリに設定されていません。",
    "",
    "1. 次の画面をシステム全体管理者で開き、「鍵を発行する」を押します。",
    `   ${base}${KEY_PAGE_PATH}`,
    "2. 出てきた鍵はその場で1回だけ表示されます。控えてください。",
    `3. このリポジトリの直下で \`cp env.example ${KEY_FILE}\` を実行し、次の1行を書きます。`,
    `   ${KEY_VAR}=控えた鍵`,
    "4. もう一度 `pnpm improvements list` を実行します。",
    "",
    `${KEY_FILE} は共有されない設定ファイルです（除外済み）。鍵を他のファイルへ書かないでください。`,
  ].join("\n");
}

/**
 * 鍵と宛先を決める。
 * 鍵の在り処は「環境変数 → .env.local」の順。手元で一時的に差し替えたいときに
 * ファイルを書き換えずに済む形にしておく。
 */
export function resolveConfig({ env = {}, envFileText = null, baseOverride = null } = {}) {
  const key = (env[KEY_VAR] ?? "").trim() || readEnvValue(envFileText, KEY_VAR) || null;
  const base =
    (baseOverride ?? "").trim() ||
    (env[BASE_VAR] ?? "").trim() ||
    readEnvValue(envFileText, BASE_VAR) ||
    DEFAULT_BASE;
  return { key, base: base.replace(/\/+$/, "") };
}

/* ───────────────────────── 宛先を組み立てる ───────────────────────── */

export function buildUrl(base, { command, ids, json }) {
  const params = new URLSearchParams();
  if (command === "get") {
    if (ids.length === 1) params.set("id", ids[0]);
    else params.set("ids", ids.join(","));
  }
  params.set("format", json ? "json" : "markdown");
  return `${base}/api/improvements?${params.toString()}`;
}

/* ───────────────────────── 失敗を訳す ───────────────────────── */

/**
 * サーバーの返事を、原因と次の一手に訳す。
 * 返ってきた本文をそのまま出さないのは、断り文が「鍵の在り処の手がかりを
 * 与えない」形に作られていて、そのままでは何をすればよいか分からないため。
 */
export function describeFailure(status, retryAfter, base) {
  if (status === 401) {
    return [
      "鍵が受け付けられませんでした（違う鍵か、止められた鍵です）。",
      `${base}${KEY_PAGE_PATH} で鍵を発行し直し、${KEY_FILE} の ${KEY_VAR} を書き換えてください。`,
    ].join("\n");
  }
  if (status === 429) {
    const wait = Number.parseInt(retryAfter ?? "", 10);
    const seconds = Number.isFinite(wait) && wait > 0 ? wait : 60;
    return `短い間に繰り返し取りにいったため、いったん断られました。${seconds}秒ほど待ってからもう一度実行してください。`;
  }
  if (status === 503) {
    return [
      "受け取り側にまだ鍵が1本も登録されていません。",
      `${base}${KEY_PAGE_PATH} を開いて鍵を発行してください（発行すればこの状態は解消します）。`,
    ].join("\n");
  }
  if (status === 404) {
    return `宛先が見つかりませんでした（${base}）。--base で指定したURLを確かめてください。`;
  }
  return `受け取りに失敗しました（応答コード ${status}）。時間をおいてもう一度お試しください。`;
}

export function describeNetworkError(base, error) {
  return [
    `${base} につながりませんでした。`,
    "ネットワークの状態と、宛先のURLを確かめてください。",
    `詳細: ${error?.message ?? "不明"}`,
  ].join("\n");
}

/* ───────────────────────── 実行 ───────────────────────── */

/**
 * 台本の本体。外に触るものはすべて引数で受け取る（テストで差し替えるため）。
 * 戻り値は終了コード（0 なら成功）。
 */
export async function run({
  argv,
  env = {},
  envFileText = null,
  fetchImpl = fetch,
  out = console.log,
  err = console.error,
} = {}) {
  const parsed = parseArgs(argv ?? []);
  if (parsed.error) {
    err(`${parsed.error}\n\n${USAGE}`);
    return 1;
  }
  if (parsed.command === "help") {
    out(USAGE);
    return 0;
  }

  const { key, base } = resolveConfig({ env, envFileText, baseOverride: parsed.base });
  if (!key) {
    err(missingKeyMessage(base));
    return 1;
  }

  const url = buildUrl(base, parsed);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        authorization: `Bearer ${key}`,
        accept: parsed.json ? "application/json" : "text/markdown",
      },
    });
  } catch (error) {
    err(describeNetworkError(base, error));
    return 1;
  }

  if (!response.ok) {
    err(describeFailure(response.status, response.headers?.get?.("retry-after") ?? null, base));
    return 1;
  }

  const body = await response.text();
  out(body.trimEnd());
  if (parsed.dropped > 0) {
    err(`一度に読めるのは${BULK_MAX}件までです。${parsed.dropped}件は今回含めていません。`);
  }
  return 0;
}

/* ───────────────────────── 入口 ───────────────────────── */

function readEnvFile() {
  try {
    return readFileSync(resolve(process.cwd(), KEY_FILE), "utf8");
  } catch {
    return null;
  }
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  process.exitCode = await run({
    argv: process.argv.slice(2),
    env: process.env,
    envFileText: readEnvFile(),
  });
}
