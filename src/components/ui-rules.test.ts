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

  it("一覧の1行は CardRow に集約する（title と sub を画面で組み立て直さない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    // .row-main（見出し＋補足の入れ物）を自前で書いている画面を検出する。
    // 入力欄が並ぶ編集画面は行の中身が画面ごとに違うため、下の許可リストで除く。
    const editors = new Set(
      ["FormAnswer.tsx", "GradeRequirementEditor.tsx", "PromotionRequirementEditor.tsx", "PointDesign.tsx", "BehaviorGuidelineEditor.tsx", "BehaviorBandSetEditor.tsx"].map((n) => n),
    );
    const offenders = sourceFiles.filter(
      (p) => p !== owner && !editors.has(p.split("/").pop() ?? "") && readFileSync(p, "utf8").includes('className="row-main"'),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("カード1枚の頭は CardHead に集約する（左に読むもの・右に押すものの並べ方を書き起こさない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    // SchemeEditor だけは、カードの頭ではなく「カードの中の節見出し」に同じ並びを使っている
    const allowed = new Set(["SchemeEditor.tsx"]);
    const offenders = sourceFiles.filter(
      (p) =>
        p !== owner &&
        !allowed.has(p.split("/").pop() ?? "") &&
        readFileSync(p, "utf8").includes("flex flex-wrap items-start justify-between gap-3"),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("ボタンの見た目は Button / LinkButton / DownloadButton に集約する（btn クラスを直接書かない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    // 素の <a>/<button>/<Link> に btn を貼ると、押せる大きさ（44px）・見た目の段階
    // （primary/secondary/tertiary）がその箇所だけ揃わなくなる。
    // 文字列で書いても差し込みで書いても（className={`btn ...`}）同じく禁止する。
    const offenders = sourceFiles.filter((p) => /className=(["{`])(?:\{?`)?btn[\s"`]/.test(readFileSync(p, "utf8")));
    expect(offenders.filter((p) => p !== owner).map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("節見出しは SectionHeading に集約する（見出しタグを直接書かない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    // AdminDashboard の「次の一手」だけは、その画面唯一の視覚的な主役として
    // 節見出し（13px）ではなく大きい文字で出す意図的な例外。
    const allowed = new Set(["AdminDashboard.tsx"]);
    const offenders = sourceFiles.filter(
      (p) =>
        p !== owner &&
        !allowed.has(p.split("/").pop() ?? "") &&
        /<h[234][\s>]/.test(readFileSync(p, "utf8")),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("取り消しのきかない操作の確認は ConfirmButton に集約する（ブラウザの確認ダイアログを使わない）", () => {
    // window.confirm は文面の見た目を画面側で整えられず、確認の作法が1箇所だけ変わる。
    const offenders = sourceFiles.filter((p) => readFileSync(p, "utf8").includes("window.confirm"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("確認・入力を割り込ませるダイアログを書いてよいのは ConfirmButton だけ", () => {
    // 確認は「押した場所の幅に左右されない中央のダイアログ」で出す、を1箇所で守る。
    // 画面ごとに行の中へ確認文の箱を差し込むと、本文（.row-main は min-width: 0）が
    // 潰れて1文字ずつ縦に折り返される崩れ方をする（実際にそうなっていた）。
    const owner = join(SRC, "components", "ConfirmButton.tsx");
    const offenders = sourceFiles.filter((p) => p !== owner && /<dialog[\s>]/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("確認ダイアログはキャンセルを初期フォーカスにし、暗黙のフォーム送信をしない", () => {
    const source = readFileSync(join(SRC, "components", "ConfirmButton.tsx"), "utf8");
    expect(source).toMatch(/<Button type="button" autoFocus[\s\S]*?>\s*やめる/);
    expect(source.match(/type="button"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("一覧の行は、入りきらないときに折り返す（本文を潰さない）", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const row = css.slice(css.indexOf(".card-row {"));
    const block = row.slice(0, row.indexOf("}"));
    expect(block).toContain("flex-wrap: wrap");
    // 本文は最低限の幅を要求する（min-width: 0 だけだと隣の箱に押し潰される）
    expect(css).toContain(".row-main { flex: 1 1 16rem; min-width: 0; }");
  });

  it("文字は12px未満にしない（画面・共通CSSとも）", () => {
    // 11px・10px は一見「小さくまとまって」見えるが、補足・状態の札はこの下限を割ると読めなくなる。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    expect(css.match(/font-size: (\d|1[01])px/g) ?? []).toEqual([]);
    const offenders = sourceFiles.filter((p) => /text-\[(\d|1[01])px\]/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("白文字を載せる主要ボタンは、コントラストを満たす色を使う", () => {
    // --accent（#e8590c）に白文字だと 3.58:1 で本文の基準（4.5:1）に届かない。
    // 大きい数字の文字色としてだけ使い、面の色には --accent-on-white-bg を使う。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const primary = css.slice(css.indexOf(".btn-primary {"));
    expect(primary.slice(0, primary.indexOf("}"))).toContain("var(--accent-on-white-bg)");
  });

  it("指で押す端末では、押せるものが44px以上になる", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    expect(css).toContain("@media (pointer: coarse)");
    const block = css.slice(css.indexOf("@media (pointer: coarse)"));
    expect(block.slice(0, block.indexOf("}"))).toContain("min-height: 44px");
  });

  it("固定した列見出しの位置は、固定ヘッダーの高さと対で保つ", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 列見出しを固定していること
    expect(css).toContain("--table-head-top");
    // 見出しの帯を固定している画面では、その帯のぶんだけ下げていること
    expect(css).toContain('body:has(.page-head[data-sticky="true"])');
  });
});
