import { Badge, Card, CardRow, Num } from "@/components/ui";
import type { SelectableItem } from "./data";

/**
 * その等級区分で選べる項目の一覧。
 *
 * 2026-08-11 の自由化により、固定枠を除けば全項目がどの枠にも入れられる。
 * 一覧から項目を消す条件は無い。
 * ランク基準が未設定の項目は消さずに残し、その旨を添える（消すと理由が読めなくなるため）。
 */

function ItemRow({
  item,
  points,
  adopted,
  href,
}: {
  item: SelectableItem;
  points: number;
  adopted: boolean;
  /** その項目のランク基準（A〜E）へのリンク */
  href: string;
}) {
  return (
    <CardRow
      alignTop
      title={
        <>
          <a href={href} className="underline">
            No.{item.no} {item.name}
          </a>{" "}
          {adopted && <Badge tone="active">この等級で採用中</Badge>}
          {item.isProvisional && <Badge tone="dropped">仮置き</Badge>}
        </>
      }
      sub={
        <>
          {item.categoryName ?? "カテゴリ未設定"} ／ {item.measureType} ／ 単位 {item.unit} ／{" "}
          {item.direction === "lower" ? "低いほど良い（逆転指標）" : "高いほど良い"}
        </>
      }
      value={
        <>
          <Num value={points} display />
          <span className="unit">点</span>
        </>
      }
    />
  );
}

export function SelectableItems({
  items,
  withoutCriteria,
  majorSlotPoints,
  majorSlotCount,
  minorSlotPoints,
  minorSlotCount,
  fixedSlotPoints,
  adoptedIds,
  gradeName,
  criteriaHref,
}: {
  items: SelectableItem[];
  withoutCriteria: SelectableItem[];
  majorSlotPoints: number;
  majorSlotCount: number;
  minorSlotPoints: number;
  minorSlotCount: number;
  fixedSlotPoints: number;
  adoptedIds: Set<string>;
  gradeName: string;
  /** 項目名から、その項目のランク基準（A〜E）へ飛ぶためのリンク */
  criteriaHref: (kpiItemId: string) => string;
}) {
  const fixed = items.filter((i) => i.isFixedSlot);
  /* 固定枠以外は、20点枠にも10点枠にも同じ項目を置けるようになったため、
     枠ごとに候補を分けて出す意味がなくなった。1つの一覧にまとめる。 */
  const others = items.filter((i) => !i.isFixedSlot);

  // カテゴリごとにまとめる。33項目を1列に並べると、どこを見ればよいか分からなくなるため
  const byCategory = new Map<string, SelectableItem[]>();
  for (const i of others) {
    const key = i.categoryName ?? "カテゴリ未設定";
    byCategory.set(key, [...(byCategory.get(key) ?? []), i]);
  }

  return (
    <>
      <Card>
        {fixed.map((i) => (
          <ItemRow
            key={i.kpiItemId}
            item={i}
            points={fixedSlotPoints}
            adopted={adoptedIds.has(i.kpiItemId)}
            href={criteriaHref(i.kpiItemId)}
          />
        ))}
      </Card>
      <p className="footnote mt-2">
        等級要件達成率は差し替えできません。どの等級でも必ずこの1項目が入ります。
      </p>

      <p className="section-heading mt-5 mb-2">
        選べる項目（<Num value={others.length} unit="件" />
        の中から{" "}
        {majorSlotCount > 0 ? (
          <>
            {majorSlotPoints}点枠に <Num value={majorSlotCount} unit="つ" />、{minorSlotPoints}点枠に{" "}
            <Num value={minorSlotCount} unit="つ" />
          </>
        ) : (
          <>
            {minorSlotPoints}点枠に <Num value={minorSlotCount} unit="つ" />
          </>
        )}
        ）
      </p>
      <p className="footnote mb-2">
        どの項目をどの枠に入れるかは自由です。分類はまとめて見るための区切りで、同じ分類から何項目選んでもかまいません。
        {majorSlotCount > 0 && `${majorSlotPoints}点枠にもこの一覧の項目から選びます。`}
      </p>
      {withoutCriteria.length > 0 && (
        <p className="footnote mb-2">
          {withoutCriteria.map((i) => i.name).join("・")}のランク基準（A〜E）は、{gradeName}{" "}
          を対象として想定されていません。選ぶことも採点することもできますが、
          上位の等級を想定して作られた閾値がそのまま使われるため、{gradeName}{" "}
          には厳しすぎる可能性があります。項目名から閾値を確認してください。
        </p>
      )}
      {others.length === 0 ? (
        <p className="footnote">
          この等級区分では、等級要件達成率だけで満点になります。ほかの項目は評価の対象になりません（0点ではなく、そもそも点数を付けません）。
        </p>
      ) : (
        <details className="card card-pad">
          <summary className="cursor-pointer text-sub font-semibold">
            選べる項目をカテゴリごとに見る（<Num value={others.length} unit="件" />）
          </summary>
          <div className="mt-3 grid gap-4">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <p className="m-0 mb-1 text-note font-semibold text-[var(--ink-muted)]">
                  {category}（{list.length}件）
                </p>
                <ul className="m-0 list-none space-y-1 p-0 text-sub">
                  {list.map((i) => (
                    <li key={i.kpiItemId}>
                      <a href={criteriaHref(i.kpiItemId)} className="underline">
                        No.{i.no} {i.name}
                      </a>
                      {adoptedIds.has(i.kpiItemId) && <> <Badge tone="active">採用中</Badge></>}
                      <span className="footnote">
                        {" "}
                        ／ {i.direction === "lower" ? "低いほど良い" : "高いほど良い"}（{i.unit}）
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
