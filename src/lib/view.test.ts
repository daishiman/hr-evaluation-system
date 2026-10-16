import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./view";

// サーバー（Workers）は UTC で動く。試験の機械が日本時間だと、機械の時間帯で読む誤りを見逃すので、
// この試験の間だけ日本から遠い時間帯にする。
const savedTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

describe("画面の日付と時刻は、動いている機械の時間帯によらず日本時間で書く", () => {
  it("日本時間の朝（UTC ではまだ前の日）の提出は、日本時間の日付と時刻で書く", () => {
    const at = new Date("2026-10-15T23:09:00Z"); // 日本時間 2026-10-16 08:09
    expect(formatDate(at)).toBe("2026年10月16日");
    expect(formatDateTime(at)).toBe("2026年10月16日 08:09");
  });

  it("時刻を持たない「2026-09-30」は、その日のまま書く", () => {
    expect(formatDate("2026-09-30")).toBe("2026年9月30日");
  });

  it("空は「—」、読めない文字列はそのまま返す", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("未定")).toBe("未定");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(new Date(Number.NaN))).toBe("—");
  });
});
