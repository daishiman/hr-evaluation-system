import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../src/test-support/sqlite-d1";
import { buildAddUserSql, buildAddUserOutcomeSql, resolveAddUserPassword } from "./add-user-data.mjs";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("better-auth/crypto", () => ({ hashPassword: async () => "hashed:cli" }));

let t;
const input = (patch = {}) => ({
  userId: "usr_new", accountId: "acc_new", email: "new@example.test", name: "新規 利用者",
  role: "EMPLOYEE", companyId: "cmp_active", employeeCode: "A-1", department: "営業",
  passwordHash: "hashed:new", now: 123456, ...patch,
});

describe("パスワードの受け取り方（DD-032 の4）", () => {
  // 引数のパスワードはシェルの履歴とプロセスの一覧に残る。標準入力か環境変数だけで受ける。
  const resolve = (options) => (async () => resolveAddUserPassword(options))();

  it("引数に --password があれば、値を読まずに拒む", async () => {
    const readStdin = vi.fn(() => "from-stdin-password");
    await expect(resolve({ argv: ["--email", "a@example.test", "--password", "argv-secret-1"], env: {}, readStdin }))
      .rejects.toThrow(/--password/);
    expect(readStdin).not.toHaveBeenCalled();
  });

  it("ADD_USER_PASSWORD があればそれを使い、標準入力は読まない", async () => {
    const readStdin = vi.fn(() => "from-stdin-password");
    await expect(resolve({ argv: [], env: { ADD_USER_PASSWORD: "from-env-password" }, readStdin }))
      .resolves.toBe("from-env-password");
    expect(readStdin).not.toHaveBeenCalled();
  });

  it("どちらも無ければ標準入力を読み、末尾の改行だけを落とす", async () => {
    await expect(resolve({ argv: [], env: {}, readStdin: () => "from-stdin-password\n" })).resolves.toBe("from-stdin-password");
    await expect(resolve({ argv: [], env: {}, readStdin: () => "  spaced  pass \r\n" })).resolves.toBe("  spaced  pass ");
  });
});

