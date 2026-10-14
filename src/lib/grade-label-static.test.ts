import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { splitSource } from "@/test-support/source-code";

/*
 * 画面の文字列に、英語の区分名とカタカナの呼び名が残っていない（S1・A1・A2）。
 *
 * 区分（pointGroup）の値そのものは、表の結び付けに使う鍵なので残す。
 * 鍵として書く文字列（"Beginner" ぴったり）は数えず、画面に出る文の中に混ざったものだけを数える。
 * 注釈（開発者向けの文）は利用者に見えないので数えない。
 */

const ROOT = process.cwd();
/** 画面に出る文に混ざってはいけない呼び名。「マネージャー」は役割の名前なので、等級の番号付きだけを見る。 */
const LEGACY = /Beginner|Regular|Chief|Manager ?[ⅠⅡ]|AM ?[ⅠⅡ]|ビギナー|レギュラー|チーフ|マネージャー ?[ⅠⅡ]/;
/** 区分の鍵そのもの。照合に使うので書いてよい。 */
const POINT_GROUP_KEYS = new Set(["Beginner", "Regular", "Chief", "AM", "Manager"]);

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

describe("英語の区分名の静的検査", () => {
  it("src の画面の文字列（文字列リテラルと JSX の地の文）に英語の区分名・カタカナの呼び名が無い", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const { literals, code } = splitSource(readFileSync(file, "utf8"));
      for (const literal of literals) {
        if (POINT_GROUP_KEYS.has(literal.trim())) continue;
        if (LEGACY.test(literal)) hits.push(`${path.relative(ROOT, file)}: "${literal.slice(0, 60)}"`);
      }
      if (file.endsWith(".tsx")) {
        code.split("\n").forEach((line, i) => {
          // 地の文だけを見る（識別子の Beginner など、鍵としての使い方は日本語を伴わない）
          if (LEGACY.test(line) && /[ぁ-んァ-ヶ一-龠]/.test(line)) {
            hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 60)}`);
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });

  it("昇格の段階名は保存した文字列ではなく等級名から作る（等級名を変えると、段階の表示も変わる）", () => {
    // 線引きの label と昇格要件の transition_label は、保存したときの等級名の写しで、名前を変えても追従しない
    const STORED_STEP = /\{\s*\w+\.transitionLabel\s*\}|\$\{\s*\w+\.transitionLabel\s*\}|\{\s*th\.label\s*\}|\$\{\s*th\.label\s*\}/;
    const hits: string[] = [];
    for (const dir of ["src/app", "src/components"]) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        if (!file.endsWith(".tsx")) continue;
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (STORED_STEP.test(line)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 80)}`);
          });
      }
    }
    expect(hits).toEqual([]);

    // 段階を出す画面は、等級名から段階の呼び名を作る共通の関数を通す
    for (const file of ["src/app/admin/masters/promotion/page.tsx", "src/app/criteria/page.tsx"]) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).toContain("promotionStepFrom(grade.id, grades, thresholds)");
    }
    const editor = readFileSync(path.join(ROOT, "src/components/PromotionRequirementEditor.tsx"), "utf8");
    expect(editor).toContain("stepLabel: string | null;");
    // 対象の昇格を手で書かせる入力欄は置かない
    expect(editor).not.toContain("対象の昇格（任意");
  });

  it("種データの等級名は「等級4-1」の形で、英語を含まない", () => {
    const grades = JSON.parse(readFileSync(path.join(ROOT, "data/grades.json"), "utf8")) as { code: string; name: string }[];
    expect(grades.map((g) => [g.code, g.name])).toEqual([
      ["beginner", "等級1"],
      ["regular", "等級2"],
      ["chief", "等級3"],
      ["am1", "等級4-1"],
      ["am2", "等級4-2"],
      ["manager1", "等級5-1"],
      ["manager2", "等級5-2"],
    ]);
  });

  it("種データの行動指針のセット名に英語の区分名が無い", () => {
    for (const file of ["scripts/seed-data.mjs", "src/lib/domain/behavior.ts"]) {
      const { literals } = splitSource(readFileSync(path.join(ROOT, file), "utf8"));
      const bad = literals.filter((l) => /向け/.test(l) && LEGACY.test(l));
      expect(bad, file).toEqual([]);
    }
  });
});
