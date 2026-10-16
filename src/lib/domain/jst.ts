/**
 * 日本時間（UTC+9。夏時間なし）への読み替え。日付と時刻を日本時間で扱う処理は、ここを通す。
 *
 * サーバー（Workers）は UTC で動くので、機械の時間帯で読む getDate・getHours を使うと、
 * 日本時間の0時〜9時の出来事が前の日・9時間前になる。9時間進めた Date を作り、getUTC* で読む。
 * 機械の時間帯を通さないので、ブラウザで読んでも同じ字面になる。
 *
 * 暦の日付（YYYY-MM-DD）の比べ方と、画面・CSV の表記の形は、それぞれの場所が持つ
 * （form-deadline.ts・usage.ts・view.ts・csv.ts）。ここが持つのは時間帯の読み替えだけ。
 */

/** 日本時間の時差（ミリ秒）。夏時間が無いので固定値でよい。 */
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 9時間進めた Date。getUTC* で読むと日本時間の値になる（getHours などの機械の時間帯では読まない）。
 * 読めない Date は例外にする。「NaN-NaN-NaN」の日付が保存の鍵や期限の比べ合いに黙って紛れないため。
 * 表記で「—」や空にしたい場所（view.ts・csv.ts）は、呼ぶ前に自分で確かめる。
 */
export function toJstClock(d: Date): Date {
  const t = d.getTime();
  if (Number.isNaN(t)) throw new RangeError("Invalid time value");
  return new Date(t + JST_OFFSET_MS);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** その瞬間が日本時間で何日にあたるかを「2026-09-30」の形で返す。 */
export function jstDateKey(d: Date): string {
  const j = toJstClock(d);
  return `${j.getUTCFullYear()}-${pad2(j.getUTCMonth() + 1)}-${pad2(j.getUTCDate())}`;
}

/** 日本時間の時刻を「08:09」の形（24時制・時も分も2桁）で返す。 */
export function formatJstTime(d: Date): string {
  const j = toJstClock(d);
  return `${pad2(j.getUTCHours())}:${pad2(j.getUTCMinutes())}`;
}
