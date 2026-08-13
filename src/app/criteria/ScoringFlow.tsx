import type { ReactNode } from "react";
import { Badge, Card, Code, DefList, Disclosure, NoteBlock, Num, RankMark, StepBlock, StepFlow } from "@/components/ui";
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

/**
 * 「内部完結」「外部影響」だけでは、何が結果を左右するのか読み取れない。
 * 値そのものは短く残し、意味は値の下に小さく添える（値と説明を1行に混ぜない）。
 */
const CONTROLLABILITY_NOTE: Record<string, string> = {
  内部完結: "本人・事業所の実行だけでAに届きます。",
  外部影響: "利用者・家族・市場の反応が結果を左右します。",
};

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

/**
 * 定義書の列を、ラベルと値の対（定義リスト）に組む。
 *
 * 以前はラベルと値を空白1つでつないだ段落を9行並べていたため、どこがラベルで
 * どこが値なのか目で切れなかった（2026-08-13 の指摘）。器を定義リストへ替えると、
 * ラベル幅・小ささ・狭い画面での縦積みが共通部品側で揃う（docs/product/spec.md §5-5）。
 *
 * 値が無い列は行ごと出さない（空欄を並べても読めないため）。
 */
function defRowsOf(item: SelectableItem): { label: string; value: ReactNode }[] {
  const controllabilityNote = item.controllability ? CONTROLLABILITY_NOTE[item.controllability] : undefined;
  const rows: { label: string; value: ReactNode }[] = [
    { label: "何を見る項目か", value: item.intent },
    { label: "実績区分", value: item.measureType },
    { label: "データ取得元", value: item.dataSource },
    { label: "判断時期", value: item.judgeTiming },
    { label: "A水準の型", value: item.aType },
    { label: "Aランクの基準", value: item.aStandard },
    {
      label: "制御可能性",
      value: item.controllability && (
        <>
          {item.controllability}
          {controllabilityNote && <span className="footnote mt-0.5 block">{controllabilityNote}</span>}
        </>
      ),
    },
  ];
  return rows.filter((r) => r.value);
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
      <StepFlow>
        <StepBlock step="⓪" title="この項目の定義">
          <DefList rows={defRowsOf(item)} />
          {item.aRationale && <NoteBlock label="なぜその水準をAとするか">{item.aRationale}</NoteBlock>}
          {item.remarks && <NoteBlock label="備考">{item.remarks}</NoteBlock>}
        </StepBlock>

        <StepBlock step="①" title="本人に聞くこと">
          {questions.length === 0 ? (
            <p className="m-0 text-sub">
              この項目の設問が登録されていません。実績値を出せないため、評価する側が値を入れる必要があります。
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0 text-sub">
              {questions.map((q) => (
                <li key={q.id}>
                  <Code>{q.questionKey}</Code> <span className="footnote">{ROLE_LABEL[q.role] ?? q.role}</span>
                  <br />
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </StepBlock>

        <StepBlock
          step="②"
          title="実績値の出し方"
          aside={`単位 ${item.unit} ／ ${item.direction === "lower" ? "低いほど良い" : "高いほど良い"}`}
        >
          {item.formula ? (
            <Code block>{item.formula}</Code>
          ) : (
            <p className="m-0 text-sub">計算式が登録されていません（回答した数値をそのまま使います）。</p>
          )}
          {item.formulaNote && <NoteBlock label="自動で決まる値・固定値の扱い">{item.formulaNote}</NoteBlock>}
        </StepBlock>

        {/* ③と④は同じ表の別の列で読むもの。段を分けると同じ表を2回出すことになるのでまとめる。 */}
        <StepBlock step="③④" title="ランクの決まり方と点数">
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
                { key: "rank", header: "ランク", role: "title", cell: (c) => <RankMark rank={c.rank} /> },
                { key: "range", header: "この範囲なら", cell: (c) => c.displayLabel },
                {
                  key: "meaning",
                  header: "どういう状態か",
                  // 空欄にすると「登録漏れ」と「そもそも書かない列」の区別が付かないので印を出す
                  cell: (c) => <span className="footnote">{c.meaning ?? "—"}</span>,
                },
                {
                  key: "formula",
                  header: "数式で書くと",
                  // 上限・下限が両方空の行は日本語の文になる。文を等幅にすると読みにくいので、式のときだけ等幅にする。
                  cell: (c) =>
                    c.lowerBound === null && c.upperBound === null ? (
                      <span className="footnote">{boundText(c, item.direction)}</span>
                    ) : (
                      <Code>{boundText(c, item.direction)}</Code>
                    ),
                },
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
          <NoteBlock label="境目の値の扱い">
            {item.direction === "lower"
              ? "低いほど良いので「上限以下・下限超」で見ます。境目の値はどちらか一方のランクにしか入りません。"
              : "高いほど良いので「下限以上・上限未満」で見ます。境目の値はどちらか一方のランクにしか入りません。"}
          </NoteBlock>
        </StepBlock>
      </StepFlow>
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
