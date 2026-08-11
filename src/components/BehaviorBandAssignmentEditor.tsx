"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { behaviorBandForGrade, behaviorBandLabel, behaviorBandPayloadValue, type BehaviorBandSetRow } from "@/lib/domain/behavior";
import { Button, Card, ReasonNote } from "@/components/ui";

export interface BehaviorAssignmentGradeRow {
  id: string;
  name: string;
  behaviorBand: string | null;
}

/**
 * 等級ごとの行動指針の適用を変更する。
 *
 * 等級と等級帯を独立した uncontrolled select にすると、等級だけ切り替えたときに
 * 前の等級帯が残り、別の等級へ誤保存できてしまう。選択中の等級を変えるたびに、
 * その等級の現在値を読み直す1組の controlled state として扱う。
 */
export function BehaviorBandAssignmentEditor({
  grades,
  bandSets,
  availableBands,
}: {
  grades: BehaviorAssignmentGradeRow[];
  /** 会社が持っている基準セット（呼び名の正本）。 */
  bandSets: readonly BehaviorBandSetRow[];
  /** 実際に行動指針が登録されていて、いま使う設定になっている基準だけを選択肢にする。 */
  availableBands: readonly string[];
}) {
  const router = useRouter();
  const firstGradeId = grades[0]?.id ?? "";
  const initialBand = behaviorBandForGrade(grades, firstGradeId) ?? "";
  const [gradeId, setGradeId] = useState(firstGradeId);
  const [baselineBand, setBaselineBand] = useState(initialBand);
  const [behaviorBand, setBehaviorBand] = useState(initialBand);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectableBands = bandSets.map((set) => set.code).filter((band) => availableBands.includes(band));
  const currentBandUnavailable = behaviorBand !== "" && !selectableBands.some((band) => band === behaviorBand);

  /* router.refresh() で保存後の割り当てが届いたら、現在値の控えも同期する。
     配列そのものではなく ID と値だけを依存値にし、親の再描画だけでは入力中の値を消さない。 */
  const assignmentSignature = useMemo(
    () => grades.map((grade) => `${grade.id}:${grade.behaviorBand ?? ""}`).join("|"),
    [grades],
  );
  useEffect(() => {
    const nextGradeId = grades.some((grade) => grade.id === gradeId) ? gradeId : firstGradeId;
    const nextBand = behaviorBandForGrade(grades, nextGradeId) ?? "";
    if (nextGradeId !== gradeId) setGradeId(nextGradeId);
    setBaselineBand(nextBand);
    setBehaviorBand(nextBand);
  }, [assignmentSignature, firstGradeId, gradeId, grades]);

  const selectGrade = (nextGradeId: string) => {
    const nextBand = behaviorBandForGrade(grades, nextGradeId) ?? "";
    setGradeId(nextGradeId);
    setBaselineBand(nextBand);
    setBehaviorBand(nextBand);
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "grade",
          id: gradeId,
          behaviorBand: behaviorBandPayloadValue(behaviorBand),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setBaselineBand(behaviorBand);
      setMessage(json.message ?? "保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。選んだ内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      <p className="footnote m-0 mb-3">
        等級を選ぶと、現在その等級に設定されている基準を表示します。「適用しない」にすると、次に作るアンケートから行動指針の設問が出ません。
      </p>
      <div className="field-grid">
        <label>
          <span className="block text-[12px] text-[var(--ink-muted)]">等級</span>
          <select value={gradeId} onChange={(event) => selectGrade(event.target.value)} className="input mt-1 w-full">
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-[12px] text-[var(--ink-muted)]">出す基準</span>
          <select value={behaviorBand} onChange={(event) => setBehaviorBand(event.target.value)} className="input mt-1 w-full">
            <option value="">適用しない</option>
            {currentBandUnavailable && (
              <option value={behaviorBand} disabled>
                {behaviorBandLabel(bandSets, behaviorBand)}（いまは選べません）
              </option>
            )}
            {selectableBands.map((band) => (
              <option key={band} value={band}>
                {behaviorBandLabel(bandSets, band)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={busy || behaviorBand === baselineBand} onClick={() => void save()}>
          {busy ? "保存しています…" : "この等級の適用を保存する"}
        </Button>
        <Button type="button" variant="tertiary" disabled={busy || behaviorBand === baselineBand} onClick={() => setBehaviorBand(baselineBand)}>
          現在の設定に戻す
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="m-0 mt-3 text-[13px] text-[var(--brand-deep)]">{message}</p>}
    </Card>
  );
}
