import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatJstTime, JST_OFFSET_MS, jstDateKey, toJstClock } from "./jst";

// サーバー（Workers）は UTC で動く。試験の機械が日本時間だと、機械の時間帯で読む誤りを見逃すので、
// この試験の間だけ日本から遠い時間帯にする（view.test.ts と同じやり方）。
const savedTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

/** 時間帯の名前で読んだ日本時間。ここで作った読み替えとは別の道筋で答えを出す。 */
const byName = {
  date: (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d),
  time: (d: Date) => d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }),
};

/** 日本時間の0時・9時の前後と、月・年の替わり目。 */
const EDGES = [
  "2026-09-30T14:59:59Z", // 日本時間 9/30 23:59
  "2026-09-30T15:00:00Z", // 日本時間 10/1 00:00（UTC ではまだ 9/30）
  "2026-10-15T23:09:00Z", // 日本時間 10/16 08:09（UTC ではまだ前の日）
  "2026-10-15T23:59:59Z", // 日本時間 10/16 08:59
  "2026-10-16T00:00:00Z", // 日本時間 10/16 09:00
  "2026-12-31T15:00:00Z", // 日本時間 2027/1/1 00:00
  "2028-02-28T15:00:00Z", // 日本時間 2028/2/29 00:00（うるう日）
].map((s) => new Date(s));

describe("日本時間への読み替え", () => {
  it("時差は9時間で、9時間進めた時計を getUTC* で読む", () => {
    expect(JST_OFFSET_MS).toBe(9 * 60 * 60 * 1000);
    expect(toJstClock(new Date("2026-10-15T23:09:00Z")).toISOString()).toBe("2026-10-16T08:09:00.000Z");
  });

  it("日本時間の0時〜9時（UTC では前の日の 15:00 以降）は、日本時間の日付にする", () => {
    expect(jstDateKey(new Date("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
    expect(jstDateKey(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
    expect(jstDateKey(new Date("2026-10-15T23:59:59Z"))).toBe("2026-10-16");
    expect(jstDateKey(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("時刻は24時制で、時も分も2桁にそろえる（0時は 24 でなく 00）", () => {
    expect(formatJstTime(new Date("2026-10-15T23:09:00Z"))).toBe("08:09");
    expect(formatJstTime(new Date("2026-09-30T15:00:00Z"))).toBe("00:00");
    expect(formatJstTime(new Date("2026-09-30T14:59:59Z"))).toBe("23:59");
    expect(formatJstTime(new Date("2026-01-05T03:05:00Z"))).toBe("12:05");
    expect(jstDateKey(new Date("2026-01-05T03:05:00Z"))).toBe("2026-01-05");
  });

  it("時間帯の名前（Asia/Tokyo）で読んだ日付・時刻と同じ字面になる", () => {
    for (const d of EDGES) {
      expect(jstDateKey(d)).toBe(byName.date(d));
      // 回答画面の「保存済み HH:MM」が今使っている書き方を、日本時間で読んだもの
      expect(formatJstTime(d)).toBe(byName.time(d));
    }
  });

  it("締切の判定と利用状況の記録・掃除・集計は、日付の鍵を jstDateKey から直に取る（別名を置かない）", () => {
    // 同じ読み替えに名前が3つあると、どれが日本時間かを読む人が確かめ直すことになる
    const read = (f: string) => readFileSync(path.join(process.cwd(), "src", f), "utf8");
    const deadline = read("lib/domain/form-deadline.ts");
    expect(deadline).toContain("const today = jstDateKey(input.now);");
    expect(deadline).toContain("const today = jstDateKey(now);");
    const usage = read("lib/usage.ts");
    for (const line of ["const date = jstDateKey(now);", "const today = jstDateKey(now);", "const to = jstDateKey(now);"]) {
      expect(usage).toContain(line);
    }
    expect(read("lib/domain/usage.ts")).toContain("shiftDateKey(jstDateKey(today)");
  });

  it("読めない Date は例外にし、NaN の日付を鍵や比べ合いに紛れ込ませない", () => {
    const bad = new Date(Number.NaN);
    expect(() => toJstClock(bad)).toThrow(RangeError);
    expect(() => jstDateKey(bad)).toThrow(RangeError);
    expect(() => formatJstTime(bad)).toThrow(RangeError);
  });

  it("動いている機械の時間帯を変えても、答えは変わらない", () => {
    const expected = EDGES.map((d) => [jstDateKey(d), formatJstTime(d)]);
    for (const tz of ["UTC", "Asia/Tokyo", "Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
      process.env.TZ = tz;
      expect(EDGES.map((d) => [jstDateKey(d), formatJstTime(d)]), tz).toEqual(expected);
    }
    process.env.TZ = "America/Los_Angeles";
    // 機械の時間帯で読むと日本時間とずれることを確かめ、上の比べが空振りしていないことを示す
    expect(new Date("2026-10-15T23:09:00Z").getHours()).not.toBe(8);
  });

  it("機械の時間帯で日付・時刻を読む書き方は、src のどこにも置かない（読み替えは jst.ts の1か所）", () => {
    // サーバーは UTC、ブラウザは見る人の時間帯で動く。getHours や toLocaleTimeString を画面ごとに書くと、
    // 日本時間の0時〜9時に前の日・9時間前の字面になる画面が残る（回答画面の「保存済み HH:MM」がそうだった）。
    // 数の toLocaleString（桁区切り）は時間帯を読まないので数えない。コメントの中の言及も数えない
    const root = path.join(process.cwd(), "src");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    const code = (f: string) =>
      readFileSync(path.join(root, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const machineClock = /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds)\(\)|\.toLocale(Date|Time)String\(/;
    // 空振りしていないこと：走査が jst.ts まで届き、式が機械の時間帯の読みに当たり、getUTC* と数の桁区切りには当たらない
    expect(files.map((f) => f.split(path.sep).join("/"))).toContain("lib/domain/jst.ts");
    expect(machineClock.test("d.getHours()")).toBe(true);
    expect(machineClock.test("d.toLocaleTimeString(\"ja-JP\")")).toBe(true);
    expect(machineClock.test(code("lib/domain/jst.ts"))).toBe(false);
    expect(machineClock.test("n.toLocaleString(\"ja-JP\")")).toBe(false);
    expect(files.filter((f) => machineClock.test(code(f))).sort()).toEqual([]);
  });
});
