import { describe, expect, it } from "vitest";
import {
  AGENT_KEY_BYTES,
  AGENT_KEY_ONCE_NOTICE,
  AGENT_KEY_PAGE_LABEL,
  AGENT_KEY_PAGE_PATH,
  AGENT_KEY_PREFIX_LENGTH,
  AGENT_KEY_TOUCH_INTERVAL_MS,
  activeAgentKey,
  agentKeyConfirmText,
  agentKeyExportLine,
  agentKeyMaskedLabel,
  agentKeyPrefix,
  agentKeyState,
  agentKeyStateLabel,
  agentKeyStateTone,
  agentKeyUsageNote,
  encodeAgentKey,
  shouldTouchLastUsed,
} from "@/lib/domain/agent-keys";

const bytes = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256));

describe("鍵の作り", () => {
  it("推測できない長さで作る（当てられる長さにしない）", () => {
    expect(AGENT_KEY_BYTES).toBeGreaterThanOrEqual(32);
    expect(encodeAgentKey(bytes(AGENT_KEY_BYTES)).length).toBeGreaterThanOrEqual(32);
  });

  it("貼っても壊れない文字だけを使う", () => {
    // シェルが解釈する記号（$ ` " \ 空白）が入ると、貼り方次第で鍵が変わる。
    const raw = encodeAgentKey(bytes(AGENT_KEY_BYTES));
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("同じ乱数からは同じ鍵、違う乱数からは違う鍵になる", () => {
    expect(encodeAgentKey(bytes(32))).toBe(encodeAgentKey(bytes(32)));
    expect(encodeAgentKey(new Uint8Array([1, 2, 3]))).not.toBe(encodeAgentKey(new Uint8Array([3, 2, 1])));
  });

  it("短い乱数でも詰め物の記号を残さない", () => {
    expect(encodeAgentKey(new Uint8Array([255, 254]))).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("画面に出してよい範囲", () => {
  it("出すのは先頭数文字だけ", () => {
    const raw = encodeAgentKey(bytes(AGENT_KEY_BYTES));
    const prefix = agentKeyPrefix(raw);
    expect(prefix).toHaveLength(AGENT_KEY_PREFIX_LENGTH);
    expect(raw.startsWith(prefix)).toBe(true);
    // 先頭だけでは鍵として使えない長さであること
    expect(AGENT_KEY_PREFIX_LENGTH).toBeLessThan(raw.length / 2);
  });

  it("先頭だけであることが、見た人に伝わる言い方にする", () => {
    expect(agentKeyMaskedLabel("abcd1234")).toContain("以降は表示しません");
  });

  it("閉じたら出せないことを、鍵と同じ場所で言う", () => {
    expect(AGENT_KEY_ONCE_NOTICE).toContain("もう一度表示することはできません");
  });

  it("手元へ貼る1行は、鍵を引用符で囲む", () => {
    expect(agentKeyExportLine("abc-def")).toBe("export HR_AGENT_KEY='abc-def'");
  });
});

describe("鍵の状態", () => {
  const at = (iso: string) => new Date(iso);

  it("失効の印があれば、それだけで使えない", () => {
    expect(agentKeyState({ revokedAt: null })).toBe("active");
    expect(agentKeyState({ revokedAt: at("2026-08-15T00:00:00Z") })).toBe("revoked");
  });

  it("どちらの状態にも言葉と色がある", () => {
    expect(agentKeyStateLabel("active")).toBe("使えます");
    expect(agentKeyStateLabel("revoked")).toBe("失効しました");
    expect(agentKeyStateTone("active")).toBe("done");
    expect(agentKeyStateTone("revoked")).toBe("dropped");
  });

  it("使える鍵は、記録の中から1本だけ選ぶ", () => {
    const records = [
      { id: "k2", revokedAt: null },
      { id: "k1", revokedAt: at("2026-08-01T00:00:00Z") },
    ];
    expect(activeAgentKey(records)?.id).toBe("k2");
    expect(activeAgentKey([{ id: "k1", revokedAt: at("2026-08-01T00:00:00Z") }])).toBeNull();
    expect(activeAgentKey([])).toBeNull();
  });

  it("一度も使われていないことを、黙って空欄にしない", () => {
    expect(agentKeyUsageNote(null)).toContain("まだ一度も使われていません");
    expect(agentKeyUsageNote(at("2026-08-15T00:00:00Z"))).toBe("使われています");
  });

  it("押す前に、何が止まるかを言う", () => {
    expect(agentKeyConfirmText("reissue")).toContain("いまの鍵はすぐに使えなくなります");
    expect(agentKeyConfirmText("revoke")).toContain("いまの鍵はすぐに使えなくなります");
    expect(agentKeyConfirmText("reissue")).not.toBe(agentKeyConfirmText("revoke"));
  });
});

describe("使った時刻の書き換え", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("一度も使われていなければ書く", () => {
    expect(shouldTouchLastUsed(null, now)).toBe(true);
  });

  it("直前に書いたばかりなら書かない（読むたびに書き込みを起こさない）", () => {
    expect(shouldTouchLastUsed(new Date(now.getTime() - 1_000), now)).toBe(false);
  });

  it("間隔が空いていれば書く", () => {
    expect(shouldTouchLastUsed(new Date(now.getTime() - AGENT_KEY_TOUCH_INTERVAL_MS), now)).toBe(true);
  });
});

describe("案内の行き先", () => {
  it("発行の場所と呼び名は1か所で決める", () => {
    expect(AGENT_KEY_PAGE_PATH).toBe("/system/agent-keys");
    expect(AGENT_KEY_PAGE_LABEL).toContain("鍵");
  });
});
