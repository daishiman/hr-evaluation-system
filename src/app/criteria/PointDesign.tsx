import { Card, InlineDetail, Num } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { slotCountOf, type GradePointRule } from "./data";

/**
 * 等級区分ごとの「持ち点の型」。
 *
 * 数字は1つも書かず、すべて grade_point_rules から読んだ値を並べている。
 * 制度を変えたらこの画面の表示も自動で変わる。
 */

/** 100点の内訳を1本の帯で見せる。合計が100点ちょうどであることが一目で分かるようにするため。 */
function CompositionBar({ rule }: { rule: GradePointRule }) {
  const total = rule.totalPoints;
  const segments = [
    { key: "fixed", points: rule.fixedSlotPoints, color: "var(--brand-deep)" },
    { key: "major", points: rule.majorSlotPoints * rule.majorSlotCount, color: "var(--brand)" },
    { key: "minor", points: rule.minorSlotPoints * rule.minorSlotCount, color: "var(--brand-soft)" },
  ].filter((seg) => seg.points > 0);

  return (
    <div
      className="mt-3 flex h-3 overflow-hidden rounded-full border border-line"
      role="img"
      aria-label={`満点${total}点の内訳`}
    >
      {segments.map((seg) => (
        <div
          key={seg.key}
          style={{ width: `${(seg.points / total) * 100}%`, background: seg.color }}
          className="h-full"
        />
      ))}
    </div>
  );
}

/** 内訳の1行（枠の名前・1つあたりの配点・個数・小計）。 */
function SlotRow({
  swatch,
  title,
  detail,
  subtotal,
}: {
  swatch: string;
  title: string;
  detail: string;
  subtotal: number;
}) {
  return (
    <div className="card-row items-start">
      <span
        aria-hidden="true"
        className="mt-[5px] inline-block h-3 w-3 shrink-0 rounded-sm border border-line"
        style={{ background: swatch }}
      />
      <div className="row-main">
        <p className="todo-row-title m-0">{title}</p>
        <p className="todo-row-sub m-0">{detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <Num value={subtotal} display />
        <span className="unit">点</span>
      </div>
    </div>
  );
}

export function PointDesign({
  rule,
  gradeName,
  selectableCount,
}: {
  rule: GradePointRule | null;
  gradeName: string;
  selectableCount: number;
}) {
  if (!rule) {
    return (
      <Card className="card-pad">
        <p className="m-0 text-sub">
          {gradeName} の配点の型がまだ登録されていません。会社の管理者に「等級区分ごとの配点」の登録を依頼してください。
        </p>
      </Card>
    );
  }

  const slots = slotCountOf(rule);
  const sum =
    rule.fixedSlotPoints + rule.majorSlotPoints * rule.majorSlotCount + rule.minorSlotPoints * rule.minorSlotCount;

  return (
    <>
      <Card className="card-pad hero-tint">
        <p className="m-0 text-note text-ink-muted">{gradeName} の満点と、その内訳</p>
        <p className="num-display m-0 text-hero-sp leading-tight text-accent">
          <Num value={rule.totalPoints} />
          <span className="unit">点満点</span>
        </p>
        <p className="m-0 mt-1 text-sub">
          この等級では <Num value={slots} unit="項目" /> を評価します（選べる項目は{" "}
          <Num value={selectableCount} unit="件" />）。
        </p>
        <CompositionBar rule={rule} />
        {sum !== rule.totalPoints && (
          <p className="m-0 mt-2 text-note text-danger">
            内訳の合計が <Num value={sum} unit="点" /> で満点と合いません。会社の管理者に配点の見直しを依頼してください。
          </p>
        )}
      </Card>

      <Card>
        <SlotRow
          swatch="var(--brand-deep)"
          title="等級要件達成率（固定枠）"
          detail="どの等級でも必ず入る。差し替えできない"
          subtotal={rule.fixedSlotPoints}
        />
        {rule.majorSlotCount > 0 && (
          <SlotRow
            swatch="var(--brand)"
            title={`${rule.majorSlotPoints}点枠（とくに重く見る項目）`}
            detail={`${rule.majorSlotPoints}点 × ${rule.majorSlotCount}つ。下の「選べる項目」から選ぶ（どの分類からでも可）`}
            subtotal={rule.majorSlotPoints * rule.majorSlotCount}
          />
        )}
        {rule.minorSlotCount > 0 && (
          <SlotRow
            swatch="var(--brand-soft)"
            title={`${rule.minorSlotPoints}点枠`}
            detail={`${rule.minorSlotPoints}点 × ${rule.minorSlotCount}つ。下の「選べる項目」から選ぶ`}
            subtotal={rule.minorSlotPoints * rule.minorSlotCount}
          />
        )}
      </Card>

      {rule.note && <p className="footnote mt-2">{rule.note}</p>}

      {/* 配点そのものは上に出ている。ここに書いてあるのは「なぜその配点なのか」という
          制度の考え方で、見るたびに読む必要はない。消さずに畳んでおく。 */}
      <div className="mt-2">
        <InlineDetail summary="等級によって配点が変わる理由">
          <p className="m-0 text-sub">等級が上がるほど、等級要件の配点は下がります。</p>
          <p className="m-0 mt-1 text-sub">そのぶん、売上や利益などの成果を見る項目の配点が上がります。</p>
          <p className="m-0 mt-1 text-sub">上の等級ほど、自分の判断で動かせる範囲が広くなります。</p>
          <p className="m-0 mt-1 text-sub">
            決められたことを満たしたかよりも、出した成果で見るほうが実態に合うためです。
          </p>
        </InlineDetail>
      </div>
    </>
  );
}

/** 全等級区分の配点をならべた比較表。「自分の等級だけ特別ではない」ことを確かめるために置く。 */
export function PointRuleComparison({ rules, currentGroup }: { rules: GradePointRule[]; currentGroup: string | null }) {
  return (
    /* 等級区分ごとの配点を横並びで見比べるための表。数値を突き合わせる用途そのものなので表が最適
       （docs/product/spec.md §5-5）。狭い画面では DataTable が自動でカードに畳む。 */
    <DataTable
      caption="等級区分ごとの配点"
      rows={rules}
      rowKey={(r) => r.id}
      columns={[
        {
          key: "group",
          header: "等級区分",
          role: "title",
          cell: (r) => (
            <>
              {r.pointGroup}
              {r.pointGroup === currentGroup && <span className="footnote"> ← いま見ている等級</span>}
            </>
          ),
        },
        { key: "total", header: "満点", num: true, cell: (r) => <Num value={r.totalPoints} /> },
        { key: "fixed", header: "等級要件", num: true, cell: (r) => <Num value={r.fixedSlotPoints} /> },
        {
          key: "major",
          header: "20点枠",
          num: true,
          cell: (r) =>
            r.majorSlotCount > 0 ? (
              <>
                <Num value={r.majorSlotPoints} />
                <span className="unit">点 ×</span>
                <Num value={r.majorSlotCount} />
              </>
            ) : (
              <span className="text-ink-muted">—</span>
            ),
        },
        {
          key: "minor",
          header: "10点枠",
          num: true,
          cell: (r) =>
            r.minorSlotCount > 0 ? (
              <>
                <Num value={r.minorSlotPoints} />
                <span className="unit">点 ×</span>
                <Num value={r.minorSlotCount} />
              </>
            ) : (
              <span className="text-ink-muted">—</span>
            ),
        },
        { key: "slots", header: "選ぶ項目数", num: true, cell: (r) => <Num value={slotCountOf(r)} /> },
      ]}
    />
  );
}
