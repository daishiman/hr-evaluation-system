/**
 * 元の配点表（data/kpi-points.json ＝「KPI基準定義_配点」シート）を
 * kpi_reference_points テーブルに取り込む。
 *
 *   pnpm run db:seed:reference          … ローカルD1へ
 *   pnpm run db:seed:reference -- --remote  … 本番D1へ
 *
 * 参考値を置くだけの表なので、何度実行しても同じ結果になる（同じ行は上書き）。
 * 他のテーブルには一切触れない。元の表で「-」（その等級では対象外）だった組み合わせは行を作らない。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const remote = process.argv.includes("--remote");
const points = JSON.parse(readFileSync(new URL("../data/kpi-points.json", import.meta.url), "utf8"));

/** 配点表の列名 = grades.point_group の値 */
const GROUPS = ["Beginner", "Regular", "Chief", "AM", "Manager"];

const d1 = (sqlOrFile, json = false) => {
  const args = ["exec", "wrangler", "d1", "execute", "hr-evaluation-db", remote ? "--remote" : "--local"];
  if (sqlOrFile.file) args.push("--file", sqlOrFile.file);
  else args.push("--command", sqlOrFile.command);
  if (json) args.push("--json");
  args.push("--yes");
  const out = execFileSync("pnpm", args, { encoding: "utf8", stdio: json ? "pipe" : "inherit" });
  return json ? JSON.parse(out.slice(out.indexOf("["))) : null;
};

// 会社ごとのKPI項目（項目Noとの対応）をDBから引く。IDの付け方を推測しないため。
const res = d1({ command: "SELECT id, company_id, no FROM kpi_items;" }, true);
const rows = res[0]?.results ?? [];
if (rows.length === 0) {
  console.error("kpi_items が空です。先に初期データを投入してください。");
  process.exit(1);
}

const now = Date.now();
const values = [];
for (const item of rows) {
  for (const r of points) {
    if (Number(r["項目No"]) !== Number(item.no)) continue;
    for (const g of GROUPS) {
      const raw = String(r[g] ?? "").trim();
      if (raw === "" || raw === "-") continue; // その等級では対象外の項目
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const id = `krp_${item.id}_${g}_${r["ランク"]}`;
      values.push(
        `('${id}','${item.company_id}','${item.id}','${g}','${r["ランク"]}',${n},${now},${now})`,
      );
    }
  }
}

const chunks = [];
for (let i = 0; i < values.length; i += 200) {
  chunks.push(
    `INSERT OR REPLACE INTO kpi_reference_points
 (id, company_id, kpi_item_id, point_group, rank, points, created_at, updated_at)
VALUES ${values.slice(i, i + 200).join(",\n")};`,
  );
}

const file = "drizzle/.reference-points.sql";
writeFileSync(file, chunks.join("\n"));
d1({ file });
console.log(`\n${remote ? "本番" : "ローカル"}に元の配点 ${values.length} 件を取り込みました（${rows.length} 項目ぶん）。`);
