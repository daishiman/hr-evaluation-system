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
  agentKeyConfigured,
  agentFetchCommand,
  agentFormat,
  agentKeyMissingMessage,
  agentKeySetupLines,
  agentPromptText,
  keysMatch,
  parseAgentIds,
  readBearer,
  withInlineKey,
  agentPromptTextWithKey,
} from "@/lib/domain/agent-api";
import { AGENT_KEY_PAGE_PATH } from "@/lib/domain/agent-keys";

const KEY = "k".repeat(AGENT_KEY_MIN_LENGTH);
/** 画面から発行した鍵は、ハッシュだけが保存される。突き合わせもハッシュどうし。 */
const HASH = "a".repeat(64);
const env = { envKey: KEY, activeKeyHash: null };
const stored = { envKey: null, activeKeyHash: HASH };

describe("鍵が無ければ中身を返さない", () => {
  it("鍵を付けずに来たら断る", () => {
    const r = agentAuth(env, null, null);
    expect(r).toEqual({ ok: false, status: 401, message: AGENT_UNAUTHORIZED_MESSAGE });
  });

  it("違う鍵でも断る", () => {
    expect(agentAuth(env, `Bearer ${"x".repeat(AGENT_KEY_MIN_LENGTH)}`, "b".repeat(64))).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("鍵の取り違えと鍵なしで、断り文を変えない", () => {
    // 文面が違うと、総当たりをする側が「近い」ことを読み取れてしまう。
    const missing = agentAuth(env, null, null);
    const wrong = agentAuth(env, "Bearer zzzz", "b".repeat(64));
    expect(missing).toEqual(wrong);
  });

  it("断り文に鍵そのものや長さの手がかりを載せない", () => {
    expect(AGENT_UNAUTHORIZED_MESSAGE).not.toContain(KEY);
    expect(AGENT_UNAUTHORIZED_MESSAGE).not.toContain(String(AGENT_KEY_MIN_LENGTH));
  });

  it("サーバーの設定値の鍵なら通す", () => {
    expect(agentAuth(env, `Bearer ${KEY}`, null)).toEqual({ ok: true });
  });

  it("鍵の前後の空白は落として比べる", () => {
    expect(agentAuth({ envKey: `  ${KEY}  `, activeKeyHash: null }, `Bearer ${KEY}`, null)).toEqual({ ok: true });
  });
});

describe("画面から発行した鍵", () => {
  it("保存してあるハッシュと一致すれば通す（生の鍵は突き合わせに使わない）", () => {
    expect(agentAuth(stored, "Bearer なんでもよい", HASH)).toEqual({ ok: true });
  });

  it("ハッシュが違えば断る", () => {
    expect(agentAuth(stored, "Bearer なんでもよい", "b".repeat(64))).toMatchObject({ ok: false, status: 401 });
  });

  it("失効させて保存が空になれば、同じ鍵でも通らない", () => {
    // 失効は「使える鍵が無い」状態。設定値も無ければ未設定と同じ扱いになる。
    expect(agentAuth({ envKey: null, activeKeyHash: null }, "Bearer なんでもよい", HASH)).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("画面の鍵とサーバーの設定値は、どちらでも通る", () => {
    const both = { envKey: KEY, activeKeyHash: HASH };
    expect(agentAuth(both, `Bearer ${KEY}`, "b".repeat(64))).toEqual({ ok: true });
    expect(agentAuth(both, "Bearer 画面の鍵", HASH)).toEqual({ ok: true });
  });

  it("どちらかに鍵があれば「設定済み」とみなす", () => {
    expect(agentKeyConfigured(env)).toBe(true);
    expect(agentKeyConfigured(stored)).toBe(true);
    expect(agentKeyConfigured({ envKey: "みじかい", activeKeyHash: null })).toBe(false);
    expect(agentKeyConfigured({ envKey: null, activeKeyHash: "" })).toBe(false);
  });
});

describe("鍵が未設定のとき", () => {
  it("使えないことと、設定の手順を返す", () => {
    for (const key of [null, undefined, "", "みじかい鍵"]) {
      const r = agentAuth({ envKey: key, activeKeyHash: null }, `Bearer ${KEY}`, null);
      expect(r).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("短すぎる鍵は設定されていない扱いにする", () => {
    const short = "k".repeat(AGENT_KEY_MIN_LENGTH - 1);
    expect(agentAuth({ envKey: short, activeKeyHash: null }, `Bearer ${short}`, null)).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("手順は、画面で発行する道を先に案内する", () => {
    const lines = agentKeySetupLines();
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toContain(AGENT_KEY_PAGE_PATH);
    expect(lines.join("\n")).toContain(AGENT_KEY_PUT_COMMAND);
    expect(AGENT_KEY_PUT_COMMAND).toContain(AGENT_KEY_NAME);
    expect(agentKeyMissingMessage()).toContain("設定されていません");
    expect(agentKeyMissingMessage()).toContain(AGENT_KEY_NAME);
  });

  it("入口の場所が分かっていれば、押せる形の行き先にして返す", () => {
    expect(agentKeyMissingMessage("https://example.test")).toContain(`https://example.test${AGENT_KEY_PAGE_PATH}`);
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

  it("鍵の作り方が分からない人に、発行できる場所を書き添える", () => {
    expect(agentPromptText("https://example.test", "")).toContain(`https://example.test${AGENT_KEY_PAGE_PATH}`);
  });

  it("発行直後だけは、鍵を埋めた形で渡せる", () => {
    // 手元に環境変数を用意しなくても、貼るだけで受け取れる形。
    const text = agentPromptTextWithKey("https://example.test", "", KEY);
    expect(text).toContain(KEY);
    expect(text).not.toContain(`$${AGENT_KEY_SHELL_VAR}`);
    // 鍵が入っていることを、貼る前に読める場所で言う
    expect(text).toContain("人の目に触れる場所へ貼らないでください");
  });

  it("埋め込みは、環境変数の書き方だけを鍵に置き換える", () => {
    expect(withInlineKey(`a $${AGENT_KEY_SHELL_VAR} b $${AGENT_KEY_SHELL_VAR}`, "xyz")).toBe("a xyz b xyz");
    expect(withInlineKey("鍵の入らない文", "xyz")).toBe("鍵の入らない文");
  });
});
