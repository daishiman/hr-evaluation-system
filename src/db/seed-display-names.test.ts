import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 初期データ（drizzle/seed.sql）の表示に使う文に、英語・カタカナの区分名が残っていないこと（S2・DD-008）。
 *
 * 画面は等級を会社の等級名だけで表す。seed が区分名入りの文（KPI 項目の注記・題名・説明など）を入れると、
 * 新しく作った環境や、テンプレートの会社から写した会社（src/lib/template.ts）の画面に区分名が出てしまう。
 * src の文字列は grade-label-static.test.ts が見ているので、ここではデータの側を、生成済みの SQL の実物で確かめる。
 *
 * 区分名のままでよい列は、照合に使うキーだけ（等級区分 point_group・対象等級 target_grades・code・id）。
 * 画面に出すときは src/lib/domain/grade-label.ts が等級名に直す。
 * 役割名の「マネージャー」（上長の役割）は区分名ではないので対象にしない（「マネージャーⅠ」のような区分の呼び名だけを拾う）。
 */

/** 区分名と、その略記（AM は前後が英字でないときだけ。TEAM などを拾わない） */
const LEGACY = new RegExp(
  [
    "Beginner",
    "Regular",
    "Chief",
    "Manager",
    "(^|[^A-Za-z])AM([^A-Za-z]|$)",
    "(^|[^A-Za-z])(Reg|Beg)([^A-Za-z]|$)",
    "ビギナー",
    "レギュラー",
    "チーフ",
    "マネージャー ?[ⅠⅡ]",
    // 昇格の段階の略記（B→R・MⅠ→MⅡ など）
    "(^|[^A-Za-z])[BRCM][ⅠⅡ]?→",
    "→ ?[BRCM][ⅠⅡ]?([^A-Za-z]|$)",
  ].join("|"),
);

/** 照合に使うキーの列。区分名のままでよい */
const KEY_COLUMN = /^(id|.*_id|code|point_group|target_grades)$/;
/** 認証の列。乱数から作るので、偶然に区分名と同じ並びを含むことがある */
const CREDENTIAL_COLUMN = /^(password|access_token|refresh_token|id_token|public_token)$/;

let t: TestDatabase;

beforeAll(() => {
  t = createTestDatabase();
  t.raw.exec(readFileSync(join(process.cwd(), "drizzle/seed.sql"), "utf8"));
});

afterAll(() => t.close());

function tables() {
  return (
    t.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
      .all() as { name: string }[]
  ).map((r) => r.name);
}

describe("初期データの表示名", () => {
  it("表示に使う列に、英語・カタカナの区分名が残っていない", () => {
    const found: string[] = [];
    let scanned = 0;
    for (const table of tables()) {
      for (const row of t.raw.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]) {
        for (const [column, v] of Object.entries(row)) {
          if (typeof v !== "string" || KEY_COLUMN.test(column) || CREDENTIAL_COLUMN.test(column)) continue;
          scanned += 1;
          if (LEGACY.test(v)) found.push(`${table}.${column}（${String(row.id ?? "")}）: ${v.slice(0, 60)}`);
        }
      }
    }
    // 空の seed を読んで通ってしまわないよう、実際に文を見たことも確かめる
    expect(scanned).toBeGreaterThan(1000);
    expect(found).toEqual([]);
  });

  it("等級名は既定の名前（等級1〜等級5-2）で、区分（point_group）は照合用のキーとして残る", () => {
    const grades = t.raw
      .prepare("SELECT DISTINCT code, name, point_group AS pointGroup FROM grades ORDER BY display_order, code")
      .all();
    expect(grades).toEqual([
      { code: "beginner", name: "等級1", pointGroup: "Beginner" },
      { code: "regular", name: "等級2", pointGroup: "Regular" },
      { code: "chief", name: "等級3", pointGroup: "Chief" },
      { code: "am1", name: "等級4-1", pointGroup: "AM" },
      { code: "am2", name: "等級4-2", pointGroup: "AM" },
      { code: "manager1", name: "等級5-1", pointGroup: "Manager" },
      { code: "manager2", name: "等級5-2", pointGroup: "Manager" },
    ]);
  });

  it("区分名の検査は、seed にあった文の形を拾える（検査そのものが空回りしていない）", () => {
    for (const legacy of [
      "Regular/Chief＝本人が報告した件数",
      "1人あたり必要回数：AM=3回（対象=Reg・Beg・Pt）",
      "スキルアップ研修（チーフ以上）",
      "マネージャーⅠ",
      "B→R",
      "AMⅠ→ AMⅡ",
    ]) {
      expect(LEGACY.test(legacy), legacy).toBe(true);
    }
    for (const allowed of ["給付事業（1社目） マネージャー", "TEAM向け", "等級4-1・等級4-2=3回（対象=等級2・等級1・Pt）", "等級1→等級2"]) {
      expect(LEGACY.test(allowed), allowed).toBe(false);
    }
  });
});
