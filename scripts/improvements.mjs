#!/usr/bin/env node
// 届いた改善要望を、この作業ディレクトリから直接読み出す。
//
// 使い方:
//   pnpm improvements list                  # 手つかずの要望を一覧で見る
//   pnpm improvements get <ID> [<ID>…]      # 作業指示文を読む（最大10件まとめて）
//   pnpm improvements done <ID> --release … # 直して公開したことを書き戻す
//   pnpm improvements failed <ID> --reason … # 直しきれなかった理由を残す
//   pnpm improvements key                   # 鍵の在り処だけを確かめる（値は出さない）
//
// 鍵の探し方は上から順に4つ。最初に見つかったものを使う。
//   1. 環境変数 HR_AGENT_KEY（その場だけ差し替えたいとき）
//   2. 1Password（HR_AGENT_KEY_OP_REF に op://… を書き、op コマンドで読む）
//   3. OSのキーチェーン（macOS の security コマンド）
//   4. リポジトリ直下の .env.local の HR_AGENT_KEY=…
// 1Password が入っていない環境でも 3・4 で動く。どこにも無ければ設定手順を出す。
//
// **この台本の外へ鍵の値を出さない。** 標準出力・エラー出力の両方を通す前に、
// 鍵と同じ文字列は必ず伏せ字へ置き換える（→ redactor）。取り違えて画面へ流すと、
// そこから先はログにも履歴にも残ってしまい、取り消せない。

import { execFileSync } from "node:child_process";
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

/** 1Password の場所を書く変数の名前。値ではなく「どこにあるか」だけを持つ。 */
export const OP_REF_VAR = "HR_AGENT_KEY_OP_REF";

/** OSのキーチェーンに入れるときの名前。手順書と合わせる。 */
export const KEYCHAIN_SERVICE = "hr-agent-key";

/** 出力に鍵が混じったときの置き換え先。長さも伏せる。 */
export const REDACTED = "********";

export const USAGE = [
  "使い方:",
  "  pnpm improvements list                    手つかずの改善要望を一覧で見る",
  "  pnpm improvements get <ID> [<ID>…]        作業指示文を読む（最大10件）",
  "  pnpm improvements done <ID> --release …   直して公開したことを書き戻す",
  "  pnpm improvements failed <ID> --reason …  直しきれなかった理由を残す",
  "  pnpm improvements key                     鍵の在り処だけを確かめる",
  "",
  "付けられるもの:",
  "  --json        機械処理用にJSONのまま出す",
  `  --base <URL>  宛先を変える（既定は本番。環境変数 ${BASE_VAR} でも指定できる）`,
  "  --release …   公開した先（本番URL・版の名前・確認依頼の番号）",
  "  --reason …    直しきれなかった理由",
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
  let detail = null;

  const fail = (message) => ({ error: message, command: null, ids: [], json, base, detail: null, dropped: 0 });
  const ok = (command, ids, dropped = 0) => ({ command, ids, dropped, json, base, detail });

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--base") {
      base = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg === "--release" || arg === "--reason") {
      detail = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--release=") || arg.startsWith("--reason=")) {
      detail = arg.slice(arg.indexOf("=") + 1);
    } else if (arg === "--help" || arg === "-h" || arg === "help") {
      return { command: "help", ids: [], json: false, base: null, detail: null, dropped: 0 };
    } else if (arg.startsWith("-")) {
      return fail(`${arg} は使えません。`);
    } else {
      rest.push(arg);
    }
  }

  if (base !== null && base.trim() === "") return fail("--base のあとに宛先のURLがありません。");

  const [command, ...ids] = rest;
  if (!command) return { command: "help", ids: [], json, base, detail, dropped: 0 };

  if (command === "list") {
    if (ids.length > 0) {
      return fail("list に要望IDは付けられません。1件読むときは get を使ってください。");
    }
    return ok("list", []);
  }

  if (command === "key") {
    if (ids.length > 0) return fail("key に要望IDは付けられません。");
    return ok("key", []);
  }

  if (command === "get") {
    if (ids.length === 0) {
      return fail("要望IDがありません。`pnpm improvements list` で番号を確かめてください。");
    }
    const unique = [...new Set(ids)];
    return ok("get", unique.slice(0, BULK_MAX), Math.max(0, unique.length - BULK_MAX));
  }

  // 書き戻しは必ず1件ずつ。まとめて「対応済み」にできる形にすると、
  // 直していないものまで一括で完了になり、あとから見分けられない。
  if (command === "done" || command === "failed") {
    if (ids.length !== 1) return fail(`${command} は要望IDを1つだけ指定してください。`);
    if ((detail ?? "").trim() === "") {
      return fail(
        command === "done"
          ? "--release に公開した先を書いてください（本番URL・版の名前・確認依頼の番号）。"
          : "--reason に直しきれなかった理由を書いてください。",
      );
    }
    return ok(command, ids);
  }

  return fail(`${command} という操作はありません。`);
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
    "1Password を使うときは、控えた鍵を保管庫に入れ、その場所だけを次の形で渡します。",
    `   ${OP_REF_VAR}=op://保管庫/項目名/credential`,
    "OSのキーチェーンに入れるときは、次の1行で登録できます。",
    `   security add-generic-password -s ${KEYCHAIN_SERVICE} -a "$USER" -w`,
    "",
    `${KEY_FILE} は共有されない設定ファイルです（除外済み）。鍵を他のファイルへ書かないでください。`,
  ].join("\n");
}

/* ───────────────────────── 鍵を解決する ───────────────────────── */

