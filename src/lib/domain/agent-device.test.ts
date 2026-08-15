import { describe, expect, it } from "vitest";
import {
  DEVICE_APPROVE_PATH,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  deviceApprovalQuestion,
  deviceGrantState,
  deviceLoginInstructions,
  expiresInMinutes,
  formatUserCode,
  isExpired,
  normalizeUserCode,
  sessionDisplayName,
  sessionExpiryNote,
  sessionRevokeConfirmText,
} from "./agent-device";

const at = (ms: number) => new Date(ms);

describe("合言葉", () => {
  it("読み違えやすい文字を含まない", () => {
    for (const ch of "01OIL") expect(USER_CODE_ALPHABET).not.toContain(ch);
    expect(USER_CODE_LENGTH).toBe(8);
  });

  it("4文字ずつに区切って見せる", () => {
    expect(formatUserCode("abcd2345")).toBe("ABCD-2345");
  });

  it("小文字・区切り・空白の違いでは弾かない", () => {
    expect(normalizeUserCode(" abcd-2345 ")).toBe("ABCD2345");
  });

  it("形が違えば受け取らない", () => {
    expect(normalizeUserCode(null)).toBeNull();
    expect(normalizeUserCode("ABC")).toBeNull();
    // 使わない文字（0 と I）が混じっていれば、近い合言葉を探しにいかない
    expect(normalizeUserCode("ABCD230I")).toBeNull();
  });
});

describe("期限", () => {
  it("残りは分に切り上げる", () => {
    expect(expiresInMinutes(at(61_000), at(0))).toBe(2);
    expect(expiresInMinutes(at(0), at(61_000))).toBe(0);
  });

  it("期限そのものは切れている側に入れる", () => {
    expect(isExpired(at(10), at(10))).toBe(true);
    expect(isExpired(at(11), at(10))).toBe(false);
    expect(isExpired(null, at(10))).toBe(true);
  });
});

describe("承認待ちの状態", () => {
  const base = { expiresAt: at(1_000), approvedAt: null, deniedAt: null };

  it("断られたものが最優先", () => {
    expect(deviceGrantState({ ...base, deniedAt: at(1), approvedAt: at(1) }, at(0))).toBe("denied");
  });

  it("承認済みは、そのあと期限をまたいでも受け取れる", () => {
    expect(deviceGrantState({ ...base, approvedAt: at(1) }, at(9_999))).toBe("approved");
  });

  it("押されないまま時間が過ぎたら時間切れ", () => {
    expect(deviceGrantState(base, at(9_999))).toBe("expired");
    expect(deviceGrantState(base, at(0))).toBe("pending");
  });
});

describe("画面とターミナルに出す文", () => {
  it("押す前に、どの端末かを言う", () => {
    expect(deviceApprovalQuestion(" 開発機 ", "abcd2345")).toBe("「開発機」（ABCD-2345）を通しますか。");
    expect(deviceApprovalQuestion("  ", "abcd2345")).toContain("名前のない端末");
  });

  it("案内は、開く場所と合言葉と残り時間を出す", () => {
    const text = deviceLoginInstructions("https://example.test", "abcd2345", 10);
    expect(text).toContain(`https://example.test${DEVICE_APPROVE_PATH}`);
    expect(text).toContain("ABCD-2345");
    expect(text).toContain("10分");
  });

  it("一覧の見出しは、空白を詰めて出す", () => {
    expect(sessionDisplayName("  開発  機 ")).toBe("開発 機");
    expect(sessionDisplayName("   ")).toBe("名前のない端末");
  });

  it("入り直しの時期は日で言う", () => {
    const now = at(0);
    expect(sessionExpiryNote(at(24 * 60 * 60_000), now)).toBe("あと1日で入り直しが要ります。");
    expect(sessionExpiryNote(at(0), now)).toBe("期限切れです。入り直しが要ります。");
  });

  it("止める前に、止めた先で何が起きるかを言う", () => {
    expect(sessionRevokeConfirmText("開発機")).toContain("入り直せばまた使えます。");
  });
});
