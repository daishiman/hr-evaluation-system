import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/test-support/source-code";

/*
 * 会社ごとの値を users から直接読まない（S7・A6・D-004）。
 *
 * 1人が複数の会社に所属するので、役割・等級・事業所・上司・社員番号・部署・入社日・人物メモと
 * 会社そのもの（companyId）は、所属の表（company_memberships）を会社の条件付きで結合して読む。
 * users に残る同じ列は「元の所属（一番古い有効な所属）」の写しで、読むのは許可リストの中だけ。
 *  - src/lib/memberships.ts: 写しを書き、所属の選び方と全体管理者の見分けを持つ
 *  - src/lib/session.ts: 全体管理者かを見る1か所（全体管理者は所属を持たない）
 * 所属から grades・offices を結合するときは、会社の条件（grades.companyId = 所属の会社）を付ける。
 * 付けないと、所属の等級 id が他社の等級を指したときに他社の等級名が出る。
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const rel = (p: string) => path.relative(ROOT, p);

const PER_COMPANY = [
  "companyId",
  "role",
  "gradeId",
  "officeId",
  "managerId",
  "employeeCode",
  "department",
  "hiredAt",
  "profileNote",
] as const;
const PER_COMPANY_SQL = [
  "company_id",
  "role",
  "grade_id",
  "office_id",
  "manager_id",
  "employee_code",
  "department",
  "hired_at",
  "profile_note",
] as const;

/** 許可リスト。ファイルごとに、読んでよい箇所の数と理由 */
const ALLOWED: Record<string, { max: number; reason: string }> = {
  "src/lib/memberships.ts": { max: Number.POSITIVE_INFINITY, reason: "元の所属の写しを書き、所属を選ぶ本体" },
  "src/lib/session.ts": { max: 1, reason: "全体管理者か（所属を持たない）を見る1か所" },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes(`${path.sep}test-support${path.sep}`))
      out.push(p);
  }
  return out;
}

const files = walk(SRC);
// role・department は camelCase と snake_case で同じ字面なので、1か所を2回数えないよう名前を1つにまとめる
const columnNames = [...new Set<string>([...PER_COMPANY, ...PER_COMPANY_SQL])];
const perCompanyRead = new RegExp(`\\busers\\.(${columnNames.join("|")})\\b`, "g");

function directReads(file: string): string[] {
  const code = stripComments(readFileSync(file, "utf8"));
  return [...code.matchAll(perCompanyRead)].map((m) => {
    const line = code.slice(0, m.index).split("\n").length;
    return `${rel(file)}:${line} ${m[0]}`;
  });
}

/** `.leftJoin(s.grades, …)` などの、結合の条件（2つ目の引数）を括弧の対応で切り出す */
function joins(code: string, table: "grades" | "offices"): string[] {
  const out: string[] = [];
  const re = new RegExp(`Join\\(\\s*(?:s\\.)?${table}\\s*,`, "g");
  for (const m of code.matchAll(re)) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") depth--;
    }
    out.push(code.slice(start, i - 1));
  }
  return out;
}

describe("会社ごとの列を users から直接読まない", () => {
  it("所属の表と所属の読み方の本体がある", () => {
    expect(existsSync(path.join(SRC, "lib/memberships.ts"))).toBe(true);
    const schema = readFileSync(path.join(SRC, "db/schema.ts"), "utf8");
    expect(schema).toMatch(/sqliteTable\(\s*"company_memberships"/);
    const lib = stripComments(readFileSync(path.join(SRC, "lib/memberships.ts"), "utf8"));
    for (const name of ["memberColumns", "joinMembership", "activeMembershipFor", "writeMembership"]) {
      expect(lib, `memberships.ts に ${name} が無い`).toMatch(new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${name}\\b`));
    }
  });

  it("許可リストの外で users.<会社ごとの列> を読む箇所が0件", () => {
    const outside = files.filter((f) => !(rel(f) in ALLOWED)).flatMap(directReads);
    expect(outside).toEqual([]);
  });

  it("許可リストの中でも、決めた数より多く読まない", () => {
    for (const [file, { max, reason }] of Object.entries(ALLOWED)) {
      const full = path.join(ROOT, file);
      if (!existsSync(full) || max === Number.POSITIVE_INFINITY) continue;
      expect(directReads(full).length, `${file}（${reason}）`).toBeLessThanOrEqual(max);
    }
  });

  it("所属から grades・offices を結合するときは、会社の条件を付ける", () => {
    const missing: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const table of ["grades", "offices"] as const) {
        for (const cond of joins(code, table)) {
          const fromMembership = /companyMemberships\.|membership/i.test(cond);
          if (fromMembership && !new RegExp(`${table}\\.companyId`).test(cond)) {
            missing.push(`${rel(file)}: Join(${table}, ${cond.replace(/\s+/g, " ").slice(0, 120)})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("users の gradeId・officeId から grades・offices を結合しない（所属の値を使う）", () => {
    const viaUsers: string[] = [];
    for (const file of files.filter((f) => !(rel(f) in ALLOWED))) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const table of ["grades", "offices"] as const) {
        for (const cond of joins(code, table)) {
          if (/users\.(gradeId|officeId)/.test(cond)) viaUsers.push(`${rel(file)}: Join(${table}, …${cond.slice(0, 80)})`);
        }
      }
    }
    expect(viaUsers).toEqual([]);
  });
});
