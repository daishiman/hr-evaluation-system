import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "vitest";

const root = process.cwd();
const ledgerPath = join(root, "system-spec/route-ledger.json");
const roles = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"];
const widths = [375, 768, 1280, 1600];
const outcomes = new Set(["200", "redirect", "notFound", "denied"]);

function walkPages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function toRoute(file) {
  const route = relative(join(root, "src/app"), file)
    .split(sep)
    .slice(0, -1)
    .join("/");
  return route ? `/${route}` : "/";
}

test("45個の page.tsx とルート台帳が完全に一致する", () => {
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const implemented = walkPages(join(root, "src/app")).map(toRoute).sort();
  const documented = ledger.routes.map((route) => route.path).sort();

  assert.equal(implemented.length, 45);
  assert.equal(new Set(documented).size, documented.length, "台帳のパスが重複しています");
  assert.deepEqual(documented, implemented);
});

test("全ルートが4ロール×状態×期待結果と4つの検証幅へ展開できる", () => {
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  let expandedCases = 0;

  assert.deepEqual(ledger.widths, widths);
  for (const [className, accessClass] of Object.entries(ledger.accessClasses)) {
    assert.ok(Object.keys(accessClass.states).length > 0, `${className}: 状態がありません`);
    for (const [stateName, state] of Object.entries(accessClass.states)) {
      assert.deepEqual(Object.keys(state.expectedByRole).sort(), [...roles].sort(), `${className}.${stateName}`);
      for (const outcome of Object.values(state.expectedByRole)) {
        assert.ok(outcomes.has(outcome), `${className}.${stateName}: 未知の期待結果 ${outcome}`);
      }
    }
  }

  for (const route of ledger.routes) {
    const accessClass = ledger.accessClasses[route.accessClass];
    assert.ok(accessClass, `${route.path}: accessClass が不明です`);
    assert.equal(route.widthPolicy, "all", `${route.path}: 4幅すべてを対象にしてください`);
    assert.ok(route.label, `${route.path}: 画面名がありません`);
    assert.ok(route.purpose, `${route.path}: 目的がありません`);
    assert.ok(route.subject, `${route.path}: 対象がありません`);
    for (const width of ledger.widths) {
      for (const state of Object.values(accessClass.states)) {
        for (const role of roles) {
          assert.ok(outcomes.has(state.expectedByRole[role]), `${route.path}@${width}: ${role} の期待結果が不正です`);
          expandedCases++;
        }
      }
    }
  }
  assert.ok(expandedCases >= 44 * 4 * 2 * 4, "全routeを最低2状態×4ロール×4幅へ展開してください");
});
