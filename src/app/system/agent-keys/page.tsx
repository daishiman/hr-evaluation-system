import { requireRole } from "@/lib/session";
import { getDb } from "@/lib/db";
import { envKeyEnabled, listAgentKeys } from "@/lib/agent-keys";
import { hasEnvKey } from "@/lib/agent-api";
import { listAgentSessions } from "@/lib/agent-device";
import { AgentKeyPanel, type AgentKeyView, type AgentSessionView } from "@/components/AgentKeyPanel";
import { PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/view";
import {
  sessionDisplayName,
  sessionExpiryNote,
} from "@/lib/domain/agent-device";
import {
  AGENT_KEY_PAGE_LABEL,
  agentKeyDisplayName,
  agentKeyMaskedLabel,
  agentKeyScopeNote,
  agentKeyState,
  agentKeyStateLabel,
  agentKeyStateTone,
  agentKeyUsageNote,
} from "@/lib/domain/agent-keys";

export const dynamic = "force-dynamic";

/**
 * Claude Code に要望を渡すための鍵を発行する画面。
 *
 * 使われる場面: 使い始めるときと、端末が増えたとき。あとは漏れたかもしれない
 * 1本を止めるとき。つまりほとんど開かない画面なので、開いた人がその場で
 * 終われるように「発行 → 発行した鍵 → 設定値の鍵」の順に上から並べる。
 *
 * 鍵そのものは発行した瞬間しか出さない。ここに一覧で並ぶのは先頭数文字だけで、
 * それだけでは受け取りには使えない。
 *
 * 日時はここで文字にしてから渡す。押しものの部品へ Date のまま渡さない。
 */
export default async function SystemAgentKeys() {
  await requireRole("SUPER_ADMIN");
  const keys = await listAgentKeys();
  const sessions = await listAgentSessions();
  const db = await getDb();
  const [envConfigured, envEnabled] = await Promise.all([hasEnvKey(), envKeyEnabled(db)]);

  const views: AgentKeyView[] = keys.map((k) => {
    const state = agentKeyState(k);
    return {
      id: k.id,
      name: agentKeyDisplayName(k),
      masked: agentKeyMaskedLabel(k.keyPrefix),
      active: state === "active",
      stateLabel: agentKeyStateLabel(state),
      tone: agentKeyStateTone(state),
      scopeText: agentKeyScopeNote(k),
      createdText: `${formatDateTime(k.createdAt)}／${k.createdByName ?? "退職された方"}`,
      lastUsedText: k.lastUsedAt ? formatDateTime(k.lastUsedAt) : agentKeyUsageNote(k.lastUsedAt),
      revokedText: k.revokedAt
        ? `${formatDateTime(k.revokedAt)}／${k.revokedByName ?? "退職された方"}`
        : null,
    };
  });

  const now = new Date();
  const sessionViews: AgentSessionView[] = sessions.map((v) => ({
    id: v.id,
    name: sessionDisplayName(v.label),
    active: v.revokedAt === null,
    stateLabel: v.revokedAt ? "止めました" : "使えます",
    tone: v.revokedAt ? "dropped" : "done",
    scopeText: agentKeyScopeNote({ companyName: v.companyName, scopes: v.scopes }),
    createdText: `${formatDateTime(v.createdAt)}／${v.createdByName ?? "退職された方"}`,
    lastUsedText: v.lastUsedAt ? formatDateTime(v.lastUsedAt) : agentKeyUsageNote(v.lastUsedAt),
    expiryText: v.revokedAt ? "止めた端末です。" : sessionExpiryNote(v.refreshExpiresAt, now),
  }));

  return (
    <>
      <PageTitle
        title={AGENT_KEY_PAGE_LABEL}
        lede="Claude Code が改善要望を受け取るための、端末と鍵の管理です。"
      />
      <AgentKeyPanel
        keys={views}
        sessions={sessionViews}
        envConfigured={envConfigured}
        envEnabled={envEnabled}
      />
    </>
  );
}
