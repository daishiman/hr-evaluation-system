import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Account } from "./support";

/** 画面→Server Action→ローカルD1を通す試験の前提。実操作は画面から行う。 */
export function improvementFixture() {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:8787");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("試験用DBはローカル専用です");
  const directory = join(process.env.E2E_PERSIST_TO ?? ".wrangler/state", "v3/d1/miniflare-D1DatabaseObject");
  const files = readdirSync(directory).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) throw new Error("試験用D1を一意に特定できません。E2E_PERSIST_TOでpreviewの保存先を指定してください");
  const db = new DatabaseSync(join(directory, files[0]));
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const id = `e2e_${randomUUID()}`;
  const now = Date.now();
  const company = db.prepare("SELECT id, name FROM companies WHERE slug = 'kyufu' AND is_active = 1").get() as { id: string; name: string } | undefined;
  const secondCompany = db.prepare("SELECT id, name FROM companies WHERE slug = 'sakura' AND is_active = 1").get() as { id: string; name: string } | undefined;
  const gradeTemplate = db.prepare("SELECT * FROM grades WHERE company_id = ? AND code = 'regular'").get(company?.id ?? "") as Record<string, string | number | null> | undefined;
  const grade = { id: `${id}_grade`, name: `E2E 等級 ${id.slice(-8)}` };
  const scheme = db.prepare("SELECT id FROM evaluation_schemes WHERE company_id = ? AND status = 'active' LIMIT 1").get(company?.id ?? "") as { id: string } | undefined;
  // 見本データのローカル専用パスワードのハッシュを使う。値はログにも成果物にも出さない。
  const credential = db.prepare("SELECT a.password FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.email = 'e1@kyufu.hyoka-demo.jp' AND a.provider_id = 'credential'").get() as { password: string } | undefined;
  if (!company || !secondCompany || !gradeTemplate || !scheme || !credential) { db.close(); throw new Error("ローカルの見本データが必要です"); }
  function insert(table: string, values: Record<string, string | number | null>) {
    const keys = Object.keys(values);
    db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
  }
  function user(kind: string, role: string, managerId: string | null = null) {
    const userId = `${id}_${kind}`;
    const name = `E2E ${kind} ${id.slice(-8)}`;
    const account: Account = { email: `${userId}@example.com`, password: "Hyoka2026!demo" };
    const gradeId = role === "EMPLOYEE" ? grade!.id : null;
    insert("users", { id: userId, name, email: account.email, email_verified: 1, role, company_id: company!.id, grade_id: gradeId, manager_id: managerId, is_active: 1, created_at: now, updated_at: now });
    insert("accounts", { id: `${userId}_account`, account_id: userId, provider_id: "credential", user_id: userId, password: credential!.password, created_at: now, updated_at: now });
    insert("company_memberships", { id: `${userId}_membership`, user_id: userId, company_id: company!.id, role, grade_id: gradeId, manager_id: managerId, created_at: now, updated_at: now });
    return { id: userId, name, account };
  }
  db.exec("BEGIN");
  try {
    insert("grades", { ...gradeTemplate, ...grade, code: `${id}_grade`, display_order: 90 });
    const manager = user("manager", "MANAGER");
    const admin = user("admin", "COMPANY_ADMIN");
    const employee = user("employee", "EMPLOYEE", manager.id);
    const unanswered = user("unanswered", "EMPLOYEE", manager.id);
    const cycleId = `${id}_cycle`, formId = `${id}_form`, evaluationId = `${id}_evaluation`;
    const emptyCompany = { id: `${id}_empty`, name: `E2E 未設定 ${id.slice(-8)}` };
    insert("companies", { ...emptyCompany, slug: `${id}_empty`, is_active: 1, is_template: 0, created_at: now, updated_at: now });
    const cycleName = `E2E 評価期間 ${id.slice(-8)}`;
    insert("evaluation_cycles", { id: cycleId, company_id: company.id, name: cycleName, period_start: new Date(now).toISOString().slice(0, 10), period_end: new Date(now + 30 * 86400000).toISOString().slice(0, 10), scheme_id: scheme.id, status: "open", created_at: now, updated_at: now });
    insert("forms", { id: formId, company_id: company.id, grade_id: grade.id, cycle_id: cycleId, title: `E2E 回答 ${id.slice(-8)}`, public_token: `${id}_token`, status: "published", created_at: now, updated_at: now });
    for (const [index, type] of ["single", "multi"].entries()) insert("form_questions", { id: `${id}_${type}`, company_id: company.id, form_id: formId, section: "free", question_type: type, title: type === "single" ? "今回の選択" : "複数の選択", required: 1, options_json: JSON.stringify([{ value: "a", label: "甲" }, { value: "b", label: "乙" }]), display_order: index + 1, created_at: now, updated_at: now });
    insert("evaluations", { id: evaluationId, company_id: company.id, cycle_id: cycleId, employee_id: employee.id, grade_id: grade.id, scheme_id: scheme.id, total_score: 83.5, max_score: 100, requirement_rate: 75, status: "draft", computed_at: now, created_at: now, updated_at: now });
    db.exec("COMMIT");
    return {
      db, company, secondCompany, emptyCompany, grade, manager, admin, employee, unanswered, cycleId, cycleName, formId, evaluationId,
      close() {
        db.exec("BEGIN");
        try {
          const userIds = [employee, unanswered, admin, manager].map((u) => u.id);
          const marks = userIds.map(() => "?").join(",");
          // 監査のactor外部キーは利用者削除へcascadeしない。試験の人・所属・等級だけを対象にする。
          db.prepare(`DELETE FROM constitution_events WHERE actor_id IN (${marks}) OR entity_id = ?
            OR (entity_type = 'membership' AND entity_id IN
              (SELECT id FROM company_memberships WHERE user_id IN (${marks})))`).run(...userIds, grade.id, ...userIds);
          db.prepare("DELETE FROM evaluation_cycles WHERE id = ?").run(cycleId);
          for (const u of [employee, unanswered, admin, manager]) db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
          db.prepare("DELETE FROM grades WHERE id = ?").run(grade.id);
          db.prepare("DELETE FROM companies WHERE id = ?").run(emptyCompany.id);
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        finally { db.close(); }
      },
    };
  } catch (error) { db.exec("ROLLBACK"); db.close(); throw error; }
}
