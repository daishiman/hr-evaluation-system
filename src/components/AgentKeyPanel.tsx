"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyBlock } from "@/components/CopyBlock";
import { RefreshStatus } from "@/components/RefreshStatus";
import { Badge, Button, Card, EmptyState, ReasonNote, RecordList, SectionHeading } from "@/components/ui";
import {
  AGENT_ENV_KEY_DELETE_COMMAND,
  AGENT_ENV_KEY_TITLE,
  AGENT_KEY_LABEL_MAX,
  AGENT_KEY_LABEL_PLACEHOLDER,
  AGENT_KEY_ONCE_NOTICE,
  agentKeyCapNote,
  agentKeyLabelError,
  agentKeyRevokeConfirmText,
  canIssueAgentKey,
  envKeyNote,
  envKeyStateLabel,
  envKeyStateTone,
  envKeyToggleConfirm,
  envKeyToggleLabel,
} from "@/lib/domain/agent-keys";
import { useRefreshAfterSave } from "@/lib/use-refresh";

/**
 * 作業指示文を受け取るための鍵を、画面から発行・管理する。
 *
 * 生の鍵をここに置いておくのは、発行した直後の1回だけ。画面を離れれば消え、
 * サーバーにも残っていないので二度と出せない。だから「閉じたら出せない」を
 * 鍵より先に、鍵と同じ場所に出す（あとから言っても、その時にはもう閉じている）。
 *
 * 鍵は複数本を同時に使える。止めるのは1本ずつで、他の鍵は動き続ける。
 * どれを止めてよいか分かるように、発行のときに用途の名前を必ず付けてもらう。
 *
 * 一覧をこの部品の中に置いているのは、行ごとに「止める」を出すため。
 * 表示だけを画面側に分けると、押したあとの結果表示が2箇所に散る。
 */

interface IssuedKey {
  key: string;
  envFileLine: string;
  prompt: string;
}

/** 画面に出す1本ぶん。日時は画面側で文字にしてから渡す。 */
export interface AgentKeyView {
  id: string;
  name: string;
  masked: string;
  active: boolean;
  stateLabel: string;
  tone: "done" | "dropped";
  createdText: string;
  lastUsedText: string;
  revokedText: string | null;
}

interface ApiResult {
  ok: boolean;
  message?: string;
  key?: string;
  envFileLine?: string;
  prompt?: string;
}

