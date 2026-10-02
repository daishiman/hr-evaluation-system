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
    "src/actions/companies.ts",
    "src/actions/members.ts",
    "src/actions/system-users.ts",
    "src/lib/import-members.ts",
  ])("%s の新規利用者は初回変更待ちで保存する", (path) => {
    expect(firstUserInsert(read(path))).toContain("mustChangePassword: true");
  });

  it("CSVの取り込みは共有パスワードを受け取らず、サーバーで行ごとの資格情報を発行する", () => {
    const route = read("src/actions/member-import.ts");
    const importer = read("src/lib/import-members.ts");
    const ui = read("src/components/MembersCsvImport.tsx");

    expect(route).not.toContain("initialPassword");
    expect(ui).not.toContain("generateInitialPassword");
    expect(importer).toContain("generateUniqueInitialPassword(issuedPasswords)");
    expect(importer).toContain("credentials.push({ row: p.row, name: p.name, email: p.email, initialPassword })");
    expect(ui).toContain("仮パスワードは今回だけ表示します");
  });

  it("CSVで作った方の仮パスワードも、暗号化した控えを同じ batch で残す", () => {
    const importer = read("src/lib/import-members.ts");
    const action = read("src/actions/member-import.ts");
    expect(importer).toContain("await sealMemo(vault, selfId, credential.initialPassword)");
    expect(importer).toContain("statements.push(memoUpsert(db,");
    expect(importer).toContain("statements.push(memoPurgeExpired(db)");
    // 確認だけ（dryRun）のときは鍵を使わず、控えも書かない
    expect(importer).toContain("const vault = dryRun ? null : (options.vault ?? null)");
    expect(action).toContain("vault: await loadVaultKey()");
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

  it.each(["src/actions/members.ts", "src/actions/system-users.ts"])(
    "%s は再発行を仮パスワード扱いにし、いまのログインを切る",
    (path) => {
      const action = read(path);
      const start = action.indexOf("if (input.password) {");
      expect(start).toBeGreaterThanOrEqual(0);
      const branch = action.slice(start);
      expect(branch).toContain("patch.mustChangePassword = true");
      expect(branch).toContain("delete(s.sessions).where(eq(s.sessions.userId, target.id))");
      expect(branch).toContain("prepareCredential(db, { userId: target.id, password: input.password");
      // 控えはアカウントの書き換えと同じ batch に入れる（片方だけ残らない）
      expect(branch).toContain("...credential.memo,");
    },
  );

  it("発行の材料づくりは、新規発行と再発行で同じハッシュの作り方を使う", () => {
    const issue = read("src/lib/credential-issue.ts");
    expect(issue).toContain("hashPassword(args.password)");
    // 鍵が無いときは古い控えを消す（前の値の控えを渡してしまわない）
    expect(issue).toContain("memo: [purge, memoDelete(db, args.userId)], stored: false");
    // 期限を過ぎた控えの掃除は発行の材料に束ねる（経路を足しても入れ忘れない）
    expect(issue).toContain("const purge = memoPurgeExpired(db);");
  });

  it.each(["src/actions/members.ts", "src/actions/system-users.ts", "src/actions/member-import.ts"])(
    "%s は発行した値そのものを返さない",
    (path) => {
      const action = read(path);
      // 応答に平文を載せると、通信の記録や運用のログに残る経路が増える
      expect(action).not.toContain("${input.password}");
      expect(action).not.toMatch(/return \{[^}]*password: input\.password/);
      expect(action).not.toContain("console.log");
    },
  );

  it.each([
    "src/actions/members.ts",
    "src/actions/system-users.ts",
    "src/actions/companies.ts",
  ])("%s のパスワード下限は、本人の変更画面と同じ10文字", (path) => {
    const route = read(path);
    expect(route).not.toContain("min(8,");
    // 発行するのは12文字（PASSWORD_LENGTH）。画面より弱い値がAPI直叩きで入らないようにする
    expect(route).toContain('min(10, "パスワードは10文字以上にしてください")');
  });
});
