/**
 * 等級別配点への旧移行スクリプト（自由選択化より前の履歴）。
 *
 *   pnpm exec node scripts/seed-grade-schemes.mjs --local    … ローカルD1へ
 *   pnpm exec node scripts/seed-grade-schemes.mjs --remote   … 本番D1へ
 *
 * 何をするか:
 *   1. grade_point_rules（等級区分ごとの持ち点の型）を会社ごとに入れ直す
 *   2. kpi_items.is_monetary（金銭系＝20点枠に置ける項目）を立て直す
 *   3. 有効な評価セットの scheme_items を、等級区分ごとの5本立てに作り直す
 *
 * 何をしないか（重要）:
 *   - evaluations / evaluation_items には一切触らない。
 *     確定済みの評価は判定した当時の点数・配点をその行に持っているので、
 *     評価セットを作り直しても過去の結果は変わらない。実行前後で確定件数を数えて確かめる。
 *   - フォーム・回答にも触らない。
 *
 * 既存の選択はできるだけ残す。その等級区分で選べなくなった項目だけを外し、
 * 足りない枠はカテゴリを順ぐりに回して埋める（特定の領域に偏らせないため）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

console.error(
  "この移行は自由選択化より前の履歴です。再実行すると現在の評価セットを失うため実行できません。現行画面から評価セットを編集してください。",
);
process.exit(1);

const remote = process.argv.includes("--remote");
const local = process.argv.includes("--local");
if (remote === local) {
  console.error("--local か --remote のどちらかを指定してください（取り違えを防ぐため既定値は用意していません）。");
  process.exit(1);
}

const kpiPoints = JSON.parse(readFileSync(new URL("../data/kpi-points.json", import.meta.url), "utf8"));

const POINT_GROUPS = ["Beginner", "Regular", "Chief", "AM", "Manager"];
const TOTAL_POINTS = 100;
const MAJOR_SLOT_POINTS = 20;
const MINOR_SLOT_POINTS = 10;
/** 金銭系（20点枠に置ける項目）。No.6 単価率 / No.9 売上達成率 / No.24 利益率 */
const MONETARY_ITEMS = [6, 9, 24];
/** 20点枠を持つのは Chief 以上 */
const MAJOR_SLOT_COUNT = { Beginner: 0, Regular: 0, Chief: 1, AM: 1, Manager: 1 };
/** 20点枠の既定値。会社が金銭系を1つも選んでいなかったときに使う */
const DEFAULT_MAJOR_ITEM_NO = 9;

/* 固定枠の配点は正本（data/kpi-points.json の No.1・ランクA）から読む。ここに書き写さない。 */
const RULES = POINT_GROUPS.map((group, i) => {
  const fixed = Number(kpiPoints.find((p) => p["ランク"] === "A" && Number(p["項目No"]) === 1)?.[group]);
  const majorCount = MAJOR_SLOT_COUNT[group];
  const minorCount = (TOTAL_POINTS - fixed - MAJOR_SLOT_POINTS * majorCount) / MINOR_SLOT_POINTS;
  if (!Number.isInteger(minorCount) || minorCount < 0) {
    throw new Error(`${group} の配点の型が合いません（固定枠 ${fixed} 点から10点枠の数を割り出せません）。`);
  }
  return {
    pointGroup: group,
    displayOrder: i + 1,
    totalPoints: TOTAL_POINTS,
    fixedSlotPoints: fixed,
    majorSlotPoints: majorCount > 0 ? MAJOR_SLOT_POINTS : 0,
    majorSlotCount: majorCount,
    minorSlotPoints: MINOR_SLOT_POINTS,
    minorSlotCount: minorCount,
  };
});

const d1 = (arg, json = false) => {
  const args = ["exec", "wrangler", "d1", "execute", "hr-evaluation-db", remote ? "--remote" : "--local"];
  if (arg.file) args.push("--file", arg.file);
  else args.push("--command", arg.command);
  if (json) args.push("--json");
  args.push("--yes");
  const out = execFileSync("pnpm", args, { encoding: "utf8", stdio: json ? "pipe" : "inherit" });
  return json ? JSON.parse(out.slice(out.indexOf("["))) : null;
};
const query = (sql) => d1({ command: sql }, true)[0]?.results ?? [];
const esc = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

/* ───────────────── 現状を読む ───────────────── */

const finalizedBefore = Number(query("SELECT count(*) AS n FROM evaluations WHERE status = 'finalized';")[0]?.n ?? 0);
const schemes = query("SELECT id, company_id, name FROM evaluation_schemes WHERE status = 'active';");
if (schemes.length === 0) {
  console.error("有効な評価セットがありません。先に初期データを投入してください。");
  process.exit(1);
}
const items = query("SELECT id, company_id, no, name, category_id FROM kpi_items;");
const categories = query("SELECT id, company_id, display_order FROM kpi_categories;");
const refs = query("SELECT DISTINCT company_id, kpi_item_id, point_group FROM kpi_reference_points;");
const current = query(
  "SELECT scheme_id, kpi_item_id, point_group, is_fixed_slot, is_major_slot, display_order FROM scheme_items;",
);

