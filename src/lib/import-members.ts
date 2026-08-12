import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { parseCsv } from "@/lib/csv";
import { HttpError } from "@/lib/session";
import { generateUniqueInitialPassword, type IssuedMemberCredential } from "@/lib/domain/initial-password";
import { normalizeKey } from "@/lib/csv-normalize";

/* ───────────────── 社員一覧の取り込み ───────────────── */

export type MemberRowResult = {
  row: number;
  name: string;
  email: string;
  status: "新規作成" | "更新" | "エラー";
  /** エラーの理由、または更新内容の補足 */
  reason?: string;
};

export type MemberImportResult = {
  created: number;
  updated: number;
  failed: number;
  unmatchedHeaders: string[];
  rows: MemberRowResult[];
  /** 今回新規作成した人に一度だけ渡す資格情報。dry-run と既存利用者には返さない。 */
  credentials: IssuedMemberCredential[];
  dryRun?: boolean;
};

/** 見出しの表記ゆれを吸収して列番号を引くための対応表 */
const MEMBER_COLUMNS = {
  name: ["氏名", "名前", "社員名", "職員名"],
  email: ["メールアドレス", "メール", "email", "ログインid"],
  employeeCode: ["社員番号", "職員番号", "社員コード", "ユーザーキー"],
  role: ["役割", "権限", "ロール"],
  grade: ["等級", "グレード"],
  office: ["事業所", "所属事業所", "拠点"],
  department: ["所属", "部署", "部門"],
  manager: ["上長", "上司", "評価者"],
  hiredAt: ["入社日", "入職日"],
  active: ["利用状態", "在籍状況", "状態"],
} as const;

/** 役割の言い方のゆれ。キーも `normalizeKey` を通しておく（「マネージャー」の長音などを揃えるため） */
const ROLE_WORDS = new Map<string, "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE">(
  (
    [
      [["会社管理者", "管理者", "companyadmin", "admin"], "COMPANY_ADMIN"],
      [["マネージャー", "管理職", "上長", "manager"], "MANAGER"],
      [["社員", "一般", "職員", "employee"], "EMPLOYEE"],
    ] as const
  ).flatMap(([words, role]) => words.map((w) => [normalizeKey(w), role] as const)),
);

