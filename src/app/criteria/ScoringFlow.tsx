import { Badge, Card, Disclosure, Num } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import type { SelectableItem } from "./data";

/**
 * 1項目ぶんの採点の流れを、上から下へ1本で追えるようにする画面部品。
 *
 *   ① 何を聞くか（kpi_questions）
 *   ② どう実績値にするか（kpi_items.formula）
 *   ③ どのランクになるか（kpi_rank_criteria の下限・上限）
 *   ④ 何点になるか（配点 × ランクの割合）
 *
 * ここに出る数字（閾値・割合・配点）はすべてDBのマスタから読んでいる。
 * 項目が33件あるため、既定は畳んでおき、見たい項目だけ開く。
 */

export interface RankCriterionRow {
  id: string;
  kpiItemId: string;
  rank: string;
  displayLabel: string;
  lowerBound: number | null;
  upperBound: number | null;
  meaning: string | null;
  isProvisional: boolean;
}

export interface QuestionRow {
  id: string;
  kpiItemId: string | null;
  questionKey: string;
  text: string;
  unit: string | null;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  numerator: "分子",
  denominator: "分母",
  direct: "そのまま実績値",
  identify: "識別のため",
};

const RANK_ORDER = ["A", "B", "C", "D", "E"];

/** 配点とランクの割合から点数を出す（評価の計算 src/lib/domain/scoring.ts と同じ丸め方）。 */
function scoreOf(weight: number, ratio: number): number {
  return Math.round(weight * ratio * 10) / 10;
}

/**
 * 下限・上限を日本語の範囲に直す。
 * 逆転指標（低いほど良い）は「上限以下・下限超」で見るので、書き方が入れ替わる。
 */
function boundText(c: RankCriterionRow, direction: string): string {
  const lower = c.lowerBound;
  const upper = c.upperBound;
  if (direction === "lower") {
    if (upper !== null && lower !== null) return `${lower} 超 ${upper} 以下`;
    if (upper !== null) return `${upper} 以下`;
    if (lower !== null) return `${lower} 超`;
    return "範囲の指定なし";
  }
  if (lower !== null && upper !== null) return `${lower} 以上 ${upper} 未満`;
  if (lower !== null) return `${lower} 以上`;
  if (upper !== null) return `${upper} 未満`;
  return "範囲の指定なし";
}

/**
 * 項目ブロックのアンカーID。
 * 一覧（選べる項目・採用中の項目）から「その項目の評価基準」へ直接飛ばすために、
 * リンク側と描画側で同じ関数を使う（文字列を二重に書くとズレるため）。
 */
export function anchorIdOf(kpiItemId: string): string {
  return `kpi-${kpiItemId}`;
}

/** 定義書の1列を「見出し：中身」で出す。値が無い列は行ごと出さない（空欄を並べても読めないため）。 */
function DefRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="m-0 text-sub">
      <span className="footnote">{label}</span> {value}
    </p>
  );
}

