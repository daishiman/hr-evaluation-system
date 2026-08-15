import { requireRole } from "@/lib/session";
import { getDb } from "@/lib/db";
import { envKeyEnabled, listAgentKeys } from "@/lib/agent-keys";
import { hasEnvKey } from "@/lib/agent-api";
import { AgentKeyPanel, type AgentKeyView } from "@/components/AgentKeyPanel";
import { PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/view";
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

  return (
    <>
      <PageTitle
        title={AGENT_KEY_PAGE_LABEL}
        lede="届いた改善要望を Claude Code が受け取るための鍵を、ここで発行します。"
      />
      <AgentKeyPanel keys={views} envConfigured={envConfigured} envEnabled={envEnabled} />
    </>
  );
}
