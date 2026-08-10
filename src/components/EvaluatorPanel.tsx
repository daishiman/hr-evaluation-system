"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { Button, Card, ReasonNote } from "@/components/ui";

/**
 * 上長のコメントと、確定／確認中に戻す操作。
 * 確定は本人に公開される不可逆に近い操作なので確認を1回挟む。ただし戻せる（差し戻し）。
 */
export function EvaluatorPanel({
  evaluationId,
  status,
  comment,
  employeeName,
}: {
  evaluationId: string;
  status: string;
  comment: string;
  employeeName: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(comment);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finalized = status === "finalized";

  const saveComment = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "comment", comment: text }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setSaved("コメントを保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}

      <label className="m-0 block text-[13px] font-bold" htmlFor="ev_comment">
        本人に伝えるコメント
      </label>
      <p className="footnote m-0 mb-2">確定すると、この文章が本人の結果画面に表示されます。</p>
      <textarea
        id="ev_comment"
        className="input min-h-[88px] w-full"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(null);
        }}
        placeholder="例：未達の項目について、期首に分母と行動計画をすり合わせましょう。"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={saveComment} disabled={busy}>
          コメントを保存する
        </Button>
        {saved && <span className="footnote">{saved}</span>}
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        {finalized ? (
          <>
            <p className="m-0 mb-2 text-[13px]">
              この評価は確定済みです。{employeeName} さんの画面に結果が表示されています。
            </p>
            <ActionButton
              url={`/api/evaluations/${evaluationId}`}
              body={{ action: "reopen" }}
              label="確認中に戻す"
              variant="secondary"
              confirm={`確認中に戻すと、${employeeName} さんの画面から結果が見えなくなります。よろしいですか？`}
            />
          </>
        ) : (
          <>
            <p className="m-0 mb-2 text-[13px]">
              内容を確認したら確定してください。確定すると {employeeName} さんの画面に結果が表示されます。
            </p>
            <ActionButton
              url={`/api/evaluations/${evaluationId}`}
              body={{ action: "finalize", comment: text }}
              label="確定して本人に公開する"
              confirm={`${employeeName} さんの評価を確定し、本人に公開します。あとから「確認中に戻す」で取り消せます。`}
            />
          </>
        )}
      </div>
    </Card>
  );
}
