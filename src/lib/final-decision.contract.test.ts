import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 昇給・昇格の結論を出す場所は、どれも finalDecision（src/lib/domain/final-decision.ts）だけを通す（qa-y12 (18)・DD-024）。
 *
 * 点数の判定（raiseEligible・promotionEligible）をそのまま `? :` や `&&` で文にすると、
 * 上司が変えた結論を見落とす画面ができる（昇給を見送ったのに「昇給の要件を満たす」と出る）。
 * 表示の層（画面・部品・CSV・レポートの組み立て）を読み、点数の判定で分岐している行を落とす。
 * 判定の列を値として渡すこと（finalDecision の引数・型・props）は分岐ではないので許す。
 */

const SRC = join(import.meta.dirname, "..");

/** 表示の層。domain（判定の規則そのもの）と集計（evaluate.ts）は含めない */
const DISPLAY_ROOTS = ["app", "components"];
const DISPLAY_FILES = ["lib/export.ts", "lib/report-data.ts"];

/** 結論を出す場所。どれも final-decision から結論の関数を読む */
const CONCLUSION_SITES = [
  "components/EvaluationDetail.tsx",
  "components/DecisionBadge.tsx",
  "app/me/results/page.tsx",
  "app/me/MyDashboard.tsx",
  "lib/export.ts",
  "lib/domain/report.ts",
];

/** 結論を自分では出さず、DecisionBadge に任せる場所 */
const BADGE_SITES = ["app/manager/cycles/page.tsx", "components/ReportTemplate.tsx"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function exists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const displayFiles = [
  ...DISPLAY_ROOTS.flatMap((root) => walk(join(SRC, root))),
  ...DISPLAY_FILES.map((f) => join(SRC, f)).filter(exists),
];

/** 点数の判定で分岐している書き方（三項・&&・||・否定） */
const BRANCH_ON_SCORE = [
  /\b(raise|promotion)Eligible\s*(\?(?!\.)|&&|\|\|)/,
  /!\s*[\w.?]*\.(raise|promotion)Eligible\b/,
];

/** 点数の判定だけで結論を言い切る、以前の言い回し */
const OLD_WORDING = [/昇格可(?!否)/, /昇格不可/, /昇給の要件を満たす/, /昇格の要件を満たす/];

describe("昇給・昇格の結論は finalDecision だけで出す（DD-024）", () => {
  it("表示の層は、点数の判定で分岐して結論の文を作らない", () => {
    const hits = displayFiles.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .filter(({ line }) => [...BRANCH_ON_SCORE, ...OLD_WORDING].some((re) => re.test(line)))
        .map(({ at, line }) => `${at}  ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });

  it("結論を出す場所は、どれも final-decision の関数を読む", () => {
    const missing = CONCLUSION_SITES.filter((site) => {
      const text = readFileSync(join(SRC, site), "utf8");
      return !/from "@\/lib\/domain\/final-decision"/.test(text) || !/\b(finalDecision|finalDecisionOf)\(/.test(text);
    });
    expect(missing).toEqual([]);
  });

  it("一覧は DecisionBadge に結論を任せる（自分で言い回しを作らない）", () => {
    const missing = BADGE_SITES.filter((site) => {
      const text = readFileSync(join(SRC, site), "utf8");
      return !/from "@\/components\/DecisionBadge"/.test(text) || !/<DecisionBadge\b/.test(text);
    });
    expect(missing).toEqual([]);
  });

  it("網は、以前の書き方を実際に見つける（網が空振りしていない）", () => {
    const samples = [
      `{e.raiseEligible ? "昇給の要件を満たす" : "評価確定"}`,
      `{result.promotionEligible && <Badge>昇格</Badge>}`,
      `e.promotionEligible ? "昇格可" : "昇格不可"`,
      `if (!head.raiseEligible) return null;`,
    ];
    for (const sample of samples) {
      expect([...BRANCH_ON_SCORE, ...OLD_WORDING].some((re) => re.test(sample)), sample).toBe(true);
    }
    // 値として渡すだけの書き方は分岐ではない
    for (const ok of ["finalDecision(e.raiseEligible, e.raiseDecision)", "scoreJudgement={e.promotionEligible}", "raiseEligible: boolean;"]) {
      expect(BRANCH_ON_SCORE.some((re) => re.test(ok)), ok).toBe(false);
    }
  });
});
