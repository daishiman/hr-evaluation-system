import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { IDS, seedCompany, seedMemberships } from "@/test-support/evaluation-fixture";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", async () => ({ ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")), getDb: mocked.getDb }));
import { buildResponsesCsv } from "@/lib/export";

/**
 * 回答一覧の CSV（buildResponsesCsv）。
 *
 * 「アンケートを作って配り、集まった回答を出力する」の最後の一歩。ここが壊れても画面には何も出ず、
 * 受け取った表計算で列がずれる・答えが空になる、という形で静かに間違う。
 * そのため、見出しの並び・提出状況の書き方・答えの値の出し方・CSV の形を、今の書き出しのとおりに固定する。
 *
 * 答えの行は、回答画面が保存するときと同じ形で入れる（src/components/QuestionField.tsx）。
 * 数値は value_number だけ、1つ選ぶ設問は点数と選んだ言葉、複数選ぶ設問は選んだ言葉を「、」でつないだ文と選んだ値の並び。
 * 取り込んだ回答は、どの形式でもセルに書かれた文をそのまま value_text に持つ（src/lib/import.ts）。
 *
 * 値はすべて架空（社員A など）。実在の社員名・評価値は使わない。
 */

const BOM = "\uFEFF";
const FIXED_HEADERS = ["タイムスタンプ", "氏名（回答者）", "社員番号", "事業所", "提出状況", "取り込み元"];
/** 設問の列。入れる順と表示順をわざと変えてある（列は表示順に並ぶ） */
const QUESTION_HEADERS = ["担当した件数", "研修の時間（時間, 概算）", "面談を行った", "取り組んだこと", "受けた研修"];
const NOTE = 'A社, B社と"合同"で\n2回開いた';

let t: TestDatabase;
beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: "other", name: "他社", slug: "other" });
  // email は CSV に出ない列。架空の識別子だけを入れる（メールアドレスの形にしない）
  const person = (id: string, name: string, employeeCode: string | null) => ({
    id,
    name,
    email: id,
    companyId: IDS.company,
    gradeId: IDS.gradeFrom,
    officeId: IDS.office,
    employeeCode,
  });
  await t.db.insert(s.users).values([
    person("usr_a", "社員A", "A-001"),
    person("usr_b", "社員B", "B-002"),
    person("usr_c", "社員C", null),
  ]);
  seedMemberships(t);
  // 社員A は別の会社にも所属する。その会社の社員番号を混ぜず、行も増やさないことを見る
  await t.db.insert(s.companyMemberships).values({ id: "mem_a_other", userId: "usr_a", companyId: "other", employeeCode: "他社の番号" });

  const options = (labels: [string, string, number | null][]) =>
    JSON.stringify(labels.map(([value, label, score]) => ({ value, label, score })));
  type QuestionExtra = { section?: string; required?: boolean; unit?: string; optionsJson?: string };
  const question = (id: string, title: string, questionType: string, displayOrder: number, extra: QuestionExtra = {}) => ({
    id,
    companyId: IDS.company,
    formId: IDS.form,
    section: "kpi",
    questionType,
    title,
    displayOrder,
    ...extra,
  });
  await t.db.insert(s.formQuestions).values([
    question("q_note", "取り組んだこと", "text", 4, { section: "free", required: false }),
    question("q_count", "担当した件数", "number", 1, { unit: "件" }),
    question("q_trainings", "受けた研修", "multi", 5, {
      section: "training",
      optionsJson: options([["a", "研修A", null], ["b", "研修B", null], ["c", "研修C", null]]),
    }),
    question("q_hours", "研修の時間（時間, 概算）", "number", 2, { unit: "時間" }),
    question("q_attend", "面談を行った", "single", 3, {
      section: "support",
      optionsJson: options([["yes", "はい", 1], ["no", "いいえ", 0]]),
    }),
  ]);

  // 同じ評価期間の前の版。その設問は列にせず、その回答は行にしない
  await t.db.insert(s.forms).values([
    { id: "frm_old", companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeFrom, title: "前の版", status: "closed", version: 2, publicToken: "tok_old" },
    { id: "frm_other", companyId: "other", cycleId: IDS.cycle, gradeId: IDS.gradeFrom, title: "他社", version: 3, publicToken: "tok_other" },
  ]);
  await t.db.insert(s.formQuestions).values([
    { id: "q_old", companyId: IDS.company, formId: "frm_old", section: "kpi", questionType: "text", title: "前の版だけの設問", displayOrder: 1 },
    { id: "q_other", companyId: "other", formId: "frm_other", section: "kpi", questionType: "text", title: "他社の設問", displayOrder: 1 },
  ]);

  const base = { companyId: IDS.company, formId: IDS.form, cycleId: IDS.cycle, gradeId: IDS.gradeFrom };
  await t.db.insert(s.formResponses).values([
    // 提出の遅いほうを先に入れる（並びは入れた順でなく提出日時で決まる）
    { ...base, id: "res_a", employeeId: "usr_a", officeId: null, status: "submitted", submittedAt: new Date("2026-09-20T23:30:00Z") },
    { ...base, id: "res_c", employeeId: "usr_c", officeId: IDS.office, status: "draft" },
    { ...base, id: "res_b", employeeId: "usr_b", officeId: IDS.office, importSource: "csv", status: "submitted", submittedAt: new Date("2026-09-10T01:02:00Z") },
    { ...base, id: "res_old", formId: "frm_old", employeeId: "usr_a", officeId: IDS.office, status: "submitted", submittedAt: new Date("2026-08-01T00:00:00Z") },
    { ...base, id: "res_other", companyId: "other", formId: "frm_other", employeeId: "usr_b", officeId: null, status: "submitted", submittedAt: new Date("2026-08-01T00:00:00Z") },
  ]);
  const answer = (responseId: string, questionId: string, v: { valueNumber?: number; valueText?: string; valueJson?: string }) => ({
    id: `fa_${responseId}_${questionId}`,
    companyId: responseId === "res_other" ? "other" : IDS.company,
    responseId,
    questionId,
    valueNumber: v.valueNumber ?? null,
    valueText: v.valueText ?? null,
    valueJson: v.valueJson ?? null,
  });
  await t.db.insert(s.formAnswers).values([
    // 社員A: 回答画面から提出した形
    answer("res_a", "q_count", { valueNumber: 0 }),
    answer("res_a", "q_hours", { valueNumber: 12.5 }),
    answer("res_a", "q_attend", { valueNumber: 1, valueText: "はい" }),
    answer("res_a", "q_note", { valueText: NOTE }),
    answer("res_a", "q_trainings", { valueText: "研修A、研修C", valueJson: JSON.stringify(["a", "c"]) }),
    // 社員B: CSV から取り込んだ形（セルの文を value_text に持つ）。答えていない設問がある
    answer("res_b", "q_count", { valueNumber: 7, valueText: "7" }),
    answer("res_b", "q_attend", { valueNumber: 0, valueText: "いいえ" }),
    // 社員C: 入力の途中（下書き）
    answer("res_c", "q_count", { valueNumber: 3 }),
    answer("res_old", "q_old", { valueText: "前の版の答え" }),
    answer("res_other", "q_other", { valueText: "他社の答え" }),
  ]);
});
afterEach(() => t.close());

