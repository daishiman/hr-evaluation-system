"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useState } from "react";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

/** 評価メモの記入。⌘/Ctrl+Enter でも送信できるが、主経路は見えるボタン。 */
export function NoteForm({ employeeId }: { employeeId: string }) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"manager" | "admin">("manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim() || busy || refreshing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId, body, visibility }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setBody("");
      setMessage("メモを保存しました。");
      refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  // テキストエリアなので Enter は改行。送信は見えるボタンと ⌘/Ctrl+Enter だけ。
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const modLabel = isMac ? "\u2318 + Enter" : "Ctrl + Enter";
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={refreshing} />
      <textarea
        id="note_body"
        className="input min-h-[80px] w-full"
        value={body}
        disabled={busy || refreshing}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="例：4月の面談で、来期はチーム内の勉強会を主導したいと話していた。"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={busy || refreshing || !body.trim()}>
          {busy ? "保存しています…" : refreshing ? "一覧に反映しています…" : "メモを残す"}
        </Button>
        <label className="flex items-center gap-2 text-note">
          <input
            type="checkbox"
            checked={visibility === "admin"}
            disabled={busy || refreshing}
            onChange={(e) => setVisibility(e.target.checked ? "admin" : "manager")}
          />
          管理者だけが読めるようにする
        </label>
        <span className="footnote">{modLabel} でも保存できます</span>
      </div>
    </Card>
  );
}
