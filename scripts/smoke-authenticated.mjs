#!/usr/bin/env node
/**
 * ログインした状態で主要な画面を開き、移行（migration）の当て漏れが無いかを確かめる。
 *
 * なぜ要るか:
 *   配布の流れ（.github/workflows/deploy.yml）は、未適用の移行が残っていれば
 *   scripts/verify-d1-migrations-list.mjs で止め、配布のあとに .github/scripts/smoke.sh で
 *   / と /login だけをログインせずに確かめている。
 *   けれども、表が無いときに落ちるのはログインのあとに DB を読む画面のほうである。
 *   0010（profile_field_policies）を当て忘れると、/account や「本人が変更できる項目」の画面が
 *   no such table で落ちるのに、ログイン前の2枚は通ってしまう（backlog E8・OPS-001）。
 *   そこで役割ごとに入り直し、その役割で開けるはずの画面を1枚ずつ開いて確かめる。
 *
 * 使い方:
 *   1. ローカル D1 に移行を当て、preview を起動したままにする
 *        pnpm run db:migrate:local
 *        pnpm run preview
 *   2. 別の端末で流す（宛先は --origin か環境変数 APP_URL。既定は http://localhost:8787）
 *        pnpm run smoke:auth -- --origin http://localhost:8787
 *   見本の利用者が要るので、ローカル D1 が空なら先に `pnpm run db:seed:local` を流す
 *   （全置換なので、手で入れたデータは消える）。
 *
 * 失敗とみなすもの（1件でもあれば終了コード 1）:
 *   - 200 以外。/login や自分のホームへの転送も失敗（ログインが通っていない・開けない役割になっている）
 *   - 200 でも、本文にエラーの印があるもの（no such table など）。
 *     Next.js は画面の途中で起きた例外を 200 のまま返し、ブラウザ側でエラー画面に差し替える。
 *     本番では例外の文面も伏せられるので、文面だけでなく例外の印（data-dgst）も見る。
 *
 * 利用者:
 *   手元（localhost）に向けるときは、見本データの利用者（scripts/seed-data.mjs）で入る。
 *   それ以外に向けるときは、選んだ役割の環境変数（SMOKE_<役割>_EMAIL / _PASSWORD）が
 *   そろっていないと、通信の前に止まる。見本のパスワードで本番に入りにいかないため。
 *   本番の資格情報をこのファイルに書かない。パスワードは出力に出さない（出そうになったら伏せる）。
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 宛先の既定値。preview の既定の港番号に合わせる。 */
export const DEFAULT_ORIGIN = "http://localhost:8787";

/** 宛先を渡す環境変数。.github/scripts/smoke.sh と同じ名前にする。 */
export const ORIGIN_VAR = "APP_URL";

/** 操作する会社を選ぶ cookie。src/lib/session.ts の COMPANY_SCOPE_COOKIE と同じ名前。 */
export const COMPANY_COOKIE = "hr_company";

/** 伏せ字。 */
export const REDACTED = "********";

/** 1つの通信を待つ上限（秒）。preview は最初の描画に数秒かかるので、短くしすぎない。 */
export const DEFAULT_TIMEOUT_SECONDS = 60;

/** ローカルとみなす宛先。playwright.config.ts の LOCAL_HOSTS と同じ。 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * ログインの試行制限（Better Auth の既定は10秒に3回）に当たったときの待ち方。
 * 制限を緩めずに、言われた秒数だけ待って入り直す。回数と1回の待ちには上限を置く。
 */
const LOGIN_RETRIES = 5;
const MAX_WAIT_SECONDS = 60;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/* ───────────────────────── 役割と画面の表 ───────────────────────── */

/**
 * 確かめる役割。label はアプリの呼び名（src/lib/roles.ts の ROLE_LABEL）に合わせる。
 * demo は見本データ（scripts/seed-data.mjs）での利用者。tenant は1社目の会社の key。
 */
