#!/usr/bin/env node
// 届いた改善要望を、この作業ディレクトリから直接読み出す。
//
// 使い方:
//   pnpm improvements list                  # 手つかずの要望を一覧で見る
//   pnpm improvements get <ID> [<ID>…]      # 作業指示文を読む（最大10件まとめて）
//   pnpm improvements review <ID> --pr …    # 確認依頼を作ったことを書き戻す
//   pnpm improvements done <ID> --pr …      # その確認依頼が取り込まれたことを書き戻す
//   pnpm improvements failed <ID> --reason … # 直しきれなかった理由を残す
//   pnpm improvements login                 # ブラウザで承認して、この端末を通す
//   pnpm improvements key                   # 通行証の在り処だけを確かめる（値は出さない）
//
// 受け取りに使うものは2種類ある。上が本筋で、下は移行のために残している。
//   A. 通行証（HR_AGENT_TOKEN）… `login` で受け取る。15分の短い通行証を毎回取り直す
//   B. 長命の鍵（HR_AGENT_KEY） … 画面で発行した鍵。古い方式（そのうち止める）
//
// 値が op:// で始まるときは、この台本が自分自身を `op run --` で起動し直す。
// そうすると 1Password が値を**この処理の環境変数にだけ**入れてくれるので、
// ディスクにも画面にも平文が現れない。op が無い環境ではそのまま下の段で動く。
//
// 探し方は上から順に4つ。最初に見つかったものを使う。
//   1. 環境変数 HR_AGENT_KEY（その場だけ差し替えたいとき）
//   2. 1Password（HR_AGENT_KEY_OP_REF に op://… を書き、op コマンドで読む）
//   3. OSのキーチェーン（macOS の security コマンド）
//   4. リポジトリ直下の .env.local の HR_AGENT_KEY=…
// 1Password が入っていない環境でも 3・4 で動く。どこにも無ければ設定手順を出す。
//
// **この台本の外へ鍵の値を出さない。** 標準出力・エラー出力の両方を通す前に、
// 鍵と同じ文字列は必ず伏せ字へ置き換える（→ redactor）。取り違えて画面へ流すと、
// そこから先はログにも履歴にも残ってしまい、取り消せない。

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
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

/** 通行証（長い方）を置く変数の名前。`login` が書き込む先でもある。 */
export const TOKEN_VAR = "HR_AGENT_TOKEN";

/** 通行証を 1Password に置くときの、場所を書く変数の名前。 */
export const TOKEN_OP_REF_VAR = "HR_AGENT_TOKEN_OP_REF";

/** 通行証を OSのキーチェーンに入れるときの名前。 */
export const TOKEN_KEYCHAIN_SERVICE = "hr-agent-token";

/** 承認待ちを作る・引き取る入口。 */
export const DEVICE_PATH = "/api/agent/device";

/** 短い通行証を取り直す入口。 */
export const TOKEN_PATH = "/api/agent/token";

/** `op run --` の中で動いていることの目印。二重に起動し直さないために見る。 */
export const OP_RUN_GUARD = "HR_AGENT_OP_RUN";

/** 出力に鍵が混じったときの置き換え先。長さも伏せる。 */
export const REDACTED = "********";

/**
 * 古い方式の鍵で動いたときに添える1文（`src/lib/domain/agent-device.ts` と同じ文言）。
 * この台本は TypeScript を読み込めないため、ここに写しを置く。
 */
export const LEGACY_KEY_NOTICE =
  "この鍵は古い方式です。\n`pnpm improvements login` で短い通行証に移せます。";

