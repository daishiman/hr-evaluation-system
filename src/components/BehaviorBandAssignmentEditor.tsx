"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { behaviorBandLabel, behaviorBandPayloadValue, type BehaviorBandSetRow } from "@/lib/domain/behavior";
import { Button, Card, CardHead, ReasonNote } from "@/components/ui";

export interface BehaviorAssignmentGradeRow {
  id: string;
  name: string;
  behaviorBand: string | null;
}

const assignmentsOf = (grades: readonly BehaviorAssignmentGradeRow[]) =>
  Object.fromEntries(grades.map((grade) => [grade.id, grade.behaviorBand ?? ""]));

/** 等級ごとの現在値と編集欄を、同じカードの中に置く。 */
export function BehaviorBandAssignmentEditor({
  grades,
  bandSets,
  availableBands,
}: {
  grades: BehaviorAssignmentGradeRow[];
  /** 会社が持っている基準セット（呼び名の正本）。 */
  bandSets: readonly BehaviorBandSetRow[];
  /** 問う内容があり、いま使う設定の基準だけを選択肢にする。 */
  availableBands: readonly string[];
}) {
  const router = useRouter();
  const initialAssignments = assignmentsOf(grades);
  const [baselines, setBaselines] = useState<Record<string, string>>(initialAssignments);
  const baselineRef = useRef<Record<string, string>>(initialAssignments);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialAssignments);
  const [busyGradeId, setBusyGradeId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const selectableBands = bandSets.map((set) => set.code).filter((code) => availableBands.includes(code));
  const assignmentSignature = useMemo(
    () => grades.map((grade) => `${grade.id}:${grade.behaviorBand ?? ""}`).join("|"),
    [grades],
  );

  /* 保存後の現在値だけを同期する。他の等級で編集中の選択は残す。 */
  useEffect(() => {
    const next = assignmentsOf(grades);
    const previous = baselineRef.current;
    setDrafts((current) =>
      Object.fromEntries(
        grades.map((grade) => {
          const draft = current[grade.id] ?? previous[grade.id] ?? "";
          const dirty = draft !== (previous[grade.id] ?? "");
          return [grade.id, dirty ? draft : next[grade.id]];
        }),
      ),
    );
    baselineRef.current = next;
    setBaselines(next);
  }, [assignmentSignature, grades]);

  const choose = (gradeId: string, behaviorBand: string) => {
    setDrafts((current) => ({ ...current, [gradeId]: behaviorBand }));
    setErrors((current) => ({ ...current, [gradeId]: "" }));
    setMessages((current) => ({ ...current, [gradeId]: "" }));
  };

  const save = async (grade: BehaviorAssignmentGradeRow) => {
    const behaviorBand = drafts[grade.id] ?? "";
    setBusyGradeId(grade.id);
    setErrors((current) => ({ ...current, [grade.id]: "" }));
    setMessages((current) => ({ ...current, [grade.id]: "" }));
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "grade",
          id: grade.id,
          behaviorBand: behaviorBandPayloadValue(behaviorBand),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setErrors((current) => ({ ...current, [grade.id]: json.message ?? "保存できませんでした。" }));
        return;
      }
      const nextBaselines = { ...baselineRef.current, [grade.id]: behaviorBand };
      baselineRef.current = nextBaselines;
      setBaselines(nextBaselines);
      setMessages((current) => ({ ...current, [grade.id]: json.message ?? "保存しました。" }));
      router.refresh();
    } catch {
      setErrors((current) => ({
        ...current,
        [grade.id]: "通信できませんでした。選んだ内容はこの画面に残っています。",
      }));
    } finally {
      setBusyGradeId(null);
    }
  };

  return (
    <div className="stack">
      <Card className="card-pad">
        <p className="footnote m-0">変更は次に作るアンケートから反映されます。</p>
        <p className="footnote m-0 mt-1">作成・公開済みのアンケートと評価は変わりません。</p>
      </Card>

      {grades.map((grade) => {
        const baseline = baselines[grade.id] ?? "";
        const draft = drafts[grade.id] ?? baseline;
        const currentUnavailable = draft !== "" && !selectableBands.includes(draft);
        const busy = busyGradeId !== null;
        return (
          <Card key={grade.id}>
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
                <span className="block text-note text-[var(--ink-muted)]">この等級に出す行動指針</span>
                <select
                  value={draft}
                  onChange={(event) => choose(grade.id, event.target.value)}
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
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || draft === baseline}
                  onClick={() => void save(grade)}
                >
                  {busyGradeId === grade.id ? "保存しています…" : "この等級の設定を保存"}
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={busy || draft === baseline}
                  onClick={() => choose(grade.id, baseline)}
                >
                  現在値へ戻す
                </Button>
              </div>

              {errors[grade.id] && (
                <div role="alert" className="mt-3">
                  <ReasonNote>{errors[grade.id]}</ReasonNote>
                </div>
              )}
              {messages[grade.id] && (
                <p role="status" aria-live="polite" className="m-0 mt-3 text-sub text-[var(--brand-deep)]">
                  {messages[grade.id]}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
