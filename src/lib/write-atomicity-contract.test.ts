import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「一つの操作で複数の表を書くなら、1回の batch で書く」を、ファイルの形で見張る（D-003）。
 *
 * 別々の await で2つの表を書くと、間で止まったときに片方だけが残る。
 * D1 の batch は1つのトランザクションなので、まとめておけば全部書けるか何も書かれないかになる。
 * batch に入りきらない会社の追加は、補償（withCompensation）で守る。その手順も中身は
 * 1回の batch か1つの表なので、この検査をそのまま通る（外す名前を持たない）。
 *
 * ── 見ているもの ──
 * トップレベルの関数ごとに、batch の外で直接 await している書き込み
 * （`await db.insert(s.表)` / `update` / `delete`。tx・d1 も同じ）の表を集め、
 * 2つ以上の表があれば知らせる。
 *
 * ── 見えないもの（限界） ──
 * - 別の関数を順に呼んで書く形（関数 A が表 X、関数 B が表 Y を書き、呼ぶ側が順に await）。
 * - 変数に入れた文を後で await する形。
 * こうした形を足すときは、レビューで batch に入るかを確かめる。
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "test-support") walk(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const rel = (p: string) => p.replace(`${SRC}/`, "");

/** トップレベルの宣言の頭。字下げのない行だけを見るので、入れ子の関数で切れない。 */
const TOP_LEVEL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=/gm;
const DIRECT_WRITE = /await\s+(?:tx|db|d1)\s*\.\s*(?:insert|update|delete)\s*\(\s*s\.(\w+)/g;

interface FunctionWrites {
  where: string;
  tables: string[];
}

function directWritesByFunction(): FunctionWrites[] {
  const out: FunctionWrites[] = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    const heads = [...source.matchAll(TOP_LEVEL)].map((m) => ({ name: m[1] ?? m[2], at: m.index }));
    heads.forEach((head, i) => {
      const body = source.slice(head.at, heads[i + 1]?.at ?? source.length);
      const tables = [...body.matchAll(DIRECT_WRITE)].map((m) => m[1]);
      if (tables.length > 0) out.push({ where: `${rel(file)}: ${head.name}`, tables });
    });
  }
  return out;
}

describe("書き込みの原子性（D-003）", () => {
  const found = directWritesByFunction();

  it("走査で直接の書き込みが見つかる（探し方が壊れて 0 件で通らない）", () => {
    expect(found.length).toBeGreaterThan(10);
  });

  it("一つの関数が batch の外で書く表は1つまで（複数の表は1回の batch にまとめる）", () => {
    const offenders = found
      .filter((f) => new Set(f.tables).size > 1)
      .map((f) => `${f.where} → ${[...new Set(f.tables)].join(", ")}`);
    expect(offenders).toEqual([]);
  });
});
