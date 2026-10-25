import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { splitSource } from "@/test-support/source-code";

/*
 * 比べる警告は ComparisonGap からしか作られていない（DD-012 の6・受入 AC3）。
 *
 * 字面ではなく作りで閉じる。項目の差を使ってよいのは comparison-gap.ts だけで、
 * 3画面は ComparisonGapNotice を使い、差を自分で作らない。
 * そのうえで字面の検査も残し、今後『食い違』『ズレ』の警告を別の場所で書き起こしたら落ちるようにする。
 * 数え方は ui-rules.test.ts と同じ（文字列リテラルと JSX の地の文。注釈は数えない）。
 */

const ROOT = process.cwd();
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "test-support") continue;
      sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (file: string) => splitSource(read(file)).code;

/** 比べる警告の型と部品。字面を置いてよいのはこの2つだけ */
const DOMAIN = "src/lib/domain/comparison-gap.ts";
const NOTICE = "src/components/ComparisonGapNotice.tsx";
/** 項目の差の計算そのもの */
const FORM_SYNC = "src/lib/domain/form-sync.ts";

/** 比べる警告を出す3画面 */
const SCREENS = ["src/app/admin/forms/page.tsx", "src/app/admin/forms/[id]/page.tsx", "src/app/admin/scheme/[group]/page.tsx"];

