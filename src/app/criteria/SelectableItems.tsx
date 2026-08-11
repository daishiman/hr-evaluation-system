import { Badge, Card, Num } from "@/components/ui";
import type { SelectableItem } from "./data";

/**
 * その等級区分で「選べる項目」の一覧。
 *
 * 選べるかどうかは kpi_reference_points（元の配点表の写し）に行があるかどうかが正。
 * 元の表で「-」だった組み合わせは行を作っていないので、ここに出てこない項目は
 * 「その等級区分では評価しない」という意味になる。
 */

function ItemRow({
  item,
  points,
  adopted,
}: {
  item: SelectableItem;
  points: number;
  adopted: boolean;
}) {
  return (
    <div className="card-row items-start">
      <div className="row-main">
        <p className="todo-row-title m-0">
          No.{item.no} {item.name}{" "}
          {adopted && <Badge tone="active">この等級で採用中</Badge>}
          {item.isProvisional && <Badge tone="dropped">仮置き</Badge>}
        </p>
        <p className="todo-row-sub m-0">
          {item.categoryName ?? "カテゴリ未設定"} ／ {item.measureType} ／ 単位 {item.unit} ／{" "}
          {item.direction === "lower" ? "低いほど良い（逆転指標）" : "高いほど良い"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Num value={points} display />
        <span className="unit">点</span>
      </div>
    </div>
  );
}

export function SelectableItems({
  items,
  missingMonetary,
  majorSlotPoints,
  majorSlotCount,
  minorSlotPoints,
  minorSlotCount,
  fixedSlotPoints,
  adoptedIds,
  gradeName,
}: {
  items: SelectableItem[];
  missingMonetary: SelectableItem[];
  majorSlotPoints: number;
  majorSlotCount: number;
  minorSlotPoints: number;
  minorSlotCount: number;
  fixedSlotPoints: number;
  adoptedIds: Set<string>;
  gradeName: string;
}) {
  const fixed = items.filter((i) => i.isFixedSlot);
  const monetary = items.filter((i) => i.isMonetary);
  // 20点枠を持たない等級区分では、金銭系の項目も「10点枠の候補」として扱われる
  const others = items.filter((i) => !i.isFixedSlot && !(majorSlotCount > 0 && i.isMonetary));

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
          <ItemRow key={i.kpiItemId} item={i} points={fixedSlotPoints} adopted={adoptedIds.has(i.kpiItemId)} />
        ))}
      </Card>
      <p className="footnote mt-2">
        等級要件達成率は差し替えできません。どの等級でも必ずこの1項目が入ります。
      </p>

      {majorSlotCount > 0 && (
        <>
          <p className="section-heading mt-5 mb-2">
            {majorSlotPoints}点枠の候補（金銭に関わる項目・この中から1つ）
          </p>
          <Card>
            {monetary.length === 0 ? (
              <div className="card-row">
                <p className="m-0 text-[13px]">この等級区分で選べる金銭に関わる項目が登録されていません。</p>
              </div>
            ) : (
              monetary.map((i) => (
                <ItemRow key={i.kpiItemId} item={i} points={majorSlotPoints} adopted={adoptedIds.has(i.kpiItemId)} />
              ))
            )}
          </Card>
          {missingMonetary.length > 0 && (
            <p className="footnote mt-2">
              {missingMonetary.map((i) => i.name).join("・")}は {gradeName} では選べません。
              元の配点表にこの等級区分の行が無く、制度としてこの等級では評価しないと決まっているためです。
            </p>
          )}
        </>
      )}

      <p className="section-heading mt-5 mb-2">
        {minorSlotPoints}点枠の候補（<Num value={others.length} unit="件" />
        の中から <Num value={minorSlotCount} unit="つ" />）
      </p>
      {others.length === 0 ? (
        <p className="footnote">
          この等級区分では、等級要件達成率だけで満点になります。ほかの項目は評価の対象になりません（0点ではなく、そもそも点数を付けません）。
        </p>
      ) : (
        <details className="card card-pad">
          <summary className="cursor-pointer text-[13px] font-semibold">
            選べる項目をカテゴリごとに見る（<Num value={others.length} unit="件" />）
          </summary>
          <div className="mt-3 grid gap-4">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <p className="m-0 mb-1 text-[12px] font-semibold text-[var(--ink-muted)]">
                  {category}（{list.length}件）
                </p>
                <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
                  {list.map((i) => (
                    <li key={i.kpiItemId}>
                      No.{i.no} {i.name}
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
