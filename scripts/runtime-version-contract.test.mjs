import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 動かす Node と、脆弱性の直った依存の版を固定する契約（DD-032 の13・14）。
 * 手元・CI・本番のビルドで Node の版がずれると、直したはずの版の外で動くことになる。
 * 依存は、入っている版（node_modules）と package.json の下限の両方を見る。
 * 下限が古いままだと、lock を作り直したときに直っていない版へ戻りうるため。
 */

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const pkg = JSON.parse(read("package.json"));
const WORKFLOW_DIR = ".github/workflows";
const workflows = Object.fromEntries(
  readdirSync(join(root, WORKFLOW_DIR))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => [f, read(`${WORKFLOW_DIR}/${f}`)]),
);

const NODE_VERSION = "22.23.4";

/** "16.4.2" や "^16.4.2" を [16, 4, 2] にする。読めなければ null */
function parseVersion(spec) {
  const m = String(spec ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1, 4).map(Number) : null;
}

/** a が b 以上か */
function atLeast(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

const installedVersion = (name) => JSON.parse(read(`node_modules/${name}/package.json`)).version;
const declaredSpec = (name) => pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];

describe("Node の版をそろえる（DD-032 の14）", () => {
  it(".nvmrc が Node の版を1つに決める", () => {
    expect(existsSync(join(root, ".nvmrc")), ".nvmrc が無い").toBe(true);
    expect(read(".nvmrc").trim()).toBe(NODE_VERSION);
  });

  it("package.json の engines が、同じ版から次の大きな版の手前までを受ける", () => {
    expect(pkg.engines?.node).toBe(`>=${NODE_VERSION} <23`);
  });

  it(".npmrc の engine-strict で、版の外の Node での install を止める", () => {
    expect(existsSync(join(root, ".npmrc")), ".npmrc が無い").toBe(true);
    expect(read(".npmrc")).toMatch(/^\s*engine-strict\s*=\s*true\s*$/m);
  });

  it("どのワークフローも、Node の版を .nvmrc から読む", () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      const setups = workflow.split("\n").filter((l) => /^\s*(- )?uses:\s*actions\/setup-node@/.test(l));
      const fromFile = workflow.match(/^\s*node-version-file:\s*\.nvmrc\s*$/gm) ?? [];
      expect(fromFile.length, `${name} の setup-node が .nvmrc を読んでいない`).toBe(setups.length);
      expect(/^\s*node-version:/m.test(workflow), `${name} に版の直書きがある`).toBe(false);
    }
  });
});

describe("直った版の依存を使う（DD-032 の13・O33）", () => {
  const floors = [
    ["next", [16, 4, 1], 16],
    ["react", [19, 2, 9], 19],
    ["react-dom", [19, 2, 9], 19],
    ["vitest", [4, 1, 12], 4],
    ["@vitest/coverage-v8", [4, 1, 12], 4],
    ["wrangler", [4, 0, 0], 4],
    ["@opennextjs/cloudflare", [1, 0, 0], 1],
  ];

  it.each(floors)("%s は、入っている版と package.json の下限が直った版以上で、大きな版を変えない", (name, floor, major) => {
    const installed = parseVersion(installedVersion(name));
    const declared = parseVersion(declaredSpec(name));
    expect(installed, `${name} の入っている版が読めない`).not.toBeNull();
    expect(declared, `${name} の package.json の版が読めない`).not.toBeNull();
    expect(installed[0], `${name} の大きな版`).toBe(major);
    expect(atLeast(installed, floor), `${name} の入っている版 ${installed.join(".")}`).toBe(true);
    expect(atLeast(declared, floor), `${name} の package.json の下限 ${declared.join(".")}`).toBe(true);
  });

  it("react と react-dom、vitest と @vitest/coverage-v8 は同じ版を使う", () => {
    expect(installedVersion("react-dom")).toBe(installedVersion("react"));
    expect(installedVersion("@vitest/coverage-v8")).toBe(installedVersion("vitest"));
  });

  it("版の上書き（pnpm.overrides）を置くなら、版を決めない指定を使わない", () => {
    const overrides = pkg.pnpm?.overrides ?? {};
    for (const [name, spec] of Object.entries(overrides)) {
      expect(/^(\*|latest|x)$/i.test(String(spec).trim()), `${name} の上書きが版を決めていない`).toBe(false);
    }
  });
});

describe("Actions の部品を版の中身で固定する（DD-032 の13・O32）", () => {
  it("uses は、すべてコミット SHA で固定し、版を注釈に書く", () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      const uses = workflow
        .split("\n")
        .map((l) => l.match(/^\s*(?:- )?uses:\s*(.+)$/)?.[1].trim())
        .filter(Boolean)
        // リポジトリの中の部品とコンテナの指定は、この固定の対象にしない
        .filter((u) => !u.startsWith("./") && !u.startsWith("docker://"));
      expect(uses.length, `${name} に uses が無い`).toBeGreaterThan(0);
      for (const u of uses) {
        expect(u, name).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+(\.\d+)*\s*$/);
      }
    }
  });
});
