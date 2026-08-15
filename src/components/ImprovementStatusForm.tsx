"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useRef, useState } from "react";
import { Button, Card, ChoiceChip, ReasonNote } from "@/components/ui";
import {
  IMPROVEMENT_STATUSES,
  improvementStatusLabel,
  type ImprovementStatus,
} from "@/lib/domain/improvement";
import { RefreshStatus } from "@/components/RefreshStatus";

/**
 * 要望1件の対応状況を変える。
 *
 * 「対応済み」「見送り」にしても消えない。取り違えたときに戻せるよう、
 * どの状態からでも選び直せる（→ src/lib/domain/improvement.ts）。
 */
export function ImprovementStatusForm({
  id,
  status,
  note,
}: {
  id: string;
  status: ImprovementStatus;
  note: string | null;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [next, setNext] = useState<ImprovementStatus>(status);
  const [text, setText] = useState(note ?? "");
  const [savedStatus, setSavedStatus] = useState(status);
  const [savedNote, setSavedNote] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (busy) return;
    if (next === "dropped" && text.trim().length === 0) {
      setError("見送りにする理由を入力してください。");
      setDone(false);
      noteRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/improvements/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, note: text }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "更新できませんでした。");
        return;
      }
      setSavedStatus(next);
      setSavedNote(text.trim());
      setText(text.trim());
      setDone(true);
      refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  const unchanged = next === savedStatus && text.trim() === savedNote;

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={done ? "対応状況を更新しました。" : null} refreshing={refreshing} target="画面" />

      <p className="footnote m-0">対応状況</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {IMPROVEMENT_STATUSES.map((s) => (
          <ChoiceChip key={s} selected={next === s} disabled={busy || refreshing} onClick={() => setNext(s)}>
            {improvementStatusLabel(s)}
          </ChoiceChip>
        ))}
      </div>

      <label className="footnote mt-3 block" htmlFor="improvement_note">
        対応のメモ（見送りの理由もここに書きます）
      </label>
      <textarea
        ref={noteRef}
        id="improvement_note"
        className="input min-h-[80px] w-full"
        value={text}
        aria-invalid={Boolean(error && next === "dropped" && text.trim().length === 0)}
        maxLength={1000}
        disabled={busy || refreshing}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) setError(null);
        }}
        placeholder="例：次の改修でまとめて直します。"
      />

      <div className="mt-3">
        <Button type="button" variant="primary" onClick={submit} disabled={busy || refreshing || unchanged}>
          {busy ? "保存しています…" : refreshing ? "画面に反映しています…" : "対応状況を保存する"}
        </Button>
      </div>
    </Card>
  );
}
