import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, insertMany, schema as s } from "@/lib/db";
import { newId } from "@/lib/id";
import { parseCsv } from "@/lib/csv";
import { HttpError } from "@/lib/session";

/**
 * スプレッドシート（Googleフォームの回答一覧）からの一括取り込み。
 *
 * 1行が1人の回答。列の見出しを設問文と突き合わせて、どの設問への答えかを決める。
 * 見出しの表記ゆれ（全角空白・記号違い）で外れないよう、突き合わせ前に文字を揃える。
 *
 * 取り込めなかった行は捨てず、理由つきで返す（全部を止めずに、揃った分だけ取り込む）。
 */

/**
 * 突き合わせ用に文字を揃える。空白・記号・全角半角の違いを吸収する。
 *
 * ハイフンは必ず文字クラスの最後に置く（途中に置くと「\ から ー まで」の範囲指定と
 * 解釈され、カタカナや英数字ごと消えてしまう。実際に「メールアドレス」が空文字になった）。
 */
export function normalizeKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[（）()［］[\]【】「」､、,．.・:：;；|｜/／\\ー―−-]/g, "")
    .toLowerCase();
}

/** 「1,200」「１２」などを数値にする。数値でなければ null。 */
function toNumber(raw: string): number | null {
  const t = raw.normalize("NFKC").replace(/[,\s円件人日点%％]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const YES = ["はい", "○", "◯", "実施済み", "基準を満たす", "達成", "true", "1", "yes"];
const NO = ["いいえ", "×", "✕", "未実施", "基準を満たさない", "未達", "false", "0", "no"];

export type ImportRowResult = {
  row: number;
  name: string;
  status: "取り込み" | "スキップ";
  reason?: string;
  answered?: number;
  /** 値の意味が読み取れず、点数に反映できなかった設問（文字はそのまま保存してある） */
  unreadable?: string[];
};

export type ImportResult = {
  imported: number;
  skipped: number;
  unmatchedHeaders: string[];
  rows: ImportRowResult[];
  /** true のときは何も保存していない（確認だけ） */
  dryRun?: boolean;
};

/**
 * CSVの中身を、指定したアンケートの回答として取り込む。
 * 同じ人の回答がすでにあれば上書きする（原本の取り込み元を `csv` として残す）。
 *
 * `dryRun` を true にすると、同じ検査をしたうえで保存だけを行わない。
 * 取り込む前に「何行目の何が読めないか」を確認するために使う。
 */
export async function importResponsesCsv(
  companyId: string,
  formId: string,
  csvText: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const dryRun = options.dryRun === true;
  const db = await getDb();

  const form = (
    await db
      .select()
      .from(s.forms)
      .where(and(eq(s.forms.companyId, companyId), eq(s.forms.id, formId)))
      .limit(1)
  )[0];
  if (!form) throw new HttpError(404, "取り込み先のアンケートが見つかりませんでした。");

  const table = parseCsv(csvText);
  if (table.length < 2) throw new HttpError(400, "見出し行と回答行が読み取れませんでした。1行目に設問名、2行目以降に回答を入れてください。");

  const header = table[0];
  const questions = await db
    .select()
    .from(s.formQuestions)
    .where(and(eq(s.formQuestions.companyId, companyId), eq(s.formQuestions.formId, formId)));

  // 設問文 → 設問 の対応表（表記ゆれを吸収したキーで引く）
  const byKey = new Map(questions.map((q) => [normalizeKey(q.title), q]));

  const NAME_KEYS = ["氏名回答者", "氏名", "回答者", "名前", "社員名"];
  const CODE_KEYS = ["社員番号", "職員番号", "ユーザーキー", "社員コード"];
  const TIME_KEYS = ["タイムスタンプ", "回答日時", "送信日時"];
  // このシステムが書き出した回答一覧をそのまま取り込めるよう、
  // 設問ではない付帯情報の列は「読めなかった列」に数えず黙って読み飛ばす。
  const META_KEYS = ["事業所", "提出状況", "取り込み元", "メールアドレス", "所属", "部署"].map(normalizeKey);

  let nameCol = -1;
  let codeCol = -1;
  let timeCol = -1;
  const questionCols: { col: number; q: (typeof questions)[number] }[] = [];
  const unmatchedHeaders: string[] = [];

  header.forEach((raw, col) => {
    const key = normalizeKey(raw);
    if (key === "") return;
    if (nameCol < 0 && NAME_KEYS.map(normalizeKey).includes(key)) return void (nameCol = col);
    if (codeCol < 0 && CODE_KEYS.map(normalizeKey).includes(key)) return void (codeCol = col);
    if (timeCol < 0 && TIME_KEYS.map(normalizeKey).includes(key)) return void (timeCol = col);
    if (META_KEYS.includes(key)) return;
    const q = byKey.get(key);
    if (q) questionCols.push({ col, q });
    else unmatchedHeaders.push(raw);
  });

  if (nameCol < 0 && codeCol < 0) {
    throw new HttpError(400, "「氏名」または「社員番号」の列が見つかりませんでした。見出し行をご確認ください。");
  }
  if (questionCols.length === 0) {
    throw new HttpError(400, "設問に対応する列が1つも見つかりませんでした。このアンケートの回答一覧かご確認ください。");
  }

  // 突き合わせ先の利用者（この会社・この等級）
  const members = await db
    .select({ id: s.users.id, name: s.users.name, employeeCode: s.users.employeeCode, officeId: s.users.officeId, gradeId: s.users.gradeId, isActive: s.users.isActive })
    .from(s.users)
    .where(eq(s.users.companyId, companyId));

  const rows: ImportRowResult[] = [];
  let imported = 0;

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    const name = (nameCol >= 0 ? line[nameCol] : "")?.trim() ?? "";
    const code = (codeCol >= 0 ? line[codeCol] : "")?.trim() ?? "";

    const person =
      (code ? members.find((m) => (m.employeeCode ?? "").trim() === code) : undefined) ??
      (name ? members.find((m) => m.name.replace(/[\s　]/g, "") === name.replace(/[\s　]/g, "")) : undefined);

    if (!person) {
      rows.push({ row: r + 1, name: name || code, status: "スキップ", reason: "この会社に同じ氏名・社員番号の方が登録されていません" });
      continue;
    }
    if (!person.isActive) {
      rows.push({ row: r + 1, name: person.name, status: "スキップ", reason: "利用停止中の方です" });
      continue;
    }
    if (person.gradeId !== form.gradeId) {
      rows.push({ row: r + 1, name: person.name, status: "スキップ", reason: "この方の等級は、このアンケートの対象等級と違います" });
      continue;
    }

    // 値を設問の形式に合わせて変換する
    const answers: { questionId: string; valueNumber: number | null; valueText: string | null }[] = [];
    const unreadable: string[] = [];
    for (const { col, q } of questionCols) {
      const raw = (line[col] ?? "").trim();
      if (raw === "") continue;
      let valueNumber: number | null = null;
      const norm = normalizeKey(raw);
      if (q.questionType === "yesno") {
        if (YES.map(normalizeKey).includes(norm)) valueNumber = 1;
        else if (NO.map(normalizeKey).includes(norm)) valueNumber = 0;
      } else if (q.questionType === "single" && q.optionsJson) {
        const opts = JSON.parse(q.optionsJson) as { value: string; label: string; score?: number }[];
        const hit = opts.find((o) => normalizeKey(o.label) === norm || normalizeKey(o.value) === norm);
        if (hit) valueNumber = hit.score ?? Number(hit.value);
      } else {
        valueNumber = toNumber(raw);
      }
      // 意味が取れなかった値は、書かれた文字をそのまま残したうえで画面に報告する
      // （黙って0点として集計すると、原因の分からない低評価になるため）
      if (valueNumber === null && q.questionType !== "text") unreadable.push(q.title);
      answers.push({ questionId: q.id, valueNumber, valueText: raw });
    }

    const existing = (
      await db
        .select({ id: s.formResponses.id })
        .from(s.formResponses)
        .where(and(eq(s.formResponses.formId, formId), eq(s.formResponses.employeeId, person.id)))
        .limit(1)
    )[0];

    const submittedAt = timeCol >= 0 ? parseTimestamp(line[timeCol]) : null;
    const responseId = existing?.id ?? newId("res");

    if (dryRun) {
      imported++;
      rows.push({
        row: r + 1,
        name: person.name,
        status: "取り込み",
        reason: existing ? "すでにある回答を置き換えます" : undefined,
        answered: answers.length,
        unreadable: unreadable.length > 0 ? unreadable : undefined,
      });
      continue;
    }

    if (existing) {
      await db
        .update(s.formResponses)
        .set({ status: "submitted", submittedAt: submittedAt ?? new Date(), importSource: "csv", officeId: person.officeId ?? null })
        .where(eq(s.formResponses.id, responseId));
      await db.delete(s.formAnswers).where(eq(s.formAnswers.responseId, responseId));
    } else {
      await db.insert(s.formResponses).values({
        id: responseId,
        companyId,
        formId,
        cycleId: form.cycleId,
        employeeId: person.id,
        gradeId: form.gradeId,
        officeId: person.officeId ?? null,
        importSource: "csv",
        status: "submitted",
        submittedAt: submittedAt ?? new Date(),
      });
    }

    await insertMany(
      (vals) => db.insert(s.formAnswers).values(vals),
      answers.map((a) => ({ id: newId("fa"), companyId, responseId, questionId: a.questionId, valueNumber: a.valueNumber, valueText: a.valueText })),
    );

    imported++;
    rows.push({
      row: r + 1,
      name: person.name,
      status: "取り込み",
      answered: answers.length,
      unreadable: unreadable.length > 0 ? unreadable : undefined,
    });
  }

  return { imported, skipped: rows.length - imported, unmatchedHeaders, rows, dryRun };
}

/** 「2026/07/24 12:32:24」「2026-07-24 12:32」などを日時にする。読めなければ null。 */
function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim().replace(/\//g, "-").replace(" ", "T");
  const d = new Date(t.length === 16 ? `${t}:00+09:00` : `${t}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  options: { dryRun?: boolean; initialPassword?: string } = {},
): Promise<MemberImportResult> {
  const dryRun = options.dryRun === true;
  const initialPassword = (options.initialPassword ?? "").trim();
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

    if (!existing && initialPassword === "") {
      fail("新しく登録する方です。最初のパスワードを入力してから取り込んでください");
      continue;
    }

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
    return { id: null, error: `上長「${raw}」が見つかりません（この会社の社員か、このファイルの中の方を指定してください）` };
  };

  const managerPlan = new Map<number, { id: string | null; error?: string }>();
  for (const p of plans) managerPlan.set(p.row, resolveManager(p.managerRaw));

  let created = 0;
  let updated = 0;
  const newIdByRow = new Map<number, string>();

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
      newIdByRow.set(p.row, userId);
      await db.insert(s.users).values({
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
      });
      await db.insert(s.accounts).values({
        id: newId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(initialPassword),
      });
      created++;
      results.push({ row: p.row, name: p.name, email: p.email, status: "新規作成", reason: "最初のパスワードをご本人にお伝えください" });
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
  return { created, updated, failed, unmatchedHeaders, rows: results, dryRun };
}
