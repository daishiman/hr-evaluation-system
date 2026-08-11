import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** 最初の users INSERT の値だけを切り出し、後段の更新処理で誤って PASS させない。 */
function firstUserInsert(source: string): string {
  const start = source.indexOf("insert(s.users).values({");
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + 1_200);
}

describe("管理者が発行する利用者アカウント", () => {
  it.each([
    "src/app/api/companies/route.ts",
    "src/app/api/members/route.ts",
    "src/app/api/system/users/route.ts",
    "src/lib/import-members.ts",
  ])("%s の新規利用者は初回変更待ちで保存する", (path) => {
    expect(firstUserInsert(read(path))).toContain("mustChangePassword: true");
  });

  it("CSV APIは共有パスワードを受け取らず、サーバーで行ごとの資格情報を発行する", () => {
    const route = read("src/app/api/import/members/route.ts");
    const importer = read("src/lib/import-members.ts");
    const ui = read("src/components/MembersCsvImport.tsx");

    expect(route).not.toContain("initialPassword");
    expect(ui).not.toContain("generateInitialPassword");
    expect(importer).toContain("generateUniqueInitialPassword(issuedPasswords)");
    expect(importer).toContain("credentials.push({ row: p.row, name: p.name, email: p.email, initialPassword })");
    expect(ui).toContain("仮パスワードは今回だけ表示します");
  });
});
