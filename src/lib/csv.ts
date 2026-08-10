/**
 * CSVの組み立てと読み取り。
 *
 * Excel で開いたときに日本語が化けないよう、書き出しは BOM 付き UTF-8・改行 CRLF にする。
 * 読み取りは、引用符つき（改行・カンマを含む）セルに対応する。
 */

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ヘッダーと行データからCSV文字列を作る（先頭にBOM）。 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/**
 * 見出し行を見て、区切り文字がカンマかタブかを決める。
 * スプレッドシートから範囲をコピーして貼り付けるとタブ区切りになるため、
 * 「ファイルを選ぶ」でも「表を貼り付ける」でも同じように読めるようにする。
 */
function detectDelimiter(src: string): "," | "\t" {
  const head = src.split(/\r?\n/, 1)[0] ?? "";
  let inQuote = false;
  let commas = 0;
  let tabs = 0;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    else if (inQuote) continue;
    else if (c === ",") commas++;
    else if (c === "\t") tabs++;
  }
  return tabs > commas ? "\t" : ",";
}

/** CSV文字列（またはタブ区切り）を2次元配列にする。空行は読み飛ばす。 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** ダウンロード用のレスポンス。ファイル名は日本語のままでも開けるようにエンコードする。 */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}

/** 「2026-07-24 12:32」の形。スプレッドシートの表記に合わせる。 */
export function formatDateTime(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  // 日本時間で表記する（保存はUTCミリ秒）
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}

/** 「100.0%」の形。値が無いときは空欄。 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `${value.toFixed(1)}%`;
}