if (refs.length === 0) {
  console.error("kpi_reference_points が空です。どの項目がどの等級区分の対象かを判断できません。");
  console.error("先に pnpm run db:seed:reference を実行してください。");
  process.exit(1);
}

const now = Date.now();
const sql = [];
const report = [];

/* ───────────────── 1. 等級区分ごとの持ち点の型 ───────────────── */

const companyIds = [...new Set(schemes.map((s) => s.company_id))];
for (const cid of companyIds) {
  for (const r of RULES) {
    sql.push(
      `INSERT OR REPLACE INTO grade_point_rules
 (id, company_id, point_group, display_order, total_points, fixed_slot_points, major_slot_points, major_slot_count, minor_slot_points, minor_slot_count, note, created_at, updated_at)
VALUES ('gpr_${cid}_${r.pointGroup}', ${esc(cid)}, ${esc(r.pointGroup)}, ${r.displayOrder}, ${r.totalPoints}, ${r.fixedSlotPoints}, ${r.majorSlotPoints}, ${r.majorSlotCount}, ${r.minorSlotPoints}, ${r.minorSlotCount}, ${esc(
        r.majorSlotCount > 0
          ? "固定枠（等級要件達成率）＋金銭系の20点枠1つ＋10点枠で100点。"
          : "固定枠（等級要件達成率）＋10点枠で100点。20点枠はChief以上のみ。",
      )}, ${now}, ${now});`,
    );
  }
}

/* ───────────────── 2. 金銭系のフラグ ───────────────── */

sql.push(`UPDATE kpi_items SET is_monetary = 0, updated_at = ${now} WHERE is_monetary = 1;`);
sql.push(`UPDATE kpi_items SET is_monetary = 1, updated_at = ${now} WHERE no IN (${MONETARY_ITEMS.join(", ")});`);

/* ───────────────── 3. 評価セットの作り直し ───────────────── */

