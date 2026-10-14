import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

/**
 * 初期データ（drizzle/seed.sql）が、今の移行で作った表にそのまま入り、所属（S7・D-004）がそろっていること。
 *
 * 所属の表は会社ごとの値の正本なので、seed が所属を作らないと、ログインはできても誰も会社の画面に出ない。
 * 生成済みの SQL の実物を、本番と同じ移行を流した表へ入れて確かめる（scripts/seed.mjs で作り直したら、ここも通す）。
 */

let t: TestDatabase;
const rows = (sql: string) => t.raw.prepare(sql).all() as Record<string, unknown>[];

beforeAll(() => {
  t = createTestDatabase();
  t.raw.exec(readFileSync(join(process.cwd(), "drizzle/seed.sql"), "utf8"));
});

afterAll(() => t.close());

describe("初期データの所属", () => {
  it("会社に属する利用者は全員、元の会社の所属を1件ずつ持ち、値は users の写しと同じ", () => {
    const missing = rows(`
      SELECT u.id FROM users u
      LEFT JOIN company_memberships m ON m.id = 'mem_' || u.id
      WHERE u.company_id IS NOT NULL AND u.role <> 'SUPER_ADMIN'
        AND (m.id IS NULL OR m.company_id <> u.company_id OR m.role <> u.role
          OR m.grade_id IS NOT u.grade_id OR m.office_id IS NOT u.office_id OR m.manager_id IS NOT u.manager_id)
    `);
    expect(missing).toEqual([]);
  });

  it("全体管理者は所属を持たない", () => {
    expect(rows("SELECT m.id FROM company_memberships m JOIN users u ON u.id = m.user_id WHERE u.role = 'SUPER_ADMIN'")).toEqual(
      [],
    );
  });

  it("所属の等級・事業所・上長は、どれもその所属と同じ会社のもの", () => {
    const crossed = rows(`
      SELECT m.id FROM company_memberships m
      LEFT JOIN grades g ON g.id = m.grade_id
      LEFT JOIN offices o ON o.id = m.office_id
      LEFT JOIN company_memberships boss ON boss.user_id = m.manager_id AND boss.company_id = m.company_id
      WHERE (m.grade_id IS NOT NULL AND (g.id IS NULL OR g.company_id <> m.company_id))
         OR (m.office_id IS NOT NULL AND (o.id IS NULL OR o.company_id <> m.company_id))
         OR (m.manager_id IS NOT NULL AND boss.id IS NULL)
    `);
    expect(crossed).toEqual([]);
  });

  it("兼務の見本: 給付事業のマネージャーは、さくら福祉会では一般の社員として所属する", () => {
    const own = rows("SELECT company_id, role FROM company_memberships WHERE user_id = 'usr_kyufu_mgr' ORDER BY company_id");
    expect(own).toEqual([
      { company_id: "cmp_kyufu", role: "MANAGER" },
      { company_id: "cmp_sakura", role: "EMPLOYEE" },
    ]);
    // users の会社の列は元の所属のまま
    expect(rows("SELECT company_id FROM users WHERE id = 'usr_kyufu_mgr'")).toEqual([{ company_id: "cmp_kyufu" }]);
  });
});