describe("比べる警告の作り（AC3）", () => {
  it("項目の差（diffFormKpiItems・FormKpiDiff）を使うのは comparison-gap.ts だけ", () => {
    const DIFF = /\b(diffFormKpiItems|FormKpiDiff|describeFormKpiDiff)\b/;
    const hits = sourceFiles(path.join(ROOT, "src"))
      .map(rel)
      .filter((file) => file !== DOMAIN && file !== FORM_SYNC)
      .filter((file) => DIFF.test(codeOf(file)));
    expect(hits).toEqual([]);
    // 空の検査になっていない（差を使う場所が本当にある）
    expect(codeOf(DOMAIN)).toMatch(/\bdiffFormKpiItems\(/);
    // 差から文を作る古い関数は消した（DD-012 の6）。form-sync.ts は差の計算だけを持つ
    expect(codeOf(FORM_SYNC)).not.toMatch(/\bdescribeFormKpiDiff\b/);
  });

  it("比べる警告を組む入口は formSyncGaps の1つで、読み出しはそれを通す（DD-012 の6）", () => {
    const callers = sourceFiles(path.join(ROOT, "src"))
      .map(rel)
      .filter((file) => file !== DOMAIN && /\bcomparisonGapOf\(/.test(codeOf(file)));
    expect(callers).toEqual(["src/lib/domain/setup-gaps.ts"]);
    expect(codeOf("src/lib/comparison-gap-loader.ts")).toMatch(/\bformSyncGaps\(/);
  });

  it.each(SCREENS)("%s は ComparisonGapNotice を描き、差も読み出しも自分で作らない", (screen) => {
    expect(read(screen)).toMatch(/import \{ ComparisonGapNotice \} from "@\/components\/ComparisonGapNotice";/);
    const code = codeOf(screen);
    expect(code).toMatch(/<ComparisonGapNotice\b/);
    // 読み出しは comparison-gap-loader.ts を通す（画面ごとに組み立てない）
    expect(code).toMatch(/\bload(Cycle|Form|Group)ComparisonGaps?\(/);
    for (const forbidden of ["formSyncGaps", "effectiveAskedItems", "listFormKpiCoverage", "comparisonGapOf"]) {
      expect(code, `${screen} が ${forbidden} を直接使っている`).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  // いま開いているページ（aria-current と「（このページ）」の付く先）を画面ごとに固定する。
  // 文字列の値を見るので、codeOf ではなく元の字面で照らす
  it.each([
    ["src/app/admin/forms/page.tsx", "null"],
    ["src/app/admin/forms/[id]/page.tsx", '"form"'],
    ["src/app/admin/scheme/[group]/page.tsx", '"selection"'],
  ])("%s は current: %s を渡す", (screen, current) => {
    expect(read(screen).match(/\bcurrent: (?:null|"\w+")/g)).toEqual([`current: ${current}`]);
  });

  it("部品は InlineDetail・DataTable・ActionButton を使い、<details> と <table> を書き起こさない", () => {
    const code = codeOf(NOTICE);
    expect(code).toMatch(/<InlineDetail\b/);
    // 型引数（<DataTable<ComparisonRow>）の「>」で途切れないよう、型引数を読み飛ばす
    expect(code).toMatch(/<DataTable\b(?:<\w+>)?[^>]*\bscroll\b/);
    expect(code).toMatch(/<ActionButton\b/);
    expect(code).not.toMatch(/<details\b|<table\b|<button\b/);
  });
});

describe("比べる警告の字面の閉じ込め（AC3）", () => {
  /** 『食い違』『ズレ』『ずれ』。「いずれか」「いずれにせよ」は比べの語ではないので外す */
  const WORDS = /食い違|ズレ|(?<!い)ずれ/;
  const OWNERS = new Set([DOMAIN, NOTICE]);
  /** 2つのページの比べではない文。1件ずつ理由を書いて許す（増やすときも同じ） */
  const REASONED: { file: string; phrase: string; reason: string }[] = [
    {
      file: "src/app/admin/scheme/page.tsx",
      phrase: "配点の決まりに食い違いがあります",
      reason: "1つのページの中の配点の合計の検査で、2つのページの比べではない",
    },
    {
      file: "src/lib/domain/improvement-instruction.ts",
      phrase: "書いてある事実と現物が食い違うときは現物を優先する。",
      reason: "作業指示文に載せる作業の規約で、画面の警告ではない",
    },
    {
      file: "src/components/FormAlignNotice.tsx",
      phrase: "設定とずれた下書き",
      reason: "ずれた下書きをそろえる操作（DD-028 の6・I30）の知らせで、項目の差を示す比べる警告ではない",
    },
    {
      file: "src/lib/domain/form-align.ts",
      phrase: "設定とずれた下書き",
      reason: "そろえる操作（DD-028 の6・I30）の件数と結果の文で、項目の差を示す比べる警告ではない",
    },
  ];
  const SCOPES = ["src/app", "src/components", "src/lib", "src/actions"];

  /** ファイルの中の、利用者に見える文（文字列リテラルと JSX の地の文）のうち、字面に当たるもの */
  function hitsOf(file: string): string[] {
    const { literals, code } = splitSource(read(file));
    const texts = [...literals];
    if (file.endsWith(".tsx")) for (const m of code.matchAll(/(?<![=!])>(?!=)([^<>]*)</g)) texts.push(m[1]);
    return texts.map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => WORDS.test(t));
  }

  const files = SCOPES.flatMap((dir) => sourceFiles(path.join(ROOT, dir))).map(rel);

  it("src/app・src/components・src/lib・src/actions の文に、許した場所の外で字面が無い", () => {
    const offenders = files
      .filter((file) => !OWNERS.has(file))
      .flatMap((file) => hitsOf(file).map((text) => ({ file, text })))
      .filter(({ file, text }) => !REASONED.some((r) => r.file === file && text.includes(r.phrase)))
      .map(({ file, text }) => `${file}: ${text.slice(0, 60)}`);
    expect(offenders).toEqual([]);
  });

  it("理由つきで許した文は、いまも実在する（使わなくなった許可を残さない）", () => {
    for (const r of REASONED) expect(hitsOf(r.file).some((t) => t.includes(r.phrase)), r.file).toBe(true);
  });

  it("検査の網が4つの場所すべてに掛かり、注釈を数えない", () => {
    for (const dir of SCOPES) expect(files.filter((f) => f.startsWith(`${dir}/`)).length, dir).toBeGreaterThan(0);
    // form-sync.ts の注釈には『ズレ』が書いてあるが、利用者に見える文ではない
    expect(read(FORM_SYNC)).toMatch(/ズレ/);
    expect(hitsOf(FORM_SYNC)).toEqual([]);
    // 「いずれか」は比べの語ではない
    expect(WORDS.test("会社管理者／社員 のいずれか")).toBe(false);
    expect(WORDS.test("項目がずれています")).toBe(true);
  });

  it("比べる警告の字面は、型と部品に実際に置かれている（空の検査になっていない）", () => {
    expect(hitsOf(DOMAIN).length + hitsOf(NOTICE).length).toBeGreaterThan(0);
  });
});
