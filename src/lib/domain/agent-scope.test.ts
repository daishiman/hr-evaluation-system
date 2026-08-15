import { describe, expect, it } from "vitest";
import {
  AGENT_NOT_CLAIMED_MESSAGE,
  AGENT_NOT_FOUND_MESSAGE,
  AGENT_NOT_REVIEWED_MESSAGE,
  AGENT_NO_WRITE_SCOPE_MESSAGE,
  AGENT_SCOPES,
  DEFAULT_AGENT_SCOPES,
  RELEASE_REF_MAX,
  AGENT_FAILED_NOTE_MAX,
  agentResultAction,
  agentResultNote,
  agentScopeLabel,
  canReadImprovement,
  canWriteImprovement,
  failedNoteError,
  hasAgentScope,
  isAgentScope,
  parseAgentScopes,
  releaseRefError,
  serializeAgentScopes,
  type AgentCallerScope,
} from "@/lib/domain/agent-scope";

const readonlyKey: AgentCallerScope = { keyId: "k1", companyId: "c1", scopes: ["improvements:read"] };
const fullKey: AgentCallerScope = { keyId: "k1", companyId: "c1", scopes: [...AGENT_SCOPES] };
/** 会社を焼き込む前に発行した鍵、およびサーバーの設定値の鍵。 */
const legacyKey: AgentCallerScope = { keyId: null, companyId: null, scopes: ["improvements:read"] };

describe("権限の読み書き", () => {
  it("新しい鍵には読み取りと自分の分の更新が付く", () => {
    expect(DEFAULT_AGENT_SCOPES).toEqual(["improvements:read", "improvements:write-own"]);
  });

  it("知らない権限名は落とす", () => {
    expect(parseAgentScopes("improvements:read, improvements:delete-all")).toEqual(["improvements:read"]);
  });

  it("重複と空欄をならす", () => {
    expect(parseAgentScopes(" improvements:read , improvements:read ,,")).toEqual(["improvements:read"]);
    expect(parseAgentScopes(null)).toEqual([]);
    expect(parseAgentScopes(undefined)).toEqual([]);
  });

  it("保存の形は読み戻せる", () => {
    expect(parseAgentScopes(serializeAgentScopes(AGENT_SCOPES))).toEqual([...AGENT_SCOPES]);
    expect(serializeAgentScopes(["improvements:read", "improvements:read"])).toBe("improvements:read");
  });

  it("権限名かどうかを見分ける", () => {
    expect(isAgentScope("improvements:read")).toBe(true);
    expect(isAgentScope("improvements:everything")).toBe(false);
  });

  it("権限は日本語の呼び名で出す", () => {
    expect(agentScopeLabel("improvements:read")).toBe("要望の読み取り");
    expect(agentScopeLabel("improvements:write-own")).toBe("自分が取得した要望の状態更新");
  });

  it("持っているかを確かめられる", () => {
    expect(hasAgentScope(fullKey.scopes, "improvements:write-own")).toBe(true);
    expect(hasAgentScope(readonlyKey.scopes, "improvements:write-own")).toBe(false);
  });
});

describe("読める範囲", () => {
  it("焼き込んだ会社の要望は読める", () => {
    expect(canReadImprovement(readonlyKey, "c1")).toEqual({ ok: true });
  });

  it("他社の要望は「見つかりません」で返す（他社だと言わない）", () => {
    expect(canReadImprovement(readonlyKey, "c2")).toEqual({
      ok: false,
      status: 404,
      message: AGENT_NOT_FOUND_MESSAGE,
    });
  });

  it("会社が焼き込まれていない鍵は、これまでどおり全社を読める", () => {
    expect(canReadImprovement(legacyKey, "c9")).toEqual({ ok: true });
  });

  it("読み取りの権限が無ければ断る", () => {
    const gate = canReadImprovement({ ...readonlyKey, scopes: [] }, "c1");
    expect(gate).toMatchObject({ ok: false, status: 403 });
  });
});

