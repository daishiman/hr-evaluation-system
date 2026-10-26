/** 用途別CLIの新規発行。既存メールへの所属追加・資格情報の発行は行わない。 */
// 長さの決まりは画面・サーバーと同じものを使う（DD-032 の4。そのため node --experimental-strip-types で動かす）
import { validateNewPassword } from "../src/lib/security/password.ts";

const ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"];

export { validateNewPassword };

/**
 * 発行するパスワードを受け取る。
 * 引数の値はシェルの履歴とプロセスの一覧に残るので、--password は値を読まずに断る。
 * 環境変数 ADD_USER_PASSWORD があればそれを使い、無ければ標準入力を読む（末尾の改行だけを落とす）。
 */
export async function resolveAddUserPassword({ argv, env, readStdin }) {
  if (argv.some((arg) => arg === "--password" || arg.startsWith("--password="))) {
    throw new Error("--password は使えません。ADD_USER_PASSWORD か標準入力で渡してください。");
  }
  if (env.ADD_USER_PASSWORD) return env.ADD_USER_PASSWORD;
  return String(await readStdin()).replace(/\r?\n$/, "");
}
const q = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;

/** Webの発行・ログインと同じメールの形にそろえる。 */
export const normalizeAddUserEmail = (email) => email.trim().toLowerCase();
const sameEmail = (email) => `lower(trim(email)) = ${q(normalizeAddUserEmail(email))}`;

export function assertAddUserCompanyRole({ role, companyId }) {
  if (!ROLES.includes(role)) throw new Error("--role は SUPER_ADMIN / COMPANY_ADMIN / MANAGER / EMPLOYEE のいずれかです。");
  if (role === "SUPER_ADMIN" && companyId != null) throw new Error("全体管理者に会社（--company）は指定できません。");
  if (role !== "SUPER_ADMIN" && !companyId?.trim()) throw new Error("会社の役割には --company で会社を指定してください。");
}

/**
 * 同じファイル内の3文を Wrangler の local batch / remote import でまとめて実行する。
 * 会社は書込み時に検証し、新規に作った id の利用者だけへ資格情報と所属を結び付ける。
 */
export function buildAddUserSql(values) {
  assertAddUserCompanyRole(values);
  const { userId, accountId, name, role, companyId, employeeCode, department, passwordHash, now } = values;
  const email = normalizeAddUserEmail(values.email);
  const companyGuard = role === "SUPER_ADMIN" ? "1" :
    `EXISTS (SELECT 1 FROM companies WHERE id = ${q(companyId)} AND is_active = 1 AND is_template = 0)`;
  const statements = [
    `INSERT INTO users
      (id, name, email, email_verified, company_id, role, employee_code, department, must_change_password, is_active, created_at, updated_at)
     SELECT ${q(userId)}, ${q(name)}, ${q(email)}, 1, ${q(companyId)}, ${q(role)}, ${q(employeeCode)}, ${q(department)}, 1, 1, ${q(now)}, ${q(now)}
     WHERE ${companyGuard} AND NOT EXISTS (SELECT 1 FROM users WHERE ${sameEmail(email)});`,
    `INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
     SELECT ${q(accountId)}, id, 'credential', id, ${q(passwordHash)}, ${q(now)}, ${q(now)}
     FROM users WHERE id = ${q(userId)};`,
  ];
  if (role !== "SUPER_ADMIN") statements.push(
    `INSERT INTO company_memberships (id, user_id, company_id, role, employee_code, department, created_at, updated_at)
     SELECT ${q(`mem_${userId}`)}, id, company_id, role, employee_code, department, created_at, updated_at
     FROM users WHERE id = ${q(userId)};`,
  );
  return statements;
}

/** 発行結果の確認には秘密値を含めない。既存メールと無効会社を成功と表示しない。 */
export function buildAddUserOutcomeSql({ userId, email }) {
  return `SELECT CASE
    WHEN EXISTS (SELECT 1 FROM users WHERE id = ${q(userId)}) THEN 'created'
    WHEN EXISTS (SELECT 1 FROM users WHERE ${sameEmail(email)}) THEN 'exists'
    ELSE 'invalid_company' END AS outcome;`;
}