describe("CLIの結果表示と秘密SQLの後片付け", () => {
  /** 既定は環境変数で渡す（引数の --password は CLI が断る。DD-032 の4）。"argv" は断られることを確かめる試験だけが使う。 */
  async function runCli(mode = "normal", email = "cli@example.test", { passwordVia = "env", password = "test-secret-password" } = {}) {
    const originalArgs = process.argv;
    const originalExit = process.exitCode;
    const originalEnvPassword = process.env.ADD_USER_PASSWORD;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let sqlFile;
    let fileMode;
    execFileSync.mockImplementation((_command, args) => {
      if (args.includes("--file")) {
        sqlFile = args[args.indexOf("--file") + 1];
        fileMode = statSync(sqlFile).mode & 0o777;
        if (mode === "write_failure") throw new Error("secret hash must never be printed");
        t.raw.exec("BEGIN");
        try {
          t.raw.exec(readFileSync(sqlFile, "utf8"));
          t.raw.exec("COMMIT");
        } catch (failure) {
          t.raw.exec("ROLLBACK");
          throw failure;
        }
        return Buffer.from("[]");
      }
      if (mode === "read_failure") throw new Error("query failed");
      return JSON.stringify([{ success: true, results: t.raw.prepare(args[args.indexOf("--command") + 1]).all() }]);
    });
    try {
      const passwordArgs = passwordVia === "argv" ? ["--password", password] : [];
      process.argv = ["node", "add-user.mjs", "--email", email, "--name", "追加者", ...passwordArgs, "--company", "cmp_active"];
      if (passwordVia === "env") process.env.ADD_USER_PASSWORD = password;
      else delete process.env.ADD_USER_PASSWORD;
      process.exitCode = 0;
      vi.resetModules();
      await import("./add-user.mjs");
      return {
        exit: process.exitCode,
        stdout: log.mock.calls.flat().join("\n"), stderr: error.mock.calls.flat().join("\n"),
        sqlFile, fileMode,
        childEnvs: execFileSync.mock.calls.map(([, , options]) => options.env),
      };
    } finally {
      process.argv = originalArgs;
      process.exitCode = originalExit;
      if (originalEnvPassword === undefined) delete process.env.ADD_USER_PASSWORD;
      else process.env.ADD_USER_PASSWORD = originalEnvPassword;
      log.mockRestore();
      error.mockRestore();
      execFileSync.mockReset();
    }
  }

  it("新規だけ成功と表示し、秘密SQLのファイルとディレクトリは削除する", async () => {
    const result = await runCli();
    expect(result.exit).toBe(0);
    expect(result.stdout).toContain("追加しました");
    expect(rows("company_memberships")).toHaveLength(1);
    expect(result.fileMode).toBe(0o600);
    expect(existsSync(result.sqlFile)).toBe(false);
    expect(existsSync(dirname(result.sqlFile))).toBe(false);
    expect(result.stdout + result.stderr).not.toMatch(/test-secret-password|hashed:cli/);
  });

  it("既存メールは失敗として伝え、既存データを変更しない", async () => {
    apply(input({ email: "cli@example.test" }));
    const before = snapshot();
    const result = await runCli();
    expect(result.exit).toBe(1);
    expect(result.stdout).not.toContain("追加しました");
    expect(result.stderr).toContain("すでに登録されています");
    expect(snapshot()).toEqual(before);
    expect(existsSync(result.sqlFile)).toBe(false);
  });

  it("CLI入力の前後空白と大文字を正規化して、ログインと同じメールを保存・表示する", async () => {
    const result = await runCli("normal", "  Mixed-Case@Example.Test  ");
    expect(result.exit).toBe(0);
    expect(rows("users")[0].email).toBe("mixed-case@example.test");
    expect(result.stdout).toContain("mixed-case@example.test");
    expect(result.stdout).not.toContain("Mixed-Case");
  });

  it("失敗時にもSQLを削除し、例外内の秘密を出さない", async () => {
    const result = await runCli("write_failure");
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain("追加できませんでした");
    expect(result.stderr).not.toContain("secret hash");
    expect(existsSync(result.sqlFile)).toBe(false);
    expect(rows("users")).toEqual([]);
  });

  it("書込み後の確認失敗は完了と表示せず、一覧での確認を促す", async () => {
    const result = await runCli("read_failure");
    expect(result.exit).toBe(1);
    expect(result.stdout).not.toContain("追加しました");
    expect(result.stderr).toContain("利用者一覧で確認してください");
    expect(rows("users")).toHaveLength(1);
    expect(existsSync(result.sqlFile)).toBe(false);
  });

  it("環境変数で受けた10文字のパスワードで追加でき、出力にパスワードを出さない", async () => {
    const result = await runCli("normal", "cli@example.test", { passwordVia: "env", password: "ten-chars!" });
    expect(result.exit).toBe(0);
    expect(result.stdout).toContain("追加しました");
    expect(rows("users")).toHaveLength(1);
    expect(result.stdout + result.stderr).not.toContain("ten-chars!");
  });

  it("書込み・確認の子プロセスに平文パスワードを渡さず、ほかの環境変数を保つ", async () => {
    vi.stubEnv("HR_ADD_USER_TEST_ENV", "keep-this-value");
    try {
      const result = await runCli();
      expect(result.childEnvs).toHaveLength(2);
      for (const env of result.childEnvs) {
        expect(env).not.toHaveProperty("ADD_USER_PASSWORD");
        expect(env.HR_ADD_USER_TEST_ENV).toBe("keep-this-value");
        expect(env.PATH).toBe(process.env.PATH);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("9文字のパスワードは書き込まずに断り、10文字以上を求める", async () => {
    const result = await runCli("normal", "cli@example.test", { passwordVia: "env", password: "nine-char" });
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain("10文字");
    expect(result.stdout + result.stderr).not.toContain("nine-char");
    expect(rows("users")).toEqual([]);
  });

  it("引数で渡したパスワードは長さに関係なく断り、出力に値を出さない", async () => {
    const result = await runCli("normal", "cli@example.test", { passwordVia: "argv", password: "argv-secret-password" });
    expect(result.exit).toBe(1);
    expect(result.stdout).not.toContain("追加しました");
    expect(result.stdout + result.stderr).not.toContain("argv-secret-password");
    expect(rows("users")).toEqual([]);
  });
});

function apply(values) {
  // Wrangler の local --file と同じ batch 境界（remote --file も import 全体で失敗時に復元）。
  t.raw.exec("BEGIN");
  try {
    for (const statement of buildAddUserSql(values)) t.raw.exec(statement);
    t.raw.exec("COMMIT");
  } catch (error) {
    t.raw.exec("ROLLBACK");
    throw error;
  }
  return t.raw.prepare(buildAddUserOutcomeSql(values)).get().outcome;
}
const rows = (table) => t.raw.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
const snapshot = () => Object.fromEntries(["users", "accounts", "company_memberships"].map((table) => [table, rows(table)]));

beforeEach(() => {
  t = createTestDatabase();
  t.raw.exec(`INSERT INTO companies (id, name, slug, is_active, is_template, created_at, updated_at) VALUES
    ('cmp_active', '利用中', 'active', 1, 0, 0, 0),
    ('cmp_stopped', '停止中', 'stopped', 0, 0, 0, 0),
    ('cmp_template', 'ひな形', 'template', 1, 1, 0, 0)`);
});
afterEach(() => t.close());

describe("用途別CLIでの新規利用者追加", () => {
  it.each(["EMPLOYEE", "MANAGER", "COMPANY_ADMIN"])("%s はアカウントと会社の所属がそろい、仮パスワードの変更を求める", (role) => {
    expect(apply(input({ role }))).toBe("created");
    expect(rows("users")).toHaveLength(1);
    expect(rows("users")[0]).toMatchObject({ role, company_id: "cmp_active", must_change_password: 1 });
    expect(rows("accounts")[0]).toMatchObject({ user_id: "usr_new", provider_id: "credential", password: "hashed:new" });
    expect(rows("company_memberships")).toHaveLength(1);
    expect(rows("company_memberships")[0]).toMatchObject({
      user_id: "usr_new", company_id: "cmp_active", role, employee_code: "A-1", department: "営業",
    });
  });

  it("全体管理者は会社も所属も持たない", () => {
    expect(apply(input({ role: "SUPER_ADMIN", companyId: null }))).toBe("created");
    expect(rows("users")[0]).toMatchObject({ role: "SUPER_ADMIN", company_id: null });
    expect(rows("company_memberships")).toEqual([]);
  });

  it.each([null, ""])("会社ロールの会社未指定（%s）はSQL生成前に拒否", (companyId) => {
    expect(() => buildAddUserSql(input({ companyId }))).toThrow(/会社/);
    expect(rows("users")).toEqual([]);
  });
  it("全体管理者への会社指定と未知の役割はSQL生成前に拒否", () => {
    expect(() => buildAddUserSql(input({ role: "SUPER_ADMIN" }))).toThrow(/会社/);
    expect(() => buildAddUserSql(input({ role: "UNKNOWN" }))).toThrow(/role/);
  });

  it.each(["cmp_missing", "cmp_stopped", "cmp_template"])("%s には利用者・資格情報・所属を一切作らない", (companyId) => {
    const before = snapshot();
    expect(apply(input({ companyId }))).toBe("invalid_company");
    expect(snapshot()).toEqual(before);
  });

  it("既存メールには所属も資格情報も足さず、氏名・役割・パスワードを変えない", () => {
    apply(input());
    const before = snapshot();
    expect(apply(input({ userId: "usr_second", accountId: "acc_second", name: "上書き", role: "MANAGER", passwordHash: "changed" }))).toBe("exists");
    expect(snapshot()).toEqual(before);
  });
  it("ログイン資格情報が無い既存メールにもパスワードを発行しない", () => {
    t.raw.exec("INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('usr_existing', '既存', 'new@example.test', 0, 0)");
    const before = snapshot();
    expect(apply(input())).toBe("exists");
    expect(snapshot()).toEqual(before);
  });

  it("SQL生成を直接呼んでも前後空白と大文字を正規化し、完全一致で読み出せる", () => {
    expect(apply(input({ email: "  Mixed-Case@Example.Test  " }))).toBe("created");
    expect(t.raw.prepare("SELECT id FROM users WHERE email = ?").get("mixed-case@example.test")?.id).toBe("usr_new");
    expect(rows("users")[0].email).toBe("mixed-case@example.test");
  });

  it.each(["new@example.test", "  New@Example.Test  "])("既存メール %s と正規化後に同一なら、全テーブルを変更しない", (existingEmail) => {
    // 旧CLIで大文字・空白のまま登録されたアカウントも、既存のものとして扱う。
    t.raw.prepare("INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('usr_existing', '既存', ?, 0, 0)").run(existingEmail);
    t.raw.exec("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ('acc_existing', 'usr_existing', 'credential', 'usr_existing', 'original_hash', 0, 0)");
    const before = snapshot();
    expect(apply(input({ email: "  NEW@Example.Test " }))).toBe("exists");
    expect(snapshot()).toEqual(before);
  });

  it("引用符・セミコロンを含む値をそのまま保存し、SQLとして実行しない", () => {
    const name = "O'Brien'; DROP TABLE users; --";
    const email = "o'brien@example.test";
    expect(apply(input({ name, email, department: "営業'部" }))).toBe("created");
    expect(rows("users")[0].name).toBe(name);
    expect(rows("company_memberships")[0].department).toBe("営業'部");
  });

  it("後続の所属書込みが失敗したら、利用者も資格情報も残らない", () => {
    t.raw.exec("CREATE TRIGGER reject_cli_membership BEFORE INSERT ON company_memberships BEGIN SELECT RAISE(ABORT, 'injected_membership_failure'); END");
    const before = snapshot();
    expect(() => apply(input())).toThrow(/injected_membership_failure/);
    expect(snapshot()).toEqual(before);
  });
});
