import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 網羅率100%を必ず保つファイル（＝人の昇給・昇格を左右する計算に関わるもの）。
 *
 * ここに載っているファイルは、行・関数・文・分岐のすべてで100%を割ると
 * `pnpm run test:coverage` が失敗する。CI がこのコマンドを実行するので、
 * 試験のない計算の枝を足したまま main に入れることはできない。
 *
 * 「全ファイル一律100%」にはしない。画面の見た目のコードまで100%を課すと、
 * 埋めるためだけの意味の薄い試験が増え、本当に大事な部分が埋もれるため。
 */
const CALC_FILES = [
  // 集計の本体（回答 → 点数・ランク・昇給昇格 → 保存）
  "src/lib/evaluate.ts",
  // 基準を直したあと、どの評価が古いままかを判定する
  "src/lib/impact.ts",
  // 計算式の読み取りと実績値の算出
  "src/lib/domain/formula.ts",
  // ランク判定・点数化・総合判定（昇給・昇格）
  "src/lib/domain/scoring.ts",
  // 事業所KGIの達成係数・個人Pt・賞与額
  "src/lib/domain/kgi.ts",
  // 等級区分ごとの配点の型（合計100点）
  "src/lib/domain/grade-points.ts",
  // KPIの設定内容（選ぶ項目・配点・固定枠）の検査
  "src/lib/domain/scheme.ts",
  // ランク基準の重なり・隙間の検査
  "src/lib/domain/rank-bounds.ts",
  // 数値の入力・提出値の検査（打った値と保存される値を食い違わせない）
  "src/lib/domain/number-input.ts",
  // 等級要件の数え方（達成率の分母）
  "src/lib/domain/grade-requirements.ts",
  // 行動指針の点数の帯
  "src/lib/domain/behavior.ts",
  // 保存された値を画面へ渡すときの加工（数字を書き換えていないか）
  "src/lib/domain/evaluation-view.ts",
  // 誰の評価を誰が確定できるか
  "src/lib/domain/evaluation-authority.ts",
  // 集計結果の件数のまとめ
  "src/lib/domain/build-summary.ts",
] as const;

const FULL = { lines: 100, functions: 100, statements: 100, branches: 100 };

export default defineConfig({
  test: {
    environment: "node",
    // scripts/ の種データ生成もテストの対象にする（サンプル投入が既存データに触らないことを固定するため）
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "coverage",
      /**
       * 評価（点数・ランク・係数・昇格昇給・集計）に関わるファイルだけを網羅率の対象にする。
       * 画面の部品まで混ぜると数字が薄まり、「評価のどこが守られているか」が読めなくなる。
       */
      include: ["src/lib/domain/**/*.ts", "src/lib/evaluate.ts", "src/lib/impact.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        // 計算まわり以外（上の include に入る残りのファイル）の下限。
        // いまの水準を維持し、下がったら気づけるようにする。
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
        // 計算まわりはファイル1つずつ100%。1ファイルでも割ったら失敗する。
        ...Object.fromEntries(CALC_FILES.map((f) => [f, FULL])),
      },
    },
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
