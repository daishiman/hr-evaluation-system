"use client";

import { useSaveAction } from "@/lib/use-refresh";
import { createNote } from "@/actions/notes";
import { useState } from "react";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import type { NoteVisibility } from "@/lib/domain/evaluation-authority";

/**
 * 評価メモの記入。⌘/Ctrl+Enter でも送信できるが、主経路は見えるボタン。
 *
 * visibilities は見る人が選べる公開範囲（readableNoteVisibilities(viewer.role) を呼び出し側で渡す）。
 * 書ける段階は読める段階と同じなので、「管理者だけが読めるようにする」は admin を読める人にだけ出す。
 * 保存のときもサーバーが同じ関数で確かめる（src/actions/notes.ts）。
 */
export function NoteForm({
  employeeId,
  visibilities,
}: {
  employeeId: string;
  visibilities: readonly NoteVisibility[];
}) {
  const { save, saving } = useSaveAction(createNote, { resource: "notes" });
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("manager");
  const canChooseAdminOnly = visibilities.includes("admin");
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
        {canChooseAdminOnly && (
          <label className="flex items-center gap-2 text-note">
            <input
              type="checkbox"
              checked={visibility === "admin"}
              disabled={saving}
              onChange={(e) => setVisibility(e.target.checked ? "admin" : "manager")}
            />
            管理者だけが読めるようにする
          </label>
        )}
        <span className="footnote">{modLabel} でも保存できます</span>
      </div>
    </Card>
  );
}
