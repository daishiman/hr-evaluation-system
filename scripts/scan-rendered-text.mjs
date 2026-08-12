/**
 * 全画面を実際に描画して、40文字を超える文が出ていないかを機械で確かめる。
 *
 * なぜ要るか:
 *   `src/components/ui-rules.test.ts` は「ソースに書いてある文」を検査する。
 *   差し込み（${...}）の中身は数えない（骨格だけを測る）決まりなので、
 *   等級名・項目名・人の名前が長いと、描いた結果だけが長くなることがある。
 *   そこは実際に描いてみないと分からないので、この道具で確かめる。
 *
 * 使い方:
 *   1. ローカルD1に見本データを入れる
 *        pnpm run db:migrate:local
 *        pnpm run db:seed:local
 *   2. preview を起動する（.dev.vars の BETTER_AUTH_URL を同じ港番号に合わせる）
 *        pnpm run preview
 *   3. この道具を走らせる
 *        node scripts/scan-rendered-text.mjs http://localhost:8787
 *
 * 数え方の線引き:
 *   - 文の区切りは「。」と改行。
 *   - **「／」で区切った並びは、文ではなく項目の並び**として扱う。
 *     このアプリでは見出しの脇（meta）で「期間 ／ 件数 ／ 件数」のように使っており、
 *     見た目もすでに並びになっている。1項目ずつが40文字以内であればよい。
 *   - 日本語を含まない行（英数字だけの行）は数えない。
 *
 * 残るもの（こちらで直さないもの）:
 *   - 会社が登録した文章そのもの（KPIの設問文・計算式・備考）。
 *     利用者自身の内容なので書き換えない。折り返しで読めるようにする（spec §22-3）。
 *   - すでに確定した評価に保存済みの理由文。**確定済みの評価は変えない**という決まりのため。
 */

const BASE = process.argv[2] || "http://localhost:8787";
const PW = process.env.DEMO_PASSWORD || "Hyoka2026!demo";
const MAX = 40;

const ROLES = [
  { name: "全体管理者", email: "super@hyoka-demo.jp" },
  { name: "会社管理者", email: "admin@kyufu.hyoka-demo.jp" },
  { name: "上長", email: "manager@kyufu.hyoka-demo.jp" },
  { name: "本人", email: "e1@kyufu.hyoka-demo.jp" },
];

/** 引数の要らない経路。src/app 配下の page.tsx の一覧から作る。 */
const STATIC_ROUTES = [
  "/", "/login", "/account", "/account/password", "/criteria", "/forms",
  "/me", "/me/forms", "/me/results",
  "/manager", "/manager/cycles", "/manager/members",
  "/admin", "/admin/behavior", "/admin/cycles", "/admin/forms", "/admin/kgi",
  "/admin/masters", "/admin/masters/promotion", "/admin/masters/requirements",
  "/admin/members", "/admin/members/policy", "/admin/raises", "/admin/scheme", "/admin/setup",
  "/system", "/system/companies", "/system/users",
];

/** id つきの経路。一覧の中のリンクから実物の id を拾って辿る。 */
const DYNAMIC_PATTERNS = [
  /^\/admin\/forms\/[^/]+$/,
  /^\/admin\/forms\/[^/]+\/responses$/,
  /^\/admin\/members\/[^/]+$/,
  /^\/admin\/scheme\/[^/]+$/,
  /^\/admin\/scheme\/[^/]+\/criteria$/,
  /^\/forms\/[^/]+$/,
  /^\/manager\/evaluations\/[^/]+$/,
  /^\/manager\/members\/[^/]+$/,
  /^\/me\/forms\/[^/]+$/,
  /^\/me\/responses\/[^/]+$/,
  /^\/me\/results\/[^/]+$/,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, attempt = 0) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, referer: `${BASE}/login` },
    body: JSON.stringify({ email, password: PW }),
    redirect: "manual",
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (cookie) return cookie;
  const body = await res.text();
  // 連続ログインは弾かれるので、待って入り直す
  if (res.status === 429 && attempt < 12) {
    await sleep(20000);
    return login(email, attempt + 1);
  }
  throw new Error(`ログインできない: ${email} (${res.status}) ${body}`);
}

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

const JP = /[ぁ-ゟ゠-ヿ一-鿿]/;

function longSentences(html) {
  const out = [];
  for (const line of textOf(html).split("\n")) {
    for (const chunk of line.split("。")) {
      for (const part of chunk.split("／")) {
        const t = part.replace(/\s+/g, " ").trim();
        if (!JP.test(t)) continue;
        if ([...t].length > MAX) out.push(t);
      }
    }
  }
  return out;
}

function hrefsOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="(\/[^"?#]*)"/g)) out.add(m[1]);
  return [...out];
}

const results = [];
let total = 0;

for (const role of ROLES) {
  const cookie = await login(role.email);
  const seen = new Set();
  const queue = [...STATIC_ROUTES];
  const discovered = new Set();

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
    if (res.status !== 200) continue;
    const html = await res.text();
    total++;
    const bad = longSentences(html);
    if (bad.length) results.push({ role: role.name, path, bad });
    for (const h of hrefsOf(html)) {
      if (DYNAMIC_PATTERNS.some((re) => re.test(h)) && !discovered.has(h)) {
        discovered.add(h);
        queue.push(h);
      }
    }
  }
  const dyn = [...seen].filter((p) => !STATIC_ROUTES.includes(p));
  console.log(`■ ${role.name}: ${seen.size}経路（うち id つき ${dyn.length}件）`);
}

console.log(`\n描いた画面 のべ ${total} 件`);
if (results.length === 0) {
  console.log("40文字を超える文: 0件");
} else {
  console.log(`40文字を超える文が出た画面: ${results.length}件\n`);
  for (const r of results) {
    console.log(`--- [${r.role}] ${r.path}`);
    for (const b of r.bad) console.log(`   (${[...b].length}) ${b}`);
  }
  process.exitCode = 1;
}
