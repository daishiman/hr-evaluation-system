/**
 * 認証付きスモーク（scripts/smoke-authenticated.mjs）の試験。
 *
 * 通信はしない。判定の関数は本文の文字列を、流し方（run）は偽の fetch を相手にする。
 * 移行漏れを本物の DB を壊して確かめる代わりに、漏れたときに返ってくる本文
 * （no such table・例外の印 data-dgst）を偽の応答で返し、NG と終了コード 1 になることを見る。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { ROLE_LABEL } from "../src/lib/roles";
import { buildSeed, DEMO_PASSWORD } from "./seed-data.mjs";
import {
  COMPANY_COOKIE,
  DEFAULT_ORIGIN,
  DEFAULT_TIMEOUT_SECONDS,
  PAGES,
  REDACTED,
  ROLES,
  describeLoginFailure,
  envPrefix,
  findErrorMarks,
  formatResult,
  isLocalOrigin,
  judgePage,
  loadDemoSeed,
  parseArgs,
  pickDynamicPath,
  planChecks,
  redact,
  resolveAccounts,
  resolveOrigin,
  retryAfterSeconds,
  run,
  sessionCookieOf,
  usage,
} from "./smoke-authenticated.mjs";

const root = process.cwd();
const ALL_KEYS = ROLES.map((r) => r.key);
const DEMO = { tenant: "kyufu", password: "demo-pass-for-test" };

/** 正常な画面の本文に近いもの。not-found の部品は正常な画面にも必ず入るので、印に使っていないことも見る。 */
const HEALTHY_BODY = [
  "<!DOCTYPE html><html lang=\"ja\"><head><title>人事評価</title></head><body>",
  "<main><h1>アカウント</h1><p>登録内容を確かめられます。</p></main>",
  "<script>self.__next_f.push([1,\"ページが見つかりません\"])</script>",
  "</body></html>",
].join("");

/* ───────────────────────── 判定 ───────────────────────── */

describe("判定（judgePage・findErrorMarks）", () => {
  it("200 で印が無ければ OK（「ページが見つかりません」は正常な画面にも入るので印にしない）", () => {
    expect(judgePage({ status: 200, body: HEALTHY_BODY })).toEqual({ ok: true, reason: null });
    expect(findErrorMarks(HEALTHY_BODY)).toEqual([]);
  });

  it("移行漏れの文面（no such table）は 200 でも NG", () => {
    const body = `${HEALTHY_BODY}<pre>D1_ERROR: no such table: profile_field_policies: SQLITE_ERROR</pre>`;
    const verdict = judgePage({ status: 200, body });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("表が無い（no such table: profile_field_policies）");
    expect(verdict.reason).toContain("D1 のエラー（D1_ERROR）");
  });

  it("列が足りない（no such column）も NG", () => {
    const verdict = judgePage({ status: 200, body: "Error: no such column: users.locale" });
    expect(verdict).toEqual({ ok: false, reason: "本文にエラーの印: 列が無い（no such column: users.locale）" });
  });

  it("本番で文面が伏せられても、例外の印（data-dgst の数字）で NG", () => {
    const body = `${HEALTHY_BODY}<template data-dgst="2954187512"></template>`;
    expect(judgePage({ status: 200, body })).toEqual({
      ok: false,
      reason: "本文にエラーの印: サーバーで例外（digest 2954187512）",
    });
  });

  it("画面の途中の転送と 404（loading.tsx の内側）は 200 でも NG", () => {
    expect(findErrorMarks('<template data-dgst="NEXT_REDIRECT;replace;/login;307;"></template>')).toEqual([
      "画面の途中で転送（/login）",
    ]);
    expect(findErrorMarks('<template data-dgst="NEXT_HTTP_ERROR_FALLBACK;404"></template>')).toEqual([
      "画面の途中で 404（見つからない）",
    ]);
    expect(findErrorMarks('<template data-dgst="NEXT_HTTP_ERROR_FALLBACK;403"></template>')).toEqual([
      "画面の途中で 403（権限が無い）",
    ]);
    expect(
      findErrorMarks('<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/me?denied=1"/>'),
    ).toEqual(["画面の途中で転送（/me?denied=1）"]);
  });

  it("エラー画面の文言はどれも NG", () => {
    for (const [body, mark] of [
      ['<html id="__next_error__">', "Next.js のエラー画面"],
      ["Application error: a server-side exception has occurred", "Application error"],
      ["Internal Server Error", "Internal Server Error"],
      ["<p>エラーが発生しました</p>", "「エラーが発生」の表示"],
      ["<h1>画面を表示できませんでした</h1>", "エラー画面（画面を表示できませんでした）"],
    ]) {
      expect(judgePage({ status: 200, body })).toEqual({ ok: false, reason: `本文にエラーの印: ${mark}` });
    }
  });

  it("同じ印は1回だけ数える", () => {
    const body = '<template data-dgst="1"></template><template data-dgst="1"></template>no such table: a no such table: a';
    expect(findErrorMarks(body)).toEqual(["表が無い（no such table: a）", "サーバーで例外（digest 1）"]);
  });

  it("200 以外は NG（500 のエラー画面・404）", () => {
    expect(judgePage({ status: 500, body: '<html id="__next_error__">' })).toEqual({
      ok: false,
      reason: "200 ではない（500）",
    });
    expect(judgePage({ status: 404, body: "" })).toEqual({ ok: false, reason: "200 ではない（404）" });
  });

  it("転送はどれも NG で、行き先で理由を分ける", () => {
    expect(judgePage({ status: 307, location: "/login" }).reason).toBe("ログイン画面へ転送（/login）");
    expect(judgePage({ status: 302, location: `${DEFAULT_ORIGIN}/login?next=%2Faccount` }).reason).toBe(
      "ログイン画面へ転送（/login?next=%2Faccount）",
    );
    expect(judgePage({ status: 307, location: "/me?denied=1" }).reason).toBe("開けない役割として戻された（/me?denied=1）");
    expect(judgePage({ status: 308, location: "https://other.example/x" }).reason).toBe("転送（https://other.example/x）");
    expect(judgePage({ status: 303, location: "/account/password" }).reason).toBe("転送（/account/password）");
    expect(judgePage({ status: 307, location: null }).reason).toBe("転送（行き先なし）");
  });
});

