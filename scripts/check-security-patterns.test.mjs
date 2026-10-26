import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanBuildDir, scanFile, scanRepository } from "./check-security-patterns.mjs";

/*
 * 直した型の脆弱性が、別の場所で同じ形で戻ってこないことを見張る静的検査（DD-032 の16・O38）。
 * 見張る型は5つ。
 *   db-dump-artifact      : ワークフローが DB の中身を書き出して、成果物に上げる
 *   client-ip-header      : 偽れる送信元の見出しで、相手を見分ける
 *   raw-csv               : 式の無害化を通さずに、CSV を組み立てて返す
 *   prefix-redirect-check : 先頭の / だけを見て、戻り先を自サイトの中と決める
 *   raw-error-log         : 例外をそのままログに書く（SQL の値や個人の情報が載る）
 * ビルドの成果物（--dir）では、公開する assets の source map と、秘密の値と、環境の値のファイルを見る。
 * テストのファイルは違反の見本を持つので、どの型でも見ない。
 */

const root = process.cwd();
const SCRIPT = join(root, "scripts/check-security-patterns.mjs");
const rulesOf = (violations) => violations.map((v) => v.rule);

const tempDirs = [];
function tempTree(files) {
  const dir = mkdtempSync(join(tmpdir(), "security-patterns-"));
  tempDirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function runCli(args, cwd = root) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

// 秘密らしい値の見本。本物の鍵ではない。リポジトリの走査に掛からないよう、ここで組み立てる
const FAKE_SECRET = ["test", "only", "not", "a", "real", "value", "0123456789"].join("-");
const FAKE_PEM = `-----BEGIN ${"PRIVATE"} KEY-----\n${"QUJDREVGR0g".repeat(8)}\n-----END ${"PRIVATE"} KEY-----`;

describe("db-dump-artifact（DB の書き出しを成果物にしない）", () => {
  it("ワークフローで DB を書き出す run と、.sql を上げる upload を見つける", () => {
    const backup = ["jobs:", "  deploy:", "    steps:", "      - run: pnpm run db:backup", ""].join("\n");
    const exportRun = ["      - run: npx wrangler d1 export hr-evaluation-db --remote --output=dump.sql", ""].join("\n");
    const upload = [
      "      - uses: actions/upload-artifact@0123456789abcdef0123456789abcdef01234567 # v4.6.2",
      "        with:",
      "          name: dump",
      "          path: dump.sql",
      "",
    ].join("\n");
    expect(rulesOf(scanFile(".github/workflows/deploy.yml", backup))).toContain("db-dump-artifact");
    expect(rulesOf(scanFile(".github/workflows/migrate.yml", exportRun))).toContain("db-dump-artifact");
    expect(rulesOf(scanFile(".github/workflows/deploy.yml", upload))).toContain("db-dump-artifact");
  });

  it("ビルドの成果物の upload と、ワークフローの外の文字は違反にしない", () => {
    const upload = [
      "      - uses: actions/upload-artifact@0123456789abcdef0123456789abcdef01234567 # v4.6.2",
      "        with:",
      "          name: worker-build",
      "          path: |",
      "            .open-next",
      "            !.open-next/**/*.map",
      "",
    ].join("\n");
    expect(scanFile(".github/workflows/deploy.yml", upload)).toEqual([]);
    expect(scanFile("src/lib/backup-note.ts", 'export const NOTE = "d1 export は使わない";\n')).toEqual([]);
  });
});

describe("client-ip-header（偽れる見出しで相手を見分けない）", () => {
  it.each([
    ['req.headers.get("x-forwarded-for")'],
    ["request.headers.get('X-Real-IP')"],
    ['headers.get("true-client-ip")'],
    ['headers.get("x-client-ip")'],
    ['headers.get("forwarded")'],
  ])("%s は、どこにあっても違反", (code) => {
    expect(rulesOf(scanFile("src/app/api/example/route.ts", `const ip = ${code};\n`))).toContain("client-ip-header");
    expect(rulesOf(scanFile("src/lib/security/client-ip.ts", `const ip = ${code};\n`))).toContain("client-ip-header");
  });

  it("cf-connecting-ip は、送信元を見分ける1か所（src/lib/security）の外でだけ違反", () => {
    const code = 'const ip = req.headers.get("cf-connecting-ip") ?? "unknown";\n';
    expect(rulesOf(scanFile("src/app/api/agent/token/route.ts", code))).toContain("client-ip-header");
    expect(scanFile("src/lib/security/client-ip.ts", code)).toEqual([]);
  });

  it("テストのファイルと注釈の中は違反にしない", () => {
    const code = 'headers.set("x-forwarded-for", "203.0.113.9");\n';
    expect(scanFile("src/lib/security/client-ip.test.ts", code)).toEqual([]);
    expect(scanFile("e2e/agent-api.spec.ts", code)).toEqual([]);
    expect(scanFile("src/lib/agent-api.ts", '// "x-forwarded-for" は偽れるので読まない\n')).toEqual([]);
    expect(scanFile("src/lib/agent-api.ts", '/*\n * "cf-connecting-ip" は client-ip.ts だけが読む\n */\n')).toEqual([]);
  });

  it("違反の行の番号を返す", () => {
    const code = ["export async function POST(req: Request) {", '  const ip = req.headers.get("x-real-ip");', "}", ""].join("\n");
    expect(scanFile("src/app/api/example/route.ts", code)).toEqual([
      expect.objectContaining({ rule: "client-ip-header", file: "src/app/api/example/route.ts", line: 2 }),
    ]);
  });
});

describe("raw-csv（CSV は toCsv で組み立てる）", () => {
  it("text/csv を返すのに toCsv を通していないものを見つける", () => {
    const route = 'return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8" } });\n';
    const blob = 'const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));\n';
    expect(rulesOf(scanFile("src/app/api/example/route.ts", route))).toContain("raw-csv");
    expect(rulesOf(scanFile("src/components/ExampleExport.tsx", blob))).toContain("raw-csv");
  });

  it("区切りと改行を自分で join して CSV を作るものを見つける", () => {
    const code = 'const text = rows.map((r) => r.join(",")).join("\\r\\n");\n';
    expect(rulesOf(scanFile("src/lib/example-report.ts", code))).toContain("raw-csv");
  });

  it("toCsv を通したもの、取り込みの accept、csv.ts の中は違反にしない", () => {
    const viaToCsv = [
      'import { toCsv } from "@/lib/csv";',
      "const csv = toCsv(headers, rows);",
      'const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));',
      "",
    ].join("\n");
    expect(scanFile("src/components/ExampleExport.tsx", viaToCsv)).toEqual([]);
    expect(scanFile("src/components/ExampleImport.tsx", '<input type="file" accept=".csv,text/csv" />\n')).toEqual([]);
    expect(scanFile("src/lib/csv.ts", 'const out = rows.map((r) => r.join(",")).join("\\r\\n");\nconst type = "text/csv";\n')).toEqual([]);
  });
});

describe("prefix-redirect-check（戻り先を先頭の / だけで決めない）", () => {
  it.each([
    ['const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;'],
    ['z.string().refine((value) => value.startsWith("/") && !value.startsWith("//"))'],
    ['const safe = next.startsWith("/")\n && !next.startsWith("//") ? next : undefined;'],
    ['const safe = next.startsWith("/")\r\n && !next.startsWith("//") ? next : undefined;'],
    ['const safe = next.startsWith("/") /* 戻り先 */ && /* 外部を除く */ !next.startsWith("//");'],
    ['const safe = (next.startsWith("/"))\n && !(next.startsWith("//"));'],
    ['const safe = request.next.startsWith("/") && !request.next.startsWith("//");'],
  ])("%s は違反", (code) => {
    expect(rulesOf(scanFile("src/app/login/page.tsx", `${code}\n`))).toContain("prefix-redirect-check");
  });

  it.each([
    'const safe = safeRedirectPath(next);',
    'const root = next.startsWith("/"); const protocol = next.startsWith("//");',
    'const root = next.startsWith("/")\nconst protocol = next.startsWith("//")',
    'const result = first.startsWith("/") && !second.startsWith("//");',
    '// next.startsWith("/") && !next.startsWith("//")',
    `const example = 'next.startsWith("/") && !next.startsWith("//")';`,
    'const example = `next.startsWith("/") && !next.startsWith("//")`;',
  ])("共通関数・別の条件・注釈・文字列の %s は違反にしない", (code) => {
    expect(scanFile("src/app/login/page.tsx", `${code}\n`)).toEqual([]);
  });

  it("複数行の旧式の検査は、最初の条件の行を報告する", () => {
    expect(scanFile("src/app/login/page.tsx", '\nconst safe = next.startsWith("/")\n && !next.startsWith("//");\n'))
      .toEqual([expect.objectContaining({ rule: "prefix-redirect-check", line: 2 })]);
  });
});

describe("raw-error-log（例外をそのままログに書かない）", () => {
  it.each([
    ["console.error(error);"],
    ['console.warn("古い記録を消せませんでした", e);'],
    ['console.error("保存に失敗", err);'],
    ["console.log(cause);"],
  ])("%s は違反", (code) => {
    expect(rulesOf(scanFile("src/lib/example.ts", `try { run(); } catch (e) { ${code} }\n`))).toContain("raw-error-log");
  });

  it("要約を通したもの、似た名前の別の値、注釈とテストの中は違反にしない", () => {
    expect(scanFile("src/lib/example.ts", 'console.error("保存に失敗", summarizeErrorForLog(e));\n')).toEqual([]);
    expect(scanFile("src/lib/example.ts", 'console.info("件数", errors.length, errorCount);\n')).toEqual([]);
    expect(scanFile("src/lib/example.ts", "// console.error(e) は使わない\n")).toEqual([]);
    expect(scanFile("src/lib/example.test.ts", "console.error(e);\n")).toEqual([]);
  });
});

describe("リポジトリの走査（scanRepository）", () => {
  it("src と .github/workflows を見て、node_modules・ビルドの成果物・テストは見ない", () => {
    const dir = tempTree({
      "src/app/api/example/route.ts": 'const ip = req.headers.get("x-forwarded-for");\n',
      ".github/workflows/deploy.yml": "jobs:\n  deploy:\n    steps:\n      - run: pnpm run db:backup\n",
      "src/lib/example.test.ts": "console.error(e);\n",
      "node_modules/pkg/index.js": 'const ip = req.headers.get("x-forwarded-for");\n',
      ".open-next/server-functions/default/index.mjs": "console.error(e);\n",
    });
    const found = scanRepository(dir);
    expect(found.map((v) => `${v.rule} ${v.file}`).sort()).toEqual([
      "client-ip-header src/app/api/example/route.ts",
      "db-dump-artifact .github/workflows/deploy.yml",
    ]);
  });

  it("このリポジトリに、5つの型の違反が残っていない", () => {
    // P04 の時点の数：db-dump-artifact 2・client-ip-header 4・raw-csv 0・prefix-redirect-check 2・raw-error-log 3
    const found = scanRepository(root).map((v) => `${v.rule} ${v.file}:${v.line ?? "-"}`);
    expect(found).toEqual([]);
  });

  it("package.json の check:security が、この検査を流す", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts?.["check:security"]).toMatch(/^node scripts\/check-security-patterns\.mjs$/);
  });
});