async function exported() {
  const file = await buildResponsesCsv(IDS.company, IDS.form);
  const [header, ...rows] = parseCsv(file.csv);
  /** 氏名の列で1行を引く */
  const rowOf = (name: string) => rows.find((r) => r[1] === name);
  return { file, header, rows, rowOf };
}

describe("回答一覧の CSV（buildResponsesCsv）", () => {
  it("見出しは決まった6列のあとに、このアンケートの設問文を表示順に並べる（前の版の設問は列にしない）", async () => {
    const { header } = await exported();
    expect(header).toEqual([...FIXED_HEADERS, ...QUESTION_HEADERS]);
    expect(header).not.toContain("前の版だけの設問");
  });

  it("ファイル名は「回答一覧_評価期間_等級.csv」", async () => {
    const { file } = await exported();
    expect(file.filename).toBe("回答一覧_2026年度上期_等級２：Regular.csv");
  });

  it("回答した人ごとに1行。別の会社にも所属する人・前の版にも答えた人を重ねて数えない", async () => {
    const { rows } = await exported();
    expect(rows.map((r) => r[1]).sort()).toEqual(["社員A", "社員B", "社員C"]);
  });

  it("提出済みの行は提出の早い順に並べ、タイムスタンプは提出日時を日本時間の「年-月-日 時:分」で書く", async () => {
    const { rows, rowOf } = await exported();
    expect(rows.filter((r) => r[4] === "提出済み").map((r) => r[1])).toEqual(["社員B", "社員A"]);
    expect(rowOf("社員B")?.[0]).toBe("2026-09-10 10:02");
    // UTC では前の日。日本時間で日付が変わる
    expect(rowOf("社員A")?.[0]).toBe("2026-09-21 08:30");
  });

  it("下書きも1行として出す。提出状況は「下書き」、タイムスタンプは空、保存済みの答えはそのまま出す", async () => {
    const { rowOf } = await exported();
    expect(rowOf("社員C")).toEqual(["", "社員C", "", "第一事業所", "下書き", "", "3", "", "", "", ""]);
  });

  it("答えの値: 数値はそのまま（0 も空にしない）、1つ選ぶ設問は点数でなく選んだ言葉、複数選ぶ設問は選んだ言葉を「、」でつないだもの", async () => {
    const { rowOf } = await exported();
    expect(rowOf("社員A")?.slice(FIXED_HEADERS.length)).toEqual(["0", "12.5", "はい", NOTE, "研修A、研修C"]);
  });

  it("取り込んだ回答はセルの文を出し、答えていない設問は空にする", async () => {
    const { rowOf } = await exported();
    expect(rowOf("社員B")?.slice(FIXED_HEADERS.length)).toEqual(["7", "", "いいえ", "", ""]);
  });

  it("社員番号はこの会社の所属から読み、事業所は回答のときに写した事業所を書く。取り込み元は取り込んだ回答だけに書く", async () => {
    const { file, rowOf } = await exported();
    expect(rowOf("社員A")?.slice(0, FIXED_HEADERS.length)).toEqual(["2026-09-21 08:30", "社員A", "A-001", "", "提出済み", ""]);
    expect(rowOf("社員B")?.slice(0, FIXED_HEADERS.length)).toEqual(["2026-09-10 10:02", "社員B", "B-002", "第一事業所", "提出済み", "csv"]);
    expect(rowOf("社員C")?.[2]).toBe("");
    expect(file.csv).not.toContain("他社の番号");
    expect(file.csv).not.toContain("前の版の答え");
    expect(file.csv).not.toContain("他社の答え");
  });

  it("CSV の形: 先頭に BOM、行の区切りと末尾は CRLF", async () => {
    const { file } = await exported();
    expect(file.csv.startsWith(BOM)).toBe(true);
    expect(file.csv.endsWith("\r\n")).toBe(true);
    // 見出し1行 + 回答3行 + 末尾の CRLF のあとの空
    expect(file.csv.slice(BOM.length).split("\r\n")).toHaveLength(5);
  });

  it("カンマ・引用符・改行を含む値は引用符で囲み、中の引用符は2つ重ね、セルの中の改行は LF のまま残す", async () => {
    const { file, rowOf } = await exported();
    expect(file.csv).toContain('"A社, B社と""合同""で\n2回開いた"');
    // 見出しの設問文も同じ決まりで囲む
    expect(file.csv).toContain(',"研修の時間（時間, 概算）",');
    // 読み戻すと元の文に戻る
    expect(rowOf("社員A")?.[FIXED_HEADERS.length + 3]).toBe(NOTE);
  });

  it("式として動きうる答えは先頭に ' を付けて出し、数値の答えは負の数もそのまま出す（DD-032 の5）", async () => {
    const extra = { companyId: IDS.company, valueJson: null };
    await t.db.insert(s.formAnswers).values([
      { ...extra, id: "fa_res_b_q_note", responseId: "res_b", questionId: "q_note", valueNumber: null, valueText: "=1+1" },
      { ...extra, id: "fa_res_c_q_hours", responseId: "res_c", questionId: "q_hours", valueNumber: -1.5, valueText: null },
    ]);
    const { file, rowOf } = await exported();
    expect(file.csv).toContain(`"'=1+1"`);
    expect(rowOf("社員B")?.slice(FIXED_HEADERS.length)).toEqual(["7", "", "いいえ", "'=1+1", ""]);
    expect(rowOf("社員C")?.slice(FIXED_HEADERS.length, FIXED_HEADERS.length + 2)).toEqual(["3", "-1.5"]);
    expect(rowOf("社員A")?.slice(FIXED_HEADERS.length, FIXED_HEADERS.length + 2)).toEqual(["0", "12.5"]);
  });

  it("回答がまだ無いアンケートは、見出しの行だけを出す", async () => {
    await t.db.insert(s.forms).values({ id: "frm_empty", companyId: IDS.company, cycleId: IDS.cycle, gradeId: IDS.gradeTo, title: "回答なし", publicToken: "tok_empty" });
    await t.db.insert(s.formQuestions).values({ id: "q_empty", companyId: IDS.company, formId: "frm_empty", section: "free", questionType: "text", title: "ふりかえり", displayOrder: 1 });
    const file = await buildResponsesCsv(IDS.company, "frm_empty");
    expect(file).toEqual({
      filename: "回答一覧_2026年度上期_等級３：Chief.csv",
      csv: `${BOM}${[...FIXED_HEADERS, "ふりかえり"].join(",")}\r\n`,
    });
  });

  it("無いアンケート・別の会社のアンケートは、回答を1件も出さず、見つからなかったことだけを書く", async () => {
    const notFound = { filename: "回答一覧.csv", csv: `${BOM}結果\r\n対象のアンケートが見つかりませんでした\r\n` };
    expect(await buildResponsesCsv(IDS.company, "frm_missing")).toEqual(notFound);
    expect(await buildResponsesCsv(IDS.company, "frm_other")).toEqual(notFound);
  });
});