export const ROLES = [
  {
    key: "employee",
    label: "一般",
    role: "EMPLOYEE",
    demo: (tenant) => ({ email: `e1@${tenant}.hyoka-demo.jp` }),
  },
  {
    key: "manager",
    label: "マネージャー",
    role: "MANAGER",
    // さくら福祉会にも一般として所属しているので、会社を選ばないと一般の画面が開く（DD-009）。
    // scripts/scan-rendered-text.mjs と同じく、会社の切り替えと同じ cookie で1社目を選ぶ
    demo: (tenant) => ({ email: `manager@${tenant}.hyoka-demo.jp`, company: `cmp_${tenant}` }),
  },
  {
    key: "company-admin",
    label: "会社の管理者",
    role: "COMPANY_ADMIN",
    demo: (tenant) => ({ email: `admin@${tenant}.hyoka-demo.jp` }),
  },
  {
    key: "super-admin",
    label: "システム全体管理者",
    role: "SUPER_ADMIN",
    demo: () => ({ email: "super@hyoka-demo.jp" }),
  },
];

/**
 * 役割ごとに開く画面。見る範囲を変えるときはここだけを直す。
 *
 * どれも「その役割で開けるはずの画面」で、開けるかどうかの正本はルート台帳
 * （system-spec/route-ledger.json）。台帳と食い違うと試験（smoke-authenticated.test.mjs）が落ちる。
 * reads はその画面が読む主な表。移行で表を足したら、それを読む画面がここにあるかを確かめる。
 * どの画面も、ログインした人の所属（company_memberships）を読んでから描く。
 *
 * id つきの画面は、同じ役割で先に開いた一覧（from）のリンクから、実在する id を拾って開く。
 * exclude は、同じ形をしているが id ではない段（/admin/members/policy の policy）。
 */
export const PAGES = [
  {
    path: "/account",
    roles: ["employee", "manager", "company-admin", "super-admin"],
    reads: "自分の登録内容と、本人が変えてよい項目（profile_field_policies）",
  },
  { path: "/me", roles: ["employee"], reads: "自分のアンケートと評価" },
  { path: "/manager", roles: ["manager"], reads: "部下の評価の進み具合" },
  { path: "/admin", roles: ["company-admin"], reads: "会社の設定の不足と提出状況" },
  {
    path: "/admin/members",
    roles: ["company-admin", "super-admin"],
    reads: "社員の一覧と所属・本人が変えてよい項目（profile_field_policies）",
  },
  {
    path: "/admin/members/[id]",
    roles: ["company-admin"],
    from: "/admin/members",
    exclude: ["policy"],
    reads: "社員1人の登録内容と、本人が変えてよい項目（profile_field_policies）",
  },
  {
    path: "/admin/members/policy",
    roles: ["company-admin", "super-admin"],
    reads: "本人が変えてよい項目（profile_field_policies）",
  },
  { path: "/system", roles: ["super-admin"], reads: "全社の状況" },
  { path: "/system/users", roles: ["super-admin"], reads: "全社の利用者と所属" },
];

/** 役割ごとに、開く順で画面を並べる。 */
export function planChecks(roleKeys = ROLES.map((r) => r.key)) {
  return roleKeys.flatMap((key) =>
    PAGES.filter((page) => page.roles.includes(key)).map((page) => ({ role: key, page })),
  );
}

/** 役割の環境変数の頭。company-admin → SMOKE_COMPANY_ADMIN */
export function envPrefix(roleKey) {
  return `SMOKE_${roleKey.toUpperCase().replaceAll("-", "_")}`;
}

/* ───────────────────────── 入力を読む ───────────────────────── */

