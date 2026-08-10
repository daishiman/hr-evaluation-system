"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Num, ProvisionalMark, ReasonNote } from "@/components/ui";
import { suggestWeights, validateScheme } from "@/lib/domain/scheme";
import {
  formatByRank,
  indexReferencePoints,
  referenceFor,
  type ReferencePointRow,
} from "@/lib/domain/reference-points";

export interface KpiOption {
  id: string;
  no: number;
  name: string;
  unit: string;
  categoryId: string | null;
  isFixedSlot: boolean;
  isProvisional: boolean;
  intent: string | null;
  aStandard: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
}

/**
 * 8項目の選択と配点。
 *
 * 1画面1目的にするため、この画面は「どの項目を何点にするか」だけを扱う。
 * カテゴリごとに1つだけ選べるようにし、合計が満点でないときは
 * 「あと何点」をその場に出して、保存を押す前に気づけるようにする。
 */
export function SchemeEditor({
  schemeId,
  totalPoints,
  categories,
  kpiItems,
  initial,
  raiseRequiresAllA,
  pointGroups,
  reference,
}: {
  schemeId: string;
  totalPoints: number;
  categories: CategoryOption[];
  kpiItems: KpiOption[];
  initial: { kpiItemId: string; categoryId: string | null; weight: number; isFixedSlot: boolean }[];
  raiseRequiresAllA: boolean;
  /** 元の配点表の等級区分（Beginner / Regular / Chief / AM / Manager） */
  pointGroups: string[];
  /** 元の配点表の写し。参考値としてだけ使い、計算には使わない */
  reference: ReferencePointRow[];
}) {
  const router = useRouter();
  const fixedItem = kpiItems.find((k) => k.isFixedSlot) ?? null;
  const fixedInitial = initial.find((i) => i.isFixedSlot);

  const [fixedWeight, setFixedWeight] = useState(fixedInitial?.weight ?? 16);
  const [picked, setPicked] = useState<Record<string, { kpiItemId: string; weight: number }>>(() =>
    Object.fromEntries(
      categories.map((c) => {
        const row = initial.find((i) => !i.isFixedSlot && i.categoryId === c.id);
        const fallback = kpiItems.find((k) => k.categoryId === c.id);
        return [c.id, { kpiItemId: row?.kpiItemId ?? fallback?.id ?? "", weight: row?.weight ?? 12 }];
      }),
    ),
  );
  const [allA, setAllA] = useState(raiseRequiresAllA);
  const [refGroup, setRefGroup] = useState(pointGroups[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selections = useMemo(
    () => [
      ...(fixedItem
        ? [{ kpiItemId: fixedItem.id, categoryId: null, weight: fixedWeight, isFixedSlot: true }]
        : []),
      ...categories
        .filter((c) => picked[c.id]?.kpiItemId)
        .map((c) => ({
          kpiItemId: picked[c.id].kpiItemId,
          categoryId: c.id,
          weight: picked[c.id].weight,
          isFixedSlot: false,
        })),
    ],
    [fixedItem, fixedWeight, categories, picked],
  );

  const v = validateScheme(selections, {
    totalPoints,
    categoryIds: categories.map((c) => c.id),
    categoryNameOf: (id) => categories.find((c) => c.id === id)?.name ?? id,
  });

  const refIndex = useMemo(() => indexReferencePoints(reference), [reference]);
  const refOf = (kpiItemId: string | undefined) =>
    kpiItemId && refGroup ? referenceFor(refIndex, kpiItemId, refGroup) : null;

  /** 選んでいる項目すべてに、元の配点を入れる（対象外だった項目はそのまま） */
  const loadReference = () => {
    const fixedRef = refOf(fixedItem?.id);
    if (fixedRef) setFixedWeight(Math.round(fixedRef.maxPoints));
    setPicked((prev) =>
      Object.fromEntries(
        categories.map((c) => {
          const r = refOf(prev[c.id]?.kpiItemId);
          return [c.id, r ? { ...prev[c.id], weight: Math.round(r.maxPoints) } : prev[c.id]];
        }),
      ),
    );
    setMessage(null);
  };


  /** 元の配点の参考表示。参考値であることが分かる言い方に統一する */
  const ReferenceHint = ({ kpiItemId, onApply }: { kpiItemId?: string; onApply: (points: number) => void }) => {
    if (pointGroups.length === 0) return null;
    const r = refOf(kpiItemId);
    if (!r) {
      return (
        <p className="footnote m-0 mt-2">
          元の配点表では、この項目は「{refGroup}」の対象外でした（参考にできる点数がありません）。
        </p>
      );
    }
    return (
      <p className="footnote m-0 mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="done">参考</Badge>
        元の配点表（{refGroup}）では <Num value={r.maxPoints} unit="点" />
        <span className="text-[var(--ink-muted)]">（{formatByRank(r)}）</span>
        <button type="button" className="btn btn-tertiary" onClick={() => onApply(Math.round(r.maxPoints))}>
          この点数を入れる
        </button>
      </p>
    );
  };

  const evenOut = () => {
    const w = suggestWeights(categories.length + 1, totalPoints);
    setFixedWeight(w[0]);
    setPicked((prev) =>
      Object.fromEntries(categories.map((c, i) => [c.id, { ...prev[c.id], weight: w[i + 1] }])),
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/scheme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemeId, items: selections, raiseRequiresAllA: allA }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
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

  return (
    <>
      <Card className="card-pad hero-tint">
        <p className="m-0 text-[12px] text-[var(--ink-muted)]">配点の合計</p>
        <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
          {v.total}
          <span className="unit"> / {totalPoints} 点</span>
        </p>
        <p className="m-0 mt-2 text-[13px]">
          {v.ok ? "この内容で保存できます。" : "保存する前に、下の指摘を解消してください。"}
        </p>
      </Card>

      {!v.ok && (
        <div className="mt-3">
          <ReasonNote>
            <ul className="m-0 list-disc pl-5">
              {v.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </ReasonNote>
        </div>
      )}
      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 mt-3 text-[13px] text-[var(--brand-deep)]">{message}</p>}

      {pointGroups.length > 0 && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="section-heading m-0">移行前の配点を参考にする</p>
              <p className="footnote m-0">
                移行前は等級ごとに配点が決まっていました。その点数を参考として表示します。読み込むまで配点は変わりません。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[12px]">
                等級
                <select
                  className="input h-9 w-36 py-0 text-[13px]"
                  value={refGroup}
                  onChange={(e) => setRefGroup(e.target.value)}
                >
                  {pointGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={loadReference}>選んだ項目にまとめて入れる</Button>
            </div>
          </div>
        </Card>
      )}

      {fixedItem && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="todo-row-title m-0">
                {fixedItem.name} <Badge tone="done">固定枠</Badge>
              </p>
              <p className="todo-row-sub m-0">この枠は差し替えできません。配点だけ変更できます。</p>
            </div>
            <label className="flex items-center gap-2 text-[12px]">
              配点
              <input
                className="input input-num w-20"
                inputMode="numeric"
                value={fixedWeight}
                onChange={(e) => setFixedWeight(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              />
              <span className="unit">点</span>
            </label>
          </div>
          <ReferenceHint kpiItemId={fixedItem.id} onApply={(p) => setFixedWeight(p)} />
        </Card>
      )}

      {categories.map((c) => {
        const options = kpiItems.filter((k) => k.categoryId === c.id);
        const cur = picked[c.id];
        const chosen = options.find((o) => o.id === cur?.kpiItemId) ?? null;
        return (
          <Card key={c.id} className="card-pad mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="section-heading m-0">{c.name}</p>
                {c.description && <p className="footnote m-0">{c.description}</p>}
              </div>
              <label className="flex items-center gap-2 text-[12px]">
                配点
                <input
                  className="input input-num w-20"
                  inputMode="numeric"
                  value={cur?.weight ?? 0}
                  onChange={(e) =>
                    setPicked((p) => ({
                      ...p,
                      [c.id]: { ...p[c.id], weight: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 },
                    }))
                  }
                />
                <span className="unit">点</span>
              </label>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={cur?.kpiItemId === o.id}
                  onClick={() => setPicked((p) => ({ ...p, [c.id]: { ...p[c.id], kpiItemId: o.id } }))}
                  className={
                    cur?.kpiItemId === o.id
                      ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                      : "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] hover:border-[var(--brand)]"
                  }
                >
                  <span className="block font-bold">
                    {o.name}
                    {o.isProvisional && (
                      <>
                        {" "}
                        <ProvisionalMark note="制度として未確定の項目です（叩き台）。" />
                      </>
                    )}
                  </span>
                  <span className="block text-[11px] text-[var(--ink-muted)]">
                    単位 {o.unit}
                    {o.aStandard ? ` ／ Aの目安 ${o.aStandard}` : ""}
                  </span>
                </button>
              ))}
            </div>
            {chosen?.intent && <p className="footnote m-0 mt-2">ねらい：{chosen.intent}</p>}
            <ReferenceHint
              kpiItemId={cur?.kpiItemId}
              onApply={(p) => setPicked((prev) => ({ ...prev, [c.id]: { ...prev[c.id], weight: p } }))}
            />
          </Card>
        );
      })}

      <Card className="card-pad mt-4">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={allA} onChange={(e) => setAllA(e.target.checked)} />
          昇給の条件を「選んだ8項目がすべてA」にする
        </label>
        <p className="footnote m-0 mt-1">
          外すと「配点の満点と同じ点数を取ったとき」が昇給の条件になります。
        </p>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy || !v.ok}>
          {busy ? "保存しています…" : "この内容で保存する"}
        </Button>
        <Button onClick={evenOut}>配点を均等に割り振る</Button>
        <span className="footnote">
          残り <Num value={totalPoints - v.total} unit="点" />
        </span>
      </div>
      <p className="footnote mt-2">
        保存しても、確定済みの評価は判定当時の配点のまま残ります。過去の結果は変わりません。
      </p>
    </>
  );
}
