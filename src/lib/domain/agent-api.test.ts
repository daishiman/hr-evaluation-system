import { describe, expect, it } from "vitest";
import {
  AGENT_BULK_MAX,
  AGENT_KEY_MIN_LENGTH,
  AGENT_KEY_NAME,
  AGENT_KEY_PUT_COMMAND,
  AGENT_KEY_SHELL_VAR,
  AGENT_LIST_MAX,
  AGENT_UNAUTHORIZED_MESSAGE,
  agentAuth,
  agentFetchCommand,
  agentFormat,
  agentKeyMissingMessage,
  agentKeySetupLines,
  agentPromptText,
  keysMatch,
  parseAgentIds,
  readBearer,
} from "@/lib/domain/agent-api";

const KEY = "k".repeat(AGENT_KEY_MIN_LENGTH);

describe("鍵が無ければ中身を返さない", () => {
  it("鍵を付けずに来たら断る", () => {
    const r = agentAuth(KEY, null);
    expect(r).toEqual({ ok: false, status: 401, message: AGENT_UNAUTHORIZED_MESSAGE });
  });

  it("違う鍵でも断る", () => {
    expect(agentAuth(KEY, `Bearer ${"x".repeat(AGENT_KEY_MIN_LENGTH)}`)).toMatchObject({ ok: false, status: 401 });
  });

  it("鍵の取り違えと鍵なしで、断り文を変えない", () => {
    // 文面が違うと、総当たりをする側が「近い」ことを読み取れてしまう。
    const missing = agentAuth(KEY, null);
    const wrong = agentAuth(KEY, "Bearer zzzz");
    expect(missing).toEqual(wrong);
  });

  it("断り文に鍵そのものや長さの手がかりを載せない", () => {
    expect(AGENT_UNAUTHORIZED_MESSAGE).not.toContain(KEY);
    expect(AGENT_UNAUTHORIZED_MESSAGE).not.toContain(String(AGENT_KEY_MIN_LENGTH));
  });

  it("正しい鍵なら通す", () => {
    expect(agentAuth(KEY, `Bearer ${KEY}`)).toEqual({ ok: true });
  });

  it("鍵の前後の空白は落として比べる", () => {
    expect(agentAuth(`  ${KEY}  `, `Bearer ${KEY}`)).toEqual({ ok: true });
  });
});

describe("鍵が未設定のとき", () => {
  it("使えないことと、設定の手順を返す", () => {
    for (const key of [null, undefined, "", "みじかい鍵"]) {
      const r = agentAuth(key, `Bearer ${KEY}`);
      expect(r).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("短すぎる鍵は設定されていない扱いにする", () => {
    const short = "k".repeat(AGENT_KEY_MIN_LENGTH - 1);
    expect(agentAuth(short, `Bearer ${short}`)).toMatchObject({ ok: false, status: 503 });
  });

  it("手順は上から順にやれば終わる形で、登録コマンドを含む", () => {
    const lines = agentKeySetupLines();
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.join("\n")).toContain(AGENT_KEY_PUT_COMMAND);
    expect(AGENT_KEY_PUT_COMMAND).toContain(AGENT_KEY_NAME);
    expect(agentKeyMissingMessage()).toContain("設定されていません");
    expect(agentKeyMissingMessage()).toContain(AGENT_KEY_NAME);
  });
});

describe("鍵の読み取りと突き合わせ", () => {
  it("Bearer の形だけを鍵として受け取る", () => {
    expect(readBearer("Bearer abc")).toBe("abc");
    expect(readBearer("bearer abc")).toBe("abc");
    expect(readBearer("  Bearer   abc  ")).toBe("abc");
    expect(readBearer(null)).toBeNull();
    expect(readBearer("")).toBeNull();
    expect(readBearer("abc")).toBeNull();
    expect(readBearer("Basic abc")).toBeNull();
    expect(readBearer("Bearer ")).toBeNull();
    expect(readBearer("Bearer a b")).toBeNull();
  });

  it("長さが違えばその場で不一致、同じ長さなら最後まで見る", () => {
    expect(keysMatch("abcd", "abc")).toBe(false);
    expect(keysMatch("abcd", "abce")).toBe(false);
    expect(keysMatch("abcd", "zbcd")).toBe(false);
    expect(keysMatch("abcd", "abcd")).toBe(true);
  });
});

describe("返す形式", () => {
  it("何も指定がなければ Markdown で返す", () => {
    expect(agentFormat(null, null)).toBe("markdown");
    expect(agentFormat(null, "text/html")).toBe("markdown");
  });

  it("JSON がほしいと言われたときだけ JSON で返す", () => {
    expect(agentFormat("json", null)).toBe("json");
    expect(agentFormat(null, "application/json")).toBe("json");
    expect(agentFormat(null, "APPLICATION/JSON, */*")).toBe("json");
  });

  it("形式の指定は、受け取りたい形の記述より優先する", () => {
    expect(agentFormat("markdown", "application/json")).toBe("markdown");
    expect(agentFormat("json", "text/markdown")).toBe("json");
  });

  it("知らない指定は既定に戻す", () => {
    expect(agentFormat("yaml", null)).toBe("markdown");
  });
});

describe("まとめて受け取る件数", () => {
  it("空なら1件も返さない", () => {
    expect(parseAgentIds(null)).toEqual({ ids: [], dropped: 0 });
    expect(parseAgentIds(" , , ")).toEqual({ ids: [], dropped: 0 });
  });

  it("前後の空白を落とし、同じものは1件にまとめる", () => {
    expect(parseAgentIds(" a , b ,a")).toEqual({ ids: ["a", "b"], dropped: 0 });
  });

  it("上限を超えた分は切り、切った件数を返す", () => {
    const many = Array.from({ length: AGENT_BULK_MAX + 3 }, (_, i) => `id${i}`);
    const r = parseAgentIds(many.join(","));
    expect(r.ids).toHaveLength(AGENT_BULK_MAX);
    expect(r.dropped).toBe(3);
  });

  it("一覧の上限は、まとめて渡す上限より多い", () => {
    expect(AGENT_LIST_MAX).toBeGreaterThan(AGENT_BULK_MAX);
  });
});

describe("渡す文面", () => {
  it("取得コマンドに本物の鍵を書かない", () => {
    const cmd = agentFetchCommand("https://example.test", "?id=improve_1");
    expect(cmd).toContain(`$${AGENT_KEY_SHELL_VAR}`);
    expect(cmd).toContain("https://example.test/api/improvements?id=improve_1");
    expect(cmd).not.toContain(KEY);
  });

  it("貼る文だけで、取得から作業まで進める", () => {
    const text = agentPromptText("https://example.test", "?ids=a,b");
    expect(text).toContain(agentFetchCommand("https://example.test", "?ids=a,b"));
    expect(text).toContain(AGENT_KEY_SHELL_VAR);
    expect(text).toContain("受け取った指示文");
    expect(text).not.toContain(KEY);
  });
});