export function usage() {
  const roleLines = ROLES.map((r) => {
    const paths = planChecks([r.key]).map(({ page }) => page.path).join(" ");
    return `  ${r.key.padEnd(14)}${r.label}: ${paths}`;
  });
  return [
    "使い方:",
    "  pnpm run smoke:auth -- [--origin <URL>] [--roles <役割,…>] [--timeout <秒>]",
    "",
    "付けられるもの:",
    `  --origin <URL>   宛先（環境変数 ${ORIGIN_VAR} でも渡せる。既定は ${DEFAULT_ORIGIN}）`,
    "  --roles <役割>   確かめる役割をカンマ区切りで絞る（既定は全部）",
    `  --timeout <秒>   1つの通信を待つ上限（既定は ${DEFAULT_TIMEOUT_SECONDS} 秒）`,
    "  --help           この説明を出す",
    "",
    "役割と開く画面:",
    ...roleLines,
    "",
    "利用者:",
    "  手元（localhost・127.0.0.1・[::1]）では、見本データの利用者で入る（pnpm run db:seed:local）。",
    "  役割ごとに次の環境変数で差し替えられる。手元以外に向けるときは、選んだ役割の分が必須。",
    ...ROLES.map((r) => `    ${envPrefix(r.key)}_EMAIL / ${envPrefix(r.key)}_PASSWORD / ${envPrefix(r.key)}_COMPANY（会社 id。任意）`),
    "",
    "終わり方:",
    "  0 = 全部 OK / 1 = NG が1件以上 / 2 = 引数・利用者の指定が足りない（通信する前に止めた）",
  ].join("\n");
}

/**
 * 引数を読む。分からない書き方は、その場で理由を付けて止める。
 * 打ち間違いを読み飛ばして全部 OK と出すと、確かめていないのに通ったことになる。
 */
export function parseArgs(argv) {
  const result = { help: false, origin: null, roles: null, timeoutSeconds: DEFAULT_TIMEOUT_SECONDS, error: null };
  const fail = (message) => ({ ...result, error: message });
  const valueOf = (name, i) => {
    const arg = argv[i];
    if (arg.startsWith(`--${name}=`)) return { value: arg.slice(name.length + 3), next: i };
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) return { value: null, next: i };
    return { value, next: i + 1 };
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    // `pnpm run smoke:auth -- --origin …` の区切りがそのまま届くことがあるので読み飛ばす
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") return { ...result, help: true };
    const name = ["origin", "roles", "timeout"].find((n) => arg === `--${n}` || arg.startsWith(`--${n}=`));
    if (!name) {
      return fail(arg.startsWith("-") ? `${arg} は使えません。` : `${arg} は読めません。宛先は --origin で渡してください。`);
    }
    const { value, next } = valueOf(name, i);
    i = next;
    if (value === null || value.trim() === "") return fail(`--${name} の値を指定してください。`);

    if (name === "origin") {
      result.origin = value.trim();
    } else if (name === "roles") {
      const keys = [...new Set(value.split(",").map((k) => k.trim()).filter(Boolean))];
      const unknown = keys.filter((k) => !ROLES.some((r) => r.key === k));
      if (unknown.length > 0) {
        return fail(`役割 ${unknown.join(", ")} はありません。使えるのは ${ROLES.map((r) => r.key).join(", ")} です。`);
      }
      if (keys.length === 0) return fail("--roles の値を指定してください。");
      // 表の順に並べ直す（出力の順を、指定の書き方で変えない）
      result.roles = ROLES.map((r) => r.key).filter((k) => keys.includes(k));
    } else {
      const seconds = Number(value);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) {
        return fail("--timeout は 1〜600 の整数（秒）で指定してください。");
      }
      result.timeoutSeconds = seconds;
    }
  }
  return result;
}

/**
 * 宛先を読む。ログインの Origin ヘッダーと cookie は宛先の origin で決まるので、
 * パスや問い合わせの付いた URL は受け付けない（付いていても黙って捨てると、指したつもりの先とずれる）。
 */
export function resolveOrigin(raw) {
  let url;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    return { origin: null, error: `宛先 ${raw} は URL として読めません。` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { origin: null, error: `宛先は http か https にしてください（${url.protocol}）。` };
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    return { origin: null, error: `宛先には ${url.origin} のように origin だけを渡してください。` };
  }
  return { origin: url.origin, error: null };
}

export function isLocalOrigin(origin) {
  return LOCAL_HOSTS.has(new URL(origin).hostname);
}

