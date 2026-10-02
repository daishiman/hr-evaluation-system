"use client";

import { useState } from "react";
import { Card, ChoiceChip, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { disposeImprovement } from "@/actions/improvements";
import { useSaveAction } from "@/lib/use-refresh";
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
  const { save, saving } = useSaveAction(disposeImprovement, { resource: "improvements" });
  // 廃棄済みの要望を開いたときは「元に戻す」から始める（いちばん要る操作を既定に）。
  const first: DispositionAction = discarded ? "restore" : "reject";
  const [action, setAction] = useState<DispositionAction>(first);
  const [reasonCode, setReasonCode] = useState(reasonChoices(first)[0]?.code ?? "");
  const [reasonNote, setReasonNote] = useState("");
  const [duplicateOfId, setDuplicateOfId] = useState("");
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
    if (saving || reasonError) return;
    setError(null);
    setDone(null);
    const result = await save({
      id,
      action,
      reasonCode,
      reasonNote,
      duplicateOfId: duplicateOfId.trim() || null,
    });
    if (!result.ok) {
      // 入力内容はこの画面に残す（直してもう一度押せるように）
      setError(result.message);
      return;
    }
    // 履歴と状態はサーバー側で作っている。描き直した画面は返事と一緒に届く。
    setDone(result.result.reason);
    setReasonNote("");
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      {reasonError && <ReasonNote>{reasonError}</ReasonNote>}
      <RefreshStatus message={done} refreshing={saving} target="履歴" />

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
          disabled={reasonError !== null}
          busy={saving}
          confirm={dispositionConfirm(action)}
          onConfirm={() => void submit()}
        />
      </div>
    </Card>
  );
}
