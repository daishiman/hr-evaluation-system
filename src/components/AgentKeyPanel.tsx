"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyBlock } from "@/components/CopyBlock";
import { RefreshStatus } from "@/components/RefreshStatus";
import { Button, Card, ReasonNote, SectionHeading } from "@/components/ui";
import { AGENT_KEY_ONCE_NOTICE, agentKeyConfirmText } from "@/lib/domain/agent-keys";
import { useRefreshAfterSave } from "@/lib/use-refresh";

/**
 * 作業指示文を受け取るための鍵を、画面から発行する。
 *
 * 生の鍵をここに置いておくのは、発行した直後の1回だけ。画面を離れれば消え、
 * サーバーにも残っていないので二度と出せない。だから「閉じたら出せない」を
 * 鍵より先に、鍵と同じ場所に出す（あとから言っても、その時にはもう閉じている）。
 *
 * 作り直し・失効は取り消しがきかないので、押す前に何が止まるかを1回だけ確認する。
 */

interface IssuedKey {
  key: string;
  exportLine: string;
  prompt: string;
}

export function AgentKeyPanel({ hasActiveKey }: { hasActiveKey: boolean }) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);

  const send = async (method: "POST" | "DELETE") => {
    if (busy || refreshing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/agent-keys", { method });
      const json = (await res.json()) as { ok: boolean; message?: string } & Partial<IssuedKey>;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "処理できませんでした。もう一度お試しください。");
        return;
      }
      if (method === "POST" && json.key && json.exportLine && json.prompt) {
        setIssued({ key: json.key, exportLine: json.exportLine, prompt: json.prompt });
        setMessage("鍵を発行しました。いまだけ表示しています。");
      } else {
        setIssued(null);
        setMessage(json.message ?? "鍵を失効させました。");
      }
      refresh();
    } catch {
      setError("通信できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
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
              label="手元の設定用の1行をコピー"
              text={issued.exportLine}
              summary="設定用の1行を読む"
              ariaLabel="手元の設定用の1行"
              rows={2}
            />
          </div>
          <div className="mt-4">
            <Button type="button" variant="tertiary" onClick={() => setIssued(null)}>
              控えました。表示を閉じる
            </Button>
          </div>
        </div>
      ) : hasActiveKey ? (
        <div>
          <p className="m-0">いま使える鍵があります。鍵そのものは、発行したとき以外は表示できません。</p>
          <p className="footnote m-0 mt-2">
            手元に控えが無いときは作り直してください。作り直すと、前の鍵はその場で使えなくなります。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ConfirmButton
              label="鍵を作り直す"
              confirm={agentKeyConfirmText("reissue")}
              variant="primary"
              busy={busy}
              busyLabel="発行しています…"
              disabled={refreshing}
              onConfirm={() => void send("POST")}
            />
            <ConfirmButton
              label="鍵を失効させる"
              confirm={agentKeyConfirmText("revoke")}
              variant="danger-outline"
              busy={busy}
              busyLabel="失効させています…"
              disabled={refreshing}
              onConfirm={() => void send("DELETE")}
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="m-0">まだ鍵がありません。発行すると、Claude Code が要望を受け取れるようになります。</p>
          <p className="footnote m-0 mt-2">{AGENT_KEY_ONCE_NOTICE}</p>
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              onClick={() => void send("POST")}
              disabled={busy || refreshing}
            >
              {busy ? "発行しています…" : "鍵を発行する"}
            </Button>
          </div>
        </div>
      )}

      <SectionHeading help="ターミナルを使う場合の手順です。画面から発行した鍵があれば、こちらは不要です。">
        ターミナルから設定する
      </SectionHeading>
      <p className="footnote m-0">
        openssl rand -base64 32 で文字列を作ります。
        それを wrangler secret put AGENT_API_KEY で登録します。
        どちらで設定した鍵でも同じように通ります。
      </p>
    </Card>
  );
}