/* ───────────────────────── 引数・宛先・利用者 ───────────────────────── */

describe("引数（parseArgs）", () => {
  it("何も無ければ既定の値", () => {
    expect(parseArgs([])).toEqual({
      help: false,
      origin: null,
      roles: null,
      timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      error: null,
    });
  });

  it("「--x 値」と「--x=値」の両方を読み、pnpm から届く単独の -- は読み飛ばす", () => {
    const a = parseArgs(["--", "--origin", "http://localhost:8791", "--roles", "employee", "--timeout", "30"]);
    const b = parseArgs(["--origin=http://localhost:8791", "--roles=employee", "--timeout=30"]);
    for (const args of [a, b]) {
      expect(args).toMatchObject({ origin: "http://localhost:8791", roles: ["employee"], timeoutSeconds: 30, error: null });
    }
  });

  it("--roles は表の順に並べ直し、重複を除く", () => {
    expect(parseArgs(["--roles", "super-admin, employee,employee"]).roles).toEqual(["employee", "super-admin"]);
  });

  it("--help と -h", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("読めない指定は理由を付けて止める", () => {
    expect(parseArgs(["--roles", "admin"]).error).toContain("役割 admin はありません");
    expect(parseArgs(["--roles", ","]).error).toBe("--roles の値を指定してください。");
    expect(parseArgs(["--verbose"]).error).toBe("--verbose は使えません。");
    expect(parseArgs(["http://localhost:8787"]).error).toContain("宛先は --origin で渡してください");
    expect(parseArgs(["--origin"]).error).toBe("--origin の値を指定してください。");
    expect(parseArgs(["--origin", "--roles", "employee"]).error).toBe("--origin の値を指定してください。");
    expect(parseArgs(["--origin="]).error).toBe("--origin の値を指定してください。");
    for (const bad of ["0", "601", "1.5", "abc"]) {
      expect(parseArgs(["--timeout", bad]).error).toBe("--timeout は 1〜600 の整数（秒）で指定してください。");
    }
  });
});

describe("宛先（resolveOrigin・isLocalOrigin）", () => {
  it("origin だけを受け付ける（末尾の / は落とす）", () => {
    expect(resolveOrigin("http://localhost:8791/")).toEqual({ origin: "http://localhost:8791", error: null });
    expect(resolveOrigin(" https://hr.example.com ")).toEqual({ origin: "https://hr.example.com", error: null });
  });

  it("パス・問い合わせ・ハッシュ付きや、http(s) 以外・URL でないものは止める", () => {
    for (const raw of ["http://localhost:8787/login", "http://localhost:8787/?a=1", "http://localhost:8787/#x"]) {
      expect(resolveOrigin(raw).error).toBe("宛先には http://localhost:8787 のように origin だけを渡してください。");
    }
    expect(resolveOrigin("ftp://localhost").error).toContain("http か https");
    expect(resolveOrigin("localhost:8787").error).not.toBeNull();
    expect(resolveOrigin("not a url").error).toContain("URL として読めません");
  });

  it("手元とみなすのは localhost・127.0.0.1・[::1] だけ", () => {
    for (const origin of ["http://localhost:8787", "http://127.0.0.1:8791", "http://[::1]:8787"]) {
      expect(isLocalOrigin(origin)).toBe(true);
    }
    for (const origin of ["https://hr.example.com", "http://localhost.example.com", "http://10.0.0.1:8787"]) {
      expect(isLocalOrigin(origin)).toBe(false);
    }
  });
});

describe("利用者（resolveAccounts）", () => {
  it("環境変数の名前は SMOKE_<役割>_…", () => {
    expect(ROLES.map((r) => envPrefix(r.key))).toEqual([
      "SMOKE_EMPLOYEE",
      "SMOKE_MANAGER",
      "SMOKE_COMPANY_ADMIN",
      "SMOKE_SUPER_ADMIN",
    ]);
  });

  it("手元では見本の利用者で入る（マネージャーは1社目を選ぶ）", () => {
    const { accounts, missing } = resolveAccounts({ roleKeys: ALL_KEYS, env: {}, demo: DEMO });
    expect(missing).toEqual([]);
    expect(accounts.map((a) => [a.key, a.email, a.company, a.source])).toEqual([
      ["employee", "e1@kyufu.hyoka-demo.jp", null, "demo"],
      ["manager", "manager@kyufu.hyoka-demo.jp", "cmp_kyufu", "demo"],
      ["company-admin", "admin@kyufu.hyoka-demo.jp", null, "demo"],
      ["super-admin", "super@hyoka-demo.jp", null, "demo"],
    ]);
    expect(accounts.every((a) => a.password === DEMO.password)).toBe(true);
  });

  it("EMAIL と PASSWORD がそろえば環境変数を使い、_COMPANY で会社を選べる", () => {
    const env = {
      SMOKE_MANAGER_EMAIL: " smoke-manager@example.com ",
      SMOKE_MANAGER_PASSWORD: "pw-manager",
      SMOKE_MANAGER_COMPANY: "cmp_other",
      SMOKE_COMPANY_ADMIN_COMPANY: "cmp_admin",
    };
    const { accounts } = resolveAccounts({ roleKeys: ["manager", "company-admin"], env, demo: DEMO });
    expect(accounts[0]).toEqual({
      key: "manager",
      label: "マネージャー",
      email: "smoke-manager@example.com",
      password: "pw-manager",
      company: "cmp_other",
      source: "env",
    });
    // 利用者は見本のまま、会社だけを差し替えることもできる
    expect(accounts[1]).toMatchObject({ email: "admin@kyufu.hyoka-demo.jp", company: "cmp_admin", source: "demo" });
  });

  it("片方だけのときは見本と混ぜず、足りない変数の名前だけを返す", () => {
    const env = { SMOKE_EMPLOYEE_EMAIL: "x@example.com", SMOKE_SUPER_ADMIN_PASSWORD: "only-password" };
    const { accounts, missing } = resolveAccounts({ roleKeys: ["employee", "super-admin"], env, demo: DEMO });
    expect(accounts).toEqual([]);
    expect(missing).toEqual(["SMOKE_EMPLOYEE_PASSWORD", "SMOKE_SUPER_ADMIN_EMAIL"]);
    expect(missing.join(" ")).not.toContain("only-password");
  });

  it("見本が無い（手元以外）ときは、環境変数の無い役割を両方とも足りないとする", () => {
    const env = { SMOKE_EMPLOYEE_EMAIL: "e@example.com", SMOKE_EMPLOYEE_PASSWORD: "pw" };
    const { accounts, missing } = resolveAccounts({ roleKeys: ["employee", "manager"], env, demo: null });
    expect(accounts.map((a) => a.key)).toEqual(["employee"]);
    expect(missing).toEqual(["SMOKE_MANAGER_EMAIL", "SMOKE_MANAGER_PASSWORD"]);
  });
});

describe("見本データ（loadDemoSeed）", () => {
  it("1社目の key と見本のパスワードを seed-data.mjs から読む", async () => {
    expect(await loadDemoSeed()).toEqual({ tenant: "kyufu", password: DEMO_PASSWORD });
  });

  it("見本の利用者が見本データにいて、表の役割で入れる", async () => {
    const demo = await loadDemoSeed();
    const { tableRows } = await buildSeed({ passwordHashFor: async () => "hash-for-test" });
    const rows = Object.fromEntries(tableRows);
    const { accounts } = resolveAccounts({ roleKeys: ALL_KEYS, env: {}, demo });

    for (const account of accounts) {
      const role = ROLES.find((r) => r.key === account.key);
      const user = rows.users.find((u) => u.email === account.email);
      expect(user, `${account.email} が見本データにいない`).toBeTruthy();
      expect(user.is_active).toBe(1);
      // 仮パスワードのままだとパスワードの変更へ回され、確かめたい画面が開かない
      expect(user.must_change_password).toBe(0);

      const memberships = rows.company_memberships.filter((m) => m.user_id === user.id);
      if (role.role === "SUPER_ADMIN") {
        expect(user.role).toBe("SUPER_ADMIN");
        expect(memberships).toEqual([]);
        continue;
      }
      // 会社を選ばない役割は、所属が1社だけであること（2社あると会社名の順で開く会社が決まる）
      if (!account.company) expect(memberships).toHaveLength(1);
      const companyId = account.company ?? memberships[0].company_id;
      const chosen = memberships.find((m) => m.company_id === companyId);
      expect(chosen?.role, `${account.email} の ${companyId} での役割`).toBe(role.role);
    }
  });
});

/* ───────────────────────── 役割と画面の表 ───────────────────────── */

function walkPages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function toRoute(file) {
  const route = relative(join(root, "src/app"), file).split(sep).slice(0, -1).join("/");
  return route ? `/${route}` : "/";
}

describe("役割と画面の表（ROLES・PAGES）", () => {
  it("役割の key と環境変数の頭は重複せず、呼び名はアプリ（ROLE_LABEL）と同じ", () => {
    expect(new Set(ALL_KEYS).size).toBe(ROLES.length);
    expect(new Set(ROLES.map((r) => envPrefix(r.key))).size).toBe(ROLES.length);
    expect(new Set(ROLES.map((r) => r.role))).toEqual(new Set(Object.keys(ROLE_LABEL)));
    for (const role of ROLES) expect(role.label).toBe(ROLE_LABEL[role.role]);
  });

  it("画面のパスは重複せず、役割は表にあるものだけ", () => {
    const paths = PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of PAGES) {
      expect(page.roles.length, page.path).toBeGreaterThan(0);
      expect(new Set(page.roles).size, page.path).toBe(page.roles.length);
      for (const key of page.roles) expect(ALL_KEYS, `${page.path} の ${key}`).toContain(key);
    }
  });

  it("どの役割も /account を開き、ほかに1枚以上の画面を開く", () => {
    for (const key of ALL_KEYS) {
      const paths = planChecks([key]).map(({ page }) => page.path);
      expect(paths, key).toContain("/account");
      expect(paths.length, key).toBeGreaterThan(1);
    }
  });

  it("E8 で挙がった画面がそろっている", () => {
    const paths = PAGES.map((p) => p.path);
    for (const path of ["/account", "/admin/members", "/admin/members/policy", "/system/users"]) {
      expect(paths).toContain(path);
    }
    expect(paths.some((p) => p === "/me" || p === "/manager")).toBe(true);
  });

  it("どの画面にも src/app の page.tsx がある", () => {
    for (const page of PAGES) {
      expect(existsSync(join(root, "src/app", page.path, "page.tsx")), page.path).toBe(true);
    }
  });

  it("どの（役割, 画面）もルート台帳で開ける（none ではない）", () => {
    const ledger = JSON.parse(readFileSync(join(root, "system-spec/route-ledger.json"), "utf8"));
    for (const { role: key, page } of planChecks()) {
      const route = ledger.routes.find((r) => r.path === page.path);
      expect(route, `${page.path} が台帳に無い`).toBeTruthy();
      const role = ROLES.find((r) => r.key === key).role;
      const access = ledger.accessClasses[route.accessClass]?.access?.byRole?.[role];
      expect(access, `${key} で ${page.path}`).toBe("full");
    }
  });

  it("id つきの画面は、同じ役割で先に開く一覧から id を拾う", () => {
    for (const [index, page] of PAGES.entries()) {
      expect(Boolean(page.from), page.path).toBe(page.path.includes("[id]"));
      if (!page.from) continue;
      const fromIndex = PAGES.findIndex((p) => p.path === page.from);
      expect(fromIndex, `${page.from} が ${page.path} より前に無い`).toBeGreaterThanOrEqual(0);
      expect(fromIndex).toBeLessThan(index);
      for (const key of page.roles) expect(PAGES[fromIndex].roles, `${key} で ${page.from}`).toContain(key);
    }
  });

  it("本人が変えてよい項目（profile_field_policies）を読む画面は、全部この表にある", () => {
    const readers = walkPages(join(root, "src/app"))
      .filter((file) => readFileSync(file, "utf8").includes("listProfileFieldPolicies"))
      .map(toRoute)
      .sort();
    expect(readers.length).toBeGreaterThan(0);
    const paths = PAGES.map((p) => p.path);
    for (const route of readers) expect(paths, `${route} が表に無い`).toContain(route);
  });

  it("開く順は役割の表の順、その中は画面の表の順", () => {
    const plan = planChecks();
    expect(plan).toHaveLength(14);
    expect([...new Set(plan.map((c) => c.role))]).toEqual(ALL_KEYS);
    for (const key of ALL_KEYS) {
      const paths = plan.filter((c) => c.role === key).map((c) => c.page.path);
      expect(paths).toEqual(PAGES.filter((p) => p.roles.includes(key)).map((p) => p.path));
    }
  });

  it("説明（--help）に、役割ごとの画面と環境変数の名前が出る", () => {
    const text = usage();
    for (const role of ROLES) {
      expect(text).toContain(role.key);
      expect(text).toContain(`${envPrefix(role.key)}_EMAIL`);
    }
    expect(text).toContain("/admin/members/policy");
  });
});

