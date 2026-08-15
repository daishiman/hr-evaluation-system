import { describe, expect, it } from "vitest";
import {
  AGENT_ENV_KEY_DELETE_COMMAND,
  AGENT_ENV_KEY_TITLE,
  AGENT_KEY_BYTES,
  AGENT_KEY_CAP_MESSAGE,
  AGENT_KEY_LABEL_MAX,
  AGENT_KEY_LABEL_PLACEHOLDER,
  AGENT_KEY_MAX,
  AGENT_KEY_ONCE_NOTICE,
  AGENT_KEY_PAGE_LABEL,
  AGENT_KEY_PAGE_PATH,
  AGENT_KEY_PREFIX_LENGTH,
  AGENT_KEY_TOUCH_INTERVAL_MS,
  activeAgentKey,
  activeAgentKeys,
  agentKeyCapNote,
  agentKeyDisplayName,
  agentKeyEnvFileLine,
  agentKeyLabelError,
  agentKeyMaskedLabel,
  agentKeyPrefix,
  agentKeyRevokeConfirmText,
  agentKeyState,
  agentKeyStateLabel,
  agentKeyStateTone,
  agentKeyUsageNote,
  canIssueAgentKey,
  encodeAgentKey,
  envKeyNote,
  envKeyStateLabel,
  envKeyStateTone,
  envKeyToggleConfirm,
  envKeyToggleLabel,
  normalizeAgentKeyLabel,
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

  it("設定ファイルへ貼る1行は、変数名と鍵だけにする", () => {
    // .env.local は行をそのまま読む。引用符や export を足すと読み方が増える。
    expect(agentKeyEnvFileLine("abc-def")).toBe("HR_AGENT_KEY=abc-def");
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

  it("使える鍵をまとめて取り出せる", () => {
    const records = [
      { id: "k2", revokedAt: null },
      { id: "k1", revokedAt: at("2026-08-01T00:00:00Z") },
      { id: "k3", revokedAt: null },
    ];
    expect(activeAgentKeys(records).map((r) => r.id)).toEqual(["k2", "k3"]);
    expect(activeAgentKeys([])).toEqual([]);
  });

  it("押す前に、止まる1本と残る本数を言う", () => {
    const text = agentKeyRevokeConfirmText("自宅の Claude Code", 2);
    expect(text).toContain("「自宅の Claude Code」");
    expect(text).toContain("残りの2本はそのまま使えます");
    expect(agentKeyRevokeConfirmText("社内PC", 0)).toContain("0本になります");
  });
});

describe("用途の名前", () => {
  it("空白をならし、長すぎる名前は切る", () => {
    expect(normalizeAgentKeyLabel("  自宅の\n Claude  Code ")).toBe("自宅の Claude Code");
    expect(normalizeAgentKeyLabel(null)).toBe("");
    expect(normalizeAgentKeyLabel(undefined)).toBe("");
    expect(normalizeAgentKeyLabel("あ".repeat(AGENT_KEY_LABEL_MAX + 5))).toHaveLength(AGENT_KEY_LABEL_MAX);
  });

  it("名前が無い発行は受け付けない（先頭数文字だけの一覧を作らない）", () => {
    expect(agentKeyLabelError("   ")).toContain("どこで使うか");
    expect(agentKeyLabelError(null)).not.toBeNull();
    expect(agentKeyLabelError("社内PC")).toBeNull();
  });

  it("入力欄の例と、名前が無い古い記録の呼び方がある", () => {
    expect(AGENT_KEY_LABEL_PLACEHOLDER.length).toBeGreaterThan(0);
    expect(agentKeyDisplayName({ label: "社内PC", keyPrefix: "abcd1234" })).toBe("社内PC");
    expect(agentKeyDisplayName({ label: "  ", keyPrefix: "abcd1234" })).toBe("名前のない鍵");
  });
});

describe("発行できる本数", () => {
  it("上限に達するまでは発行できる", () => {
    expect(canIssueAgentKey(0)).toBe(true);
    expect(canIssueAgentKey(AGENT_KEY_MAX - 1)).toBe(true);
    expect(canIssueAgentKey(AGENT_KEY_MAX)).toBe(false);
  });

  it("いま何本かを出し、上限では次にすることまで書く", () => {
    expect(agentKeyCapNote(3)).toContain("3本");
    expect(agentKeyCapNote(AGENT_KEY_MAX)).toContain("止めてから発行してください");
    expect(AGENT_KEY_CAP_MESSAGE).toBe(agentKeyCapNote(AGENT_KEY_MAX));
  });
});

describe("サーバーの設定値の鍵", () => {
  it("登録の有無と、受け付けているかを分けて言う", () => {
    expect(envKeyStateLabel(false, true)).toBe("登録されていません");
    expect(envKeyStateLabel(true, true)).toBe("使えます");
    expect(envKeyStateLabel(true, false)).toBe("止めています");
    expect(envKeyStateTone(false, true)).toBe("closed");
    expect(envKeyStateTone(true, true)).toBe("done");
    expect(envKeyStateTone(true, false)).toBe("dropped");
  });

  it("その状態が何を意味するかを、札の隣に必ず出す", () => {
    expect(envKeyNote(false, true)).toContain("ターミナルから登録した鍵はありません");
    expect(envKeyNote(true, true)).toContain("この鍵では受け取れます");
    expect(envKeyNote(true, false)).toContain("止めています");
  });

  it("止める・戻すは、どちらも取り消せることを言う", () => {
    expect(envKeyToggleLabel(true)).toContain("止める");
    expect(envKeyToggleLabel(false)).toContain("再開");
    expect(envKeyToggleConfirm(true)).toContain("いつでも戻せます");
    expect(envKeyToggleConfirm(false)).toContain("設定値はそのまま残っています");
  });

  it("設定値そのものを消す手順は、鍵の名前を含む1行にする", () => {
    expect(AGENT_ENV_KEY_DELETE_COMMAND).toContain("AGENT_API_KEY");
    expect(AGENT_ENV_KEY_TITLE).toContain("鍵");
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
