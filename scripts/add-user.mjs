/**
 * 利用者を1人だけ追加する（既存のデータには一切触らない）。
 *
 *   read -rs ADD_USER_PASSWORD && export ADD_USER_PASSWORD
 *   pnpm run user:add -- --email a@b.jp --name "氏名" --role SUPER_ADMIN [--remote]
 *   パスワードは環境変数 ADD_USER_PASSWORD か標準入力（パイプ）で渡す（引数の --password は断る。DD-032 の4）。
 *   長さは src/lib/security/password.ts の決まり（10〜200文字）に合わせる。
 *   会社の役割は --company <会社ID> が必須。SUPER_ADMIN には会社を指定しない。
 *   既存メールは失敗として伝え、既存の利用者・資格情報・所属は変更しない。
 *
 * パスワードはアプリのログインと同じ方式（Better Auth の scrypt）で暗号化して保存する。
 * 発行時のパスワードは本人のものではないため、must_change_password を立てて
 * ログイン後に変更をお願いし続ける状態にする。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "better-auth/crypto";
import {
  assertAddUserCompanyRole, buildAddUserSql, buildAddUserOutcomeSql, normalizeAddUserEmail,
  resolveAddUserPassword, validateNewPassword,
} from "./add-user-data.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`--${name} の値を指定してください。`);
  return value;
};

const email = normalizeAddUserEmail(flag("email") ?? "");
const name = flag("name");
const role = flag("role") ?? "EMPLOYEE";
const companyId = flag("company") ?? null;
const employeeCode = flag("code") ?? null;
const department = flag("dept") ?? null;
const remote = args.includes("--remote");

await main();

/** 断る理由だけを伝えて終える（受け取った値は出さない）。 */
function refuse(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  let password;
  try {
    // 端末から直に読むと打った文字が画面に出るので、パイプで渡されたときだけ標準入力を読む
    const readStdin = () => process.stdin.isTTY ? "" : readFileSync(0, "utf8");
    password = await resolveAddUserPassword({ argv: args, env: process.env, readStdin });
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "パスワードを受け取れませんでした。");
  }
  if (!email || !name || !password) {
    return refuse("必要な指定が足りません: --email --name とパスワード（ADD_USER_PASSWORD か標準入力）");
  }
  assertAddUserCompanyRole({ role, companyId });
  const passwordProblem = validateNewPassword(password);
  if (passwordProblem) return refuse(`${passwordProblem}（画面とログインの決まりと同じです）。`);
  await addUser(password);
}

async function addUser(password) {
  const values = {
    userId: crypto.randomUUID(), accountId: crypto.randomUUID(), now: Date.now(),
    email, name, role, companyId, employeeCode, department, passwordHash: await hashPassword(password),
  };
  const directory = mkdtempSync(join(tmpdir(), "hr-add-user-"));
  const file = join(directory, "add-user.sql");
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const command = ["exec", "wrangler", "d1", "execute", "hr-evaluation-db", remote ? "--remote" : "--local", "--yes", "--json"];
  // 子が必要とするのはSQLのハッシュだけ。入力時の平文はpnpm・Wranglerへ渡さない。
  const childEnv = { ...process.env };
  delete childEnv.ADD_USER_PASSWORD;
  let outcome;
  let written = false;
  try {
    // SQL には資格情報のハッシュがある。権限を絞り、成功・失敗どちらでも削除する。
    writeFileSync(file, buildAddUserSql(values).join("\n"), { mode: 0o600 });
    execFileSync("pnpm", [...command, "--file", file], { cwd, env: childEnv, stdio: "pipe" });
    written = true;
    const output = execFileSync("pnpm", [...command, "--command", buildAddUserOutcomeSql(values)], { cwd, env: childEnv, stdio: "pipe", encoding: "utf8" });
    const results = JSON.parse(output);
    outcome = results.flatMap((entry) => entry.results ?? []).find((row) => row.outcome)?.outcome;
    if (!["created", "exists", "invalid_company"].includes(outcome)) throw new Error("unknown_result");
  } catch {
    // Wrangler の例外や標準出力には送ったSQLが含まれる可能性があるため、そのまま出さない。
    console.error(written
      ? "書込みは受け付けられましたが結果を確認できませんでした。利用者一覧で確認してください。"
      : "利用者を追加できませんでした。接続・権限・会社と移行の状態を確認してください。");
    process.exitCode = 1;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  if (outcome === "created") {
    console.log(`\n${remote ? "本番" : "ローカル"}に ${email}（${role}）を追加しました。`);
    console.log("初回ログイン後、画面の案内からパスワードを変更してください。");
  } else if (outcome) {
    console.error(outcome === "exists"
      ? "このメールアドレスはすでに登録されています。既存の利用者・資格情報・所属は変更していません。"
      : "会社が見つからないか、停止中・テンプレートです。利用者は追加していません。");
    process.exitCode = 1;
  }
}