/**
 * 役割ごとの利用者を決める。
 *
 * 環境変数の EMAIL と PASSWORD は2つ1組。片方だけのときは、見本のパスワードと混ぜずに足りないものとして返す。
 * どちらも無いときは、見本（demo）があれば見本で入る。demo は手元に向けるときだけ渡す。
 * 返す missing は変数の名前だけ。値は入れない。
 */
export function resolveAccounts({ roleKeys = ROLES.map((r) => r.key), env = {}, demo = null }) {
  const accounts = [];
  const missing = [];
  for (const key of roleKeys) {
    const role = ROLES.find((r) => r.key === key);
    const prefix = envPrefix(key);
    const email = (env[`${prefix}_EMAIL`] ?? "").trim();
    const password = env[`${prefix}_PASSWORD`] ?? "";
    const company = (env[`${prefix}_COMPANY`] ?? "").trim() || null;

    if (email || password) {
      if (!email) missing.push(`${prefix}_EMAIL`);
      if (!password) missing.push(`${prefix}_PASSWORD`);
      if (email && password) accounts.push({ key, label: role.label, email, password, company, source: "env" });
      continue;
    }
    if (demo) {
      const user = role.demo(demo.tenant);
      accounts.push({
        key,
        label: role.label,
        email: user.email,
        password: demo.password,
        company: company ?? user.company ?? null,
        source: "demo",
      });
      continue;
    }
    missing.push(`${prefix}_EMAIL`, `${prefix}_PASSWORD`);
  }
  return { accounts, missing };
}

/** 見本データの利用者の作り方を読む。手元に向けるときだけ読む（本番向けには見本を使わない）。 */
export async function loadDemoSeed() {
  const { COMPANIES, DEMO_PASSWORD } = await import("./seed-data.mjs");
  const tenant = COMPANIES.find((c) => c.isTenantOfRecord)?.key;
  if (!tenant) throw new Error("scripts/seed-data.mjs に1社目（isTenantOfRecord）の会社がありません。");
  return { tenant, password: DEMO_PASSWORD };
}

/* ───────────────────────── 判定 ───────────────────────── */

/**
 * 200 の本文に出ていたら失敗とみなす印。上から順に、原因に近いものを先に置く。
 * 文面の印（no such table など）は、開発用の起動や、例外の文面を伏せない経路で出る。
 * 本番の起動では文面が伏せられ、data-dgst の数字だけが残る（下の digestReason）。
 */
const BODY_MARKS = [
  { pattern: /no such table(?::\s*([\w.]+))?/i, label: (m) => `表が無い（no such table${m[1] ? `: ${m[1]}` : ""}）` },
  { pattern: /no such column(?::\s*([\w.]+))?/i, label: (m) => `列が無い（no such column${m[1] ? `: ${m[1]}` : ""}）` },
  { pattern: /D1_ERROR|SQLITE_ERROR/, label: (m) => `D1 のエラー（${m[0]}）` },
  { pattern: /id="__next_error__"/, label: () => "Next.js のエラー画面" },
  { pattern: /Application error/, label: () => "Application error" },
  { pattern: /Internal Server Error/, label: () => "Internal Server Error" },
  { pattern: /エラーが発生/, label: () => "「エラーが発生」の表示" },
  // src/app/error.tsx の見出し
  { pattern: /画面を表示できませんでした/, label: () => "エラー画面（画面を表示できませんでした）" },
];

/**
 * 画面の途中で止まった印（<template data-dgst="…">）を読む。
 * Next.js は、読み込み中の表示（loading.tsx）を先に送ったあとで例外・転送・404 が起きると、
 * 状態を 200 のまま、この印だけを残してブラウザに差し替えさせる。
 */
function digestReason(digest, origin) {
  const redirect = /^NEXT_REDIRECT;[^;]*;([^;]+);/.exec(digest);
  if (redirect) return `画面の途中で転送（${describeTarget(redirect[1], origin)}）`;
  const fallback = /^NEXT_HTTP_ERROR_FALLBACK;(\d+)/.exec(digest);
  if (fallback) {
    const meaning = { 401: "ログインが要る", 403: "権限が無い", 404: "見つからない" }[fallback[1]] ?? "開けない";
    return `画面の途中で ${fallback[1]}（${meaning}）`;
  }
  return `サーバーで例外（digest ${digest}）`;
}

