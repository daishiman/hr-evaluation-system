import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";

import { createTestDatabase } from "../src/test-support/sqlite-d1";
import { computeBonus } from "../src/lib/domain/bonus";
import { commentProblem, finalDecision, validateDecisionInput } from "../src/lib/domain/final-decision";
import { buildSeed, DEMO_PASSWORD, demoPasswordHash, SEED_TABLES, seedFileBody } from "./seed-data.mjs";
import { assertFullSeedTargetIsLocal } from "./seed-target.mjs";

/**
 * デモの種データ（drizzle/seed.sql）の検査。
 *
 * 見るのは4つ。
 *  (a) 同じ日に2回作ると同じ SQL になる（作り直すたびに差分が出ない）。
 *  (b) すべての移行を流した DB に2回流しても同じ状態になり、外部キーの食い違いが残らない。
 *  (c) 画面で確かめたい形（上司の判断の5つの型・確定済みの期・アンケートと回答の全状態・
 *      設定のずれ・直属の部下とそうでない社員）が、実際に DB に入っている。
 *  (d) 本番向けの引数（--remote）を断る。
 *
 * 日付は固定する。受付中のアンケートの締切は「今日」から決まるので、
 * 固定しないと日によって SQL が変わり、(a) の比べ方が成り立たない。
 */

const TODAY = "2026-10-20";
const KYUFU = "cmp_kyufu";

let seed;
let again;
let t;
/** 1回目と2回目の、表ごとの中身（行を JSON にして並べ替えたもの） */
let firstDump;
let secondDump;

/** 表の中身を、行の順に左右されない形で取り出す */
function dumpOf(raw) {
  const out = {};
  for (const table of SEED_TABLES) {
    out[table] = raw.prepare(`SELECT * FROM ${table}`).all().map((r) => JSON.stringify(r)).sort();
  }
  return out;
}

/** seed.sql と同じ流し方（1つの取引の中で消して入れ直す）。外部キーの検査は取引の終わり */
function applySeed(raw, body) {
  raw.exec("BEGIN");
  try {
    raw.exec(body);
    raw.exec("COMMIT");
  } catch (e) {
    raw.exec("ROLLBACK");
    throw e;
  }
}

const all = (sql, ...params) => t.raw.prepare(sql).all(...params);
const one = (sql, ...params) => t.raw.prepare(sql).get(...params);
const evaluationOf = (cycleKey, empKey) => one("SELECT * FROM evaluations WHERE id = ?", `ev_kyufu_${cycleKey}_${empKey}`);

beforeAll(async () => {
  seed = await buildSeed({ today: TODAY });
  again = await buildSeed({ today: TODAY });
  t = createTestDatabase();
  const body = seedFileBody(seed.sql);
  applySeed(t.raw, body);
  firstDump = dumpOf(t.raw);
  /* 2回目の前に、デモを使ったあとにできる行を足しておく。手元では一度ログインしてから流し直すことが多い。
     ログインのセッション（利用者を消すと一緒に消える）と、エージェントの鍵（利用者を「削除時に何もしない」で指す。
     消す表に入っていないと、2回目の投入が外部キーで止まる）。鍵の値は検査用の飾りで、本物の鍵ではない。 */
  t.raw.exec(
    `INSERT INTO sessions (id, expires_at, token, created_at, updated_at, user_id)
     VALUES ('ses_seed_check', 4102444800000, 'seed-check-token', 0, 0, 'usr_kyufu_admin');
     INSERT INTO agent_api_keys (id, key_hash, key_prefix, created_at, created_by_id)
     VALUES ('aak_seed_check', 'seed-check-hash', 'seed', 0, 'usr_super');`,
  );
  applySeed(t.raw, body);
  secondDump = dumpOf(t.raw);
});

afterAll(() => t?.close());

