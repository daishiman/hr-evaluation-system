import { defineConfig } from "vitest/config";
import path from "node:path";

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
      include: [
        "src/lib/domain/**/*.ts",
        "src/lib/evaluate.ts",
        "src/lib/impact.ts",
      ],
      exclude: ["**/*.test.ts"],
      /**
       * 下限。これを割ったら `pnpm run test:coverage` が失敗する。
       * 評価の計算は1か所の取りこぼしが昇給・昇格を変えるため、数字で歯止めをかける。
       */
      thresholds: { lines: 100, functions: 100, statements: 99.6, branches: 99 },
    },
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
