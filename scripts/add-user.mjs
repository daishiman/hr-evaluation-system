/**
 * 利用者を1人だけ追加する（既存のデータには一切触らない）。
 *
 *   pnpm run user:add -- --email a@b.jp --name "氏名" --role SUPER_ADMIN --password "..." [--remote]
 *
 * パスワードはアプリのログインと同じ方式（Better Auth の scrypt）で暗号化して保存する。
 * 発行時のパスワードは本人のものではないため、must_change_password を立てて
 * ログイン後に変更をお願いし続ける状態にする。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const email = flag("email");
const name = flag("name");
const role = flag("role") ?? "EMPLOYEE";
const password = flag("password");
const companyId = flag("company") ?? null;
const employeeCode = flag("code") ?? null;
const department = flag("dept") ?? null;
const remote = args.includes("--remote");

if (!email || !name || !password) {
  console.error("必要な指定が足りません: --email --name --password");
  process.exit(1);
}
if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
  console.error(`--role は SUPER_ADMIN / COMPANY_ADMIN / MANAGER / EMPLOYEE のいずれかです（指定: ${role}）`);
  process.exit(1);
}
if (password.length < 8) {
  console.error("パスワードは8文字以上にしてください（ログイン側の最低文字数と合わせています）。");
  process.exit(1);
}

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const now = Date.now();
const userId = crypto.randomUUID();
const accountId = crypto.randomUUID();
const pw = await hashPassword(password);

// 同じメールアドレスが既にあるときは何もしない（既存アカウントを壊さないため INSERT OR IGNORE）
const sql = `
INSERT OR IGNORE INTO users
  (id, name, email, email_verified, image, company_id, role, grade_id, office_id, manager_id,
   employee_code, department, hired_at, profile_note, must_change_password, is_active, created_at, updated_at)
VALUES
  (${q(userId)}, ${q(name)}, ${q(email)}, 1, NULL, ${q(companyId)}, ${q(role)}, NULL, NULL, NULL,
   ${q(employeeCode)}, ${q(department)}, NULL, NULL, 1, 1, ${now}, ${now});
INSERT OR IGNORE INTO accounts
  (id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
   access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
SELECT ${q(accountId)}, u.id, 'credential', u.id, NULL, NULL, NULL, NULL, NULL, NULL, ${q(pw)}, ${now}, ${now}
FROM users u WHERE u.email = ${q(email)}
  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential');
`.trim();

mkdirSync("drizzle", { recursive: true });
const file = "drizzle/.add-user.sql";
writeFileSync(file, sql);

const cmd = ["d1", "execute", "hr-evaluation-db", remote ? "--remote" : "--local", "--file", file, "--yes"];
execFileSync("pnpm", ["exec", "wrangler", ...cmd], { stdio: "inherit" });
console.log(`\n${remote ? "本番" : "ローカル"}に ${email}（${role}）を追加しました。`);
console.log("初回ログイン後、画面の案内からパスワードを変更してください。");