export const USAGE = [
  "使い方:",
  "  pnpm improvements list                    手つかずの改善要望を一覧で見る",
  "  pnpm improvements get <ID> [<ID>…]        作業指示文を読む（最大10件）",
  "  pnpm improvements review <ID> --pr …      確認依頼を作ったことを書き戻す",
  "  pnpm improvements done <ID> --pr …        確認依頼が取り込まれたことを書き戻す",
  "  pnpm improvements failed <ID> --reason …  直しきれなかった理由を残す",
  "  pnpm improvements login                   ブラウザで承認して、この端末を通す",
  "  pnpm improvements key                     通行証の在り処だけを確かめる",
  "",
  "付けられるもの:",
  "  --json        機械処理用にJSONのまま出す",
  `  --base <URL>  宛先を変える（既定は本番。環境変数 ${BASE_VAR} でも指定できる）`,
  "  --pr …        確認依頼の場所（URL・番号のどちらか。--release でも同じ）",
  "  --reason …    直しきれなかった理由",
  "  --label …     この端末の名前（login のときだけ）",
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
  let label = null;

  const fail = (message) => ({
    error: message,
    command: null,
    ids: [],
    json,
    base,
    detail: null,
    label: null,
    dropped: 0,
  });
  const ok = (command, ids, dropped = 0) => ({ command, ids, dropped, json, base, detail, label });

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--base") {
      base = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg === "--label") {
      label = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--label=")) {
      label = arg.slice("--label=".length);
    } else if (arg === "--pr" || arg === "--release" || arg === "--reason") {
      // --release は v53 までの書き方。使い続けている手順書のために受け続ける。
      detail = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--pr=") || arg.startsWith("--release=") || arg.startsWith("--reason=")) {
      detail = arg.slice(arg.indexOf("=") + 1);
    } else if (arg === "--help" || arg === "-h" || arg === "help") {
      return { command: "help", ids: [], json: false, base: null, detail: null, label: null, dropped: 0 };
    } else if (arg.startsWith("-")) {
      return fail(`${arg} は使えません。`);
    } else {
      rest.push(arg);
    }
  }

  if (base !== null && base.trim() === "") return fail("--base のあとに宛先のURLがありません。");

  const [command, ...ids] = rest;
  if (!command) return { command: "help", ids: [], json, base, detail, label, dropped: 0 };

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

  if (command === "login") {
    if (ids.length > 0) return fail("login に要望IDは付けられません。");
    return ok("login", []);
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
  if (command === "review" || command === "done" || command === "failed") {
    if (ids.length !== 1) return fail(`${command} は要望IDを1つだけ指定してください。`);
    if ((detail ?? "").trim() === "") {
      return fail(
        command === "failed"
          ? "--reason に直しきれなかった理由を書いてください。"
          : "--pr に確認依頼の場所を書いてください（URL・番号のどちらか）。",
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
 * まだ何も持っていないときの案内。`login` を先頭に置く。
 * 値はどこにも出さない（この関数は通行証も鍵も受け取らない）。
 */
export function missingKeyMessage(base) {
  return [
    "この作業ディレクトリは、まだ改善要望を読める状態になっていません。",
    "",
    "1. 次を実行します。ターミナルに合言葉が出ます。",
    "   pnpm improvements login",
    "2. ブラウザで次の画面を開き、合言葉を入れて「この端末を通す」を押します。",
    `   ${base}${KEY_PAGE_PATH}`,
    "3. もう一度 `pnpm improvements list` を実行します。",
    "",
    `受け取った通行証は ${KEY_FILE} に書き込みます（共有されない設定ファイルです）。`,
    "1Password に移すときは、その1行の値を保管庫へ入れ、次の形に書き換えます。",
    `   ${TOKEN_VAR}=op://保管庫/項目名/credential`,
    "こう書くと、値は `op run --` でこの処理にだけ渡り、ファイルには残りません。",
    "OSのキーチェーンに入れるときは、次の1行で登録できます。",
    `   security add-generic-password -s ${TOKEN_KEYCHAIN_SERVICE} -a "$USER" -w`,
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
 * 使うもの（通行証・鍵）と宛先を決める。在り処は次の順で、最初に見つかったものを使う。
 *   環境変数 → 1Password → キーチェーン → .env.local
 *
 * 環境変数を先頭にしているのは、その場だけ別のもので試したいときに、
 * 保管庫の中身を書き換えずに済ませるため。
 * 1Password が入っていない環境でも、そのまま下へ落ちて動く（詰まらせない）。
 *
 * 返すのは値そのものと、**どこから来たか**の名前だけ。名前は画面に出してよい。
 */
function resolveOne({ env, envFileText, secrets, varName, opRefVar, keychainService }) {
  const opRef = (env[opRefVar] ?? "").trim();
  const candidates = [
    ["環境変数", () => (env[varName] ?? "").trim() || null],
    ["1Password", () => (opRef ? secrets.onePassword(opRef) : null)],
    ["キーチェーン", () => secrets.keychain(keychainService)],
    [KEY_FILE, () => readEnvValue(envFileText, varName)],
  ];
  for (const [name, read] of candidates) {
    const found = (read() ?? "").trim();
    if (found.length > 0) return { value: found, source: name };
  }
  return { value: null, source: null };
}

export function resolveConfig({
  env = {},
  envFileText = null,
  baseOverride = null,
  secrets = noSecretReader,
} = {}) {
  const token = resolveOne({
    env,
    envFileText,
    secrets,
    varName: TOKEN_VAR,
    opRefVar: TOKEN_OP_REF_VAR,
    keychainService: TOKEN_KEYCHAIN_SERVICE,
  });
  const key = resolveOne({
    env,
    envFileText,
    secrets,
    varName: KEY_VAR,
    opRefVar: OP_REF_VAR,
    keychainService: KEYCHAIN_SERVICE,
  });

  const base =
    (baseOverride ?? "").trim() ||
    (env[BASE_VAR] ?? "").trim() ||
    readEnvValue(envFileText, BASE_VAR) ||
    DEFAULT_BASE;
  return {
    token: token.value,
    tokenSource: token.source,
    key: key.value,
    source: key.source,
    base: base.replace(/\/+$/, ""),
  };
}

/**
 * 1Password に値を預けているとき、自分自身を `op run --` で起動し直す計画を作る。
 *
 * こうすると値は**この処理の環境変数にだけ**入り、ファイルにも画面にも残らない。
 * すでに `op run` の中にいるときは何もしない（無限に起動し直さないため）。
 * 参照が環境変数側にあるならそのまま渡し、設定ファイル側にあるならファイルごと渡す。
 */
export function opRunPlan({ env = {}, envFileText = null, scriptPath = "", argv = [], execPath = "node" } = {}) {
  if ((env[OP_RUN_GUARD] ?? "") === "1") return null;
  const inEnv = [TOKEN_VAR, KEY_VAR].some((name) => (env[name] ?? "").startsWith("op://"));
  const inFile = [TOKEN_VAR, KEY_VAR].some((name) =>
    (readEnvValue(envFileText, name) ?? "").startsWith("op://"),
  );
  if (!inEnv && !inFile) return null;
  const args = inEnv
    ? ["run", "--", execPath, scriptPath, ...argv]
    : ["run", "--env-file", KEY_FILE, "--", execPath, scriptPath, ...argv];
  return { command: "op", args };
}

/**
 * 設定ファイルの1行を書き替える（無ければ足す）。値は返り値の中だけに置く。
 * 既にある行を残したまま足すと、古い通行証が先に読まれて動かなくなる。
 */
export function writeEnvLine(text, name, value) {
  const lines = (text ?? "").split(/\r?\n/);
  const kept = lines.filter((line) => {
    const trimmed = line.trim().replace(/^export\s+/, "");
    return !trimmed.startsWith(`${name}=`);
  });
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
  kept.push(`${name}=${value}`, "");
  return kept.join("\n");
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

/* ───────────────────────── 通行証をやりとりする ───────────────────────── */

/**
 * 長い方の通行証で、短い方を取り直す。毎回取り直すので、手元に短い方を残さない。
 * 残さないから、置き場所を守る仕組みも要らない（無いものは漏れない）。
 */
export async function requestAccessToken(fetchImpl, base, refreshToken) {
  const res = await fetchImpl(`${base}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await res.text();
  if (!res.ok) return { token: null, message: serverMessage(body) ?? describeFailure(res.status, null, base) };
  try {
    const parsed = JSON.parse(body);
    const token = typeof parsed?.accessToken === "string" ? parsed.accessToken : "";
    if (token.length === 0) return { token: null, message: "通行証を受け取れませんでした。" };
    return { token, message: null };
  } catch {
    return { token: null, message: "通行証を受け取れませんでした。" };
  }
}

/**
 * ブラウザで承認してもらい、この端末を通す。
 *
 * 受け取った通行証は**表示しない**。表示するとターミナルの履歴に残り、
 * そこから先は消して回れない。書き込み先だけを言う。
 */
export async function runLogin({ fetchImpl, base, label, out, err, sleep, saveToken, addSecret }) {
  let started;
  try {
    started = await fetchImpl(`${base}${DEVICE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ label: label ?? "" }),
    });
  } catch (error) {
    err(describeNetworkError(base, error));
    return 1;
  }
  const startBody = await started.text();
  if (!started.ok) {
    err(serverMessage(startBody) ?? describeFailure(started.status, null, base));
    return 1;
  }
  let start;
  try {
    start = JSON.parse(startBody);
  } catch {
    err("承認の手続きを始められませんでした。");
    return 1;
  }
  addSecret(start.deviceCode);
  out(start.instructions);

  const intervalMs = Math.max(1, Number(start.intervalSeconds) || 5) * 1000;
  const deadline = Date.now() + Math.max(1, Number(start.expiresInMinutes) || 10) * 60_000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    let res;
    try {
      res = await fetchImpl(`${base}${DEVICE_PATH}`, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ deviceCode: start.deviceCode }),
      });
    } catch (error) {
      err(describeNetworkError(base, error));
      return 1;
    }
    const body = await res.text();
    if (!res.ok) {
      err(serverMessage(body) ?? describeFailure(res.status, null, base));
      return 1;
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      err("承認の結果を読めませんでした。");
      return 1;
    }
    if (parsed.state === "pending") continue;
    if (parsed.state !== "approved") {
      err(parsed.message ?? "承認されませんでした。");
      return 1;
    }
    addSecret(parsed.refreshToken);
    addSecret(parsed.accessToken);
    saveToken(parsed.refreshToken);
    out(
      [
        "この端末を通しました。",
        `通行証は ${KEY_FILE} に書き込みました（表示はしません）。`,
        "つづけて `pnpm improvements list` を実行できます。",
      ].join("\n"),
    );
    return 0;
  }
  err("承認されないまま、合言葉の期限が切れました。もう一度お試しください。");
  return 1;
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
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  saveToken = () => {},
} = {}) {
  const parsed = parseArgs(argv ?? []);
  // 値を解決する前の出力にも、同じ関数を通す（あとから分岐が増えても素通りしない）。
  const found = [];
  const addSecret = (value) => {
    if (typeof value === "string" && value.length > 0) found.push(value);
  };
  const hide = (text) => found.reduce((acc, s) => redact(acc, s), String(text));
  const out = (text) => rawOut(hide(text));
  const err = (text) => rawErr(hide(text));

  if (parsed.error) {
    err(`${parsed.error}\n\n${USAGE}`);
    return 1;
  }
  if (parsed.command === "help") {
    out(USAGE);
    return 0;
  }

  const { token, tokenSource, key, source, base } = resolveConfig({
    env,
    envFileText,
    baseOverride: parsed.base,
    secrets,
  });
  addSecret(token);
  addSecret(key);

  if (parsed.command === "login") {
    return runLogin({ fetchImpl, base, label: parsed.label, out, err, sleep, saveToken, addSecret });
  }

  if (!token && !key) {
    err(missingKeyMessage(base));
    return 1;
  }

  // 在り処だけを言う。値は出さない（出さないことは、この関数の外でも試験する）。
  if (parsed.command === "key") {
    const where = token ? `通行証は ${tokenSource} から読めています。` : `鍵は ${source} から読めています。`;
    out([where, `宛先: ${base}`].join("\n"));
    return 0;
  }

  // 通行証があれば、その場で短い方を取り直す。手元には短い方を残さない。
  let bearer = key;
  if (token) {
    let issued;
    try {
      issued = await requestAccessToken(fetchImpl, base, token);
    } catch (error) {
      err(describeNetworkError(base, error));
      return 1;
    }
    if (!issued.token) {
      err(issued.message ?? "通行証を取り直せませんでした。");
      return 1;
    }
    addSecret(issued.token);
    bearer = issued.token;
  }
  // 古い方式の注意は、いちばん最後に出す。先に出すと、本当の理由の上に
  // 覆いかぶさって「何が起きたか」が読み取りにくくなる。
  const notice = () => {
    if (!token) err(LEGACY_KEY_NOTICE);
  };

  const writing =
    parsed.command === "review" || parsed.command === "done" || parsed.command === "failed";
  const url = writing ? `${base}/api/improvements` : buildUrl(base, parsed);
  const init = writing
    ? {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          id: parsed.ids[0],
          result: parsed.command,
          detail: parsed.detail.trim(),
        }),
      }
    : {
        headers: {
          authorization: `Bearer ${bearer}`,
          accept: parsed.json ? "application/json" : "text/markdown",
        },
      };

  let response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    err(describeNetworkError(base, error));
    notice();
    return 1;
  }

  const body = await response.text();

  if (!response.ok) {
    // 書き戻しの断りは、サーバーが出す日本語の理由がそのまま次の一手になる
    // （権限が無い・受け取っていない・確認依頼の場所が空、など）。訳し直すと薄くなる。
    const reason = writing ? serverMessage(body) : null;
    err(reason ?? describeFailure(response.status, response.headers?.get?.("retry-after") ?? null, base));
    notice();
    return 1;
  }

  out(writing ? (serverMessage(body) ?? "書き戻しました。") : body.trimEnd());
  if (parsed.dropped > 0) {
    err(`一度に読めるのは${BULK_MAX}件までです。${parsed.dropped}件は今回含めていません。`);
  }
  notice();
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