describe("(a) 同じ日に2回作ると同じ SQL になる", () => {
  it("buildSeed を2回呼んだ SQL と、seed.sql の本文が1字も違わない", () => {
    expect(again.sql).toEqual(seed.sql);
    expect(seedFileBody(again.sql)).toBe(seedFileBody(seed.sql));
  });

  it("デモのパスワードのハッシュも毎回同じ（塩を固定している）", () => {
    expect(demoPasswordHash()).toBe(demoPasswordHash());
  });

  it("drizzle/seed.sql は、いまの SEED_TABLES で消してから入れる形で作られている", () => {
    const file = readFileSync(join(process.cwd(), "drizzle/seed.sql"), "utf8");
    expect(file.startsWith(`${seedFileBody([])}\n\nINSERT INTO `)).toBe(true);
  });

  it("SQL に事業所の達成率の仕組みの字が残っていない（DD-024）", () => {
    // 探す語は src/lib/kgi-removal.static.test.ts と同じ。ここでは組み立てた SQL を見る
    const removed = new RegExp(["k", "g", "i"].join("") + "|ｋｇｉ", "i");
    expect(removed.test(seedFileBody(seed.sql))).toBe(false);
  });
});

describe("(b) すべての移行を流した DB に2回流しても同じ状態になる", () => {
  it("2回目のあとも、表ごとの行数と中身が1回目と同じ", () => {
    for (const table of SEED_TABLES) {
      expect(secondDump[table].length, table).toBe(firstDump[table].length);
      expect(secondDump[table], table).toEqual(firstDump[table]);
    }
  });

  it("入れた行数が、組み立てた行数と表ごとに一致する", () => {
    for (const [table, rows] of seed.tableRows) {
      expect(one(`SELECT COUNT(*) AS n FROM ${table}`).n, table).toBe(rows.length);
    }
  });

  it("外部キーの食い違いが1件も無く、使ったあとにできた行（セッション・エージェントの鍵）は流し直しで消えている", () => {
    expect(all("PRAGMA foreign_key_check")).toEqual([]);
    expect(one("SELECT COUNT(*) AS n FROM sessions").n).toBe(0);
    expect(one("SELECT COUNT(*) AS n FROM agent_api_keys").n).toBe(0);
  });

  it("消す表の一覧が、入れるすべての表を含み、重複が無い", () => {
    expect(new Set(SEED_TABLES).size).toBe(SEED_TABLES.length);
    for (const [table] of seed.tableRows) expect(SEED_TABLES, table).toContain(table);
  });

  /* 0039 は P05 の PR に入れず、P08 の PR で入る（DD-020）。P05 の PR の上でも通るように、
     「schema.ts から外した表を入れない」は 0039 のファイルに頼らずに確かめる。 */
  it("消す表はすべて schema.ts に定義があり、いまの DB にある（schema から外した表を入れない）", () => {
    const schema = readFileSync(join(process.cwd(), "src/db/schema.ts"), "utf8");
    const defined = new Set([...schema.matchAll(/sqliteTable\(\s*"([^"]+)"/g)].map((m) => m[1]));
    const existing = new Set(all("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
    for (const table of SEED_TABLES) {
      expect(defined.has(table), `${table} は schema.ts に無い`).toBe(true);
      expect(existing.has(table), `${table} は DB に無い`).toBe(true);
    }
  });

  const migrationsDir = join(process.cwd(), "drizzle/migrations");
  const drop0039 = readdirSync(migrationsDir).find((f) => f.startsWith("0039_"));
  it.skipIf(!drop0039)("移行 0039 で消した表を含まない（0039 が入った後）", () => {
    const dropped = [...readFileSync(join(migrationsDir, drop0039), "utf8").matchAll(/DROP TABLE IF EXISTS `([^`]+)`/g)].map((m) => m[1]);
    expect(dropped.length).toBeGreaterThanOrEqual(3);
    for (const table of dropped) expect(SEED_TABLES).not.toContain(table);
  });

  it("消す表を「削除時に何もしない」で指す表は、行ごと消える（入っていないと2回目が外部キーで止まる）", () => {
    const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
    const fksOf = new Map(tables.map((table) => [table, all(`PRAGMA foreign_key_list(${table})`)]));
    const notNull = (table, col) => all(`PRAGMA table_info(${table})`).some((c) => c.name === col && c.notnull === 1);
    /* 行ごと消える表: 消す表そのものと、空でない列で消える表を「削除時に一緒に消す」で指す表
       （会社を消すと一緒に消える改善要望や制度の記録など）。一緒に消える表をたどって広げる。 */
    const cleared = new Set(SEED_TABLES);
    for (let grew = true; grew; ) {
      grew = false;
      for (const table of tables) {
        if (cleared.has(table)) continue;
        if (fksOf.get(table).some((fk) => cleared.has(fk.table) && fk.on_delete === "CASCADE" && notNull(table, fk.from))) {
          cleared.add(table);
          grew = true;
        }
      }
    }
    const stuck = [];
    for (const table of tables) {
      if (cleared.has(table)) continue;
      for (const fk of fksOf.get(table)) {
        if (cleared.has(fk.table) && !["CASCADE", "SET NULL"].includes(fk.on_delete)) stuck.push(`${table}.${fk.from} → ${fk.table}`);
      }
    }
    expect(stuck).toEqual([]);
  });
});

describe("(c) 給付事業で、画面で確かめたい形がそろっている", () => {
  it("確定済みの期が3つ、受付中の期が1つ", () => {
    const rows = all("SELECT status, COUNT(*) AS n FROM evaluation_cycles WHERE company_id = ? GROUP BY status ORDER BY status", KYUFU);
    expect(rows).toEqual([
      { status: "closed", n: 3 },
      { status: "open", n: 1 },
    ]);
  });

  describe("上司の判断の5つの型", () => {
    it("① 昇給も昇格も判定どおりに認める（中村 和彦・2025年度 下期。次の期から等級5-2）", () => {
      const ev = evaluationOf("2025h2", "e8");
      expect(ev).toMatchObject({ raise_eligible: 1, promotion_eligible: 1, raise_decision: "follow", promotion_decision: "follow" });
      expect(ev.raise_decision_reason).toBeNull();
      expect(ev.promotion_decision_reason).toBeNull();
    });

    it("② 昇給の判定（見送り）を変えて認める（鈴木 美咲・2026年度 上期）", () => {
      const ev = evaluationOf("2026h1", "e3");
      expect(ev).toMatchObject({ raise_eligible: 0, raise_decision: "override" });
      expect(finalDecision(ev.raise_eligible === 1, ev.raise_decision).approved).toBe(true);
      expect(ev.raise_decision_reason).toBeTruthy();
    });

    it("③ 昇給の判定（可）を変えて見送り、昇格は要件の未達で判定どおり見送る（高橋 直樹・2026年度 上期）", () => {
      const ev = evaluationOf("2026h1", "e4");
      expect(ev).toMatchObject({ raise_eligible: 1, raise_decision: "override", promotion_eligible: 0, promotion_decision: "follow" });
      expect(finalDecision(true, ev.raise_decision).approved).toBe(false);
      expect(ev.promotion_blocked_reason).toContain("昇格要件が未達です");
    });

    it("④ 判断を記録する仕組みより前に確定した期は、全員が記録なし（2025年度 上期）", () => {
      const rows = all("SELECT * FROM evaluations WHERE cycle_id = 'cyc_kyufu_2025h1'");
      expect(rows.length).toBeGreaterThan(0);
      for (const ev of rows) {
        expect(ev.status).toBe("finalized");
        expect([ev.raise_decision, ev.promotion_decision, ev.decision_recorded_at, ev.decision_recorded_by]).toEqual([null, null, null, null]);
      }
    });

    it("⑤ 昇給は判定どおり、昇格だけ判定を変えて認める（田中 陽子・2025年度 下期。次の期から等級2）", () => {
      const ev = evaluationOf("2025h2", "e1");
      expect(ev).toMatchObject({ raise_decision: "follow", promotion_eligible: 0, promotion_decision: "override" });
      expect(ev.raise_decision_reason).toBeNull();
      expect(ev.promotion_decision_reason).toBeTruthy();
    });

    it("判断を記録した期の確定済みの評価には、全員に判断と記録者・日時が入っている", () => {
      const rows = all(
        "SELECT * FROM evaluations WHERE company_id = ? AND cycle_id IN ('cyc_kyufu_2025h2', 'cyc_kyufu_2026h1')",
        KYUFU,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const ev of rows) {
        expect(ev.raise_decision, ev.id).not.toBeNull();
        expect(ev.promotion_decision, ev.id).not.toBeNull();
        expect(ev.decision_recorded_by, ev.id).toBe(ev.evaluator_id);
        expect(ev.decision_recorded_at, ev.id).toBe(ev.finalized_at);
      }
    });
  });

  describe("受付中の期（2026年度 下期）のアンケートと回答", () => {
    const form = (code) => one("SELECT * FROM forms WHERE id = ?", `frm_kyufu_2026h2_${code}`);
    const response = (empKey) => one("SELECT * FROM form_responses WHERE id = ?", `res_kyufu_2026h2_${empKey}`);

    it("アンケートの状態が、下書き・公開中・締切済みの旧版と新しい版・締切切れで延長ありの全部そろう", () => {
      expect(form("beginner").status).toBe("draft");
      expect(form("regular").status).toBe("published");
      expect(form("chief")).toMatchObject({ status: "closed", version: 1 });
      expect(form("chief_v2")).toMatchObject({ status: "published", version: 2, grade_id: "grd_kyufu_chief" });
      expect(form("am2").status).toBe("published");
      expect(form("am2").closes_at < TODAY).toBe(true);

      const ext = one("SELECT * FROM form_deadline_extensions WHERE form_id = ?", "frm_kyufu_2026h2_am2");
      expect(ext).toMatchObject({ employee_id: "usr_kyufu_e7", granted_by_id: "usr_kyufu_admin", revoked_at: null });
      expect(ext.extended_until > TODAY).toBe(true);
    });

    it("締めた期のアンケートは全部締切済み", () => {
      const rows = all("SELECT DISTINCT f.status FROM forms f JOIN evaluation_cycles c ON c.id = f.cycle_id WHERE f.company_id = ? AND c.status = 'closed'", KYUFU);
      expect(rows).toEqual([{ status: "closed" }]);
    });

    it("回答が、提出済み・入力途中（旧版への下書きも）・未回答の全部そろう", () => {
      expect(response("e2").status).toBe("submitted");
      expect(response("e3").status).toBe("draft");
      expect(response("e4")).toMatchObject({ status: "draft", form_id: "frm_kyufu_2026h2_chief" });
      expect(response("e5")).toMatchObject({ status: "submitted", form_id: "frm_kyufu_2026h2_chief_v2" });
      expect(response("e8").status).toBe("submitted");
      for (const key of ["e1", "e6", "e7"]) expect(response(key), key).toBeUndefined();
    });

    it("入力途中の回答は、設問の一部だけに答えている", () => {
      for (const key of ["e3", "e4"]) {
        const r = response(key);
        const answered = one("SELECT COUNT(*) AS n FROM form_answers WHERE response_id = ?", r.id).n;
        const asked = one("SELECT COUNT(*) AS n FROM form_questions WHERE form_id = ?", r.form_id).n;
        expect(answered, key).toBeGreaterThan(0);
        expect(answered, key).toBeLessThan(asked);
      }
    });

    it("提出済みの2人には、上司が集計した評価の下書きがある（確定の日時と判断は空）", () => {
      for (const key of ["e2", "e8"]) {
        const ev = evaluationOf("2026h2", key);
        expect(ev, key).toMatchObject({ status: "draft", finalized_at: null, raise_decision: null, decision_recorded_at: null, evaluator_comment: null });
      }
      expect(evaluationOf("2026h2", "e5")).toBeUndefined();
    });
  });

  describe("設定のずれの3種類", () => {
    it("等級要件: 等級5-2のアンケートのあとに、要件を1つ改訂して1つ足した（アンケートは元の版のまま）", () => {
      const revised = all("SELECT * FROM grade_requirements WHERE company_id = ? AND previous_version_id IS NOT NULL", KYUFU);
      expect(revised).toHaveLength(1);
      const asked = all("SELECT grade_requirement_id FROM form_questions WHERE form_id = 'frm_kyufu_2026h2_manager2'").map((r) => r.grade_requirement_id);
      expect(asked).toContain(revised[0].previous_version_id);
      expect(asked).not.toContain(revised[0].id);
      expect(one("SELECT * FROM grade_requirements WHERE id = 'greq_kyufu_add_manager2_6'")).toMatchObject({ is_active: 1 });
      expect(asked).not.toContain("greq_kyufu_add_manager2_6");
    });

    it("行動指針: 等級1・等級2向けの連帯性を使わなくしたが、アンケートはまだ聞いている", () => {
      expect(one("SELECT is_active FROM behavior_guidelines WHERE id = 'bg_kyufu_g1_2_solidarity'").is_active).toBe(0);
      for (const code of ["beginner", "regular"]) {
        const n = one(
          "SELECT COUNT(*) AS n FROM form_questions WHERE form_id = ? AND behavior_guideline_id = 'bg_kyufu_g1_2_solidarity'",
          `frm_kyufu_2026h2_${code}`,
        ).n;
        expect(n, code).toBe(1);
      }
    });

    it("KPI項目: 等級4-1のアンケートは、評価セットで選んだ13の代わりに27を聞いている", () => {
      const asked = all("SELECT DISTINCT kpi_item_id FROM form_questions WHERE form_id = 'frm_kyufu_2026h2_am1' AND kpi_item_id IS NOT NULL").map((r) => r.kpi_item_id);
      const chosen = all("SELECT kpi_item_id FROM scheme_items WHERE company_id = ? AND point_group = 'AM'", KYUFU).map((r) => r.kpi_item_id);
      expect(chosen).toContain("kpi_kyufu_13");
      expect(chosen).not.toContain("kpi_kyufu_27");
      expect(asked).toContain("kpi_kyufu_27");
      expect(asked).not.toContain("kpi_kyufu_13");
    });

    it("ずれは給付事業だけで、ほかの会社には入れない", () => {
      expect(one("SELECT COUNT(*) AS n FROM grade_requirements WHERE company_id <> ? AND previous_version_id IS NOT NULL", KYUFU).n).toBe(0);
      expect(one("SELECT COUNT(*) AS n FROM behavior_guidelines WHERE company_id <> ? AND is_active = 0", KYUFU).n).toBe(0);
    });
  });

  it("マネージャーの直属の部下は e1〜e6、e7・e8 は会社の管理者の直属（所属の表も同じ）", () => {
    for (const key of ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]) {
      const boss = ["e7", "e8"].includes(key) ? "usr_kyufu_admin" : "usr_kyufu_mgr";
      const uid = `usr_kyufu_${key}`;
      expect(one("SELECT manager_id FROM users WHERE id = ?", uid).manager_id, key).toBe(boss);
      expect(one("SELECT manager_id FROM company_memberships WHERE user_id = ? AND company_id = ?", uid, KYUFU).manager_id, key).toBe(boss);
    }
  });

  it("田中 陽子（e1）には確定済みの評価が2件以上あり、途中で等級が変わっている", () => {
    const rows = all("SELECT grade_id FROM evaluations WHERE employee_id = 'usr_kyufu_e1' AND status = 'finalized'");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(new Set(rows.map((r) => r.grade_id)).size).toBeGreaterThanOrEqual(2);
  });

  it("最終の昇格の結論が、次の期の等級と合っている（認めた人だけ1つ上がり、ほかは変わらない）", () => {
    const order = new Map(all("SELECT id, display_order FROM grades WHERE company_id = ?", KYUFU).map((g) => [g.id, g.display_order]));
    const cycles = all("SELECT id, status FROM evaluation_cycles WHERE company_id = ? ORDER BY period_start", KYUFU);
    const people = all("SELECT id, grade_id FROM users WHERE company_id = ? AND role = 'EMPLOYEE'", KYUFU);
    let promoted = 0;
    for (const p of people) {
      for (let i = 0; i + 1 < cycles.length; i++) {
        const ev = one("SELECT * FROM evaluations WHERE employee_id = ? AND cycle_id = ? AND status = 'finalized'", p.id, cycles[i].id);
        // 一番上の等級（5-2）は上がる先が無いので比べない
        if (!ev || ev.grade_id === "grd_kyufu_manager2") continue;
        const next = cycles[i + 1].status === "open"
          ? p.grade_id
          : one("SELECT grade_id FROM evaluations WHERE employee_id = ? AND cycle_id = ?", p.id, cycles[i + 1].id).grade_id;
        const approved = finalDecision(ev.promotion_eligible === 1, ev.promotion_decision).approved;
        const label = `${p.id} ${cycles[i].id}`;
        if (approved) {
          promoted++;
          expect(order.get(next), label).toBe(order.get(ev.grade_id) + 1);
        } else {
          expect(next, label).toBe(ev.grade_id);
        }
      }
    }
    expect(promoted).toBeGreaterThanOrEqual(2);
  });
});

describe("(c) すべての会社で、保存した値がアプリの決まりと合っている", () => {
  it("判断の理由は確定のときの検査を通り、判定どおりなら理由は空", () => {
    const rows = all("SELECT * FROM evaluations WHERE decision_recorded_at IS NOT NULL");
    expect(rows.length).toBe(seed.counts.上司の判断の記録);
    for (const ev of rows) {
      const check = validateDecisionInput({
        raiseDecision: ev.raise_decision, raiseDecisionReason: ev.raise_decision_reason,
        promotionDecision: ev.promotion_decision, promotionDecisionReason: ev.promotion_decision_reason,
      });
      expect(check, ev.id).toEqual({
        ok: true,
        value: {
          raiseDecision: ev.raise_decision, raiseDecisionReason: ev.raise_decision_reason,
          promotionDecision: ev.promotion_decision, promotionDecisionReason: ev.promotion_decision_reason,
        },
      });
    }
  });

  it("上長のコメントは確定済みだけにあり、本人に見せられない語を含まない", () => {
    for (const ev of all("SELECT id, status, evaluator_comment FROM evaluations")) {
      if (ev.status === "finalized") expect(ev.evaluator_comment, ev.id).toBeTruthy();
      else expect(ev.evaluator_comment, ev.id).toBeNull();
      expect(commentProblem(ev.evaluator_comment), ev.id).toBeNull();
    }
  });

  it("個人Pt・賞与額・根拠の文が、computeBonus（KPI評価点合計だけで決まる）と一致する", () => {
    const rows = all(
      `SELECT e.id, e.total_score, e.personal_points, e.bonus_yen, e.bonus_rationale, p.bonus_yen_per_point
       FROM evaluations e JOIN raise_policies p ON p.company_id = e.company_id`,
    );
    expect(rows.length).toBe(seed.counts.評価結果);
    for (const ev of rows) {
      const want = computeBonus({ kpiTotalScore: ev.total_score, yenPerPoint: ev.bonus_yen_per_point });
      expect([ev.personal_points, ev.bonus_yen, ev.bonus_rationale], ev.id).toEqual([want.personalPoints, want.bonusYen, want.rationale]);
    }
  });

  it.each([TODAY, "2027-06-01"])("今日が %s でも、公開中のアンケートと延長の期限は今日より後（意図して締切切れにした等級4-2は除く）", async (today) => {
    const built = today === TODAY ? seed : await buildSeed({ today, passwordHashFor: async () => "x" });
    const rowsOf = (table) => built.tableRows.find(([name]) => name === table)[1];
    const published = rowsOf("forms").filter((f) => f.status === "published" && f.id !== "frm_kyufu_2026h2_am2");
    expect(published.length).toBeGreaterThan(0);
    for (const f of published) expect(f.closes_at > today, f.id).toBe(true);
    expect(rowsOf("forms").find((f) => f.id === "frm_kyufu_2026h2_am2").closes_at < today).toBe(true);
    for (const x of rowsOf("form_deadline_extensions")) expect(x.extended_until > today, x.id).toBe(true);
  });

  it("デモのログイン4人がそろい、共通パスワードで照合が通る", async () => {
    const emails = ["super@hyoka-demo.jp", "admin@kyufu.hyoka-demo.jp", "manager@kyufu.hyoka-demo.jp", "e1@kyufu.hyoka-demo.jp"];
    for (const email of emails) {
      const u = one("SELECT id, is_active, must_change_password FROM users WHERE email = ?", email);
      expect(u, email).toMatchObject({ is_active: 1, must_change_password: 0 });
      const acc = one("SELECT password FROM accounts WHERE user_id = ? AND provider_id = 'credential'", u.id);
      expect(acc.password, email).toBe(demoPasswordHash());
    }
    expect(await verifyPassword({ hash: demoPasswordHash(), password: DEMO_PASSWORD })).toBe(true);
    expect(await verifyPassword({ hash: demoPasswordHash(), password: `${DEMO_PASSWORD}x` })).toBe(false);
  });
});

describe("(d) 本番向けの引数を断る", () => {
  it("--remote を渡すと、組み立ての前に止まる", () => {
    expect(() => assertFullSeedTargetIsLocal(["--remote"])).toThrow();
    expect(() => assertFullSeedTargetIsLocal(["--local"])).not.toThrow();
  });
});