/**
 * 外の道具を1回だけ呼ぶ。失敗は理由を捨てて null にする。
 *
 * エラー出力を持ち帰らないのは、道具によっては失敗の文言に参照先や
 * 項目名が入るため。原因は「見つからなかった」だけで足り、それ以上を
 * 持ち歩くと、そのままどこかへ出てしまう。
 */
function runCommandSafely(command, args) {
  try {
    const out = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const value = out.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** 実際に 1Password とキーチェーンを読む係。テストではここを差し替える。 */
export function systemSecretReader(runCommand = runCommandSafely) {
  return {
    onePassword: (ref) => runCommand("op", ["read", "--no-newline", ref]),
    keychain: (service) => runCommand("security", ["find-generic-password", "-w", "-s", service]),
  };
}

/** どこにも読みにいかない係。テストと、道具を使わせたくないときの既定。 */
export const noSecretReader = { onePassword: () => null, keychain: () => null };

/**
 * 鍵と宛先を決める。鍵の在り処は次の順で、最初に見つかったものを使う。
 *   環境変数 → 1Password → キーチェーン → .env.local
 *
 * 環境変数を先頭にしているのは、その場だけ別の鍵で試したいときに、
 * 保管庫の中身を書き換えずに済ませるため。
 * 1Password が入っていない環境でも、そのまま下へ落ちて動く（詰まらせない）。
 *
 * 返すのは鍵そのものと、**どこから来たか**の名前だけ。名前は画面に出してよい。
 */
export function resolveConfig({
  env = {},
  envFileText = null,
  baseOverride = null,
  secrets = noSecretReader,
} = {}) {
  const opRef = (env[OP_REF_VAR] ?? "").trim();
  const candidates = [
    ["環境変数", () => (env[KEY_VAR] ?? "").trim() || null],
    ["1Password", () => (opRef ? secrets.onePassword(opRef) : null)],
    ["キーチェーン", () => secrets.keychain(KEYCHAIN_SERVICE)],
    [KEY_FILE, () => readEnvValue(envFileText, KEY_VAR)],
  ];

  let key = null;
  let source = null;
  for (const [name, read] of candidates) {
    const found = (read() ?? "").trim();
    if (found.length > 0) {
      key = found;
      source = name;
      break;
    }
  }

  const base =
    (baseOverride ?? "").trim() ||
    (env[BASE_VAR] ?? "").trim() ||
    readEnvValue(envFileText, BASE_VAR) ||
    DEFAULT_BASE;
  return { key, source, base: base.replace(/\/+$/, "") };
}

/**
 * 出力に鍵が混じっていたら伏せる。
 *
 * 訳した文だけを出す作りにはしてあるが、それは「いま」正しいだけで、
 * あとから追加した1行が鍵を含む可能性は消せない。最後の1枚をここに置く。
 */
export function redact(text, key) {
  if (!key || key.length === 0) return text;
  return String(text).split(key).join(REDACTED);
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
  secrets = noSecretReader,
  out: rawOut = console.log,
  err: rawErr = console.error,
} = {}) {
  const parsed = parseArgs(argv ?? []);
  // 鍵を解決する前の出力にも、同じ関数を通す（あとから分岐が増えても素通りしない）。
  let secret = null;
  const out = (text) => rawOut(redact(text, secret));
  const err = (text) => rawErr(redact(text, secret));

  if (parsed.error) {
    err(`${parsed.error}\n\n${USAGE}`);
    return 1;
  }
  if (parsed.command === "help") {
    out(USAGE);
    return 0;
  }

  const { key, source, base } = resolveConfig({ env, envFileText, baseOverride: parsed.base, secrets });
  secret = key;
  if (!key) {
    err(missingKeyMessage(base));
    return 1;
  }

  // 在り処だけを言う。値は出さない（出さないことは、この関数の外でも試験する）。
  if (parsed.command === "key") {
    out([`鍵は ${source} から読めています。`, `宛先: ${base}`].join("\n"));
    return 0;
  }

  const writing = parsed.command === "done" || parsed.command === "failed";
  const url = writing ? `${base}/api/improvements` : buildUrl(base, parsed);
  const init = writing
    ? {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          id: parsed.ids[0],
          result: parsed.command === "done" ? "done" : "failed",
          detail: parsed.detail.trim(),
        }),
      }
    : {
        headers: {
          authorization: `Bearer ${key}`,
          accept: parsed.json ? "application/json" : "text/markdown",
        },
      };

  let response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    err(describeNetworkError(base, error));
    return 1;
  }

  const body = await response.text();

  if (!response.ok) {
    // 書き戻しの断りは、サーバーが出す日本語の理由がそのまま次の一手になる
    // （権限が無い・受け取っていない・公開先が空、など）。訳し直すと薄くなる。
    const reason = writing ? serverMessage(body) : null;
    err(reason ?? describeFailure(response.status, response.headers?.get?.("retry-after") ?? null, base));
    return 1;
  }

  out(writing ? (serverMessage(body) ?? "書き戻しました。") : body.trimEnd());
  if (parsed.dropped > 0) {
    err(`一度に読めるのは${BULK_MAX}件までです。${parsed.dropped}件は今回含めていません。`);
  }
  return 0;
}

/** 応答の JSON から日本語の1文だけを取り出す。読めなければ null。 */
export function serverMessage(body) {
  try {
    const parsed = JSON.parse(body);
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
    return message.length > 0 ? message : null;
  } catch {
    return null;
  }
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
    // 保管庫を読むのは、実際に走らせたときだけ。試験では差し替える。
    secrets: systemSecretReader(),
  });
}