function describeTarget(location, origin) {
  try {
    const url = new URL(location, origin);
    return url.origin === origin ? `${url.pathname}${url.search}` : url.href;
  } catch {
    return location;
  }
}

function describeRedirect(location, origin) {
  if (!location) return "転送（行き先なし）";
  const target = describeTarget(location, origin);
  let url = null;
  try {
    url = new URL(location, origin);
  } catch {
    return `転送（${target}）`;
  }
  if (url.pathname === "/login") return `ログイン画面へ転送（${target}）`;
  if (url.searchParams.get("denied") === "1") return `開けない役割として戻された（${target}）`;
  return `転送（${target}）`;
}

/** 本文からエラーの印を拾う。同じ印は1回だけ数える。 */
export function findErrorMarks(body, origin = DEFAULT_ORIGIN) {
  const text = String(body ?? "");
  const marks = [];
  for (const { pattern, label } of BODY_MARKS) {
    const m = pattern.exec(text);
    if (m) marks.push(label(m));
  }
  for (const [, digest] of text.matchAll(/data-dgst="([^"]*)"/g)) marks.push(digestReason(digest, origin));
  const meta = /<meta[^>]*id="__next-page-redirect"[^>]*content="\d+;\s*url=([^"]+)"/i.exec(text);
  if (meta) marks.push(`画面の途中で転送（${describeTarget(meta[1], origin)}）`);
  return [...new Set(marks)];
}

/**
 * 1画面の応答を OK / NG に分ける。通信はしない。
 *
 * 期待はどの画面も「200 で、本文にエラーの印が無い」。ここに並べたのは開けるはずの画面だけなので、
 * 転送はどれも失敗として扱う（ログインが切れた・役割の判定が変わった、のどちらかを見逃さないため）。
 *
 * @param {{ status: number, location?: string|null, body?: string, origin?: string }} response
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function judgePage({ status, location = null, body = "", origin = DEFAULT_ORIGIN }) {
  if (REDIRECT_STATUSES.has(status)) return { ok: false, reason: describeRedirect(location, origin) };
  if (status !== 200) return { ok: false, reason: `200 ではない（${status}）` };
  const marks = findErrorMarks(body, origin);
  if (marks.length > 0) return { ok: false, reason: `本文にエラーの印: ${marks.join("、")}` };
  return { ok: true, reason: null };
}

/**
 * ログインの断りを、原因と次の一手に訳す。返ってきた本文はそのまま出さない。
 * 読むのは英大文字の code だけ（成功の本文にはセッションの値が入るので、本文を出す作りにしない）。
 */
export function describeLoginFailure(status, body) {
  let code = null;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.code === "string" && /^[A-Z_]{1,64}$/.test(parsed.code)) code = parsed.code;
  } catch {
    // 本文が JSON でなければ、状態だけで判断する
  }
  if (code === "INVALID_ORIGIN") {
    return `宛先と BETTER_AUTH_URL が食い違っている（${status} ${code}）`;
  }
  if (status === 401) return `メールアドレスかパスワードが違う（${status}${code ? ` ${code}` : ""}）`;
  if (status === 429) return "ログインの試行制限が解けない（429）";
  if (status === 200) return "ログインの応答にセッションの cookie が無い（200）";
  return `ログインの応答 ${status}${code ? ` ${code}` : ""}`;
}

/** 試行制限の待ち時間（秒）。Better Auth は X-Retry-After を返す。読めなければ10秒（既定の窓）。 */
export function retryAfterSeconds(headers) {
  const raw = headers.get("x-retry-after") ?? headers.get("retry-after");
  const n = Number.parseInt(raw ?? "", 10);
  const seconds = Number.isFinite(n) && n >= 0 ? n : 10;
  // 窓の終わりちょうどはまだ数えられていることがあるので、1秒足す
  return Math.min(seconds + 1, MAX_WAIT_SECONDS);
}

