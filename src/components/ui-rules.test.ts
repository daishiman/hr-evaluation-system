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
    // SchemeGroupPicker だけは、カードの頭ではなく「カードの中の節見出し」に同じ並びを使っている
    const allowed = new Set(["SchemeGroupPicker.tsx"]);
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

  it("文字の大きさは globals.css の @theme だけで決める（px を直接書かない）", () => {
    // 「全体的に文字が小さい」と言われたとき、px が画面に散っていると
    // 200箇所以上を1つずつ直すことになり、必ず取りこぼす（実際にそうなっていた）。
    // 大きさの正本は @theme の1箇所だけにして、画面は段の名前で指定する。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
    // @theme の外に font-size: Npx が残っていないこと
    expect(css.replace(theme, "").match(/font-size: \d+px/g) ?? []).toEqual([]);
    // 画面側も text-[13px] のような直書きをしないこと
    const offenders = sourceFiles.filter((p) => /text-\[\d+px\]/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("文字の段は14px未満にしない", () => {
    // 13px・12px は一見「小さくまとまって」見えるが、補足・状態の札はこの下限を割ると読めなくなる。
    // 2026-08 に発注者から「全体的に小さい」と指摘され、下限を 12px → 14px に引き上げた。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
    const sizes = [...theme.matchAll(/--text-[\w-]+: (\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    // 本文は16px。ここを動かすと画面全体の大きさが動く。
    expect(theme).toContain("--text-body: 16px;");
    // 見出しと本文の差（情報の階層）が消えていないこと。
    // ページ見出し（title）は本文より5px以上大きく、補足（note）は本文より小さい。
    const px = (name: string) => Number(theme.match(new RegExp(`--text-${name}: (\\d+)px`))?.[1]);
    expect(px("title") - px("body")).toBeGreaterThanOrEqual(5);
    expect(px("note")).toBeLessThan(px("body"));
    expect(px("hero") / px("body")).toBeGreaterThanOrEqual(2.5); // 主役の数字:本文 = 2.5倍以上
  });

  it("グラフの中の文字も下限を守る（SVGはクラスが効かないので数値で確認する）", () => {
    const source = readFileSync(join(SRC, "components", "Charts.tsx"), "utf8");
    const sizes = [...source.matchAll(/const CHART_FS_\w+ = (\d+);/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBe(2);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
    // 数値の直書きが復活していないこと
    expect(source.match(/fontSize: \d+/g) ?? []).toEqual([]);
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

  it("カードの中の固定見出しは CardHead の pinned に集約する", () => {
    // カードごとに position: sticky を書き始めると、貼り付く位置（固定ヘッダーの下）と
    // 帯に載せてよい情報の絞り方が、そのカードだけ揃わなくなる。
    const owner = join(SRC, "components", "ui.tsx");
    const offenders = sourceFiles.filter((p) => p !== owner && readFileSync(p, "utf8").includes("card-head-sticky"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
    // 画面側が自前で貼り付けを書いていないこと（固定は共通部品の仕事）。
    // PageTitle / CardHead に sticky・pinned を渡すのは可。
    // 貼り付けてよいのは、見出しの帯とカードの頭（ui.tsx）と、下の操作バーだけ。
    const stickyOwners = new Set([owner, join(SRC, "components", "layout", "StickyActionBar.tsx")]);
    const rogue = sourceFiles.filter((p) => {
      if (stickyOwners.has(p)) return false;
      const s = readFileSync(p, "utf8");
      return /className=\{?["`][^"`]*\bsticky\b/.test(s) || /position:\s*["']?sticky/.test(s);
    });
    expect(rogue.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("固定表示の帯には、一度読めば済む注記を載せられない（型で縛る）", () => {
    // 帯に説明文を足していくと厚くなり、肝心の入力欄が画面から押し出される。
    // pinned のときは detail（注記の段落）を渡せない、を型で禁止する。
    const source = readFileSync(join(SRC, "components", "ui.tsx"), "utf8");
    expect(source).toMatch(/pinned: true;\s*\n\s*detail\?: never;/);
  });

  it("カードの中の固定見出しは、画面上部の固定ヘッダーの下に貼り付く", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".card-head-sticky {"));
    const head = block.slice(0, block.indexOf("}"));
    expect(head).toContain("position: sticky");
    // 位置は表の列見出しと同じ1つの変数から取る（2つの固定物がずれない）
    expect(head).toContain("top: var(--sticky-top)");
    expect(css).toContain("--table-head-top: var(--sticky-top)");
    // 見出し帯（z-index: 15）より下に潜る＝上部の帯を覆い隠さない
    expect(Number(head.match(/z-index: (\d+)/)?.[1])).toBeLessThan(15);
  });

  it("狭い画面・低い画面では、固定をやめて入力欄の高さを優先する", () => {
    // 帯は「参照しながら打つ」ためのもの。打つ場所を奪ったら本末転倒。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 固定をやめている箇所それぞれについて、直前の @media が
    // 「狭い画面」または「低い画面」であること
    const stops = [...css.matchAll(/\.card-head-sticky \{[^}]*position: static/g)];
    const conditions = stops.map((m) => css.slice(0, m.index).match(/@media \([^)]*\)(?![\s\S]*@media)/)?.[0]);
    expect(conditions).toEqual(["@media (max-width: 639px)", "@media (max-height: 560px)"]);
  });

  it("貼り付く位置は決め打ちにせず、見出し帯の高さを測って決める", () => {
    // 見出し帯の高さは画面ごとに違う（パンくずの有無・札の行数・折返し・文字サイズ）。
    // CSSに数値を書き込んだままにすると、帯がその下に潜り込んで読めなくなる。
    const source = readFileSync(join(SRC, "components", "StickyOffset.tsx"), "utf8");
    expect(source).toContain('.page-head[data-sticky="true"]');
    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("--sticky-top");
    // 測り直しの引き金：画面の移動と、帯の高さが変わったとき
    expect(source).toContain("usePathname");
    expect(source).toContain("ResizeObserver");
    // 全画面で効くよう、骨格に1つだけ置く
    expect(readFileSync(join(SRC, "components", "AppShell.tsx"), "utf8")).toContain("<StickyOffset />");
  });

  it("固定見出しを包む箱に overflow: hidden を作らない（無言で固定が効かなくなる）", () => {
    // position: sticky は、祖先に overflow: hidden があると見た目だけ普通の見出しに戻る。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const selector of [".card {", ".card-pad {", ".stack {"]) {
      const block = css.slice(css.indexOf(selector));
      expect(block.slice(0, block.indexOf("}"))).not.toContain("overflow: hidden");
    }
  });

  it("固定した列見出しの位置は、固定ヘッダーの高さと対で保つ", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 列見出しを固定していること
    expect(css).toContain("--table-head-top");
    // 見出しの帯を固定している画面では、その帯のぶんだけ下げていること
    expect(css).toContain('html:has(.page-head[data-sticky="true"])');
    // Tab で送ったフォーカスが固定物の下に潜らないよう、余白も同じ値から取る
    expect(css).toContain("scroll-padding-top: calc(var(--sticky-top)");
  });
});
