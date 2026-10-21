import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/*
 * 事業所KGI（達成率の入力・達成係数・賞与への掛け算）は 2026-10-19 に仕組みごと削除した（DD-024）。
 * 賞与は KPI評価点合計だけで決まる（src/lib/domain/bonus.ts）。
 *
 * 表・画面・計算を消しても、文言・初期データ・試験のどこかに名残があると、
 * 「まだどこかで入力するのでは」と読まれる。字面で 0 件であることを固定する。
 * 注釈（コメント）も数える。開発者向けの文に残った説明も、いまの仕組みと食い違うため。
 *
 * 除くもの:
 *   - この検査そのもの … 探す語を書くため。
 *   - 文書のうち、過去の経緯を書き残すもの（5種類） … 消した事実と消し方を残す場所なので、語が出てよい。
 *     受領書（spec-receipts/）・履歴（backlog-history-*.md）・レビューの記録（elegant-review.md）・
 *     判断の記録（design-decisions.md）・デプロイ時の注意（deploy-notes.md。0038・0039 の表の名前）。
 */

const ROOT = process.cwd();
const SELF = path.join("src", "lib", "kgi-removal.static.test.ts");
const EXCLUDED = new Set([SELF]);
/** 文書で経緯を書き残すもの。前方一致（フォルダ）か、名前の形で当てる */
const DOC_HISTORY = [
  /^docs\/product\/spec-receipts\//,
  /^docs\/product\/backlog-history-[^/]*\.md$/,
  /^docs\/product\/elegant-review\.md$/,
  /^docs\/product\/design-decisions\.md$/,
  /^docs\/deploy-notes\.md$/,
];
/** 半角・全角、大文字・小文字のどれで書いても当てる */
const KGI = /kgi|ｋｇｉ/i;

function filesUnder(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) filesUnder(rel, ext, out);
    else if (ext.test(name)) out.push(rel);
  }
  return out;
}

/** 当たった行を「ファイル:行: 中身」の形で返す（落ちたときに直す場所が分かるように） */
function hitsIn(files: string[]): string[] {
  const hits: string[] = [];
  for (const rel of files) {
    if (EXCLUDED.has(rel)) continue;
    readFileSync(path.join(ROOT, rel), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (KGI.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
  }
  return hits;
}

describe("事業所KGIの削除（DD-024）", () => {
  it("src の .ts・.tsx・.mjs・.css に KGI の字が無い（この検査は除く）", () => {
    expect(hitsIn(filesUnder("src", /\.(ts|tsx|mjs|css)$/))).toEqual([]);
  });

  it("画面の試験（e2e）に KGI の字が無い", () => {
    expect(hitsIn(filesUnder("e2e", /\.(ts|tsx|mjs|js|json)$/))).toEqual([]);
  });

  it("ファイル名・フォルダ名にも kgi が無い（この検査は除く）", () => {
    const named = [...filesUnder("src", /./), ...filesUnder("e2e", /./)].filter(
      (rel) => rel !== SELF && KGI.test(rel),
    );
    expect(named).toEqual([]);
  });

  it("画面の入口（ナビ・経路台帳・画面文字の走査）に KGI の画面が無く、/admin/kgi の画面も無い", () => {
    expect(existsSync(path.join(ROOT, "src", "app", "admin", "kgi"))).toBe(false);
    expect(
      hitsIn(["src/lib/nav.ts", "system-spec/route-ledger.json", "scripts/scan-rendered-text.mjs"]),
    ).toEqual([]);
  });

  it("いまの仕組みを書く文書（docs と README）に KGI の字が無い（経緯を残す5種類は除く）", () => {
    const docs = filesUnder("docs", /\.md$/)
      .map((rel) => rel.split(path.sep).join("/"))
      .filter((rel) => !DOC_HISTORY.some((pattern) => pattern.test(rel)));
    expect(hitsIn([...docs, "README.md"])).toEqual([]);
  });

  it("経緯を残す除外は、実在するファイルだけを指す（消えた除外で検査が緩まない）", () => {
    for (const rel of ["docs/product/elegant-review.md", "docs/product/design-decisions.md", "docs/deploy-notes.md"]) {
      expect(existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
    expect(filesUnder("docs/product/spec-receipts", /\.md$/).length).toBeGreaterThan(0);
    expect(filesUnder("docs/product", /^backlog-history-.*\.md$/).length).toBeGreaterThan(0);
  });

  it("初期データ・見本データに KGI の表・係数・文言が無い", () => {
    expect(
      hitsIn([
        "scripts/seed.mjs",
        "scripts/seed-data.mjs",
        "scripts/sample-data.mjs",
        "scripts/seed-sample.mjs",
        "drizzle/seed.sql",
      ]),
    ).toEqual([]);
  });
});
