import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkGradePointRule, expectedItemCount, pointsForSlot, type GradePointRule } from "./grade-points";
import { scoreFromRank, type RankRatio } from "./scoring";

/**
 * 「実際にDBへ入る配点の数値」が100点ちょうどに収まっているかの検算。
 *
 * grade-points.test.ts は手で書き写した型（RULES）を検算しているが、
 * 書き写した値が正しくても、**配布されるSQLの数値が違えば意味がない**。
 * そこで、既存会社へ配った移行SQL（0009）と初期データ（drizzle/seed.sql）の
 * 実物を読み、1行残らず検算する。ここを通れば「どの会社のどの等級区分でも、
 * 選び終われば必ず100点」と言い切れる。
 *
 * この2つ以外に grade_point_rules を書き込む経路が増えたら、ここに足すこと。
 */

const ROOT = process.cwd();

interface SeededRule extends GradePointRule {
  /** どのファイルの何行目か（落ちたときに探せるように） */
  where: string;
  companyId: string;
  displayOrder: number;
}

/** 移行SQL（0009）の INSERT ... SELECT 形式を読む */
function rulesFromMigration(): SeededRule[] {
  const file = join(ROOT, "drizzle", "migrations", "0009_grade_point_scheme.sql");
  const sql = readFileSync(file, "utf8");
  const re =
    /SELECT '(?:gpr_)' \|\| c\.`id` \|\| '_\w+', c\.`id`, '(\w+)', (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+),/g;
  const out: SeededRule[] = [];
  for (const m of sql.matchAll(re)) {
    const [, pointGroup, displayOrder, total, fixed, majorPoints, majorCount, minorPoints, minorCount] = m;
    out.push({
      where: "drizzle/migrations/0009_grade_point_scheme.sql",
      companyId: "（既存の全社）",
      pointGroup,
      displayOrder: Number(displayOrder),
      totalPoints: Number(total),
      fixedSlotPoints: Number(fixed),
      majorSlotPoints: Number(majorPoints),
      majorSlotCount: Number(majorCount),
      minorSlotPoints: Number(minorPoints),
      minorSlotCount: Number(minorCount),
    });
  }
  return out;
}

/** 初期データ（seed.sql）の VALUES 形式を読む */
function rulesFromSeed(): SeededRule[] {
  const file = join(ROOT, "drizzle", "seed.sql");
  const sql = readFileSync(file, "utf8");
  const re =
    /\('gpr_[^']*', '([^']*)', '(\w+)', (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+),/g;
  const out: SeededRule[] = [];
  for (const m of sql.matchAll(re)) {
    const [, companyId, pointGroup, displayOrder, total, fixed, majorPoints, majorCount, minorPoints, minorCount] = m;
    out.push({
      where: "drizzle/seed.sql",
      companyId,
      pointGroup,
      displayOrder: Number(displayOrder),
      totalPoints: Number(total),
      fixedSlotPoints: Number(fixed),
      majorSlotPoints: Number(majorPoints),
      majorSlotCount: Number(majorCount),
      minorSlotPoints: Number(minorPoints),
      minorSlotCount: Number(minorCount),
    });
  }
  return out;
}

const migration = rulesFromMigration();
const seed = rulesFromSeed();
const all = [...migration, ...seed];

describe("配布する配点の数値そのものの検算", () => {
  it("読み取り自体が空振りしていない（正規表現が合わなくなったら気づく）", () => {
    expect(migration.length).toBe(5);
    expect(seed.length).toBeGreaterThanOrEqual(5);
    expect(seed.length % 5, "会社ごとに5区分そろっていない").toBe(0);
  });

  it("どの会社のどの等級区分でも、配点の型が満点ちょうどになる", () => {
    for (const r of all) {
      expect(checkGradePointRule(r), `${r.where} / ${r.companyId} / ${r.pointGroup}`).toEqual([]);
    }
  });

  it("満点はどの等級区分でも100点（等級で満点が変わらない）", () => {
    for (const r of all) expect(r.totalPoints, `${r.where} / ${r.pointGroup}`).toBe(100);
  });

  it("5つの等級区分がそろっていて、重複が無い", () => {
    const byCompany = new Map<string, string[]>();
    for (const r of all) {
      const key = `${r.where}:${r.companyId}`;
      byCompany.set(key, [...(byCompany.get(key) ?? []), r.pointGroup]);
    }
    for (const [key, groups] of byCompany) {
      expect([...groups].sort(), key).toEqual(["AM", "Beginner", "Chief", "Manager", "Regular"]);
    }
  });

  it("選ぶ項目数は Beginner 1 / Regular 3 / Chief 6 / AM 7 / Manager 8 で全社そろう", () => {
    const expected: Record<string, number> = { Beginner: 1, Regular: 3, Chief: 6, AM: 7, Manager: 8 };
    for (const r of all) {
      expect(expectedItemCount(r), `${r.where} / ${r.companyId} / ${r.pointGroup}`).toBe(expected[r.pointGroup]);
    }
  });
});

/**
 * 配点は「型が100点」だけでは足りない。
 * 実際の採点は「配点 × ランクの割合」なので、割り切れない配点があると
 * 端数が出て、全項目Aでも100点にならない・確定した点数が説明できない、が起きる。
 */
describe("ランク割合を掛けたときの端数", () => {
  /** drizzle/seed.sql の初期値（A=100% / B=80% / C=60% / D=40% / E=0%） */
  const RATIOS: RankRatio[] = [
    { rank: "A", ratio: 1 },
    { rank: "B", ratio: 0.8 },
    { rank: "C", ratio: 0.6 },
    { rank: "D", ratio: 0.4 },
    { rank: "E", ratio: 0 },
  ];

  it("全項目がAなら、ちょうど満点（100点）になる", () => {
    for (const r of all) {
      const total =
        scoreFromRank("A", pointsForSlot(r, "fixed"), RATIOS) +
        scoreFromRank("A", pointsForSlot(r, "major"), RATIOS) * r.majorSlotCount +
        scoreFromRank("A", pointsForSlot(r, "minor"), RATIOS) * r.minorSlotCount;
      expect(total, `${r.where} / ${r.companyId} / ${r.pointGroup}`).toBe(100);
    }
  });

  it("どのランクでも1点未満の端数が出ない（説明できない点数を作らない）", () => {
    for (const r of all) {
      for (const kind of ["fixed", "major", "minor"] as const) {
        const weight = pointsForSlot(r, kind);
        if (weight === 0) continue; // その等級区分に無い枠
        for (const { rank } of RATIOS) {
          const points = scoreFromRank(rank, weight, RATIOS);
          expect(Number.isInteger(points), `${r.pointGroup} / ${kind} / ${rank} → ${points}点`).toBe(true);
        }
      }
    }
  });

  it("どのランクの組み合わせでも満点を超えない", () => {
    for (const r of all) {
      for (const { rank } of RATIOS) {
        const total =
          scoreFromRank(rank, pointsForSlot(r, "fixed"), RATIOS) +
          scoreFromRank(rank, pointsForSlot(r, "major"), RATIOS) * r.majorSlotCount +
          scoreFromRank(rank, pointsForSlot(r, "minor"), RATIOS) * r.minorSlotCount;
        expect(total, `${r.pointGroup} / 全項目${rank}`).toBeLessThanOrEqual(r.totalPoints);
      }
    }
  });
});