for (const scheme of schemes) {
  const cid = scheme.company_id;
  const itemsOf = items.filter((i) => i.company_id === cid);
  const byId = new Map(itemsOf.map((i) => [i.id, i]));
  const fixedItem = itemsOf.find((i) => Number(i.no) === 1);
  if (!fixedItem) {
    console.error(`${scheme.name}: 固定枠になる「等級要件達成率」(No.1) が見つかりません。この会社は飛ばします。`);
    continue;
  }
  const catOrder = new Map(categories.filter((c) => c.company_id === cid).map((c) => [c.id, Number(c.display_order)]));
  const before = current.filter((x) => x.scheme_id === scheme.id);
  const lines = [];
  /* 移行前の評価セットは等級区分の区別が無く、行が1区分に固まっている
     （列を足したときに既存行は Manager に寄せてある → drizzle/migrations/0009）。
     その場合は、その選択を全等級区分の下敷きとして引き継ぐ。 */
  const legacy = new Set(before.map((x) => x.point_group ?? "")).size <= 1;

  sql.push(`DELETE FROM scheme_items WHERE scheme_id = ${esc(scheme.id)};`);

  for (const rule of RULES) {
    const selectable = new Set(
      refs.filter((r) => r.company_id === cid && r.point_group === rule.pointGroup).map((r) => r.kpi_item_id),
    );
    const kept = before
      .filter((x) => legacy || x.point_group === rule.pointGroup)
      .filter((x) => Number(x.is_fixed_slot) !== 1 && selectable.has(x.kpi_item_id) && byId.has(x.kpi_item_id))
      .sort((a, b) => Number(a.display_order) - Number(b.display_order))
      .map((x) => x.kpi_item_id);
    const keptSet = [...new Set(kept)];

    const rows = [
      { itemId: fixedItem.id, weight: rule.fixedSlotPoints, fixed: 1, major: 0 },
    ];

    let majorId = null;
    if (rule.majorSlotCount > 0) {
      // すでに20点枠だった項目 → 選んでいる金銭系 → 既定（No.9 売上達成率）の順で決める
      const wasMajor = before.find(
        (x) =>
          (legacy || x.point_group === rule.pointGroup) &&
          Number(x.is_major_slot) === 1 &&
          selectable.has(x.kpi_item_id),
      )?.kpi_item_id;
      const monetaryKept = keptSet.find((id) => MONETARY_ITEMS.includes(Number(byId.get(id)?.no)));
      const fallback = itemsOf.find((i) => Number(i.no) === DEFAULT_MAJOR_ITEM_NO && selectable.has(i.id))?.id;
      const anyMonetary = itemsOf.find((i) => MONETARY_ITEMS.includes(Number(i.no)) && selectable.has(i.id))?.id;
      majorId = wasMajor ?? monetaryKept ?? fallback ?? anyMonetary ?? null;
      if (!majorId) {
        console.error(`${scheme.name} / ${rule.pointGroup}: 20点枠に置ける金銭系の項目がありません。この等級区分は飛ばします。`);
        continue;
      }
      rows.push({ itemId: majorId, weight: rule.majorSlotPoints, fixed: 0, major: 1 });
    }

    const used = new Set([fixedItem.id, ...(majorId ? [majorId] : [])]);
    const minors = [];
    for (const id of keptSet) {
      if (minors.length >= rule.minorSlotCount) break;
      if (used.has(id)) continue;
      used.add(id);
      minors.push(id);
    }

    /* 足りないぶんはカテゴリを順ぐりに回して埋める。
       「上から順」に埋めると特定のカテゴリばかりが増えるため、
       カテゴリごとの候補列を作って1つずつ取り出す。 */
    if (minors.length < rule.minorSlotCount) {
      const buckets = new Map();
      for (const i of itemsOf) {
        if (used.has(i.id) || !selectable.has(i.id) || Number(i.no) === 1) continue;
        const key = i.category_id ?? "";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(i);
      }
      const keys = [...buckets.keys()].sort((a, b) => (catOrder.get(a) ?? 99) - (catOrder.get(b) ?? 99));
      for (const k of keys) buckets.get(k).sort((a, b) => Number(a.no) - Number(b.no));
      let round = 0;
      while (minors.length < rule.minorSlotCount) {
        const line = keys.map((k) => buckets.get(k)[round]).filter(Boolean);
        if (line.length === 0) break;
        for (const i of line) {
          if (minors.length >= rule.minorSlotCount) break;
          used.add(i.id);
          minors.push(i.id);
        }
        round += 1;
      }
    }
    if (minors.length < rule.minorSlotCount) {
      console.error(
        `${scheme.name} / ${rule.pointGroup}: 選べる項目が足りません（${minors.length}/${rule.minorSlotCount}）。この等級区分は飛ばします。`,
      );
      continue;
    }
    for (const id of minors) rows.push({ itemId: id, weight: rule.minorSlotPoints, fixed: 0, major: 0 });

    const total = rows.reduce((s, x) => s + x.weight, 0);
    if (total !== rule.totalPoints) {
      throw new Error(`${scheme.name} / ${rule.pointGroup} の合計が ${total} 点になりました（${rule.totalPoints}点になりません）。`);
    }

    rows.forEach((r, i) => {
      const item = byId.get(r.itemId);
      sql.push(
        `INSERT INTO scheme_items
 (id, company_id, scheme_id, kpi_item_id, point_group, category_id, weight, is_fixed_slot, is_major_slot, display_order, created_at, updated_at)
VALUES (${esc(`si_${scheme.id}_${rule.pointGroup}_${item.no}`)}, ${esc(cid)}, ${esc(scheme.id)}, ${esc(r.itemId)}, ${esc(rule.pointGroup)}, ${esc(r.fixed ? null : item.category_id)}, ${r.weight}, ${r.fixed}, ${r.major}, ${i + 1}, ${now}, ${now});`,
      );
    });

    const carried = minors.filter((id) => keptSet.includes(id)).length + (majorId && keptSet.includes(majorId) ? 1 : 0);
    lines.push(
      `  ${rule.pointGroup.padEnd(9)} ${rows.length}項目 / ${rule.totalPoints}点` +
        `（引き継いだ選択 ${carried}件、新しく入れた項目 ${rows.length - 1 - carried}件` +
        (majorId ? `、20点枠 ${byId.get(majorId)?.name}` : "") +
        "）",
    );
  }
  report.push(`${scheme.name}`, ...lines);
}

/* ───────────────── 流し込み ───────────────── */

const file = "drizzle/.grade-schemes.sql";
writeFileSync(file, ["PRAGMA defer_foreign_keys = ON;", ...sql].join("\n"));
console.log(`${remote ? "本番" : "ローカル"}のDBに ${sql.length} 文を流します（drizzle/.grade-schemes.sql）。`);
d1({ file });

const finalizedAfter = Number(query("SELECT count(*) AS n FROM evaluations WHERE status = 'finalized';")[0]?.n ?? 0);
const changed = query(
  `SELECT count(*) AS n FROM evaluations WHERE status = 'finalized' AND updated_at > ${now - 1};`,
)[0]?.n;

console.log("\n移行しました。");
for (const line of report) console.log(line);
console.log(
  `\n確定済みの評価: 実行前 ${finalizedBefore}件 → 実行後 ${finalizedAfter}件（書き換えた件数 ${Number(changed ?? 0)}件）。`,
);
if (finalizedBefore !== finalizedAfter || Number(changed ?? 0) !== 0) {
  console.error("確定済みの評価に変化がありました。想定外です。内容を確認してください。");
  process.exit(1);
}
console.log("過去の評価は判定した当時の点数のまま残っています。");
console.log("このあと管理画面の「評価セット」で、等級区分ごとの項目をご確認ください。");