/**
 * 受け取った通行証を設定ファイルへ書き込む。所有者だけが読める権限にする。
 * 値を返さず、画面にも出さない（呼び出し側は成否しか知らない）。
 */
function saveTokenToFile(value) {
  const path = resolve(process.cwd(), KEY_FILE);
  writeFileSync(path, writeEnvLine(readEnvFile(), TOKEN_VAR, value), { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const envFileText = readEnvFile();
  // 1Password に預けているなら、自分自身を `op run --` で起動し直す。
  // こうすると値はこの処理の環境変数にだけ入り、画面にもファイルにも出ない。
  const plan = opRunPlan({
    env: process.env,
    envFileText,
    scriptPath: fileURLToPath(import.meta.url),
    argv: process.argv.slice(2),
    execPath: process.execPath,
  });
  if (plan) {
    const child = spawnSync(plan.command, plan.args, {
      stdio: "inherit",
      env: { ...process.env, [OP_RUN_GUARD]: "1" },
    });
    // `op` が入っていない環境では、そのまま自分で続ける（詰まらせない）。
    if (!child.error) process.exit(child.status ?? 1);
  }
  process.exitCode = await run({
    argv: process.argv.slice(2),
    env: process.env,
    envFileText,
    // 保管庫を読むのは、実際に走らせたときだけ。試験では差し替える。
    secrets: systemSecretReader(),
    saveToken: saveTokenToFile,
  });
}
