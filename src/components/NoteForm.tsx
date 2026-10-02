"use client";

import { useSaveAction } from "@/lib/use-refresh";
import { createNote } from "@/actions/notes";
import { useState } from "react";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

/** 評価メモの記入。⌘/Ctrl+Enter でも送信できるが、主経路は見えるボタン。 */
export function NoteForm({ employeeId }: { employeeId: string }) {
  const { save, saving } = useSaveAction(createNote, { resource: "notes" });
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"manager" | "admin">("manager");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim() || saving) return;
    setError(null);
    setMessage(null);
    // 保存の応答には、メモを足したあとの一覧が同梱される（サーバー側の refresh()）
    const result = await save({ employeeId, body, visibility });
    // 失敗したときは書いた内容を消さない
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody("");
    setMessage(result.message);
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
      <RefreshStatus message={message} refreshing={saving} />
      <textarea
        id="note_body"
        className="input min-h-[80px] w-full"
        value={body}
        disabled={saving}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="例：4月の面談で、来期はチーム内の勉強会を主導したいと話していた。"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void submit()} disabled={saving || !body.trim()}>
          {saving ? "保存しています…" : "メモを残す"}
        </Button>
        <label className="flex items-center gap-2 text-note">
          <input
            type="checkbox"
            checked={visibility === "admin"}
            disabled={saving}
            onChange={(e) => setVisibility(e.target.checked ? "admin" : "manager")}
          />
          管理者だけが読めるようにする
        </label>
        <span className="footnote">{modLabel} でも保存できます</span>
      </div>
    </Card>
  );
}