describe("状態を変えてよい範囲", () => {
  it("権限・会社・受け取り済みが揃えば通す", () => {
    expect(canWriteImprovement(fullKey, { companyId: "c1", claimedByThisKey: true })).toEqual({ ok: true });
  });

  it("読み取りだけの鍵では変えられない", () => {
    expect(canWriteImprovement(readonlyKey, { companyId: "c1", claimedByThisKey: true })).toEqual({
      ok: false,
      status: 403,
      message: AGENT_NO_WRITE_SCOPE_MESSAGE,
    });
  });

  it("会社が決まらない鍵では変えられない", () => {
    const noCompany: AgentCallerScope = { keyId: "k1", companyId: null, scopes: [...AGENT_SCOPES] };
    const noKeyRow: AgentCallerScope = { keyId: null, companyId: "c1", scopes: [...AGENT_SCOPES] };
    expect(canWriteImprovement(noCompany, { companyId: "c1", claimedByThisKey: true })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(canWriteImprovement(noKeyRow, { companyId: "c1", claimedByThisKey: true })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("他社の要望は変えられない（見つからない、として返す）", () => {
    expect(canWriteImprovement(fullKey, { companyId: "c2", claimedByThisKey: true })).toEqual({
      ok: false,
      status: 404,
      message: AGENT_NOT_FOUND_MESSAGE,
    });
  });

  it("受け取っていない要望は変えられない", () => {
    expect(canWriteImprovement(fullKey, { companyId: "c1", claimedByThisKey: false })).toEqual({
      ok: false,
      status: 403,
      message: AGENT_NOT_CLAIMED_MESSAGE,
    });
  });
});

describe("終わったときの書き戻し", () => {
  it("確認依頼の場所が空なら受けない", () => {
    expect(releaseRefError("  ")).toContain("確認依頼の場所");
  });

  it("確認依頼の場所は長すぎると受けない", () => {
    expect(releaseRefError("v".repeat(RELEASE_REF_MAX + 1))).toContain(`${RELEASE_REF_MAX}文字`);
    expect(releaseRefError("#81")).toBeNull();
  });

  it("直しきれなかったときは理由が要る", () => {
    expect(failedNoteError("")).toContain("理由");
    expect(failedNoteError("あ".repeat(AGENT_FAILED_NOTE_MAX + 1))).toContain(`${AGENT_FAILED_NOTE_MAX}文字`);
    expect(failedNoteError("再現できませんでした")).toBeNull();
  });

  it("履歴の1文に、どの鍵が何をしたかを書く", () => {
    expect(agentResultNote("review", " #81 ", "自宅の Claude Code")).toBe(
      "「自宅の Claude Code」の鍵が直して確認を依頼しました（#81）",
    );
    expect(agentResultNote("failed", "再現できず", null)).toBe("作業する側が直しきれませんでした（再現できず）");
  });

  it("取り込まれた行は、鍵の名前ではなく取り込みの事実を書く", () => {
    // 取り込むのは人。ここで鍵の名前を主語にすると、誰が取り込んだかを
    // 取り違えて読む（実際には鍵は「取り込まれた」と報告しているだけ）。
    expect(agentResultNote("done", "#81", "自宅の Claude Code")).toBe("確認依頼が取り込まれました（#81）");
  });

  it("履歴の操作名は、人の操作と混ざらない", () => {
    expect(agentResultAction("review")).toBe("agent-review");
    expect(agentResultAction("done")).toBe("agent-done");
    expect(agentResultAction("failed")).toBe("agent-failed");
  });

  it("順番を飛ばして対応済みにしようとしたときの断り文に、次の一手が入る", () => {
    expect(AGENT_NOT_REVIEWED_MESSAGE).toContain("対応済みにできません");
    expect(AGENT_NOT_REVIEWED_MESSAGE).toContain("pnpm improvements review");
  });
});