/** ログインの応答から、セッションの cookie（名前=値）だけを取り出して1行にする。 */
export function sessionCookieOf(headers) {
  const pairs = (headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0].trim()).filter((c) => /=./.test(c));
  return pairs.some((p) => p.split("=")[0].includes("session_token")) ? pairs.join("; ") : null;
}

/** 出力に資格情報が混じっていたら伏せる。いまの作りでは混じらないが、あとから足した1行のための最後の1枚。 */
export function redact(text, secrets) {
  let out = String(text);
  for (const secret of secrets) if (secret) out = out.split(secret).join(REDACTED);
  return out;
}

/** 結果1件を1行にする。「OK/NG・役割・パス・状態（理由）」をタブで区切る（smoke.sh と同じ並び）。 */
export function formatResult({ ok, role, path, status, reason }) {
  return [ok ? "OK" : "NG", role, path, reason ? `${status}（${reason}）` : String(status)].join("\t");
}

/* ───────────────────────── 通信 ───────────────────────── */

function errorText(error) {
  if (error?.name === "TimeoutError") return "時間切れ";
  const cause = error?.cause?.code ?? error?.cause?.message;
  return cause ? `${error.message}: ${cause}` : (error?.message ?? "不明");
}

async function signIn({ origin, account, fetchImpl, sleep, timeoutMs, note }) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetchImpl(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, referer: `${origin}/login` },
      body: JSON.stringify({ email: account.email, password: account.password }),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 成功の本文にはセッションの値が入る。読むだけで、どこにも出さない
    const body = await res.text();
    if (res.status === 429 && attempt < LOGIN_RETRIES) {
      const wait = retryAfterSeconds(res.headers);
      note(`ログインの試行制限に当たったので、${wait}秒待って入り直します（${account.label}）。`);
      await sleep(wait * 1000);
      continue;
    }
    const cookie = res.ok ? sessionCookieOf(res.headers) : null;
    if (cookie) return { cookie, error: null };
    return { cookie: null, error: describeLoginFailure(res.status, body) };
  }
}

/** 入ったセッションを閉じる。失敗しても判定は変えない（セッションは期限で消える）。 */
async function signOut({ origin, cookie, fetchImpl, timeoutMs, note, label }) {
  try {
    const res = await fetchImpl(`${origin}/api/auth/sign-out`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, referer: origin, cookie },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.text();
    if (!res.ok) note(`ログアウトできませんでした（${label}・${res.status}）。セッションは期限で消えます。`);
  } catch (error) {
    note(`ログアウトできませんでした（${label}・${errorText(error)}）。セッションは期限で消えます。`);
  }
}

/** 一覧の本文から、id つきの画面のパスを1つ拾う。 */
export function pickDynamicPath(page, listBody) {
  const [head, tail] = page.path.split("[id]");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`href="${escape(head)}([^"/?#]+)${escape(tail)}"`, "g");
  for (const [, id] of String(listBody ?? "").matchAll(pattern)) {
    if (!(page.exclude ?? []).includes(id)) return `${head}${id}${tail}`;
  }
  return null;
}

/**
 * 役割ごとに入り直して、表の画面を順に開く。結果は onResult で1件ずつ渡し、最後にまとめて返す。
 * 通信の関数（fetchImpl）と待ち方（sleep）は差し替えられる。試験では外へ出ない偽物を渡す。
 */
