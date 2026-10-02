"use client";

import { useState } from "react";
import { updateEvaluation } from "@/actions/evaluations";
import { ActionButton } from "@/components/ActionButton";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useSaveAction } from "@/lib/use-refresh";

/**
 * 上長のコメントと、確定／確認中に戻す操作。
 * 確定は本人に公開される不可逆に近い操作なので確認を1回挟む。ただし戻せる（差し戻し）。
 */
export function EvaluatorPanel({
  evaluationId,
  status,
  comment,
  employeeName,
  blockedReason = null,
}: {
  evaluationId: string;
  status: string;
  comment: string;
  employeeName: string;
  /** 手を入れられない理由。渡されたら操作は出さず、理由だけを出す（自分自身の評価など）。 */
  blockedReason?: string | null;
}) {
  /* 保存の応答に保存後の画面が同梱されるので、別に取り直しを頼まない。
     saving は「保存して画面に出し終えるまで」の間ずっと true。 */
  const { save, saving } = useSaveAction(updateEvaluation, { resource: "evaluations" });
  const [text, setText] = useState(comment);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finalized = status === "finalized";

  const saveComment = async () => {
    setError(null);
    setSaved(null);
    const result = await save({ evaluationId, action: "comment", comment: text });
    if (!result.ok) {
      // 入力欄はそのまま残す（直して押し直せるように）
      setError(result.message);
      return;
    }
    setSaved(result.message);
  };

  if (blockedReason) {
    return (
      <Card className="card-pad">
        <ReasonNote>{blockedReason}</ReasonNote>
        <p className="footnote m-0 mt-2">
          {status === "finalized"
            ? "この評価は確定済みです。内容は上の欄でそのまま確認できます。"
            : "この評価はまだ確認中です。確定されると、あなたの「自分の評価」の画面に結果が出ます。"}
        </p>
      </Card>
    );
  }

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}

      <label className="m-0 block text-sub font-bold" htmlFor="ev_comment">
        本人に伝えるコメント
      </label>
      <p className="footnote m-0 mb-2">確定すると、この文章が本人の結果画面に表示されます。</p>
      <textarea
        id="ev_comment"
        className="input min-h-[88px] w-full"
        value={text}
        disabled={saving}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(null);
        }}
        placeholder="例：未達の項目について、期首に分母と行動計画をすり合わせましょう。"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={() => void saveComment()} disabled={saving}>
          {saving ? "保存しています…" : "コメントを保存する"}
        </Button>
        <RefreshStatus message={saved} refreshing={saving} target="画面" className="footnote" />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {finalized ? (
          <>
            <p className="m-0 mb-2 text-sub">
              この評価は確定済みです。{employeeName} さんの画面に結果が表示されています。
            </p>
            <ActionButton
              action={updateEvaluation}
              resource="evaluations"
              input={{ evaluationId, action: "reopen" }}
              label="確認中に戻す"
              variant="secondary"
              confirm={`確認中に戻すと、${employeeName} さんの画面から結果が見えなくなります。よろしいですか？`}
            />
          </>
        ) : (
          <>
            <p className="m-0 mb-2 text-sub">
              内容を確認したら確定してください。確定すると {employeeName} さんの画面に結果が表示されます。
            </p>
            <ActionButton
              action={updateEvaluation}
              resource="evaluations"
              input={{ evaluationId, action: "finalize", comment: text }}
              label="確定して本人に公開する"
              confirm={`${employeeName} さんの評価を確定し、本人に公開します。あとから「確認中に戻す」で取り消せます。`}
            />
          </>
        )}
      </div>
    </Card>
  );
}
