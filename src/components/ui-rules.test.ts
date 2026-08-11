import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 画面の器（表・カード・定義リスト・サマリー）の作法を、コードのほうで固定する。
 *
 * 判断基準そのものは docs/product/spec.md §5-5。
 * ここで縛るのは「同じ用途に2つ目の組み方を作らない」という一点。
 * 表を1画面で手書きし始めると、列見出しの固定・狭い画面でのカード化・
 * 数値の右揃えが、その画面だけ抜け落ちる（実際にそうなっていた）。
 */

const SRC = join(process.cwd(), "src");

/** DataTable だけが表を組み立ててよい。 */
const TABLE_OWNER = join(SRC, "components", "DataTable.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const sourceFiles = walk(SRC).filter((p) => (p.endsWith(".tsx") || p.endsWith(".ts")) && !p.includes(".test."));

describe("画面の器の作法", () => {
  it("表を組み立ててよいのは DataTable だけ（画面に <table> を直接書かない）", () => {
    const offenders = sourceFiles.filter((p) => p !== TABLE_OWNER && readFileSync(p, "utf8").includes("<table"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("ラベルと値の対は DefList に集約する（画面に <dl> を直接書かない）", () => {
    const owners = new Set([join(SRC, "components", "ui.tsx"), TABLE_OWNER]);
    const offenders = sourceFiles.filter((p) => !owners.has(p) && readFileSync(p, "utf8").includes("<dl"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("固定した列見出しの位置は、固定ヘッダーの高さと対で保つ", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 列見出しを固定していること
    expect(css).toContain("--table-head-top");
    // 見出しの帯を固定している画面では、その帯のぶんだけ下げていること
    expect(css).toContain('body:has(.page-head[data-sticky="true"])');
  });
});
