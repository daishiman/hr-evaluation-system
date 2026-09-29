// キット更新で、このアプリの配色の正本（spec.md のテーマ契約）が平賀配色へ黙って上書きされないことを固定する。判断の経緯は docs/product/design-decisions.md DD-003。
// 宣言のキー名や、キットが信号として読む語（除外の目印・平賀 CSS のファイル名）は連結で組み立て、そのままの形では書かない。
// リポジトリ直下を走査する判定（catalog-default.mjs plan）ではこのファイルも読まれるため、判定を汚さないようにする。
// 判定はキットの実物（eligibility.mjs）を呼ぶ。キット更新でこの import が落ちたら、判定の場所か規則が変わった合図として見直す。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  projectEligibility,
  readProjectSources,
} from "../aidd-agent-kit/skills/jp-web-design/scripts/lib/eligibility.mjs";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");

const STATUS_KEY = "brand_color_" + "status";
const SOURCE_KEY = "brand_color_" + "source";
const HIRAGA_CSS = "hiraga-color-" + "system.css";

// キットの判定（eligibility.mjs）が T2 を読むときと同じ正規表現。行頭形式でないと読まれない。
function declared(body, key) {
  return (
    body.match(new RegExp(`^\\s*${key}\\s*:\\s*(.*?)\\s*$`, "im"))?.[1] ?? null
  );
}

// dir 配下の .ts/.tsx/.css を、リポジトリ直下からの相対パスで返す。
function listSources(dir) {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return listSources(path);
      return /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : [];
    },
  );
}

// 読み込み先の文字列だけを取り出す（CSS の @import、JS/TS の import・from・require）。
// コメントで名前に触れただけでは引っかからないようにするため、ファイル全文の検索はしない。
const LOAD_TARGET =
  /(?:@import\s+(?:url\(\s*)?["']?|\bfrom\s+["']|\bimport\s*\(?\s*["']|\brequire\s*\(\s*["'])([^"')\s;]+)/g;

const loadTargets = (body) =>
  [...body.matchAll(LOAD_TARGET)].map((match) => match[1]);

const isKitStyle = (target) =>
  target.includes(HIRAGA_CSS) || /(?:^|\/)styles\/aidd(?:[/.]|$)/.test(target);

describe("AIDD キットとアプリ配色の境界", () => {
  it("キットの判定に src を渡すと、自動移行せず報告だけ（別ブランド扱い）になる", async () => {
    const sources = await readProjectSources(join(process.cwd(), "src"));

    expect(projectEligibility(sources)).toMatchObject({
      status: "report-only",
      source_theme: "external-brand",
    });
  });

  it("T2 に、アプリ独自の配色契約を承認済みとする宣言が行頭形式で書かれている", () => {
    const t2 = read("docs/product/T2-experience-spec.md");

    expect(declared(t2, STATUS_KEY)).toBe("approved");
    expect(declared(t2, SOURCE_KEY)).toBe("app-theme-contract");
  });

  it("globals.css にも同じ宣言がある（キットの移行は src だけを走査し、T2 を読まないため）", () => {
    const css = read("src/app/globals.css");

    expect(declared(css, STATUS_KEY)).toBe("approved");
    expect(declared(css, SOURCE_KEY)).toBe("app-theme-contract");
  });

  it("src がキットの平賀 CSS や見本のスタイル（styles/aidd）を読み込まない", () => {
    const files = listSources("src");
    // 走査が空振りして素通りしていないことの確認
    expect(files).toContain("src/app/globals.css");

    const offenders = files.flatMap((file) =>
      loadTargets(read(file))
        .filter(isKitStyle)
        .map((target) => `${file} → ${target}`),
    );

    expect(offenders).toEqual([]);
  });
});