/* ───────────────────────── 小さな部品 ───────────────────────── */

describe("小さな部品", () => {
  it("一覧のリンクから id を拾う（policy は id ではないので飛ばす）", () => {
    const page = PAGES.find((p) => p.path === "/admin/members/[id]");
    const body = '<a href="/admin/members/policy">設定</a><a href="/admin/members/usr_a/edit">x</a><a href="/admin/members/usr_b">B</a>';
    expect(pickDynamicPath(page, body)).toBe("/admin/members/usr_b");
    expect(pickDynamicPath(page, '<a href="/admin/members/policy">設定</a>')).toBeNull();
    expect(pickDynamicPath(page, "")).toBeNull();
  });

  it("ログインの断りは原因に訳し、本文はそのまま出さない", () => {
    expect(describeLoginFailure(403, '{"code":"INVALID_ORIGIN","message":"Invalid origin"}')).toBe(
      "宛先と BETTER_AUTH_URL が食い違っている（403 INVALID_ORIGIN）",
    );
    expect(describeLoginFailure(401, '{"code":"INVALID_EMAIL_OR_PASSWORD"}')).toBe(
      "メールアドレスかパスワードが違う（401 INVALID_EMAIL_OR_PASSWORD）",
    );
    expect(describeLoginFailure(429, "")).toBe("ログインの試行制限が解けない（429）");
    expect(describeLoginFailure(200, '{"token":"secret-session"}')).toBe("ログインの応答にセッションの cookie が無い（200）");
    // code が英大文字でなければ読まない（本文に何が入っていても出さない）
    const odd = describeLoginFailure(500, '{"code":"leak secret-pass"}');
    expect(odd).toBe("ログインの応答 500");
  });

  it("試行制限の待ち時間は、言われた秒に1秒足す（上限60秒・読めなければ11秒）", () => {
    expect(retryAfterSeconds(new Headers({ "x-retry-after": "9" }))).toBe(10);
    expect(retryAfterSeconds(new Headers({ "retry-after": "3" }))).toBe(4);
    expect(retryAfterSeconds(new Headers({ "x-retry-after": "999" }))).toBe(60);
    expect(retryAfterSeconds(new Headers())).toBe(11);
    expect(retryAfterSeconds(new Headers({ "x-retry-after": "soon" }))).toBe(11);
  });

  it("セッションの cookie だけを1行にする（https の __Secure- 付きも読む）", () => {
    const headers = new Headers([
      ["set-cookie", "better-auth.session_token=abc.def; Path=/; HttpOnly"],
      ["set-cookie", "better-auth.session_data=xyz; Path=/"],
    ]);
    expect(sessionCookieOf(headers)).toBe("better-auth.session_token=abc.def; better-auth.session_data=xyz");
    const secure = new Headers([["set-cookie", "__Secure-better-auth.session_token=t; Path=/; Secure"]]);
    expect(sessionCookieOf(secure)).toBe("__Secure-better-auth.session_token=t");
    expect(sessionCookieOf(new Headers([["set-cookie", "other=1; Path=/"]]))).toBeNull();
    expect(sessionCookieOf(new Headers())).toBeNull();
  });

  it("出力の資格情報は伏せる", () => {
    expect(redact("a secret b secret", ["secret", ""])).toBe(`a ${REDACTED} b ${REDACTED}`);
  });

  it("結果1件は「OK/NG・役割・パス・状態（理由）」のタブ区切り", () => {
    expect(formatResult({ ok: true, role: "一般", path: "/account", status: 200, reason: null })).toBe(
      "OK\t一般\t/account\t200",
    );
    expect(formatResult({ ok: false, role: "一般", path: "/me", status: 307, reason: "ログイン画面へ転送（/login）" })).toBe(
      "NG\t一般\t/me\t307（ログイン画面へ転送（/login））",
    );
  });
});