export function AgentKeyPanel({
  keys,
  envConfigured,
  envEnabled,
}: {
  keys: AgentKeyView[];
  envConfigured: boolean;
  envEnabled: boolean;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [label, setLabel] = useState("");

  const activeKeys = keys.filter((k) => k.active);
  const canIssue = canIssueAgentKey(activeKeys.length);

  const send = async (path: string, init: RequestInit): Promise<ApiResult | null> => {
    if (busy || refreshing) return null;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(path, init);
      const json = (await res.json()) as ApiResult;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "処理できませんでした。もう一度お試しください。");
        return null;
      }
      return json;
    } catch {
      setError("通信できませんでした。もう一度お試しください。");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    const labelError = agentKeyLabelError(label);
    if (labelError) {
      setError(labelError);
      return;
    }
    const json = await send("/api/agent-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!json?.key || !json.envFileLine || !json.prompt) return;
    setIssued({ key: json.key, envFileLine: json.envFileLine, prompt: json.prompt });
    setMessage("鍵を発行しました。いまだけ表示しています。");
    setLabel("");
    refresh();
  };

  const revoke = async (id: string) => {
    const json = await send(`/api/agent-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!json) return;
    setMessage(json.message ?? "鍵を止めました。");
    refresh();
  };

  const toggleEnvKey = async () => {
    const json = await send("/api/agent-keys", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ envKeyEnabled: !envEnabled }),
    });
    if (!json) return;
    setMessage(json.message ?? "切り替えました。");
    refresh();
  };

  return (
    <>
      <SectionHeading help="鍵が1本も無い間は、受け取りの入口は何も返しません。">鍵を発行する</SectionHeading>
      <Card className="card-pad">
        {error && <ReasonNote>{error}</ReasonNote>}
        <RefreshStatus message={message} refreshing={refreshing} target="画面" />

        {issued ? (
          <div>
            <p className="m-0 font-bold text-danger" role="alert" aria-live="assertive">
              {AGENT_KEY_ONCE_NOTICE}
            </p>
            <p className="footnote m-0 mt-2">
              下の3つのうち、使うものをコピーしてください。鍵そのものはどこにも保存していません。
            </p>
            <div className="mt-3 grid gap-4">
              <CopyBlock
                label="鍵をコピー"
                text={issued.key}
                summary="鍵を見る"
                ariaLabel="発行した鍵"
                rows={2}
                open
              />
              <CopyBlock
                label="Claude Code へ貼る文言をコピー"
                text={issued.prompt}
                summary="貼る文言を読む"
                ariaLabel="Claude Code へ貼る文言"
              />
              <CopyBlock
                label=".env.local へ書く1行をコピー"
                text={issued.envFileLine}
                summary=".env.local へ書く1行を読む"
                ariaLabel="設定ファイルへ書く1行"
                rows={2}
              />
            </div>
            <div className="mt-4">
              <Button type="button" variant="tertiary" onClick={() => setIssued(null)}>
                控えました。表示を閉じる
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="m-0">{agentKeyCapNote(activeKeys.length)}</p>
            <p className="footnote m-0 mt-2">{AGENT_KEY_ONCE_NOTICE}</p>
            <label className="footnote mt-3 block" htmlFor="agent_key_label">
              この鍵をどこで使いますか（例: {AGENT_KEY_LABEL_PLACEHOLDER}）
            </label>
            <input
              id="agent_key_label"
              className="input w-full"
              type="text"
              value={label}
              maxLength={AGENT_KEY_LABEL_MAX}
              placeholder={AGENT_KEY_LABEL_PLACEHOLDER}
              disabled={!canIssue}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div className="mt-4">
              <Button
                type="button"
                variant="primary"
                onClick={() => void issue()}
                disabled={busy || refreshing || !canIssue}
              >
                {busy ? "発行しています…" : "鍵を発行する"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <SectionHeading help="行は消えません。止めた鍵も記録として残ります。">発行した鍵</SectionHeading>
      {keys.length === 0 ? (
        <EmptyState
          title="まだ鍵を発行していません"
          body="上の「鍵を発行する」を押すと、ここに発行した鍵が並びます。"
        />
      ) : (
        <RecordList
          items={keys.map((k) => ({
            key: k.id,
            title: k.name,
            marks: <Badge tone={k.tone}>{k.stateLabel}</Badge>,
            off: !k.active,
            rows: [
              { label: "鍵の先頭", value: k.masked },
              { label: "発行した人と日時", value: k.createdText },
              { label: "最後に使われた日時", value: k.lastUsedText },
              ...(k.revokedText ? [{ label: "止めた人と日時", value: k.revokedText }] : []),
            ],
            action: k.active ? (
              <ConfirmButton
                label="この鍵を止める"
                confirm={agentKeyRevokeConfirmText(k.name, activeKeys.length - 1)}
                variant="danger-outline"
                busy={busy}
                busyLabel="止めています…"
                disabled={refreshing}
                onConfirm={() => void revoke(k.id)}
              />
            ) : undefined,
          }))}
        />
      )}

      <SectionHeading help="ターミナルから登録した鍵です。画面の一覧には出てきません。">
        {AGENT_ENV_KEY_TITLE}
      </SectionHeading>
      <Card className="card-pad">
        <div className="list-card-head">
          <span className="min-w-0">{AGENT_ENV_KEY_TITLE}</span>
          <Badge tone={envKeyStateTone(envConfigured, envEnabled)}>
            {envKeyStateLabel(envConfigured, envEnabled)}
          </Badge>
        </div>
        <p className="m-0 mt-2">{envKeyNote(envConfigured, envEnabled)}</p>
        {envConfigured && (
          <>
            <div className="mt-4">
              <ConfirmButton
                label={envKeyToggleLabel(envEnabled)}
                confirm={envKeyToggleConfirm(envEnabled)}
                variant={envEnabled ? "danger-outline" : "secondary"}
                busy={busy}
                busyLabel="切り替えています…"
                disabled={refreshing}
                onConfirm={() => void toggleEnvKey()}
              />
            </div>
            <p className="footnote m-0 mt-3">
              設定値そのものを消すときは、ターミナルで次の1行を実行します。
              消したあとは元に戻せません。
            </p>
            <CopyBlock
              label="消すコマンドをコピー"
              text={AGENT_ENV_KEY_DELETE_COMMAND}
              summary="コマンドを読む"
              ariaLabel="設定値の鍵を消すコマンド"
              rows={2}
            />
          </>
        )}
      </Card>
    </>
  );
}