export async function smoke({ origin, accounts, fetchImpl = fetch, sleep = defaultSleep, timeoutMs, onResult = () => {}, note = () => {} }) {
  const results = [];
  for (const account of accounts) {
    const record = (path, status, verdict) => {
      const result = { role: account.label, path, status, ...verdict };
      results.push(result);
      onResult(result);
    };
    const pages = planChecks([account.key]).map(({ page }) => page);

    let session;
    try {
      session = await signIn({ origin, account, fetchImpl, sleep, timeoutMs, note });
    } catch (error) {
      session = { cookie: null, error: `ログインの通信が届かない（${errorText(error)}）` };
    }
    if (!session.cookie) {
      for (const page of pages) record(page.path, "-", { ok: false, reason: `ログインできない: ${session.error}` });
      continue;
    }

    const cookie = account.company ? `${session.cookie}; ${COMPANY_COOKIE}=${account.company}` : session.cookie;
    const bodies = new Map();
    for (const page of pages) {
      let path = page.path;
      if (page.from) {
        if (!bodies.has(page.from)) {
          record(page.path, "-", { ok: false, reason: `${page.from} が開けなかったので、開く相手を拾えない` });
          continue;
        }
        path = pickDynamicPath(page, bodies.get(page.from));
        if (!path) {
          record(page.path, "-", { ok: false, reason: `${page.from} に開ける相手のリンクが無い` });
          continue;
        }
      }
      try {
        const res = await fetchImpl(`${origin}${path}`, {
          headers: { cookie },
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = await res.text();
        const verdict = judgePage({ status: res.status, location: res.headers.get("location"), body, origin });
        if (verdict.ok) bodies.set(page.path, body);
        record(path, res.status, verdict);
      } catch (error) {
        record(path, "-", { ok: false, reason: `届かない（${errorText(error)}）` });
      }
    }
    await signOut({ origin, cookie: session.cookie, fetchImpl, timeoutMs, note, label: account.label });
  }
  return results;
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ───────────────────────── 入口 ───────────────────────── */

/**
 * 引数と環境変数を読み、流して、終了コードを返す。
 * 0 = 全部 OK / 1 = NG が1件以上 / 2 = 指定が足りない（通信の前に止めた）
 */
export async function run({
  argv = [],
  env = {},
  fetchImpl = fetch,
  sleep = defaultSleep,
  out = console.log,
  err = console.error,
  loadDemo = loadDemoSeed,
} = {}) {
  const args = parseArgs(argv);
  if (args.error) {
    err(args.error);
    err("使い方は --help で確かめてください。");
    return 2;
  }
  if (args.help) {
    out(usage());
    return 0;
  }

  const { origin, error } = resolveOrigin(args.origin ?? env[ORIGIN_VAR] ?? DEFAULT_ORIGIN);
  if (error) {
    err(error);
    return 2;
  }
  const local = isLocalOrigin(origin);
  const roleKeys = args.roles ?? ROLES.map((r) => r.key);
  const demo = local ? await loadDemo() : null;
  const { accounts, missing } = resolveAccounts({ roleKeys, env, demo });
  if (missing.length > 0) {
    err(
      local
        ? "環境変数の EMAIL と PASSWORD は、役割ごとに2つそろえて渡してください。"
        : `手元以外（${origin}）に向けるときは、見本の利用者を使いません。確かめる役割の利用者を環境変数で渡してください。`,
    );
    err(`足りないもの: ${missing.join(", ")}`);
    return 2;
  }

  const secrets = accounts.map((a) => a.password);
  const say = (line) => out(redact(line, secrets));
  const warn = (line) => err(redact(line, secrets));
  const sources = new Set(accounts.map((a) => a.source));
  const who = sources.size === 2 ? "見本データと環境変数" : sources.has("demo") ? "見本データ（scripts/seed-data.mjs）" : "環境変数";

  say(`対象: ${origin}（利用者: ${who}）`);
  const results = await smoke({
    origin,
    accounts,
    fetchImpl,
    sleep,
    timeoutMs: args.timeoutSeconds * 1000,
    onResult: (result) => say(formatResult(result)),
    note: warn,
  });
  const ng = results.filter((r) => !r.ok).length;
  say(`認証付きスモーク: ${results.length}件中 OK ${results.length - ng}件 / NG ${ng}件`);
  // 0 以外で終わらないと、呼んだ側（手順・ワークフロー）が緑のままになる
  return ng > 0 ? 1 : 0;
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  process.exitCode = await run({ argv: process.argv.slice(2), env: process.env });
}
