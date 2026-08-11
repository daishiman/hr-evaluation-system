"use client";

import { useState } from "react";
import { RecordForm } from "@/components/RecordForm";
import { useLazyJson } from "@/components/useLazyJson";
import { Card, Num, ProvisionalMark, ReasonNote } from "@/components/ui";

/**
 * KPIのランク基準（A〜Eの線引き）の編集。
 *
 * 8項目 × 5ランクで40件ぶんの入力欄になるため、開いたときに初めて読む。
 * KPI・評価セットの項目選択は毎回見るが、ランク基準は
 * 「基準を直したいときだけ」開く場所なので、常に読み込まない。
 */

interface CriteriaRow {
  id: string;
  rank: string;
  lowerBound: number | null;
  upperBound: number | null;
  displayLabel: string;
}

interface ItemRow {
  id: string;
  name: string;
  unit: string;
  weight: number;
  direction: string;
  formula: string | null;
  isFixedSlot: boolean;
  criteria: CriteriaRow[];
}

interface Payload {
  ratios: { rank: string; ratio: number; isProvisional: boolean }[];
  items: ItemRow[];
}

export function RankCriteriaPanel({ itemCount }: { itemCount: number }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useLazyJson<Payload>("/api/masters/rank-criteria", open);

  return (
    <details className="disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        KPIのランク基準を確認・変更する（{itemCount}項目 × A〜E）
      </summary>
      <div className="disclosure-body">
        {/* 開くまでは何も読み込まない。開いてから出す内容だけをここに書く */}
        {!open ? null : loading ? (
          <p className="footnote m-0">読み込んでいます…</p>
        ) : error ? (
          <ReasonNote>{error}</ReasonNote>
        ) : !data || data.items.length === 0 ? (
          <ReasonNote>評価セットが未設定のため、ランク基準を表示できません。</ReasonNote>
        ) : (
          <>
            <p className="footnote">
              ランクごとの点数の割合：{data.ratios.map((r) => `${r.rank}=${Math.round(r.ratio * 100)}%`).join("、")}
              {data.ratios.some((r) => r.isProvisional) && (
                <>
                  {" "}
                  <ProvisionalMark note="ランクごとの割合は制度として未確定のため、叩き台の初期値です。" />
                </>
              )}
            </p>
            <div className="stack">
              {data.items.map((i) => (
                <Card key={i.id} className="card-pad">
                  <p className="todo-row-title m-0">
                    {i.name} <span className="unit">配点 </span>
                    <Num value={i.weight} unit="点" />
                  </p>
                  <p className="todo-row-sub m-0">
                    単位 {i.unit} ／ {i.direction === "lower" ? "低いほど良い" : "高いほど良い"}
                    {i.isFixedSlot
                      ? " ／ 実績値は「アンケートで出した等級要件のうち達成した数 ÷ 出した数 × 100」で出します"
                      : i.formula
                        ? ` ／ 計算式 ${i.formula}`
                        : ""}
                  </p>
                  <p className="footnote m-0 mt-1">
                    {i.direction === "lower"
                      ? "下限は「その値を含まない」、上限は「その値を含む」で判定します。"
                      : "下限は「その値を含む」、上限は「その値を含まない」で判定します。"}
                    空欄にすると、その側の制限なし（青天井）になります。
                  </p>
                  <div className="mt-3 grid gap-2">
                    {i.criteria.map((c) => (
                      <RecordForm
                        key={c.id}
                        url="/api/masters"
                        method="PUT"
                        fixed={{ kind: "rankCriteria", id: c.id }}
                        submitLabel={`ランク${c.rank}の基準を保存`}
                        /* 画面に出す表記は入力させない。判定に使うのは下限・上限の数値だけなので、
                           文言を別に書けるようにすると、書いてある範囲と実際に判定される範囲が
                           食い違う（説明文だけが嘘になる）。表記は保存時に数値から作り直す。 */
                        description={`ランク${c.rank}のいまの表記：${c.displayLabel}`}
                        /* 保存したら控えを捨てて読み直す。あとで開き直したときに
                           古い値が残っていると、それを上書き保存して直した内容が消えるため */
                        onSaved={reload}
                        fields={[
                          { name: "lowerBound", label: `ランク${c.rank} の下限`, type: "number", defaultValue: c.lowerBound, unit: i.unit },
                          { name: "upperBound", label: `ランク${c.rank} の上限`, type: "number", defaultValue: c.upperBound, unit: i.unit },
                        ]}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