function ItemFlow({
  item,
  weight,
  slotLabel,
  adopted,
  questions,
  criteria,
  ratios,
  open,
}: {
  item: SelectableItem;
  weight: number;
  slotLabel: string;
  adopted: boolean;
  questions: QuestionRow[];
  criteria: RankCriterionRow[];
  ratios: { rank: string; ratio: number }[];
  /** 一覧から「この項目の評価を見る」で飛んできたときだけ開いておく */
  open: boolean;
}) {
  const sorted = [...criteria].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  return (
    /* アンカーは畳む部品の外側に置く。畳む器を共通部品に替えても、
       一覧からの「#kpi-… へ飛ぶ」と「?item= で開いた状態にする」は変わらない。 */
    <div id={anchorIdOf(item.kpiItemId)}>
      <Disclosure
        defaultOpen={open}
        summary={
          <>
            <span className="font-semibold">
              No.{item.no} {item.name}
            </span>{" "}
            <span className="footnote">／ {slotLabel}</span>{" "}
            <span className="num font-bold">{weight}</span>
            <span className="unit">点</span>
            {adopted && <> <Badge tone="active">この等級で採用中</Badge></>}
          </>
        }
      >
      <div className="grid gap-4">
        <div>
          <p className="m-0 mb-1 text-note font-semibold text-ink-muted">⓪ この項目の定義</p>
          <div className="grid gap-1">
            <DefRow label="何を見る項目か" value={item.intent} />
            <DefRow label="実績区分" value={item.measureType} />
            <DefRow label="データ取得元" value={item.dataSource} />
            <DefRow label="判断時期" value={item.judgeTiming} />
            <DefRow
              label="A水準の型"
              value={[item.aType, item.aStandard && `A＝${item.aStandard}`].filter(Boolean).join(" ／ ") || null}
            />
            <DefRow
              label="制御可能性"
              value={
                item.controllability === "外部影響"
                  ? "外部影響（利用者・家族・市場の反応が結果を左右する）"
                  : item.controllability === "内部完結"
                    ? "内部完結（本人・事業所の実行だけでAに届く）"
                    : item.controllability
              }
            />
            <DefRow label="なぜその水準をAとするか" value={item.aRationale} />
            <DefRow label="備考" value={item.remarks} />
          </div>
        </div>

        <div>
          <p className="m-0 mb-1 text-note font-semibold text-ink-muted">① 本人に聞くこと</p>
          {questions.length === 0 ? (
            <p className="m-0 text-sub">
              この項目の設問が登録されていません。実績値を出せないため、評価する側が値を入れる必要があります。
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0 text-sub">
              {questions.map((q) => (
                <li key={q.id}>
                  <span className="num font-bold">{q.questionKey}</span>{" "}
                  <span className="footnote">（{ROLE_LABEL[q.role] ?? q.role}）</span>
                  <br />
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="m-0 mb-1 text-note font-semibold text-ink-muted">② 実績値の出し方</p>
          <p className="m-0 text-sub">{item.formula ?? "計算式が登録されていません（回答した数値をそのまま使います）。"}</p>
          {item.formulaNote && <p className="footnote m-0 mt-1">{item.formulaNote}</p>}
          <p className="footnote m-0 mt-1">
            単位は {item.unit}。{item.direction === "lower" ? "低いほど良い項目です。" : "高いほど良い項目です。"}
          </p>
        </div>

        <div>
          <p className="m-0 mb-1 text-note font-semibold text-ink-muted">
            ③ 実績値からランクを決める ／ ④ 何点になるか
          </p>
          {sorted.length === 0 ? (
            <p className="m-0 text-sub">この項目のランク基準が登録されていません。会社の管理者に登録を依頼してください。</p>
          ) : (
            /* ランクごとの範囲と点数を上から見比べる表。項目が揃っていて数値を突き合わせるので表のまま
               （docs/product/spec.md §5-5）。 */
            <DataTable
              caption="ランクごとの範囲と点数"
              rows={sorted}
              rowKey={(c) => c.id}
              columns={[
                { key: "rank", header: "ランク", role: "title", cell: (c) => <span className="num font-bold">{c.rank}</span> },
                {
                  key: "range",
                  header: "この範囲なら",
                  cell: (c) => (
                    <>
                      {c.displayLabel}
                      {c.meaning && <span className="footnote"> ／ {c.meaning}</span>}
                    </>
                  ),
                },
                { key: "formula", header: "数式で書くと", cell: (c) => <span className="footnote">{boundText(c, item.direction)}</span> },
                {
                  key: "ratio",
                  header: "割合",
                  num: true,
                  cell: (c) => <Num value={Math.round((ratios.find((r) => r.rank === c.rank)?.ratio ?? 0) * 100)} unit="%" />,
                },
                {
                  key: "score",
                  header: "点数",
                  num: true,
                  cell: (c) => <Num value={scoreOf(weight, ratios.find((r) => r.rank === c.rank)?.ratio ?? 0)} unit="点" />,
                },
              ]}
            />
          )}
          <p className="footnote mt-2">
            {item.direction === "lower"
              ? "この項目は低いほど良いので「上限以下・下限超」で見ます。境目の値はどちらか一方のランクにしか入りません。"
              : "この項目は高いほど良いので「下限以上・上限未満」で見ます。境目の値はどちらか一方のランクにしか入りません。"}
          </p>
          {item.aStandard && <p className="footnote m-0 mt-1">Aの水準の考え方：{item.aStandard}</p>}
        </div>
      </div>
      </Disclosure>
    </div>
  );
}

export function ScoringFlow({
  items,
  weightOf,
  slotLabelOf,
  adoptedIds,
  questions,
  criteria,
  ratios,
  openItemId,
}: {
  items: SelectableItem[];
  weightOf: (item: SelectableItem) => number;
  slotLabelOf: (item: SelectableItem) => string;
  adoptedIds: Set<string>;
  questions: QuestionRow[];
  criteria: RankCriterionRow[];
  ratios: { rank: string; ratio: number }[];
  openItemId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <Card className="card-pad">
        <p className="m-0 text-sub">この等級区分で評価する項目がありません。</p>
      </Card>
    );
  }

  return (
    <div className="stack-tight">
      {items.map((item) => (
        <ItemFlow
          key={item.kpiItemId}
          item={item}
          weight={weightOf(item)}
          slotLabel={slotLabelOf(item)}
          adopted={adoptedIds.has(item.kpiItemId)}
          questions={questions.filter((q) => q.kpiItemId === item.kpiItemId)}
          criteria={criteria.filter((c) => c.kpiItemId === item.kpiItemId)}
          ratios={ratios}
          open={item.kpiItemId === openItemId}
        />
      ))}
    </div>
  );
}