describe("ビルドの成果物の走査（scanBuildDir）", () => {
  it("公開する assets の source map と、その参照を見つける", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n//# sourceMappingURL=app.js.map\n",
      "assets/_next/static/chunks/app.js.map": "{}",
    });
    expect(scanBuildDir(dir).map((v) => `${v.rule} ${v.file}`).sort()).toEqual([
      "source-map assets/_next/static/chunks/app.js",
      "source-map assets/_next/static/chunks/app.js.map",
    ]);
  });

  it("公開しないサーバーの source map は違反にしない", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n",
      "server-functions/default/handler.mjs": "export default {};\n//# sourceMappingURL=handler.mjs.map\n",
      "server-functions/default/handler.mjs.map": "{}",
    });
    expect(scanBuildDir(dir)).toEqual([]);
  });

  it("秘密の値と、鍵の本体と、環境の値のファイルを、どこにあっても見つける", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n",
      "server-functions/default/a.mjs": `const s = { BETTER_AUTH_SECRET: "${FAKE_SECRET}" };\n`,
      "server-functions/default/b.mjs": `var c={"AGENT_API_KEY":"${FAKE_SECRET}"};\n`,
      "server-functions/default/c.mjs": `const pem = \`${FAKE_PEM}\`;\n`,
      ".dev.vars": "X=1\n",
      "server-functions/default/.env.production": "X=1\n",
    });
    expect(scanBuildDir(dir).map((v) => `${v.rule} ${v.file}`).sort()).toEqual([
      "env-file .dev.vars",
      "env-file server-functions/default/.env.production",
      "secret-value server-functions/default/a.mjs",
      "secret-value server-functions/default/b.mjs",
      "secret-value server-functions/default/c.mjs",
    ]);
  });

  it("環境の値の参照、名前だけの文、.env.example は違反にしない", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n",
      "server-functions/default/a.mjs": [
        "const s = process.env.BETTER_AUTH_SECRET;",
        'const k = env.AGENT_API_KEY ?? "";',
        'throw new Error("CREDENTIAL_ENC_KEY を設定してください");',
        "",
      ].join("\n"),
      ".env.example": "BETTER_AUTH_SECRET=\n",
    });
    expect(scanBuildDir(dir)).toEqual([]);
  });

  it("依存のライブラリの定数と、まるごと差し込みのテンプレートは見ず、同じ所の秘密の値は見つける", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n",
      "server-functions/default/handler.mjs": [
        'var TELEMETRY_KEY_ID = "example.attribute.name";',
        `var DEFAULT_SECRET = "${FAKE_SECRET}";`,
        'var a = { PENDING_WRITES_CACHE_KEY: "__example-cache-entry__" };',
        "var b = { BETTER_AUTH_SECRETS: `${value.slice(0,maxChars)}` };",
        'throw new Error(`Invalid BETTER_AUTH_SECRETS: "${value.slice(0,maxChars)}". Use a list.`);',
        "",
      ].join("\n"),
      "server-functions/default/ours.mjs": [
        `var c = { BETTER_AUTH_SECRET: "${FAKE_SECRET}" };`,
        "var d = { AGENT_API_KEY: `" + FAKE_SECRET + "${suffix}` };",
        "",
      ].join("\n"),
    });
    expect(scanBuildDir(dir).map((v) => `${v.rule} ${v.file}:${v.line}`)).toEqual([
      "secret-value server-functions/default/ours.mjs:1",
      "secret-value server-functions/default/ours.mjs:2",
    ]);
  });

  it("見つけた結果に、秘密の値そのものを入れない", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js": "console.log(1);\n",
      "server-functions/default/a.mjs": `const s = { BETTER_AUTH_SECRET: "${FAKE_SECRET}" };\n`,
    });
    const text = JSON.stringify(scanBuildDir(dir));
    expect(text.includes("secret-value"), "違反を見つけていない").toBe(true);
    expect(text.includes(FAKE_SECRET), "結果に秘密の値が出ている").toBe(false);
  });
});

