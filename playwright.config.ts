import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/support";

/**
 * 画面の通し試験（E2E）。データの鮮度（作成・変更の結果がすぐ見えること）を4つの経路で確かめる
 * （architecture/data-freshness.md・e2e/data-freshness.spec.ts）。
 *
 * 相手はローカルの preview（`pnpm run preview`）とローカル D1 の見本データ。
 * preview を別のポートで動かしたときは E2E_BASE_URL で指す（`.dev.vars` の BETTER_AUTH_URL と同じ origin）。
 * 試験は会社を実際に追加するので、ローカル以外には向けない。
 * 本番に書き込まないための止め（下の LOCAL_HOSTS）を外さないこと。
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8787";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!LOCAL_HOSTS.has(new URL(BASE_URL).hostname)) {
  throw new Error(`E2E はローカルの preview だけを相手にします（会社を追加するため）。指定された先: ${BASE_URL}`);
}

export default defineConfig({
  testDir: "e2e",
  // 同じ一覧の件数を見比べるので、試験どうしを並べて走らせない
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
});