/* ───────────────────────── 流し方（偽の fetch） ───────────────────────── */

/**
 * 外へ出ない偽のサーバー。ログインは token-<メール> の cookie を返し、
 * 画面は pageFor(path, email) が返す { status, body, location } で答える。
 */
function fakeServer({ pageFor = () => ({ status: 200, body: HEALTHY_BODY }), signIn = () => null } = {}) {
  const calls = [];
  const attempts = new Map();
  const fetchImpl = async (url, init = {}) => {
    const { origin, pathname, search } = new URL(url);
    calls.push({ url, origin, path: pathname + search, init });
    if (pathname === "/api/auth/sign-in/email") {
      const { email, password } = JSON.parse(init.body);
      const attempt = attempts.get(email) ?? 0;
      attempts.set(email, attempt + 1);
      const custom = signIn({ email, password, attempt, init });
      if (custom) return custom;
      return new Response(JSON.stringify({ token: "secret-session", user: { email } }), {
        status: 200,
        headers: [["set-cookie", `better-auth.session_token=token-${email}; Path=/; HttpOnly`]],
      });
    }
    if (pathname === "/api/auth/sign-out") return new Response('{"success":true}', { status: 200 });
    const email = /session_token=token-([^;]+)/.exec(init.headers?.cookie ?? "")?.[1] ?? null;
    if (!email) return new Response(null, { status: 307, headers: { location: "/login" } });
    const { status = 200, body = HEALTHY_BODY, location } = pageFor(pathname + search, email) ?? {};
    return new Response(status === 307 ? null : body, { status, headers: location ? { location } : {} });
  };
  return { fetchImpl, calls };
}

