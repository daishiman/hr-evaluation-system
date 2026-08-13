"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardRow, DefList, EmptyState, LinkButton, Num, ReasonNote, SectionHeading } from "@/components/ui";
import { TrendChart } from "@/components/LazyCharts";
import {
  availableRanges,
  buildGradeBands,
  filterByRange,
  gradeChanges,
} from "@/lib/domain/evaluation-trend";

/** 内訳に出す1行。数値は画面側で桁区切りを付けるため、文字にせず数のまま渡す。 */
export interface TrendDetailRow {
  label: string;
  value?: number | null;
  unit?: string;
  /** 数値ではない項目（状態・コメントなど） */
  text?: string;
}

export interface TrendItem {
  id: string;
  /** その期の評価票へのリンク先 */
  href: string;
  /** 評価期間の名前。グラフの横軸の値になる */
  cycle: string;
  /** 「2025年4月1日 〜 …」の形に整えた期間 */
  period: string;
  periodStart: string | null;
  gradeName: string | null;
  /** 確定した評価だけをグラフに出す（確認中の値は動くため） */
  finalized: boolean;
  /** グラフの系列ごとの値 */
  values: Record<string, number | null>;
  /** 一覧の1行に出す補足 */
  sub: string;
  /** 一覧の1行の右に出す主な数値 */
  headline: { value: number | null; unit: string; caption: string };
  /** 選んだ期の内訳 */
  rows: TrendDetailRow[];
}

export interface TrendSeries {
  key: string;
  label: string;
}

const RANGE_LABEL: Record<number, string> = { 1: "直近1年", 3: "直近3年", 5: "直近5年" };

/** 等級の区間をそのまま並べてよい数。これを超えたら回数だけを言う。 */
const BANDS_LISTED = 4;
/** 「これまでの評価」の初期表示件数。長く在籍した人でも一覧が画面を埋め尽くさないようにする。 */
const ROWS_SHOWN = 12;

/**
 * 評価の推移と、その中身をひとつながりで読むための節。
 *
 * 元は「推移のグラフ」と「これまでの評価」が別々に置かれており、
 * グラフの山がどの期のことなのか、その期に何があったのかを辿れなかった。
 * ここでは期をひとつ選ぶと、グラフの位置・内訳・一覧の行が同時に動く。
 *
 * 等級はグラフの背景の区切りと縦の破線で示す。等級が変わると評価の基準も変わるため、
 * 切れ目を描かずに数値だけを並べると「下がった」と誤読される。
 */
