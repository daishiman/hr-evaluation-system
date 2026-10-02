import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { E2E_ACCOUNT, STORAGE_STATE, signIn } from "./support";

/** システム全体管理者でログインし、各試験が使うログイン状態を保存する。 */
setup("システム全体管理者でログインする", async ({ page }) => {
  await signIn(page, E2E_ACCOUNT);

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
