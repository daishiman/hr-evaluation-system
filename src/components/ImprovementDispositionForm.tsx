"use client";

import { useState } from "react";
import { Card, ChoiceChip, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useRefreshAfterSave } from "@/lib/use-refresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  DISPOSITION_ACTIONS,
  dispositionActionLabel,
  dispositionConfirm,
  dispositionNeedsReason,
  dispositionReasonError,
  reasonChoices,
  type DispositionAction,
} from "@/lib/domain/improvement-disposition";

/**
 * 要望1件を落とす・戻す。
 *
 * 使われる場面: 詳細を開いて中身を読み、その場で「これは直さない」
 * 「これは誤って届いたもの」と判断する。
 *
 * 落とす操作には必ず理由を残す。あとから「なぜ落ちているのか」を
 * 説明できないと、同じ要望が何度も届く。理由の判定はサーバー側と
 * 同じ関数（domain）で行うので、画面と保存の判断がずれない。
 */
export function ImprovementDispositionForm({ id, discarded }: { id: string; discarded: boolean }) {
  const { refresh, refreshing } = useRefreshAfterSave();
  // 廃棄済みの要望を開いたときは「元に戻す」から始める（いちばん要る操作を既定に）。
  const first: DispositionAction = discarded ? "restore" : "reject";
  const [action, setAction] = useState<DispositionAction>(first);
  const [reasonCode, setReasonCode] = useState(reasonChoices(first)[0]?.code ?? "");
  const [reasonNote, setReasonNote] = useState("");
  const [duplicateOfId, setDuplicateOfId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const choices = reasonChoices(action);
  const needsReason = dispositionNeedsReason(action);
  // 足りないものはその場に出し、揃うまで実行させない（判定はサーバーと同じ関数）。
  const reasonError = dispositionReasonError(action, reasonCode, reasonNote);

  const pick = (next: DispositionAction) => {
    setAction(next);
    setReasonCode(reasonChoices(next)[0]?.code ?? "");
    setError(null);
    setDone(null);
  };

  const submit = async () => {
    if (busy || refreshing || reasonError) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/improvements", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reasonCode,
          reasonNote,
          duplicateOfId: duplicateOfId.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; result?: { reason: string } };
      if (!res.ok || !json.ok || !json.result) {
        setError(json.message ?? "実行できませんでした。");
        return;
      }
      setDone(json.result.reason);
      setReasonNote("");
      // 履歴と状態はサーバー側で作っている。作り直しが終わるまで結果を出し続ける。
      refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      {reasonError && <ReasonNote>{reasonError}</ReasonNote>}
      <RefreshStatus message={done} refreshing={refreshing} target="履歴" />

      <p className="footnote m-0">この要望をどうするか</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {DISPOSITION_ACTIONS.map((a) => (
          <ChoiceChip key={a} selected={action === a} onClick={() => pick(a)}>
            {dispositionActionLabel(a)}
          </ChoiceChip>
        ))}
      </div>

      {needsReason && (
        <>
          <p className="footnote mt-3 mb-0">理由</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {choices.map((c) => (
              <ChoiceChip
                key={c.code}
                selected={reasonCode === c.code}
                onClick={() => {
                  setReasonCode(c.code);
                  setError(null);
                }}
              >
                {c.label}
              </ChoiceChip>
            ))}
          </div>
        </>
      )}

      {action === "duplicate" && (
        <>
          <label className="footnote mt-3 block" htmlFor="disposition_duplicate">
            まとめ先の要望ID
          </label>
          <input
            id="disposition_duplicate"
            className="input w-full"
            value={duplicateOfId}
            maxLength={60}
            onChange={(e) => setDuplicateOfId(e.target.value)}
            placeholder="一覧で開いたURLの末尾の文字列"
          />
        </>
      )}

      <label className="footnote mt-3 block" htmlFor="disposition_note">
        補足（その他を選んだときは必須）
      </label>
      <textarea
        id="disposition_note"
        className="input min-h-[64px] w-full"
        value={reasonNote}
        maxLength={1000}
        onChange={(e) => {
          setReasonNote(e.target.value);
          if (e.target.value.trim()) setError(null);
        }}
        placeholder="例：同じ内容を先週まとめて直しました。"
      />

      <div className="mt-3">
        <ConfirmButton
          label={needsReason ? `${dispositionActionLabel(action)}にする` : dispositionActionLabel(action)}
          variant={action === "discard" ? "danger-outline" : "primary"}
          disabled={busy || refreshing || reasonError !== null}
          busy={busy}
          confirm={dispositionConfirm(action)}
          onConfirm={() => void submit()}
        />
      </div>
    </Card>
  );
}
