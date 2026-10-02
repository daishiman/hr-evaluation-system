"use client";

import { saveMaster } from "@/actions/masters";
import { useSaveAction } from "@/lib/use-refresh";
import { useEffect, useState } from "react";
import { behaviorBandLabel, behaviorBandPayloadValue, type BehaviorBandSetRow } from "@/lib/domain/behavior";
import { Button, Card, CardHead, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

export interface BehaviorAssignmentGradeRow {
  id: string;
  name: string;
  behaviorBand: string | null;
}

/**
 * 等級タブで選ばれた1件分だけを出す。
 * 現在値と編集欄は同じカードに置く（「昇格の条件・要件」画面の等級タブと同じ作法）。
 */
export function BehaviorBandAssignmentEditor({
  grade,
  bandSets,
  availableBands,
}: {
  grade: BehaviorAssignmentGradeRow;
  /** 会社が持っている基準セット（呼び名の正本）。 */
  bandSets: readonly BehaviorBandSetRow[];
  /** 問う内容があり、いま使う設定の基準だけを選択肢にする。 */
  availableBands: readonly string[];
}) {
  const { save, saving } = useSaveAction(saveMaster, { resource: "masters" });
  const [baseline, setBaseline] = useState(grade.behaviorBand ?? "");
  const [draft, setDraft] = useState(grade.behaviorBand ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectableBands = bandSets.map((set) => set.code).filter((code) => availableBands.includes(code));

  /* 保存後（応答に同梱された新しい画面）の現在値だけを取り込む。等級タブの切り替えは
     親側の key={grade.id} で作り直すので、ここでは同じ等級内の同期だけを見る。 */
  useEffect(() => {
    setBaseline(grade.behaviorBand ?? "");
    setDraft(grade.behaviorBand ?? "");
  }, [grade.behaviorBand]);

  const choose = (behaviorBand: string) => {
    setDraft(behaviorBand);
    setError(null);
    setMessage(null);
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    const result = await save({
      kind: "grade",
      id: grade.id,
      behaviorBand: behaviorBandPayloadValue(draft),
    });
    if (!result.ok) {
      // 選んだ内容は画面に残す
      setError(result.message);
      return;
    }
    setBaseline(draft);
    setMessage(result.message);
  };

  const currentUnavailable = draft !== "" && !selectableBands.includes(draft);

  return (
    <div className="stack">
      <Card className="card-pad">
        <p className="footnote m-0">変更は次に作るアンケートから反映されます。</p>
        <p className="footnote m-0 mt-1">作成・公開済みのアンケートと評価は変わりません。</p>
      </Card>

      <Card>
        <CardHead
          title={grade.name}
          sub={
            baseline
              ? `現在は「${behaviorBandLabel(bandSets, baseline)}」を出します。`
              : "現在は行動指針を出しません。"
          }
        />
        <div className="card-pad">
          <label>
            <span className="block text-note text-ink-muted">この等級に出す行動指針</span>
            <select
              value={draft}
              onChange={(event) => choose(event.target.value)}
              disabled={saving}
              className="input mt-1 w-full"
              aria-label={`${grade.name}に出す行動指針`}
            >
              <option value="">行動指針を出さない</option>
              {currentUnavailable && (
                <option value={draft} disabled>
                  {behaviorBandLabel(bandSets, draft)}（いまは選べません）
                </option>
              )}
              {selectableBands.map((code) => (
                <option key={code} value={code}>
                  {behaviorBandLabel(bandSets, code)}
                </option>
              ))}
            </select>
          </label>

          {draft ? (
            <p className="footnote m-0 mt-2">
              <b>{grade.name}</b>のアンケートにこの行動指針を出します。
            </p>
          ) : (
            <p className="footnote m-0 mt-2">
              この等級では行動指針を出しません。次に作るアンケートから、行動指針の質問が出なくなります。
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={saving || draft === baseline} onClick={() => void submit()}>
              {saving ? "保存しています…" : "この等級の設定を保存"}
            </Button>
            <Button type="button" variant="tertiary" disabled={saving || draft === baseline} onClick={() => choose(baseline)}>
              現在値へ戻す
            </Button>
          </div>

          {error && (
            <div role="alert" className="mt-3">
              <ReasonNote>{error}</ReasonNote>
            </div>
          )}
          <RefreshStatus message={message} refreshing={saving} target="画面" className="m-0 mt-3 text-sub text-brand-deep" />
        </div>
      </Card>
    </div>
  );
}