export function EvaluationTrend({
  items,
  series,
  emptyBody,
}: {
  /** 新しい順に並んだ評価 */
  items: TrendItem[];
  /** グラフ1枚につき1つ。単位の違う値を1本の縦軸に重ねない */
  series: TrendSeries[];
  /** 評価が1件もないときに、次に何をすればよいかを書く */
  emptyBody: string;
}) {
  /* 「いま」は開いたときの1点に固定する。描き直すたびに測ると、
     選択肢や絞り込みの結果が毎回作り直されて画面が無駄に動く。 */
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [allRows, setAllRows] = useState(false);

  const ranges = useMemo(() => availableRanges(items, now), [items, now]);
  const shown = useMemo(() => filterByRange(items, range, now), [items, range, now]);

  /* グラフは古い順（左から右へ時が流れる）。一覧は新しい順のまま。 */
  const plotted = useMemo(() => [...shown].filter((x) => x.finalized).reverse(), [shown]);
  const bands = useMemo(() => buildGradeBands(plotted), [plotted]);
  const changes = useMemo(() => gradeChanges(bands), [bands]);
  const gradeOf = useMemo(
    () => Object.fromEntries(plotted.map((x) => [x.cycle, x.gradeName ?? "等級未設定"])),
    [plotted],
  );
  const chartData = useMemo(
    () => plotted.map((x) => ({ cycle: x.cycle, ...x.values })),
    [plotted],
  );

  /* 既定は、絞り込んだ範囲の中でいちばん新しい期。面談で最初に見るのはそこなので、
     開いた時点で内訳が埋まっている状態にする。選んだ期が範囲から外れたら先頭へ戻す。 */
  const current = shown.find((x) => x.id === picked) ?? shown[0] ?? null;

  /* 一覧は新しい方から少しだけ出す。選んだ期が奥にあるときは、その行までは出す
     （「表示中」と言いながらどこにも無い、が起きないようにする）。 */
  const pickedAt = current ? shown.findIndex((x) => x.id === current.id) : -1;
  const listed = allRows ? shown : shown.slice(0, Math.max(ROWS_SHOWN, pickedAt + 1));

  if (items.length === 0) {
    return (
      <>
        <SectionHeading>評価の推移</SectionHeading>
        <EmptyState title="評価がまだありません" body={emptyBody} />
      </>
    );
  }

  return (
    <>
      <SectionHeading
        help={ranges.length > 0 ? "見たい期間を選ぶと、グラフと一覧の両方が切り替わります。" : undefined}
      >
        評価の推移
      </SectionHeading>

      {ranges.length > 0 && (
        <div className="chip-grid mb-3" aria-label="表示する期間">
          {[null, ...ranges].map((y) => (
            <button
              key={y ?? "all"}
              type="button"
              className="chip"
              aria-pressed={range === y}
              onClick={() => setRange(y)}
            >
              {y === null ? "全期間" : RANGE_LABEL[y]}
            </button>
          ))}
        </div>
      )}

      {plotted.length < 2 ? (
        <ReasonNote>
          この期間に確定した評価が{plotted.length}件のため、推移のグラフは出せません。
        </ReasonNote>
      ) : (
        <Card className="card-pad">
          {/* 等級の区間は文字でも出す。グラフの背景の濃淡だけに頼ると、
              印刷したときと色の見分けがつきにくい方の環境で読めなくなる。 */}
          <p className="m-0 text-note text-[var(--ink-muted)]">この期間の等級</p>
          {bands.length > BANDS_LISTED ? (
            /* 20年ぶんのように区間が増えると、この一覧だけで画面が埋まりグラフに届かない。
               回数だけ伝え、期ごとの等級は下の一覧（行ごとのバッジ）に任せる。 */
            <p className="m-0 mt-1 text-sub">
              この期間に等級が{bands.length - 1}回変わりました。各期の等級は下の一覧に出ます。
            </p>
          ) : (
            <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sub">
              {bands.map((b) => (
                <li key={`${b.label}-${b.from}`}>
                  {b.label}
                  <span className="footnote">
                    {" "}
                    {b.from === b.to ? b.from : `${b.from} 〜 ${b.to}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {series.map((sr) => (
            <div key={sr.key} className="mt-4">
              <p className="m-0 text-note text-[var(--ink-muted)]">{sr.label}</p>
              <TrendChart
                data={chartData}
                series={[sr]}
                bands={bands}
                changes={changes}
                gradeOf={gradeOf}
                activeCycle={current?.cycle}
                onSelect={(cycle) => setPicked(plotted.find((x) => x.cycle === cycle)?.id ?? null)}
              />
            </div>
          ))}
          <p className="footnote m-0">グラフを押すと、その期の内訳が下に出ます。</p>
        </Card>
      )}

      {current && (
        <>
          <SectionHeading>選んだ期の内訳</SectionHeading>
          <Card className="card-pad">
            <div className="field">
              <label htmlFor="trend-cycle">見る期</label>
              <select
                id="trend-cycle"
                className="input"
                value={current.id}
                onChange={(e) => setPicked(e.target.value)}
              >
                {shown.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.cycle}
                    {x.finalized ? "" : "（確認中）"}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <DefList
                rows={[
                  { label: "評価期間", value: current.period },
                  { label: "この期の等級", value: current.gradeName ?? "未設定" },
                  ...current.rows.map((r) => ({
                    label: r.label,
                    value: r.text ?? <Num value={r.value} unit={r.unit} />,
                  })),
                ]}
              />
            </div>
            <div className="mt-3">
              <LinkButton href={current.href}>この期の評価票を開く</LinkButton>
            </div>
          </Card>
        </>
      )}

      <SectionHeading>これまでの評価</SectionHeading>
      {shown.length === 0 ? (
        <ReasonNote
          action={
            <button type="button" className="chip" onClick={() => setRange(null)}>
              全期間に戻す
            </button>
          }
        >
          選んだ期間に評価がありません。
        </ReasonNote>
      ) : (
        <Card>
          {/* 選んだ行の目印。等級バッジと同じ色にすると、バッジが行に溶けて読めなくなる */}
          {listed.map((e) => (
            <CardRow
              key={e.id}
              className={e.id === current?.id ? "bg-[var(--subtle)]" : undefined}
              title={
                <Link href={e.href} className="text-[var(--brand-deep)]">
                  {e.cycle}
                </Link>
              }
              sub={`${e.period} ／ ${e.sub}`}
              value={
                <>
                  <Num value={e.headline.value} unit={e.headline.unit} display />
                  <p className="m-0 text-note text-[var(--ink-muted)]">{e.headline.caption}</p>
                </>
              }
              marks={
                <>
                  {/* 等級は打消し線の出るバッジ（closed）を使わない。等級名に線が引かれ、
                      「その等級ではなくなった」と読めてしまう。 */}
                  <Badge tone="active">{e.gradeName ?? "等級未設定"}</Badge>
                  {e.finalized ? <Badge tone="done">確定済み</Badge> : <Badge tone="dropped">確認中</Badge>}
                  {/* 選んでいる行は薄い塗りだけだと見落とす。言葉でも示す */}
                  {e.id === current?.id && <Badge tone="required">表示中</Badge>}
                </>
              }
            />
          ))}
          {listed.length < shown.length && (
            <CardRow
              title={
                <button type="button" className="chip" onClick={() => setAllRows(true)}>
                  古い評価も表示する
                </button>
              }
              sub={`いま${listed.length}件を表示中。全部で${shown.length}件あります。`}
            />
          )}
        </Card>
      )}
    </>
  );
}
