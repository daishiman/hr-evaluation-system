"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ReasonNote } from "@/components/ui";
import { NumberField } from "@/components/NumberField";
import { checkRankBoundaries, sortByRank, type BoundFix, type RankBoundRow } from "@/lib/domain/rank-bounds";
import type { Direction } from "@/lib/domain/scoring";

/**
 * KPI項目1つぶんのランク基準（A〜E）を、まとめて直す。
 *
 * 1ランクずつ保存する作りをやめた理由:
 *   ランク同士の重なり・隙間は、**そのランクだけを見ても分からない**。
 *   1ランクずつ保存していると、直している途中は必ずどこかが繋がらないため、
 *   「保存はできるが警告だけ出す」という中途半端な形にせざるを得なかった。
 *   まとめて直してまとめて保存すれば、繋がっているものしか保存できないと言い切れる。
 *
 * 叱らないための作り:
 *   打っている最中に、どこが重なって・どこが抜けているかを日本語で出し、
 *   **どう直せば繋がるかまで書く**。直す案は自動では当てない（他のランクの値を
 *   勝手に書き換えられると、何が起きたのか分からなくなる）。押してもらってから当てる。
 */
export function RankCriteriaSetForm({
  kpiItemId,
  unit,
  direction,
  rows,
}: {
  kpiItemId: string;
  unit: string | null;
  direction: Direction;
  rows: { id: string; rank: string; lowerBound: number | null; upperBound: number | null; displayLabel: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    sortByRank(rows).map((r) => ({ id: r.id, rank: r.rank, lowerBound: r.lowerBound, upperBound: r.upperBound })),
  );
  /* 提案を当てたときに入力欄の表示を作り直すための番号。
     入力欄は打っている途中の文字を自分で持っているので、外から値を変えたことを
     こうして伝えないと、画面の文字だけ古いまま残る。 */
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = checkRankBoundaries(values as RankBoundRow[], direction);
  const issues = check.ok ? [] : check.issues;

  const applyFix = (fix: BoundFix) => {
    setValues((prev) => prev.map((r) => (r.rank === fix.rank ? { ...r, [fix.field]: fix.value } : r)));
    setVersion((v) => v + 1);
    setMessage(null);
    setError(null);
  };

  const setBound = (id: string, field: "lowerBound" | "upperBound", value: number | null) => {
    setValues((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const submit = async () => {
    if (!check.ok) {
      setError("ランクの境界が繋がっていません。下の案内のとおりに直してから保存してください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "rankCriteriaSet",
          kpiItemId,
          rows: values.map((r) => ({ id: r.id, lowerBound: r.lowerBound, upperBound: r.upperBound })),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。入力内容をご確認ください。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  const current = new Map(rows.map((r) => [r.id, r.displayLabel]));

  return (
    <div className="mt-3">
      <div className="stack-tight">
        {values.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-sub">ランク{r.rank}</span>
            <label className="flex items-center gap-1">
              <span className="text-note text-ink-muted">下限</span>
              <NumberField
                key={`${r.id}-lower-${version}`}
                name={`lowerBound_${r.id}`}
                ariaLabel={`ランク${r.rank} の下限`}
                defaultValue={r.lowerBound}
                policy={{ allowNegative: true }}
                unit={unit}
                reportWhileTyping
                onValueChange={(v) => setBound(r.id, "lowerBound", v)}
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-note text-ink-muted">上限</span>
              <NumberField
                key={`${r.id}-upper-${version}`}
                name={`upperBound_${r.id}`}
                ariaLabel={`ランク${r.rank} の上限`}
                defaultValue={r.upperBound}
                policy={{ allowNegative: true }}
                unit={unit}
                reportWhileTyping
                onValueChange={(v) => setBound(r.id, "upperBound", v)}
              />
            </label>
            <span className="footnote">いまの表記：{current.get(r.id)}</span>
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="stack-tight mt-3">
          {issues.map((x, i) => (
            <ReasonNote key={i}>
              {x.message}
              {x.fix && (
                <>
                  {" "}
                  <Button type="button" onClick={() => applyFix(x.fix as BoundFix)}>
                    この案で直す
                  </Button>
                </>
              )}
            </ReasonNote>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button type="button" variant="primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "保存しています…" : "ランクA〜Eの基準を保存"}
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="m-0 mt-3 text-sub text-brand-deep">{message}</p>}
    </div>
  );
}
