import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // scripts/ の種データ生成もテストの対象にする（サンプル投入が既存データに触らないことを固定するため）
  test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"] },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
