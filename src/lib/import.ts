import { and, eq } from "drizzle-orm";
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

/** 突き合わせ用に文字を揃える。空白・記号・全角半角の違いを吸収する。 */
function normalizeKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[（）()［］\[\]【】「」､、,．.・:：;；|｜/／\\-ー―−]/g, "")
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
};

/**
 * CSVの中身を、指定したアンケートの回答として取り込む。
 * 同じ人の回答がすでにあれば上書きする（原本の取り込み元を `csv` として残す）。
 */
export async function importResponsesCsv(companyId: string, formId: string, csvText: string): Promise<ImportResult> {
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

  return { imported, skipped: rows.length - imported, unmatchedHeaders, rows };
}

/** 「2026/07/24 12:32:24」「2026-07-24 12:32」などを日時にする。読めなければ null。 */
function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim().replace(/\//g, "-").replace(" ", "T");
  const d = new Date(t.length === 16 ? `${t}:00+09:00` : `${t}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