/** 「2026-04-01」「2026/4/1」を ISO の日付にする。読めなければ null。 */
function toIsoDate(raw: string): string | null {
  const t = raw.normalize("NFKC").trim().replace(/[./]/g, "-");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * 社員一覧のCSVをまとめて取り込む。
 *
 * メールアドレスが同じ人はすでにいる人として扱い、等級・上長・所属などを更新する。
 * いない人は新しくアカウントを作る（そのときだけ最初のパスワードが要る）。
 *
 * 1行でも不備があれば、その行だけを理由つきで止めて、揃っている行は取り込む。
 * `dryRun` を true にすると、同じ検査をしたうえで保存だけを行わない（取り込み前の確認用）。
 */
export async function importMembersCsv(
  companyId: string,
  csvText: string,
  options: { dryRun?: boolean } = {},
): Promise<MemberImportResult> {
  const dryRun = options.dryRun === true;
  const db = await getDb();

  const table = parseCsv(csvText);
  if (table.length < 2) {
    throw new HttpError(400, "見出し行と社員の行が読み取れませんでした。1行目に「氏名」「メールアドレス」などの見出しを入れてください。");
  }

  const header = table[0];
  const col: Record<keyof typeof MEMBER_COLUMNS, number> = {
    name: -1, email: -1, employeeCode: -1, role: -1, grade: -1,
    office: -1, department: -1, manager: -1, hiredAt: -1, active: -1,
  };
  const unmatchedHeaders: string[] = [];
  header.forEach((raw, i) => {
    const key = normalizeKey(raw);
    if (key === "") return;
    const hit = (Object.keys(MEMBER_COLUMNS) as (keyof typeof MEMBER_COLUMNS)[]).find(
      (k) => col[k] < 0 && (MEMBER_COLUMNS[k] as readonly string[]).map(normalizeKey).includes(key),
    );
    if (hit) col[hit] = i;
    else unmatchedHeaders.push(raw);
  });

  if (col.name < 0 || col.email < 0) {
    throw new HttpError(400, "「氏名」と「メールアドレス」の列が必要です。見出し行をご確認ください。");
  }

  const [grades, offices, existingUsers] = await Promise.all([
    db.select({ id: s.grades.id, name: s.grades.name, code: s.grades.code }).from(s.grades).where(eq(s.grades.companyId, companyId)),
    db.select({ id: s.offices.id, name: s.offices.name }).from(s.offices).where(eq(s.offices.companyId, companyId)),
    db.select({ id: s.users.id, name: s.users.name, email: s.users.email, companyId: s.users.companyId, employeeCode: s.users.employeeCode })
      .from(s.users),
  ]);

  const gradeByKey = new Map<string, string>();
  for (const g of grades) {
    gradeByKey.set(normalizeKey(g.name), g.id);
    if (g.code) gradeByKey.set(normalizeKey(g.code), g.id);
  }
  const officeByKey = new Map(offices.map((o) => [normalizeKey(o.name), o.id]));
  const userByEmail = new Map(existingUsers.map((u) => [u.email.trim().toLowerCase(), u]));

  type Plan = {
    row: number;
    name: string;
    email: string;
    employeeCode: string | null;
    role: "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE" | null;
    gradeId: string | null;
    officeId: string | null;
    department: string | null;
    hiredAt: string | null;
    isActive: boolean | null;
    managerRaw: string;
    existingId: string | null;
  };

  const plans: Plan[] = [];
  const results: MemberRowResult[] = [];
  const seenEmail = new Map<string, number>();
  const seenCode = new Map<string, number>();

  const at = (line: string[], c: number) => (c >= 0 ? (line[c] ?? "").trim() : "");

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    const rowNo = r + 1;
    const name = at(line, col.name);
    const email = at(line, col.email).toLowerCase();
    const fail = (reason: string) => results.push({ row: rowNo, name, email, status: "エラー", reason });

    if (name === "" && email === "") continue;
    if (name === "") { fail("氏名が空欄です"); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail(`メールアドレスの形式を確認してください（${email || "空欄"}）`); continue; }
    if (seenEmail.has(email)) { fail(`同じメールアドレスがこのファイルの${seenEmail.get(email)}行目にもあります`); continue; }
    seenEmail.set(email, rowNo);

    const existing = userByEmail.get(email);
    if (existing && existing.companyId !== companyId) { fail("このメールアドレスは他社で使われています"); continue; }

    const employeeCode = at(line, col.employeeCode) || null;
    if (employeeCode) {
      if (seenCode.has(employeeCode)) { fail(`同じ社員番号がこのファイルの${seenCode.get(employeeCode)}行目にもあります`); continue; }
      const clash = existingUsers.find(
        (u) => u.companyId === companyId && (u.employeeCode ?? "") === employeeCode && u.id !== existing?.id,
      );
      if (clash) { fail(`社員番号「${employeeCode}」はすでに${clash.name}さんが使っています`); continue; }
      seenCode.set(employeeCode, rowNo);
    }

    const roleRaw = at(line, col.role);
    const role = roleRaw === "" ? null : (ROLE_WORDS.get(normalizeKey(roleRaw)) ?? null);
    if (roleRaw !== "" && role === null) { fail(`役割「${roleRaw}」が分かりません（会社管理者／マネージャー／社員 のいずれか）`); continue; }

    const gradeRaw = at(line, col.grade);
    const gradeId = gradeRaw === "" ? null : (gradeByKey.get(normalizeKey(gradeRaw)) ?? null);
    if (gradeRaw !== "" && gradeId === null) { fail(`等級「${gradeRaw}」がこの会社に登録されていません`); continue; }

    const officeRaw = at(line, col.office);
    const officeId = officeRaw === "" ? null : (officeByKey.get(normalizeKey(officeRaw)) ?? null);
    if (officeRaw !== "" && officeId === null) { fail(`事業所「${officeRaw}」がこの会社に登録されていません`); continue; }

    const hiredRaw = at(line, col.hiredAt);
    const hiredAt = hiredRaw === "" ? null : toIsoDate(hiredRaw);
    if (hiredRaw !== "" && hiredAt === null) { fail(`入社日「${hiredRaw}」が日付として読めません（例：2026-04-01）`); continue; }

    const activeRaw = normalizeKey(at(line, col.active));
    const isActive = activeRaw === "" ? null : !["利用停止", "停止", "退職", "無効", "false", "0"].map(normalizeKey).includes(activeRaw);

    plans.push({
      row: rowNo, name, email, employeeCode, role, gradeId, officeId,
      department: at(line, col.department) || null,
      hiredAt, isActive,
      managerRaw: at(line, col.manager),
      existingId: existing?.id ?? null,
    });
  }

  // 上長は、すでに登録されている人でも、このファイルの中の人でも指定できるようにする
  const resolveManager = (raw: string): { id: string | null; error?: string } => {
    if (raw === "") return { id: null };
    const key = normalizeKey(raw);
    const inFile = plans.find(
      (p) => normalizeKey(p.name) === key || p.email === raw.toLowerCase() || normalizeKey(p.employeeCode ?? "") === key,
    );
    if (inFile) return { id: inFile.existingId ?? `row:${inFile.row}` };
    const inDb = existingUsers.find(
      (u) => u.companyId === companyId && (normalizeKey(u.name) === key || u.email === raw.toLowerCase() || normalizeKey(u.employeeCode ?? "") === key),
    );
    if (inDb) return { id: inDb.id };
    return { id: null, error: `上長「${raw}」が見つかりません。この会社の社員か、このファイルの中の方を指定してください` };
  };

  const managerPlan = new Map<number, { id: string | null; error?: string }>();
  for (const p of plans) managerPlan.set(p.row, resolveManager(p.managerRaw));

  let created = 0;
  let updated = 0;
  const newIdByRow = new Map<number, string>();
  const issuedPasswords = new Set<string>();
  const credentials: IssuedMemberCredential[] = [];

  for (const p of plans) {
    const mp = managerPlan.get(p.row)!;
    if (mp.error) {
      results.push({ row: p.row, name: p.name, email: p.email, status: "エラー", reason: mp.error });
      continue;
    }
    if (dryRun) {
      if (p.existingId) {
        updated++;
        results.push({ row: p.row, name: p.name, email: p.email, status: "更新", reason: "すでにいる方の情報を更新します" });
      } else {
        created++;
        results.push({ row: p.row, name: p.name, email: p.email, status: "新規作成", reason: "新しくアカウントを作ります" });
      }
      continue;
    }
    if (p.existingId) {
      newIdByRow.set(p.row, p.existingId);
    } else {
      const userId = crypto.randomUUID();
      const initialPassword = generateUniqueInitialPassword(issuedPasswords);
      newIdByRow.set(p.row, userId);
      await db.batch([
        db.insert(s.users).values({
          id: userId,
          name: p.name,
          email: p.email,
          emailVerified: true,
          companyId,
          role: p.role ?? "EMPLOYEE",
          gradeId: p.gradeId,
          officeId: p.officeId,
          employeeCode: p.employeeCode,
          department: p.department,
          hiredAt: p.hiredAt,
          isActive: p.isActive ?? true,
          mustChangePassword: true,
        }),
        db.insert(s.accounts).values({
          id: newId("acc"),
          accountId: userId,
          providerId: "credential",
          userId,
          password: await hashPassword(initialPassword),
        }),
      ]);
      issuedPasswords.add(initialPassword);
      credentials.push({ row: p.row, name: p.name, email: p.email, initialPassword });
      created++;
      results.push({ row: p.row, name: p.name, email: p.email, status: "新規作成", reason: "下の仮パスワード一覧をご本人にお伝えください" });
    }
  }

  if (!dryRun) {
    // 上長は全員を登録し終えてから設定する（ファイル内の上長も指せるようにするため）
    for (const p of plans) {
      const mp = managerPlan.get(p.row);
      if (!mp || mp.error) continue;
      const selfId = newIdByRow.get(p.row);
      if (!selfId) continue;
      const managerId = mp.id?.startsWith("row:")
        ? (newIdByRow.get(Number(mp.id.slice(4))) ?? null)
        : mp.id;

      const patch: Record<string, unknown> = { managerId: managerId === selfId ? null : managerId };
      if (p.existingId) {
        patch.name = p.name;
        if (p.role !== null) patch.role = p.role;
        if (p.gradeId !== null) patch.gradeId = p.gradeId;
        if (p.officeId !== null) patch.officeId = p.officeId;
        if (p.employeeCode !== null) patch.employeeCode = p.employeeCode;
        if (p.department !== null) patch.department = p.department;
        if (p.hiredAt !== null) patch.hiredAt = p.hiredAt;
        if (p.isActive !== null) patch.isActive = p.isActive;
      }
      await db.update(s.users).set(patch).where(eq(s.users.id, selfId));

      if (p.existingId) {
        updated++;
        results.push({ row: p.row, name: p.name, email: p.email, status: "更新", reason: "登録済みの方の情報を更新しました" });
      }
    }
  }

  results.sort((a, b) => a.row - b.row);
  const failed = results.filter((x) => x.status === "エラー").length;
  return { created, updated, failed, unmatchedHeaders, rows: results, credentials, dryRun };
}