/** 一覧には社員1人ぶんのリンクを入れておく（id つきの画面がそこから開く）。 */
const MEMBERS_BODY = `${HEALTHY_BODY}<a href="/admin/members/policy">設定</a><a href="/admin/members/usr_kyufu_e1">太郎</a>`;

function healthyPage(path) {
  return path === "/admin/members" ? { status: 200, body: MEMBERS_BODY } : { status: 200, body: HEALTHY_BODY };
}

async function runWith({ argv = [], env = {}, server = fakeServer({ pageFor: healthyPage }), loadDemo } = {}) {
  const out = [];
  const err = [];
  const sleeps = [];
  let demoLoads = 0;
  const code = await run({
    argv,
    env,
    fetchImpl: server.fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    loadDemo: async () => {
      demoLoads += 1;
      return loadDemo ? loadDemo() : DEMO;
    },
  });
  const rows = out.filter((line) => /^(OK|NG)\t/.test(line)).map((line) => line.split("\t"));
  return { code, out, err, sleeps, rows, calls: server.calls, demoLoads: () => demoLoads };
}

describe("流し方（run）", () => {
  it("全部開ければ 0。14行を出し、最後に件数をまとめる", async () => {
    const { code, out, rows, calls, err } = await runWith();
    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out[0]).toBe("対象: http://localhost:8787（利用者: 見本データ（scripts/seed-data.mjs））");
    expect(rows).toHaveLength(14);
    expect(rows.every(([mark, , , status]) => mark === "OK" && status === "200")).toBe(true);
    expect(rows.map(([, role, path]) => `${role} ${path}`)).toContain("会社の管理者 /admin/members/usr_kyufu_e1");
    expect(out.at(-1)).toBe("認証付きスモーク: 14件中 OK 14件 / NG 0件");

    // ログインには Origin と Referer を付け、転送は追わない
    const login = calls.find((c) => c.path === "/api/auth/sign-in/email");
    expect(login.init).toMatchObject({
      method: "POST",
      redirect: "manual",
      headers: { origin: DEFAULT_ORIGIN, referer: `${DEFAULT_ORIGIN}/login` },
    });
    expect(login.init.signal).toBeInstanceOf(AbortSignal);
    // マネージャーは会社を選ぶ cookie を付けて開く
    const managerPage = calls.find((c) => c.path === "/manager");
    expect(managerPage.init.headers.cookie).toContain(`${COMPANY_COOKIE}=cmp_kyufu`);
    expect(managerPage.init.redirect).toBe("manual");
    // 役割ごとに入り直し、最後にログアウトする
    expect(calls.filter((c) => c.path === "/api/auth/sign-in/email")).toHaveLength(4);
    expect(calls.filter((c) => c.path === "/api/auth/sign-out")).toHaveLength(4);
  });

  it("移行漏れ（表が無い）を模した本文なら 1。その表を読む画面の行だけが NG", async () => {
    const missingTable = `${HEALTHY_BODY}D1_ERROR: no such table: profile_field_policies: SQLITE_ERROR`;
    const readsPolicies = new Set(["/account", "/admin/members", "/admin/members/policy"]);
    const server = fakeServer({
      pageFor: (path) =>
        readsPolicies.has(path) || path.startsWith("/admin/members/usr_")
          ? { status: 200, body: missingTable }
          : healthyPage(path),
    });
    const { code, rows, out } = await runWith({ server });
    expect(code).toBe(1);
    const ng = rows.filter(([mark]) => mark === "NG");
    expect(ng.map(([, role, path]) => `${role} ${path}`)).toEqual([
      "一般 /account",
      "マネージャー /account",
      "会社の管理者 /account",
      "会社の管理者 /admin/members",
      "会社の管理者 /admin/members/[id]",
      "会社の管理者 /admin/members/policy",
      "システム全体管理者 /account",
      "システム全体管理者 /admin/members",
      "システム全体管理者 /admin/members/policy",
    ]);
    expect(ng[0][3]).toContain("表が無い（no such table: profile_field_policies）");
    // 一覧が開けなかったので、id つきの画面は開かずに理由を出す
    expect(ng[4][3]).toBe("-（/admin/members が開けなかったので、開く相手を拾えない）");
    expect(out.at(-1)).toBe("認証付きスモーク: 14件中 OK 5件 / NG 9件");
  });

  it("本番の形（文面が伏せられ data-dgst だけ）でも 1", async () => {
    const server = fakeServer({
      pageFor: (path) =>
        path === "/admin/members/policy"
          ? { status: 200, body: `${HEALTHY_BODY}<template data-dgst="3141592653"></template>` }
          : healthyPage(path),
    });
    const { code, rows } = await runWith({ argv: ["--roles", "company-admin"], server });
    expect(code).toBe(1);
    expect(rows.find(([, , path]) => path === "/admin/members/policy")).toEqual([
      "NG",
      "会社の管理者",
      "/admin/members/policy",
      "200（本文にエラーの印: サーバーで例外（digest 3141592653））",
    ]);
  });

  it("一覧に開ける相手のリンクが無ければ、id つきの画面は NG", async () => {
    const server = fakeServer({ pageFor: () => ({ status: 200, body: HEALTHY_BODY }) });
    const { code, rows } = await runWith({ argv: ["--roles", "company-admin"], server });
    expect(code).toBe(1);
    expect(rows.find(([, , path]) => path === "/admin/members/[id]")?.[3]).toBe(
      "-（/admin/members に開ける相手のリンクが無い）",
    );
  });

  it("開けない役割として戻されたら NG（役割の判定が変わったのを見逃さない）", async () => {
    const server = fakeServer({
      pageFor: (path) => (path === "/manager" ? { status: 307, location: "/me?denied=1" } : healthyPage(path)),
    });
    const { code, rows } = await runWith({ argv: ["--roles", "manager"], server });
    expect(code).toBe(1);
    expect(rows).toEqual([
      ["OK", "マネージャー", "/account", "200"],
      ["NG", "マネージャー", "/manager", "307（開けない役割として戻された（/me?denied=1））"],
    ]);
  });

  it("試行制限（429）に当たったら、言われた秒数だけ待って入り直す", async () => {
    const server = fakeServer({
      signIn: ({ attempt }) =>
        attempt === 0 ? new Response('{"message":"Too many requests"}', { status: 429, headers: { "x-retry-after": "10" } }) : null,
    });
    const { code, sleeps, err } = await runWith({ argv: ["--roles", "employee"], server });
    expect(code).toBe(0);
    expect(sleeps).toEqual([11000]);
    expect(err).toEqual(["ログインの試行制限に当たったので、11秒待って入り直します（一般）。"]);
  });

  it("試行制限が解けなければ、上限まで待ったあと NG", async () => {
    const server = fakeServer({
      signIn: () => new Response("{}", { status: 429, headers: { "x-retry-after": "1" } }),
    });
    const { code, sleeps, rows } = await runWith({ argv: ["--roles", "employee"], server });
    expect(code).toBe(1);
    expect(sleeps).toEqual([2000, 2000, 2000, 2000, 2000]);
    expect(rows).toEqual([
      ["NG", "一般", "/account", "-（ログインできない: ログインの試行制限が解けない（429））"],
      ["NG", "一般", "/me", "-（ログインできない: ログインの試行制限が解けない（429））"],
    ]);
  });

  it("ログインできない役割は、その役割の画面を全部 NG にし、ほかの役割は続ける", async () => {
    const server = fakeServer({
      signIn: ({ email }) =>
        email.startsWith("e1@")
          ? new Response('{"code":"INVALID_EMAIL_OR_PASSWORD","message":"Invalid email or password"}', { status: 401 })
          : null,
    });
    const { code, rows } = await runWith({ argv: ["--roles", "employee,super-admin"], server });
    expect(code).toBe(1);
    expect(rows.filter(([mark]) => mark === "NG").map(([, role, path, status]) => [role, path, status])).toEqual([
      ["一般", "/account", "-（ログインできない: メールアドレスかパスワードが違う（401 INVALID_EMAIL_OR_PASSWORD））"],
      ["一般", "/me", "-（ログインできない: メールアドレスかパスワードが違う（401 INVALID_EMAIL_OR_PASSWORD））"],
    ]);
    expect(rows.filter(([, role]) => role === "システム全体管理者").every(([mark]) => mark === "OK")).toBe(true);
  });

  it("宛先と BETTER_AUTH_URL が食い違えば、そう言って NG", async () => {
    const server = fakeServer({
      signIn: () => new Response('{"code":"INVALID_ORIGIN","message":"Invalid origin"}', { status: 403 }),
    });
    const { code, rows } = await runWith({ argv: ["--roles", "employee"], server });
    expect(code).toBe(1);
    expect(rows[0][3]).toBe("-（ログインできない: 宛先と BETTER_AUTH_URL が食い違っている（403 INVALID_ORIGIN））");
  });

  it("宛先に届かなければ NG（preview が起動していない）", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    };
    const { code, rows } = await runWith({ argv: ["--roles", "employee"], server: { fetchImpl, calls: [] } });
    expect(code).toBe(1);
    expect(rows[0]).toEqual(["NG", "一般", "/account", "-（ログインできない: ログインの通信が届かない（fetch failed: ECONNREFUSED））"]);
  });

  it("画面の通信が途中で切れたら、その画面を NG にする", async () => {
    const base = fakeServer({ pageFor: healthyPage });
    const fetchImpl = async (url, init) => {
      if (new URL(url).pathname === "/me") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return base.fetchImpl(url, init);
    };
    const { code, rows } = await runWith({ argv: ["--roles", "employee"], server: { fetchImpl, calls: [] } });
    expect(code).toBe(1);
    expect(rows).toEqual([
      ["OK", "一般", "/account", "200"],
      ["NG", "一般", "/me", "-（届かない（時間切れ））"],
    ]);
  });

  it("手元以外に向けて利用者の環境変数が無ければ、通信も見本の読み込みもせずに 2", async () => {
    const result = await runWith({ argv: ["--origin", "https://hr.example.com"] });
    expect(result.code).toBe(2);
    expect(result.calls).toEqual([]);
    expect(result.demoLoads()).toBe(0);
    expect(result.err[0]).toContain("見本の利用者を使いません");
    expect(result.err[1]).toContain("SMOKE_EMPLOYEE_EMAIL");
    expect(result.err[1]).toContain("SMOKE_SUPER_ADMIN_PASSWORD");
  });

  it("手元以外では、環境変数の利用者だけで入る（宛先は APP_URL でも渡せる）", async () => {
    const env = {
      APP_URL: "https://hr.example.com",
      SMOKE_SUPER_ADMIN_EMAIL: "smoke-super@example.com",
      SMOKE_SUPER_ADMIN_PASSWORD: "Sup3r-secret!",
    };
    const result = await runWith({ argv: ["--roles", "super-admin"], env });
    expect(result.code).toBe(0);
    expect(result.demoLoads()).toBe(0);
    expect(result.out[0]).toBe("対象: https://hr.example.com（利用者: 環境変数）");
    expect(new Set(result.calls.map((c) => c.origin))).toEqual(new Set(["https://hr.example.com"]));
    expect(JSON.parse(result.calls[0].init.body)).toEqual({ email: "smoke-super@example.com", password: "Sup3r-secret!" });
    expect([...result.out, ...result.err].join("\n")).not.toContain("Sup3r-secret!");
  });

  it("--origin は APP_URL より優先する", async () => {
    const result = await runWith({ argv: ["--origin", "http://localhost:8791", "--roles", "employee"], env: { APP_URL: "https://hr.example.com" } });
    expect(result.code).toBe(0);
    expect(new Set(result.calls.map((c) => c.origin))).toEqual(new Set(["http://localhost:8791"]));
  });

  it("手元でも、EMAIL と PASSWORD が片方だけなら 2", async () => {
    const result = await runWith({ env: { SMOKE_MANAGER_EMAIL: "m@example.com" } });
    expect(result.code).toBe(2);
    expect(result.calls).toEqual([]);
    expect(result.err).toEqual([
      "環境変数の EMAIL と PASSWORD は、役割ごとに2つそろえて渡してください。",
      "足りないもの: SMOKE_MANAGER_PASSWORD",
    ]);
  });

  it("パスワードは、例外の文面に混じっても出力では伏せる", async () => {
    const password = "Leaky-pass#42";
    const fetchImpl = async () => {
      throw new Error(`boom ${password}`);
    };
    const env = { SMOKE_EMPLOYEE_EMAIL: "e@example.com", SMOKE_EMPLOYEE_PASSWORD: password };
    const { code, out, err } = await runWith({ argv: ["--roles", "employee"], env, server: { fetchImpl, calls: [] } });
    expect(code).toBe(1);
    const all = [...out, ...err].join("\n");
    expect(all).not.toContain(password);
    expect(all).toContain(`boom ${REDACTED}`);
  });

  it("見本のパスワードも出力に出さない", async () => {
    const { out, err } = await runWith();
    expect([...out, ...err].join("\n")).not.toContain(DEMO.password);
  });

  it("読めない引数・宛先は、通信の前に 2", async () => {
    for (const argv of [["--roles", "boss"], ["--origin", "http://localhost:8787/login"], ["extra"]]) {
      const result = await runWith({ argv });
      expect(result.code, argv.join(" ")).toBe(2);
      expect(result.calls).toEqual([]);
      expect(result.err.length).toBeGreaterThan(0);
    }
  });

  it("--help は説明を出して 0。通信しない", async () => {
    const result = await runWith({ argv: ["--help"] });
    expect(result.code).toBe(0);
    expect(result.out[0]).toContain("使い方:");
    expect(result.calls).toEqual([]);
  });
});
