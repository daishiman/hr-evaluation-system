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

describe("パスワードの再発行", () => {
  it.each([
    "src/app/admin/members/[id]/page.tsx",
    "src/app/system/users/[id]/page.tsx",
  ])("%s は共通の再発行部品を使い、手打ちの入力欄を置かない", (path) => {
    const page = read(path);
    expect(page).toContain('import { PasswordReissue } from "@/components/PasswordReissue"');
    expect(page).toContain("<PasswordReissue");
    // 管理者が思いついた文字列を打ち込む欄を残すと、発行の作法が画面ごとに分かれる
    expect(page).not.toContain('label: "新しいパスワード"');
  });

  it("再発行の部品は、新規発行と同じ生成の仕組みで初期表示を作る", () => {
    const ui = read("src/components/PasswordReissue.tsx");
    // RecordForm の generate 経路に乗せることで、生成・作り直す・写す・発行後の控え表示が
    // 新規発行（利用者の追加・会社の追加）とまったく同じ見え方になる
    expect(ui).toContain("generate: true");
    expect(ui).toContain("resetAfterSubmit");
    expect(ui).not.toContain("Math.random");
    expect(read("src/components/RecordForm.tsx")).toContain(
      'import { generateInitialPassword } from "@/lib/domain/initial-password"',
    );
  });

  it.each(["src/app/api/members/route.ts", "src/app/api/system/users/route.ts"])(
    "%s は再発行を仮パスワード扱いにし、いまのログインを切る",
    (path) => {
      const route = read(path);
      const branch = route.slice(route.indexOf("if (body.password) {"));
      expect(branch).toContain("patch.mustChangePassword = true");
      expect(branch).toContain("delete(s.sessions).where(eq(s.sessions.userId, target.id))");
      expect(branch).toContain("await hashPassword(body.password)");
    },
  );

  it.each(["src/app/api/members/route.ts", "src/app/api/system/users/route.ts"])(
    "%s は発行した値そのものを返さない",
    (path) => {
      const route = read(path);
      // 応答に平文を載せると、通信の記録や運用のログに残る経路が増える
      expect(route).not.toContain("${body.password}");
      expect(route).not.toContain("password: body.password");
      expect(route).not.toContain("console.log");
    },
  );

  it.each([
    "src/app/api/members/route.ts",
    "src/app/api/system/users/route.ts",
    "src/app/api/companies/route.ts",
  ])("%s のパスワード下限は、本人の変更画面と同じ10文字", (path) => {
    const route = read(path);
    expect(route).not.toContain("min(8,");
    // 発行するのは12文字（PASSWORD_LENGTH）。画面より弱い値がAPI直叩きで入らないようにする
    expect(route).toContain('min(10, "パスワードは10文字以上にしてください")');
  });
});
