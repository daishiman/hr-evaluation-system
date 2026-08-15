import { requireRole } from "@/lib/session";
import { listAgentKeys } from "@/lib/agent-keys";
import { AgentKeyPanel } from "@/components/AgentKeyPanel";
import { Badge, EmptyState, PageTitle, RecordList, SectionHeading } from "@/components/ui";
import { formatDateTime } from "@/lib/view";
import {
  AGENT_KEY_PAGE_LABEL,
  activeAgentKey,
  agentKeyMaskedLabel,
  agentKeyState,
  agentKeyStateLabel,
  agentKeyStateTone,
  agentKeyUsageNote,
} from "@/lib/domain/agent-keys";

export const dynamic = "force-dynamic";

/**
 * Claude Code に要望を渡すための鍵を発行する画面。
 *
 * 使われる場面: 使い始めるときに1回、あとは漏れたかもしれないときに作り直す。
 * つまりほとんど開かない画面なので、開いた人がその場で終われるように
 * 「いま鍵があるか」を最初に出し、次に押しもの、最後に発行の記録を置く。
 *
 * 鍵そのものは発行した瞬間しか出さない。ここに一覧で並ぶのは先頭数文字だけで、
 * それだけでは受け取りには使えない。
 */
export default async function SystemAgentKeys() {
  await requireRole("SUPER_ADMIN");
  const keys = await listAgentKeys();
  const active = activeAgentKey(keys);

  return (
    <>
      <PageTitle
        title={AGENT_KEY_PAGE_LABEL}
        lede="届いた改善要望を Claude Code が受け取るための鍵を、ここで発行します。"
      />

      <SectionHeading help="鍵が無い間は、受け取りの入口は何も返しません。">いまの状態</SectionHeading>
      <AgentKeyPanel hasActiveKey={active !== null} />

      <SectionHeading help="発行と失効の記録です。行は消えません。">発行の記録</SectionHeading>
      {keys.length === 0 ? (
        <EmptyState
          title="まだ鍵を発行していません"
          body="上の「鍵を発行する」を押すと、ここに発行の記録が並びます。"
        />
      ) : (
        <RecordList
          items={keys.map((k) => {
            const state = agentKeyState(k);
            return {
              key: k.id,
              title: agentKeyMaskedLabel(k.keyPrefix),
              marks: <Badge tone={agentKeyStateTone(state)}>{agentKeyStateLabel(state)}</Badge>,
              off: state === "revoked",
              rows: [
                { label: "発行した人と日時", value: `${formatDateTime(k.createdAt)}／${k.createdByName ?? "退職された方"}` },
                {
                  label: "最後に使われた日時",
                  value: k.lastUsedAt ? formatDateTime(k.lastUsedAt) : agentKeyUsageNote(k.lastUsedAt),
                },
                ...(k.revokedAt
                  ? [
                      {
                        label: "止めた人と日時",
                        value: `${formatDateTime(k.revokedAt)}／${k.revokedByName ?? "退職された方"}`,
                      },
                    ]
                  : []),
              ],
            };
          })}
        />
      )}
    </>
  );
}
