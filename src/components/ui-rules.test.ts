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

/** 割り込む窓（<dialog>）を書いてよいファイル。増やすときは作法の検査も一緒に足す。 */
const DIALOG_OWNERS = [
  join(SRC, "components", "ConfirmButton.tsx"),
  join(SRC, "components", "GlobalSearch.tsx"),
  join(SRC, "components", "FeedbackWidget.tsx"),
];

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

  it("計算式・設問IDは Code に集約する（画面に <code> を直接書かない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    const offenders = sourceFiles.filter((p) => p !== owner && readFileSync(p, "utf8").includes("<code"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("計算式を地の文に混ぜない（記号の並びは Code で等幅にする）", () => {
    // 「計算式：q1_1 ÷【…】× 100」のように本文と同じ書体で出すと、記号の並びが
    // 文章の一部に見えて読み違える。式は必ず Code に入れて出す（docs/product/spec.md §5-6）。
    const offenders = sourceFiles.filter((p) => {
      const s = readFileSync(p, "utf8");
      return s.includes("計算式：") || s.includes("計算式 ${");
    });
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("順番のある説明は StepBlock に集約する（番号付きの疑似見出しを画面で書き起こさない）", () => {
    const owner = join(SRC, "components", "ui.tsx");
    // 段落タグに「小さい・太字・muted」を貼って見出しの代わりにすると、見出しの階層が
    // 読み上げに伝わらず、段の境界も余白だけになる（docs/product/spec.md §5-6）。
    const offenders = sourceFiles.filter(
      (p) => p !== owner && /[⓪①②③④⑤][^<]{0,20}<\/p>/.test(readFileSync(p, "utf8")),
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
    //
    // ヘッダーの検索だけは別の器（探して移るための窓）なので例外にしている。
    // 窓が満たすべき作法は下の2件で同じように縛る。
    expect(DIALOG_OWNERS.map((p) => p.replace(`${SRC}/`, ""))).toEqual([
      "components/ConfirmButton.tsx",
      "components/GlobalSearch.tsx",
      "components/FeedbackWidget.tsx",
    ]);
    const offenders = sourceFiles.filter(
      (p) => !DIALOG_OWNERS.includes(p) && /<dialog[\s>]/.test(readFileSync(p, "utf8")),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("検索の窓も、中央に出して押す場所を窓の中に残す", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".search-dialog {"));
    const body = block.slice(0, block.indexOf("}"));
    // Tailwind の初期化が dialog の margin を 0 にするため、指定しないと左上に出る
    expect(body).toContain("margin: auto");
    expect(body).toContain("max-height:");
    expect(body).toContain("overflow: hidden");
    // 打ち込む欄は常に見える位置に残し、あふれるのは候補の一覧だけ
    const list = css.slice(css.indexOf(".search-dialog-list {"));
    expect(list.slice(0, list.indexOf("}"))).toContain("overflow-y: auto");
    const grid = css.slice(css.indexOf(".search-dialog-body {"));
    expect(grid.slice(0, grid.indexOf("}"))).toContain("grid-template-rows:");
  });

  it("改善要望の窓も、中央に出して押す場所を窓の中に残す", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".feedback-dialog {"));
    const body = block.slice(0, block.indexOf("}"));
    // Tailwind の初期化が dialog の margin を 0 にするため、指定しないと左上に出る
    expect(body).toContain("margin: auto");
    expect(body).toContain("max-height:");
    expect(body).toContain("overflow: hidden");
    // 「閉じる」「送る」は常に見える位置に残し、あふれるのは本文だけ
    const grid = css.slice(css.indexOf(".feedback-dialog-body {"));
    expect(grid.slice(0, grid.indexOf("}"))).toContain("grid-template-rows:");
    const main = css.slice(css.indexOf(".feedback-dialog-main {"));
    expect(main.slice(0, main.indexOf("}"))).toContain("overflow-y: auto");
  });

  it("改善要望の窓は Esc で閉じ、開いた先で打ち始められる", () => {
    const source = readFileSync(join(SRC, "components", "FeedbackWidget.tsx"), "utf8");
    // Esc・背景クリックのどちらで閉じても、開いているかの控えを合わせる
    expect(source).toContain("onClose={close}");
    // 開いた瞬間に打ち始められる（送るまでの手を1つ増やさない）
    expect(source).toContain("autoFocus");
    // 開いたら出られない窓を作らない
    expect(source).toMatch(/onClick=\{close\}>\s*\n?\s*閉じる/);
  });

  it("画面を撮るとき、改善要望の仕組み自体は写らない", () => {
    /* 撮った画像に「改善要望」のボタンや窓が写ると、本題の場所が隠れる。
       撮る対象から `.feedback-root` を外していることを固定する。 */
    const source = readFileSync(join(SRC, "components", "FeedbackWidget.tsx"), "utf8");
    expect(source).toMatch(/filter:[^\n]*\n?[^\n]*classList\?\.contains\("feedback-root"\)/);
  });

  it("画面を撮るのに、共有の許可を聞くやり方を使わない", () => {
    /* 押した次の瞬間に書き込める体験にするため、表示中の DOM を描き直して撮る。
       getDisplayMedia は毎回 OS・ブラウザの許可を挟むので使わない。
       貼り付け・ファイル添付は、撮れなかったときの逃げ道として残す。 */
    const source = readFileSync(join(SRC, "components", "FeedbackWidget.tsx"), "utf8");
    expect(source).not.toMatch(/navigator\.mediaDevices|getDisplayMedia\(/);
    expect(source).toContain('import("modern-screenshot")');
    expect(source).toContain("onPaste");
    expect(source).toContain('type="file"');
  });

  it("貼り付いて見えている帯とメニューは、撮った絵でも同じ位置に出す", () => {
    /* 描き直しにはスクロール量が無いため、何もしないと上の帯と左のメニューが
       絵から消える（利用者には「壊れた画像」に見える）。 */
    const source = readFileSync(join(SRC, "components", "FeedbackWidget.tsx"), "utf8");
    expect(source).toContain('querySelectorAll<HTMLElement>(".app-header, .app-sidebar")');
    expect(source).toContain("translateY(${scrollY}px)");
  });

  it("撮った絵が実画面とずれないための補正が入っている", () => {
    /* 実画面と撮影画像を画素で比べて必要と分かった補正。外すと次の崩れが戻る。
       ・body の既定余白 → 絵が斜めにずれる
       ・描き直し側のスクロールバー → 中でスクロールする箱の下端・右端が数 px 欠ける
       ・実寸のまるめ（子は切り上げ・親は切り捨て）→ 折り返す並びで札が1つだけ次の行へ落ちる */
    const source = readFileSync(join(SRC, "components", "FeedbackWidget.tsx"), "utf8");
    expect(source).toContain('margin: "0"');
    expect(source).toContain("copyScrollbar: false");
    expect(source).toContain('el.style[axis] = "hidden"');
    expect(source).toMatch(/flexWrap[\s\S]{0,400}columnGap/);
  });

  it("パンくずの下の余白は外側ではなく内側で取る", () => {
    /* 外側の余白は親へすり抜けて相殺されるため、画面を絵として写し取ると
       4px ぶん詰まって見える（見出しの位置がずれる）。 */
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".breadcrumb {"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toContain("margin: 0;");
    expect(rule).toContain("padding: 0 0 4px;");
  });

  it("検索の窓は Esc で閉じ、開いた先にフォーカスが移る", () => {
    const source = readFileSync(join(SRC, "components", "GlobalSearch.tsx"), "utf8");
    // Esc・背景クリックのどちらで閉じても、開いているかの控えを合わせる
    expect(source).toContain("onClose={close}");
    // 開いた瞬間に打ち始められる（探すのに手を1つ増やさない）
    expect(source).toContain("autoFocus");
    // 上下キーで候補を選び、Enter で開ける
    expect(source).toContain('e.key === "ArrowDown"');
    expect(source).toContain('e.key === "Enter"');
  });

  it("階層表示を畳む印は、畳む幅の中だけで出す", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const narrow = css.slice(css.indexOf("@media (max-width: 1023px)"));
    const inside = narrow.slice(0, narrow.indexOf("\n}\n"));
    // 段を隠すのと、隠したと分かる「…」は同じ幅の中で行う
    expect(inside).toContain(".trail li { display: none; }");
    expect(inside).toContain('.trail li + li:nth-last-child(2)::before { content: "…"');
    // 広い画面では段の区切りは「›」のまま（外に置くと全幅で「…」になる）
    expect(css.replace(inside, "")).not.toContain('content: "…"');
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

  it("割合で小さくする文字（単位・桁区切り・通貨記号）にも下限を付ける", () => {
    // 単位は「大きな数字の脇では小さく」が正しいが、割合だけで指定すると
    // 15px の見出しに混ざったときに 9px 前後まで落ちて読めなくなる（実測で確認）。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const selector of [".unit {", ".num-sep {", ".currency {"]) {
      const block = css.slice(css.indexOf(selector));
      const body = block.slice(0, block.indexOf("}"));
      expect(body).toMatch(/font-size: max\([^)]*var\(--text-note\)\)/);
    }
  });

  it("行の右端の操作は、縮んで折り返す（ページを横に広げない）", () => {
    // まとまりを縮まないようにすると、中に長い一文（止められない理由など）が入ったとき
    // まとまりの幅がそのまま画面をはみ出し、ページ全体が横スクロールする（実測で確認）。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".row-actions {"));
    const body = block.slice(0, block.indexOf("}"));
    expect(body).toContain("flex-wrap: wrap");
    expect(body).toContain("min-width: 0");
    expect(body).not.toContain("flex-shrink: 0");
    // 中のボタン・札だけは潰さない
    expect(css).toContain(".row-actions > .btn");
    // 画面側で「縮まない操作のまとまり」を書き起こしていないこと
    const offenders = sourceFiles.filter((p) => /shrink-0[^"]*flex-wrap|flex-wrap[^"]*shrink-0/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("グラフの中の文字も下限を守る（SVGはクラスが効かないので数値で確認する）", () => {
    const source = readFileSync(join(SRC, "components", "Charts.tsx"), "utf8");
    const sizes = [...source.matchAll(/const CHART_FS_\w+ = (\d+);/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBe(2);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
    // 数値の直書きが復活していないこと
    expect(source.match(/fontSize: \d+/g) ?? []).toEqual([]);
  });

  it("主要ボタンは、テーマ共通のCTA意味トークンを使う", () => {
    // 結果の数字（--accent）と、押す面（--cta-*）は用途を混ぜない。
    // 各テーマでの4.5:1以上は theme-contract.test.ts が実際の値から計算する。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const primary = css.slice(css.indexOf(".btn-primary {"));
    const block = primary.slice(0, primary.indexOf("}"));
    expect(block).toContain("var(--cta-bg)");
    expect(block).toContain("var(--cta-fg)");
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
    // pinned: true の枝（＝固定する側）に detail?: never があること。
    // 枝の中に narrow などが増えても効き続けるよう、枝の終わり（}）までの間で見る。
    const pinnedBranch = source.slice(source.indexOf("pinned: true;"));
    expect(pinnedBranch.slice(0, pinnedBranch.indexOf("\n      }"))).toContain("detail?: never;");
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

  it("回答画面は、まとまりごとに頭を固定し、そこへ答え方の決まりを残す", () => {
    // 「行ったものだけ はい」「受講しただけは いいえ」は、1問ごとに当てはめる物差し。
    // これが画面の外へ出ると、下のほうの設問だけ違う基準で答えてしまう。
    const source = readFileSync(join(SRC, "components", "FormAnswer.tsx"), "utf8");
    expect(source).toMatch(/<CardHead\s+pinned\s+narrow\s+heading\s+title=\{SECTION_LABEL/);
    expect(source).toMatch(/sub=\{SECTION_HELP\[g\.section\]\}/);
    // 同じ説明を帯と本文の2箇所に出さない（帯へ移したぶんは節見出しから外す）
    expect(source).not.toContain("<SectionHeading help=");
  });

  it("スマートフォンで打つ画面（回答）だけは、帯を1行に縮めて狭い画面でも固定する", () => {
    // 狭い画面の既定は「固定しない」。回答者にスマートフォンの人がいるため、
    // 回答画面だけ例外にする。ただし帯は名前だけの1行に縮め、
    // 答え方の決まりは消さずに本文の先頭へ移す（読める場所を変えるだけ）。
    const ui = readFileSync(join(SRC, "components", "ui.tsx"), "utf8");
    // 例外にできるのは pinned のときだけ（型で縛る）
    expect(ui).toMatch(/pinned: true;[\s\S]{0,400}narrow\?: boolean;/);
    expect(ui).toMatch(/pinned\?: false; narrow\?: never/);
    expect(ui).toContain('data-narrow={pinned && narrow ? "pin" : undefined}');
    // 縮めたときの逃がし先が部品の中にある（画面ごとに書き起こさない）
    expect(ui).toContain("card-head-sub-narrow");

    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const narrow = css.slice(css.indexOf("@media (max-width: 639px) {\n  /* 狭い画面では、既定は固定をやめる"));
    const block = narrow.slice(0, narrow.indexOf("\n}"));
    expect(block).toContain('.card-head-sticky[data-narrow="pin"] { position: sticky;');
    // 帯の中の説明は隠し、本文側を出す（同じ文が2つ見えない）
    expect(block).toContain('.card-head-sticky[data-narrow="pin"] .card-head-sub { display: none; }');
    expect(block).toContain(".card-head-sub-narrow { display: block;");

    // 例外を使ってよいのは、回答画面だけ
    const users = sourceFiles.filter((p) => /<CardHead[\s\S]{0,40}\bnarrow\b/.test(readFileSync(p, "utf8")));
    expect(users.map((p) => p.replace(`${SRC}/`, ""))).toEqual(["components/FormAnswer.tsx"]);
  });

  it("文字盤（スマートフォンのキーボード）が出ている間は、固定を全部やめる", () => {
    // 文字盤は見える範囲を半分近く奪うのに、CSSの高さ（@media height）は変わらない。
    // 実測（375×見える高さ380）で、固定ヘッダー＋見出し帯＋操作バーだけで314pxが埋まり、
    // 打っている欄が下の操作バーに隠れた。打っている間は打つ場所を最優先にする。
    const sticky = readFileSync(join(SRC, "components", "StickyOffset.tsx"), "utf8");
    expect(sticky).toContain("window.visualViewport");
    expect(sticky).toContain('dataset.keyboard = "open"');

    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const selector of [
      '.card-head-sticky[data-narrow="pin"]',
      '.page-head[data-sticky="true"]',
      ".action-bar",
    ]) {
      expect(css).toContain(`html[data-keyboard="open"] ${selector} { position: static; }`);
    }
  });

  it("設問の組み立ては、編集を開いているカードだけ頭を固定する", () => {
    // 閉じているカードは2行しかなく、貼り付く前に流れ去る。
    // 全部に帯を付けると、設問の一覧としての読みやすさだけが落ちる。
    const source = readFileSync(join(SRC, "components", "FormBuilder.tsx"), "utf8");
    expect(source).toMatch(/\{open \? \(\s*<CardHead pinned/);
  });

  it("読むだけの画面（提出済みの回答・一覧）には帯を作らない", () => {
    // 帯は「参照しながら打つ」ためのもの。打つ欄が無い画面では場所を取るだけになる。
    // 一覧の表は DataTable が列見出しを同じ --sticky-top に貼り付けており、そちらが役目を持つ。
    const readOnly = [
      join(SRC, "components", "ResponseSnapshot.tsx"),
      join(SRC, "components", "FormPreview.tsx"),
      join(SRC, "app", "me", "forms", "page.tsx"),
      join(SRC, "app", "admin", "forms", "page.tsx"),
    ];
    const offenders = readOnly.filter((p) => readFileSync(p, "utf8").includes("pinned"));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("確認の窓は画面の中央に出す（左上に貼り付かせない）", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".confirm-dialog {"));
    const body = block.slice(0, block.indexOf("}"));
    // Tailwind の初期化が dialog の margin を 0 にするため、
    // 指定しないと画面の左上に出る（実際にそうなっていた）。
    expect(body).toContain("margin: auto");
    // 窓の高さは画面内に収める
    expect(body).toContain("max-height:");
  });

  it("確認の窓が縦に長くても、ボタンは窓の中に残る（本文だけがスクロールする）", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 窓ごとスクロールさせるとボタンが下に隠れ、「押せない窓」に見える
    const win = css.slice(css.indexOf(".confirm-dialog {"));
    expect(win.slice(0, win.indexOf("}"))).toContain("overflow: hidden");
    // 本文とボタンを縦に積み、あふれるのは本文だけにする
    const box = css.slice(css.indexOf(".confirm-dialog-body {"));
    expect(box.slice(0, box.indexOf("}"))).toContain("grid-template-rows:");
    const text = css.slice(css.indexOf(".confirm-dialog-text {"));
    expect(text.slice(0, text.indexOf("}"))).toContain("overflow-y: auto");
    // 部品側でも本文だけを包んでいること
    expect(readFileSync(join(SRC, "components", "ConfirmButton.tsx"), "utf8")).toContain("confirm-dialog-text");
  });

  it("確認の窓は ConfirmButton に集約する（画面ごとに窓を書き起こさない）", () => {
    const offenders = sourceFiles.filter((p) => {
      if (DIALOG_OWNERS.includes(p)) return false;
      const s = readFileSync(p, "utf8");
      return s.includes("showModal(") || s.includes('role="dialog"');
    });
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("入力項目が少ない画面の幅は .narrow-form 1つで決める", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".narrow-form {"));
    expect(block.slice(0, block.indexOf("}"))).toContain("max-width:");
    // 狭い画面では上限を外す（絞ると窮屈になる）
    expect(css).toMatch(/@media \(max-width: 639px\) \{\s*\.narrow-form \{ max-width: none; \}/);
    // 画面ごとに max-w-* を書かない（幅の正本を1箇所に保つ）
    for (const rel of ["app/login/page.tsx", "app/account/password/page.tsx"]) {
      const s = readFileSync(join(SRC, ...rel.split("/")), "utf8");
      expect(s).toContain("narrow-form");
      expect(s).not.toMatch(/max-w-(xs|sm|md|lg|xl)/);
    }
  });

  it("数値を入れる欄は NumberField に集約する（画面ごとに書き起こさない）", () => {
    /* 数値欄を画面ごとに書くと、全角→半角の変換・貼り付けの正しさ・
       スマートフォンの数字キーボード・空欄と0の区別が、その画面だけ抜け落ちる
       （実際に、アンケートの回答欄と設問の最小値欄でそうなっていた）。 */
    const owner = join(SRC, "components", "NumberField.tsx");
    const offenders = sourceFiles.filter((p) => {
      if (p === owner) return false;
      const src = readFileSync(p, "utf8");
      // 数字専用の見た目（input-num）を <input> に直接当てている画面を検出する
      return /<input[^>]*input-num/s.test(src);
    });
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("数字キーボードの出し分けは NumberField だけが決める", () => {
    const allowed = new Set([join(SRC, "components", "NumberField.tsx"), join(SRC, "app", "login", "LoginForm.tsx")]);
    const offenders = sourceFiles.filter(
      (p) => !allowed.has(p) && /inputMode=["{]/.test(readFileSync(p, "utf8")),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("入力欄・選択欄に固定の高さを付けない（文字を大きくすると下が欠ける）", () => {
    /* 2026-08 に文字の段を一律 +2px 上げたところ、会社を切り替える選択欄だけ
       「さくら福祉会」の下が欠けた。原因は h-8（32px）の決め打ちで、
       上下の余白（8px+8px）と枠（1px+1px）を引いた残りが 14px しかなく、
       14px の和文がそこに収まらなかったこと。英数字だけなら気づかない。
       高さは「文字の大きさ＋余白」から決まるままにして、px で止めない。 */
    const offenders: string[] = [];
    for (const p of sourceFiles) {
      for (const m of readFileSync(p, "utf8").matchAll(/className=\{?["`]([^"`]*)["`]/g)) {
        const classes = m[1].split(/\s+/);
        if (!classes.includes("input")) continue;
        // min-h-* は下限なので伸びる。禁止するのは h-8 / h-[32px] のような決め打ちだけ。
        if (classes.some((c) => /^h-(\d|\[)/.test(c))) offenders.push(p.replace(`${SRC}/`, ""));
      }
    }
    expect(offenders).toEqual([]);
    // 高さの拠り所となる行の高さを、入力の共通指定に明示していること
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".input {"));
    expect(block.slice(0, block.indexOf("}"))).toContain("line-height:");
  });

  it("伸びる棒には既定の色がある（クラスの付け忘れで灰色の帯にならない）", () => {
    // 色を修飾クラス側にだけ持たせると、付け忘れた棒が「読み込み中の灰色」に見える。
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 動きを止める指定（@media prefers-reduced-motion）にも .bar-fill が出るので、
    // 見た目の定義そのもの（.bar-track の直後）を見る。
    const after = css.slice(css.indexOf(".bar-track {"));
    const block = after.slice(after.indexOf(".bar-fill {"));
    expect(block.slice(0, block.indexOf("}"))).toContain("background:");
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

/* ═════════════════════════ 文の長さの作法 ═════════════════════════
 *
 * 判断基準は docs/product/spec.md §22。
 *
 * 2026-08-12、発注者から「説明文や注意事項が多いと読むのが面倒」という指摘。
 * 原因は長さそのものより「1文に複数のことを詰めた」書き方だった。実例:
 *
 *   アンケート「A」・アンケート「B」ほか2件で使っているため、完全には消せません。
 *   「使わない」なら次のアンケートから外せます。
 *
 * 1文の中に ①使われている場所の列挙 ②消せない理由 ③代わりの手段 が入っている。
 * これが等級要件9項目すべてに繰り返し出て、一覧が文字で埋まった。
 *
 * そこで「1文＝1つのこと」を長さで機械的に縛る。40文字を超えたら、
 * ほぼ必ず2つ以上のことが入っている（実測: 直した68文すべてがそうだった）。
 * 折り返しでは解決しない。折り返しは §22-3 の保険で、本筋は文を分けること。
 */

/** 1文の上限。ここを緩めない（緩めると上の指摘がそのまま戻る）。 */
const MAX_SENTENCE = 40;

const JP_CHAR = /[ぁ-ゟ゠-ヿ一-鿿]/;

/**
 * コード・注釈・文字列を1文字ずつ見分ける。
 *
 * 注釈（このコメントのような開発者向けの文）は利用者に見えないので数えない。
 * 正規表現で雑に消すと "https://" の // を注釈と誤認する・
 * 注釈の中の「」がカッコの対応を壊す、といった取りこぼしが出るため、
 * 状態を持って端から読む。
 */
function splitSource(src: string): { literals: string[]; code: string } {
  const literals: string[] = [];
  let code = "";
  let i = 0;
  const n = src.length;
  const blank = (s: string) => { code += s.replace(/[^\n]/g, " "); };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const e = j < 0 ? n : j; blank(src.slice(i, e)); i = e; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const e = j < 0 ? n : j + 2; blank(src.slice(i, e)); i = e; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      let j = i + 1;
      let buf = "";
      while (j < n) {
        if (src[j] === "\\") { buf += src[j] + src[j + 1]; j += 2; continue; }
        if (src[j] === q) break;
        if (q !== "`" && src[j] === "\n") break;
        buf += src[j];
        j++;
      }
      literals.push(buf);
      blank(src.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    code += c;
    i++;
  }
  return { literals, code };
}

/**
 * 差し込まれる値（`${…}` と JSX の `{…}`）を入れ子ごと落とす。
 *
 * ＝ 例外の線引き。アンケート名・会社名・等級名・設問名・件数は
 * 実行時に決まるので、書き手には長さを制御できない。
 * 数えるのは「文の骨格（書き手が決められる部分）」だけにする。
 * 差し込みが長くて行が伸びる問題は、文を分けることでは直せないため
 * §22-3（折り返しの保証）で受ける。
 */
function dropPlaceholders(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const isTpl = s[i] === "$" && s[i + 1] === "{";
    if (isTpl || s[i] === "{") {
      let depth = 0;
      let j = isTpl ? i + 1 : i;
      for (; j < s.length; j++) {
        if (s[j] === "{") depth++;
        else if (s[j] === "}") { depth--; if (depth === 0) break; }
      }
      i = j + 1;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

const tidy = (s: string) => s.replace(/[ \t]+/g, " ").trim();

/** 文字列リテラルの中の「文」。句点と改行が文の切れ目。 */
function sentencesOfLiteral(raw: string): string[] {
  const text = dropPlaceholders(raw).replace(/\\n/g, "\n").replace(/\\(["'`])/g, "$1");
  return text.split(/[\n。]/).map(tidy).filter((s) => JP_CHAR.test(s));
}

/**
 * JSX の地の文（タグとタグの間に直接書いた文）の中の「文」。
 * 画面のコードでは文字列にせず地の文で書くほうが多いので、ここを外すと
 * 検査が半分しか見ていないことになる（実測: 68文のうち21文が地の文だった）。
 *
 * 開きの `>` から次の `<` までが地の文1つ。`=>` と `>=` は演算子なので外す。
 * 原文の改行はブラウザ上では空白に潰れるだけなので、文の切れ目にしない。
 */
function sentencesOfJsx(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?<![=!])>(?!=)([^<>]*)</g)) {
    const text = dropPlaceholders(m[1]).replace(/\s+/g, "");
    if (!JP_CHAR.test(text)) continue;
    for (const s of text.split("。")) if (JP_CHAR.test(s)) out.push(s);
  }
  return out;
}

function longSentencesOf(src: string, isJsx: boolean): string[] {
  const { literals, code } = splitSource(src);
  const all = [...literals.flatMap(sentencesOfLiteral), ...(isJsx ? sentencesOfJsx(code) : [])];
  return all.filter((s) => s.length > MAX_SENTENCE);
}

describe("文の長さの作法", () => {
  it("利用者の目に触れる日本語の1文は40文字以内（画面・API の返事・計算の説明文すべて）", () => {
    /* 除外している画面・ファイルは1つも無い。
       「この画面だけ長くてよい」を1つ認めると、次からそこに長い文が溜まる。
       どうしても要る場合は、ここに「ファイル名 + 理由」を1件ずつ書き足すこと
       （閾値を上げる・対象を狭めるのは不可）。 */
    const offenders = sourceFiles.flatMap((p) =>
      longSentencesOf(readFileSync(p, "utf8"), p.endsWith(".tsx")).map(
        (s) => `${p.replace(`${SRC}/`, "")}（${s.length}文字）: ${s}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("検査の網が src 全体に掛かっている（対象を狭めて逃げていない）", () => {
    /* 「一部しか見ていない検査」を防ぐ。画面・部品・計算のどれかを
       こっそり対象から外したら、この件数と内訳で気づける。 */
    expect(sourceFiles.length).toBeGreaterThanOrEqual(180);
    for (const dir of ["app/", "components/", "lib/domain/"]) {
      const rel = sourceFiles.map((p) => p.replace(`${SRC}/`, ""));
      expect(rel.filter((p) => p.startsWith(dir)).length).toBeGreaterThan(10);
    }
    // 画面（page.tsx）が1枚残らず入っていること
    expect(sourceFiles.filter((p) => p.endsWith(`${"page"}.tsx`)).length).toBeGreaterThanOrEqual(41);
  });

  it("数えるのは文の骨格だけ（差し込まれる名前・件数は長さに数えない）", () => {
    // 骨格が短ければ、差し込みがどれだけ長くても検査は通る
    expect(longSentencesOf('const a = `「${veryLongSurveyName}」は使えません。`;', false)).toEqual([]);
    // 入れ子の差し込みも落とせる
    expect(dropPlaceholders("保存済み ${d.toLocaleTimeString('ja-JP', { hour: '2-digit' })}")).toBe("保存済み ");
    // 骨格そのものが長ければ落ちる（差し込みがあっても見逃さない）
    const skeleton = `const a = \`\${name}は${"あ".repeat(41)}。\`;`;
    expect(longSentencesOf(skeleton, false)).toHaveLength(1);
  });

  it("40文字はよくて41文字で落ちる（境目を動かしていない）", () => {
    expect(longSentencesOf(`const a = "${"あ".repeat(40)}。";`, false)).toEqual([]);
    expect(longSentencesOf(`const a = "${"あ".repeat(41)}。";`, false)).toHaveLength(1);
    // 句点で切った1文ずつで見る（合計が長いだけでは落ちない）
    expect(longSentencesOf(`const a = "${"あ".repeat(30)}。${"い".repeat(30)}。";`, false)).toEqual([]);
  });

  it("開発者向けの注釈は数えない（利用者に見えないため）", () => {
    expect(longSentencesOf(`// ${"あ".repeat(60)}\nconst a = 1;`, false)).toEqual([]);
    expect(longSentencesOf(`/* ${"あ".repeat(60)} */\nconst a = 1;`, false)).toEqual([]);
    // 注釈の中の // や引用符に釣られて、後ろの本物を見落とさないこと
    expect(longSentencesOf(`// https://example.com の「注意」\nconst a = "${"あ".repeat(41)}。";`, false)).toHaveLength(1);
  });

  it("画面に地の文で書いた説明も数える（文字列にしなければ逃げられる、を塞ぐ）", () => {
    expect(longSentencesOf(`<p>${"あ".repeat(41)}。</p>`, true)).toHaveLength(1);
    // 原文の改行は表示上ただの空白なので、文の切れ目にしない
    const wrapped = `<p>\n  ${"あ".repeat(20)}\n  ${"あ".repeat(21)}。\n</p>`;
    expect(longSentencesOf(wrapped, true)).toHaveLength(1);
    // 演算子の > を地の文の始まりと読み違えない
    expect(longSentencesOf(`{list.map((i) => i.name).join("・")}が対象です。`, true)).toEqual([]);
  });
});

/* ═════════════════════════ 畳んだものへ必ず手が届く ═════════════════════════
 *
 * 判断基準は docs/product/spec.md §22-4。
 *
 * 「注意事項はボタンを押したら出す」に応えるにあたり、いちばん危ないのは
 * **畳んだつもりが消えている**こと。開く手がかりが無い・押せると分からない、は
 * 利用者から見れば非表示と同じで、発注者が禁じた「削除」に当たる。
 * そこで畳む仕組みを3つに限定し、そのどれもが押す場所を必ず持つことを固定する。
 */
describe("畳んだものへ必ず手が届く", () => {
  const UI = join(SRC, "components", "ui.tsx");
  const DIALOG_OWNER = join(SRC, "components", "ConfirmButton.tsx");

  it("畳む仕組みは3つだけ（画面ごとに <details> を書き起こさない）", () => {
    /* 画面ごとに書くと、開く印（＋）・押せる見た目・狭い画面での余白が
       そこだけ揃わなくなる。実際、移行前は14箇所が素の <details> で、
       押せると分かる見た目が付いていないものが混ざっていた。 */
    const offenders = sourceFiles.filter((p) => p !== UI && /<details[\s>]/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("畳んだものには必ず押す場所がある（summary / label を省略できない）", () => {
    const ui = readFileSync(UI, "utf8");
    // Disclosure・InlineDetail は summary が必須（? を付けない）
    expect(ui).toMatch(/summary: ReactNode;/);
    expect(ui).toMatch(/export function InlineDetail[\s\S]{0,220}summary: string;/);
    expect(ui).not.toMatch(/export function InlineDetail[\s\S]{0,220}summary\?: string;/);
    // どちらも <summary> を必ず描く
    expect(ui.match(/<summary/g) ?? []).toHaveLength(2);
    // 窓は押すボタンと対で作る（label が必須）
    const dlg = readFileSync(DIALOG_OWNER, "utf8");
    const detail = dlg.slice(dlg.indexOf("export function DetailDialogButton"));
    expect(detail).toContain("label: string;");
    expect(detail).toContain("title: string;");
  });

  it("押す場所を見えなくしない（summary を display:none にしない）", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const m of css.matchAll(/([^\n{}]*summary[^\n{}]*)\{([^}]*)\}/g)) {
      // list-style / ::-webkit-details-marker は既定の三角を消すだけで、押す場所は残る
      if (m[1].includes("::-webkit-details-marker")) continue;
      expect(m[2]).not.toMatch(/display: none|visibility: hidden/);
    }
    // 押せると分かる見た目（指の形）が両方に付いていること
    expect(css).toMatch(/details\.disclosure summary \{[^}]*cursor: pointer/);
    expect(css).toMatch(/details\.inline-detail > summary \{[^}]*cursor: pointer/);
    // 開いているかの印（＋／－）があること
    expect(css).toContain('details.inline-detail > summary::after { content: "＋"');
    expect(css).toContain('details.inline-detail[open] > summary::after { content: "－"');
  });

  it("読むだけの窓も ConfirmButton.tsx の中だけで作る", () => {
    const dlg = readFileSync(DIALOG_OWNER, "utf8");
    expect(dlg).toContain("export function DetailDialogButton");
    // 閉じる手段が窓の中にあること（開いたら出られない窓を作らない）
    expect(dlg).toMatch(/<Button type="button" autoFocus onClick=\{\(\) => setOpen\(false\)\}>\s*閉じる/);
  });
});

describe("長い文が来ても読める形で折り返る", () => {
  /* 文を分けても、差し込まれる名前（アンケート名・会社名）は長いままになる。
     そこだけは表示側で受け止める。ただし折り返しは保険であって、
     これがあるから長い文を書いてよい、ではない（上の検査が本筋）。 */
  it("日本語の禁則を効かせ、語の途中では折らない", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const body = css.slice(css.indexOf("body {"));
    const block = body.slice(0, body.indexOf("}"));
    // 行頭の 、。」 行末の 「 を防ぐ
    expect(block).toContain("line-break: strict");
    // 入りきらないときだけ折る（既定は語の途中で折らない）
    expect(block).toContain("overflow-wrap: break-word");
    expect(block).toContain("word-break: normal");
  });

  it("word-break: break-all を画面全体に当てない（和文も英単語も真ん中で割れる）", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 使ってよいのは、連続した英数字だけを出す専用の箱に限る
    const uses = [...css.matchAll(/([^\n{]*)\{[^}]*word-break: break-all/g)].map((m) => m[1].trim());
    expect(uses).toEqual([]);
  });
});

describe("色と選択肢の見た目は1箇所で決める（画面に直書きしない）", () => {
  /* 依頼の発端は「場所によってボタンの色が違う」「背景の色が規約から外れている」。
     原因は、同じ色を書く道が2つあったこと（意味の名前と、任意値 text-[var(--…)]）と、
     同じ役目の部品が画面ごとに手書きされていたこと。
     この節は「2つ目の道を作らない」ことだけを縛る。 */

  const UI = join(SRC, "components", "ui.tsx");
  const screens = sourceFiles.filter((p) => p !== UI);

  it("色は意味の名前で書く（任意値 text-[var(--…)] を残さない）", () => {
    /* 任意値で書くと、同じ色に2つの書き方が並び立つ。
       どちらが正しいか読む側に判断させないため、意味の名前（text-ink-muted 等）へ寄せる。
       名前は globals.css の @theme inline が作る。 */
    const offenders = sourceFiles.filter((p) => /-\[var\(--/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("色そのもの（#rrggbb・rgb()・hsl()）を画面に書かない", () => {
    const offenders = sourceFiles.filter((p) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("Tailwind の色見本（bg-white・text-gray-500 など）を使わない", () => {
    const palette =
      /\b(bg|text|border|ring|fill|stroke)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;
    const offenders = sourceFiles.filter((p) => palette.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("並べて1つ選ぶスイッチ（.segmented）は Segmented だけが書く", () => {
    /* 以前は2択用と明るさ切替用の2つのCSSがあり、角丸と hover が食い違っていた。
       CSSを1つに統合したので、書く場所も1つに固定する。 */
    const offenders = screens.filter((p) => /"[^"]*\bsegmented\b/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
    const ui = readFileSync(UI, "utf8");
    expect(ui).toContain("export function Segmented");
    // 選択中がどれかを、見た目だけでなく読み上げにも伝える
    expect(ui).toMatch(/className="segmented-btn"[\s\S]{0,200}aria-pressed=/);
  });

  it("押して選ぶ小さな札（.chip）は ChoiceChip / ChipLink / ChipTag だけが書く", () => {
    /* 同じ chip が「押して絞り込む」「別の画面へ行く」「ただ表示する」の3役に使われ、
       画面ごとに aria-pressed や aria-current が付いたり付かなかったりしていた。 */
    const offenders = screens.filter((p) => /className="chip"|className=\{`chip/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
    const ui = readFileSync(UI, "utf8");
    for (const name of ["ChoiceChip", "ChipLink", "ChipTag"]) {
      expect(ui).toContain(`export function ${name}`);
    }
  });

  it("選んで積み上げる大きめの選択肢（.option-card）は OptionCard / OptionCheck だけが書く", () => {
    /* 選択肢のカードは2つの画面で5回書き起こされ、hover の有無が食い違っていた。
       SchemeGroupPicker の「選んだ結果を並べる箱」だけは押せない表示用のため、
       同じ面を使いつつ押せる見た目（cursor・hover）はCSS側で除いている。 */
    const allowed = new Set(["SchemeGroupPicker.tsx"]);
    const offenders = screens.filter(
      (p) => !allowed.has(p.split("/").pop() ?? "") && /"[^"]*\boption-card\b/.test(readFileSync(p, "utf8")),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
    const ui = readFileSync(UI, "utf8");
    expect(ui).toContain("export function OptionCard");
    expect(ui).toContain("export function OptionCheck");
  });

  it("押せる見た目は、実際に押せるものだけに付く", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // .option-card は表示だけの箱にも使うため、指の形と hover は button / label に限定する
    expect(css).toContain(":where(button, label).option-card { cursor: pointer; }");
    expect(css).toMatch(/:where\(button, label\)\.option-card:hover:not\(:disabled\)/);
  });

  it("消えた古い書き方（.switch-2 / .theme-switch）が残っていない", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    // 経緯を書いたコメントには名前が残ってよい。縛るのは「セレクタとして生きていないこと」。
    expect(css).not.toMatch(/^\s*\.(switch-2|theme-switch)[\s{,]/m);
    const offenders = sourceFiles.filter((p) => /switch-2|theme-switch/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });

  it("意味の名前は @theme inline で作られている（クラス名だけあって色が出ない、を防ぐ）", () => {
    /* Tailwind v4 では、CSS変数を宣言しただけでは text-ink-muted は生まれない。
       @theme inline に橋渡しを書き忘れると、クラスは付いているのに色が付かない
       （＝「この画面だけ見た目が反映されていない」に見える）。 */
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const bridge = css.slice(css.indexOf("@theme inline {"));
    const block = bridge.slice(0, bridge.indexOf("}"));
    for (const name of [
      "brand", "brand-deep", "brand-soft", "accent", "ink", "ink-muted", "line", "subtle",
      "danger", "danger-soft", "danger-fg", "caution-soft", "caution-border",
      "page-bg", "surface", "off-surface", "off-surface-soft", "off-line",
      "cta-bg", "cta-fg", "status-progress",
    ]) {
      expect(block).toContain(`--color-${name}: var(--${name});`);
    }
  });

  it("行の中の小さな操作（項目名・行の操作・見せ隠し）は ui.tsx だけが書く", () => {
    /* btn を当てると行の高さが押し広がるため、この3つだけは専用の見た目を持つ。
       専用であるぶん、画面ごとに書き起こすと押せる状態の伝え方（aria-*）が
       そこだけ抜ける。実際、同じ項目名の組み方が2画面で書かれており、
       開いているときに矢印を反転させる指定が片方だけ抜けかけていた。 */
    const offenders = screens.filter((p) =>
      /className="(profile-row-label|profile-row-action|field-toggle)"/.test(readFileSync(p, "utf8")),
    );
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
    const ui = readFileSync(UI, "utf8");
    for (const name of ["HintToggle", "RowAction", "RevealToggle"]) {
      expect(ui).toContain(`export function ${name}`);
    }
  });

  it("開くもの・押すもの・見せ隠しで、状態の伝え方を取り違えない", () => {
    /* 見た目が似ていても意味は別物。1つの部品にまとめると混ざるので、
       それぞれが正しい属性を持っていることを固定する。 */
    const ui = readFileSync(UI, "utf8");
    /* 1つの部品の範囲は「宣言から、次の宣言の手前まで」で切り出す。
       関数の閉じ括弧で切ると、引数の型定義の } に先に当たって範囲が空になる。 */
    const bodyOf = (name: string) => {
      const from = ui.indexOf(`export function ${name}`);
      const rest = ui.slice(from + 1);
      const next = rest.indexOf("\nexport ");
      return next < 0 ? rest : rest.slice(0, next);
    };
    // 補足を開く＝開閉。押した状態（aria-pressed）ではない
    expect(bodyOf("HintToggle")).toContain("aria-expanded={open}");
    // 見せ隠し＝押した状態。かつ、どの欄かを読み上げへ伝える
    const reveal = bodyOf("RevealToggle");
    expect(reveal).toContain("aria-pressed={visible}");
    expect(reveal).toMatch(/aria-label=\{`\$\{label\}を/);
    // 欄の名前は省略できない（「表示する」だけでは、どの欄か分からない）
    expect(reveal).not.toContain("label?:");
  });

  it("本文の幅と余白は globals.css だけが決める（画面ごとに max-w-* を書かない）", () => {
    /* main の幅は 1箇所（.app-main / main）に置いてある。
       画面側で max-w-md などを足すと、その画面だけ余白の作法が変わる。 */
    const pages = sourceFiles.filter((p) => p.endsWith("page.tsx"));
    const offenders = pages.filter((p) => /<main[^>]*max-w-/s.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(`${SRC}/`, ""))).toEqual([]);
  });
});