describe("コマンドとして流す（CI の check:security と、ビルドの後の --dir）", () => {
  it("--dir を付けると、その成果物だけを見て、違反があれば 1 で終わり、値を出さない", () => {
    const dir = tempTree({
      "assets/_next/static/chunks/app.js.map": "{}",
      "server-functions/default/a.mjs": `const s = { BETTER_AUTH_SECRET: "${FAKE_SECRET}" };\n`,
    });
    const r = runCli(["--dir", dir]);
    expect(r.status).toBe(1);
    expect(r.output).toContain("source-map");
    expect(r.output).toContain("secret-value");
    expect(r.output).toContain("THIRD_PARTY_CONSTANT_NAMES");
    expect(r.output.includes(FAKE_SECRET), "出力に秘密の値が出ている").toBe(false);
  });

  it("--dir の成果物がきれいなら 0 で終わる", () => {
    const dir = tempTree({ "assets/_next/static/chunks/app.js": "console.log(1);\n" });
    expect(runCli(["--dir", dir]).status).toBe(0);
  });

  it("--dir の先が無いか assets を持たないときは、検査できないので 0 で終えない", () => {
    const empty = tempTree({ "server-functions/default/a.mjs": "export {};\n" });
    expect(runCli(["--dir", join(empty, "missing")]).status).not.toBe(0);
    expect(runCli(["--dir", empty]).status).not.toBe(0);
  });

  it("--dir が無いときはリポジトリだけを見て、ビルドの成果物は見ない", () => {
    const clean = tempTree({
      "src/lib/example.ts": "export const x = 1;\n",
      ".open-next/assets/_next/static/chunks/app.js.map": "{}",
    });
    expect(runCli([], clean).status).toBe(0);

    const dirty = tempTree({ "src/lib/example.ts": "try { run(); } catch (e) { console.error(e); }\n" });
    const r = runCli([], dirty);
    expect(r.status).toBe(1);
    expect(r.output).toContain("raw-error-log");
    expect(r.output).toContain("src/lib/example.ts");
  });
});
