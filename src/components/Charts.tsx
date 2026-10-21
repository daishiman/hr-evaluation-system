"use client";

import { cloneElement, type ReactElement } from "react";
import { RADAR_HEIGHT, REPORT_CHART_HEIGHT, REPORT_RADAR_HEIGHT, TREND_HEIGHT } from "./chart-dimensions";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GradeBand, GradeChange } from "@/lib/domain/evaluation-trend";
import { chartDensity } from "@/lib/domain/evaluation-trend";

/**
 * 評価の見える化。
 * 色はプライマリ1色だけを使い、比較のときだけ薄い方を過去分に割り当てる。
 */

/* 色は globals.css のトークンから読む。SVG にはクラスが効かず値で渡すしかないが、
   ここに色を書き込むと暗いテーマのときだけグラフが白いままになる。
   等級の区間を敷く面（band）は、色相を増やさないため面の中でいちばん弱い段を使い、
   区間を1つおきに塗って切れ目を出す（塗った側が「上の等級」ではない）。 */
const CHART_COLORS = {
  brand: "var(--brand)",
  brandSoft: "var(--chart-line-soft)",
  line: "var(--line)",
  inkMuted: "var(--ink-muted)",
  band: "var(--chart-band)",
  surface: "var(--surface)",
  ink: "var(--ink)",
} as const;

/* グラフの中の文字。SVG に描くのでクラスが効かず、数値で渡すしかない。
   globals.css の文字の段（--text-note = 14px / --text-sub = 15px）と
   対で保つ。片方だけ動かさないこと。目盛りだけは軸の本数が多く、
   14px だと隣とぶつかるため一段小さい 13px を下限として許容する。 */
const CHART_FS_TICK = 13;
const CHART_FS_TEXT = 14;

export interface RadarPoint {
  /** 項目名（軸のラベル） */
  item: string;
  /** 0〜100 の達成度。判定外（実績が未入力）は null で、0点とは区別する */
  value: number | null;
  rank: string | null;
  /** 実績が入力されておらずランクを付けられなかった項目 */
  unrated?: boolean;
}

/**
 * 項目別の達成度を1枚で見せるレーダーチャート。
 *
 * 軸の数は等級区分によって 1〜8 と変わるため、項目数は固定にしない。
 * 3項目に満たないと多角形が形にならない（1軸は点、2軸は線）ので、
 * そのときは横棒に切り替える。形で語れない数を無理に多角形で描かないため。
 */
export function EightAxisRadar({
  data,
  compare,
  compareLabel,
  label = "今回",
  valueLabel = "達成度",
}: {
  data: RadarPoint[];
  compare?: RadarPoint[];
  compareLabel?: string;
  label?: string;
  /** ツールチップに出す軸の意味（実点数で描くか、ランクで描くかで変わる） */
  valueLabel?: string;
}) {
  /* 判定外の軸はラベルに ※ を添える。値を欠損にするだけだと、
     形がへこんだ理由が「悪い」なのか「測れていない」なのか読み取れないため。 */
  const { brand, brandSoft, line, inkMuted, surface, ink } = CHART_COLORS;
  const unratedNames = new Set(data.filter((d) => d.unrated || d.rank === null).map((d) => d.item));

  const merged = data.map((d) => ({
    item: d.item,
    rank: d.rank,
    [label]: d.value,
    ...(compare ? { [compareLabel ?? "前回"]: compare.find((c) => c.item === d.item)?.value ?? null } : {}),
  }));

  if (data.length < 3) {
    return (
      <div>
        {data.map((d) => (
          <div key={d.item} style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: CHART_FS_TEXT, color: inkMuted }}>
              {d.item}
              {unratedNames.has(d.item) ? "（判定外）" : ""}
            </p>
            <div style={{ height: 8, borderRadius: 4, background: line, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${d.value ?? 0}%`,
                  background: d.value === null ? "transparent" : brand,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: RADAR_HEIGHT }}>
      <ResponsiveContainer>
        <RadarChart data={merged} outerRadius="72%">
          <PolarGrid stroke={line} />
          <PolarAngleAxis
            dataKey="item"
            tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }}
            tickFormatter={(v: string) =>
              `${v.length > 9 ? `${v.slice(0, 9)}…` : v}${unratedNames.has(v) ? "※" : ""}`
            }
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }} tickCount={6} />
          {compare && (
            <Radar
              name={compareLabel ?? "前回"}
              dataKey={compareLabel ?? "前回"}
              stroke={brandSoft}
              fill={brandSoft}
              fillOpacity={0.25}
              connectNulls={false}
            />
          )}
          <Radar
            name={label}
            dataKey={label}
            stroke={brand}
            fill={brand}
            fillOpacity={0.3}
            /* 判定外を線でつながない。つなぐと0点として面積に混ざってしまう */
            connectNulls={false}
          />
          <Tooltip
            formatter={(v) => [v === null || v === undefined ? "判定外（実績が未入力）" : `${v}%`, valueLabel]}
            contentStyle={{
              fontSize: CHART_FS_TEXT,
              borderRadius: 8,
              border: `1px solid ${line}`,
              background: surface,
              color: ink,
            }}
          />
          {compare && <Legend wrapperStyle={{ fontSize: CHART_FS_TEXT }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface TrendPoint {
  cycle: string;
  [key: string]: string | number | null;
}

/* 横軸の見出し。評価期間の名前は「2025年度 下期（サンプル）」のように長くなりがちで、
   そのまま出すと隣とぶつかり、両端は画面の外にはみ出して読めなくなる。
   期を見分けられる先頭だけ残す（正式な名前はツールチップと下の一覧に出る）。 */
const TICK_MAX = 9;
function shortenTick(v: string) {
  return v.length > TICK_MAX ? `${v.slice(0, TICK_MAX)}…` : v;
}

/**
 * サイクルごとの推移。過去の評価を並べて比較する。
 *
 * 単位の違う値（％と点）を1本の縦軸に重ねない。目盛りが1つしかないと、
 * 「達成率80％」と「80点」が同じ高さに描かれ、上下の比較が意味を持たなくなる。
 * 比べたい値が複数あるときは、横軸をそろえたグラフを縦に並べる。
 *
 * `bands` と `changes` は等級の文脈。等級が変われば評価の基準そのものが変わるため、
 * 切れ目を描かずに数値だけを並べると「下がった」と誤読される。
 */
export function TrendChart({
  data,
  series,
  bands = [],
  changes = [],
  gradeOf,
  activeCycle,
  onSelect,
  height = TREND_HEIGHT,
}: {
  data: TrendPoint[];
  series: { key: string; label: string; unit?: string }[];
  /** 等級ごとの区間。背景を1つおきに敷いて切れ目を出す */
  bands?: GradeBand[];
  /** 等級が変わった期。縦の破線と新しい等級名を出す */
  changes?: GradeChange[];
  /** 期の名前から等級名を引く。ツールチップに「どの等級のときか」を添える */
  gradeOf?: Record<string, string>;
  /** いま選んでいる期。縦線で場所を示す */
  activeCycle?: string;
  /** グラフを押したときに、いちばん近い期を返す */
  onSelect?: (cycle: string) => void;
  height?: number;
}) {
  const { brand, brandSoft, line, inkMuted, band, surface, ink } = CHART_COLORS;
  const { tickInterval, showDots } = chartDensity(data.length);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 20, right: 44, bottom: 4, left: -8 }}
          onClick={(state: { activeLabel?: string | number }) => {
            if (onSelect && state?.activeLabel !== undefined) onSelect(String(state.activeLabel));
          }}
          style={onSelect ? { cursor: "pointer" } : undefined}
        >
          {/* 背景は目盛りより先に描く（あとに描くと線と点が隠れる） */}
          {bands
            .filter((b) => b.alt)
            .map((b) => (
              <ReferenceArea key={`${b.label}-${b.from}`} x1={b.from} x2={b.to} fill={band} fillOpacity={1} />
            ))}
          <CartesianGrid stroke={line} vertical={false} />
          <XAxis
            dataKey="cycle"
            tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }}
            tickLine={false}
            axisLine={{ stroke: line }}
            interval={tickInterval}
            tickFormatter={shortenTick}
          />
          <YAxis tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              fontSize: CHART_FS_TEXT,
              borderRadius: 8,
              border: `1px solid ${line}`,
              background: surface,
              color: ink,
            }}
            labelFormatter={(label) => {
              const cycle = String(label ?? "");
              return gradeOf?.[cycle] ? `${cycle}（${gradeOf[cycle]}）` : cycle;
            }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: CHART_FS_TEXT }} />}
          {activeCycle && <ReferenceLine x={activeCycle} stroke={brandSoft} strokeWidth={2} />}
          {changes.map((c) => (
            <ReferenceLine
              key={c.at}
              x={c.at}
              stroke={inkMuted}
              strokeDasharray="4 3"
              label={
                c.label ? { value: c.label, position: "top", fontSize: CHART_FS_TICK, fill: inkMuted } : undefined
              }
            />
          ))}
          {series.map((sr, i) => (
            <Line
              key={sr.key}
              type="monotone"
              dataKey={sr.key}
              name={sr.label}
              stroke={i === 0 ? brand : brandSoft}
              strokeWidth={2}
              dot={showDots ? { r: 3 } : false}
              activeDot={{ r: 5 }}
              connectNulls
              /* 線を描くアニメーションは付けない。期を選ぶたび・画面幅が変わるたびに
                 最初から描き直され、読んでいる途中の線が消える。 */
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────── 評価レポートの図（DD-024） ─────────────
   画面では入れ物の幅に合わせ、印刷では決まった大きさ（width と height）で描く。
   印刷の幅で入れ物の幅を測り直す仕組みに頼ると、紙の幅に合う前の大きさで刷られる。
   凡例と値は図の外（ReportTemplate の文と表）に置き、図の中にはツールチップも凡例も持たない。
   本人・前の期・同じ等級の平均は、色だけでなく線の形（実線・破線）と点の有無で見分けられるようにする。
   描き直しのアニメーションは付けない（印刷の途中の形で刷られないように）。 */

/** width を渡せば決まった大きさで、渡さなければ入れ物の幅に合わせて描く */
function ReportChartBox({
  width,
  height,
  children,
}: {
  width?: number;
  height: number;
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  if (width) return <div style={{ width, height }}>{cloneElement(children, { width, height })}</div>;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

export interface ReportRadarDatum {
  item: string;
  /** 0〜100。判定外は null */
  value: number | null;
  previous: number | null;
  unrated: boolean;
}

/** ④ KPI の項目ごとの形。前の期を破線で重ねる（軸が3未満のときは呼ばない） */
export function ReportRadarChart({
  data,
  showPrevious,
  width,
  height = REPORT_RADAR_HEIGHT,
}: {
  data: ReportRadarDatum[];
  showPrevious: boolean;
  width?: number;
  height?: number;
}) {
  const { brand, brandSoft, line, inkMuted } = CHART_COLORS;
  const unratedNames = new Set(data.filter((d) => d.unrated).map((d) => d.item));
  return (
    <ReportChartBox width={width} height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke={line} />
        <PolarAngleAxis
          dataKey="item"
          tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }}
          tickFormatter={(v: string) => `${shortenTick(v)}${unratedNames.has(v) ? "※" : ""}`}
        />
        {/* 目盛りの数字は描かず、輪だけを残す。値は隣の表に出ていて、数字を置くと真上の軸の名前と重なる。
            本人向けは判定（A〜E）から作った形なので、0〜100 の数字はかえって点数に見える。
            印刷用の低い図は半径が短いので、輪を 50・100 の2本にする */}
        <PolarRadiusAxis
          domain={[0, 100]}
          angle={90}
          tick={false}
          axisLine={false}
          tickCount={height < REPORT_RADAR_HEIGHT ? 3 : 6}
        />
        {showPrevious && (
          <Radar
            dataKey="previous"
            stroke={brandSoft}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        <Radar
          dataKey="value"
          stroke={brand}
          strokeWidth={2}
          fill={brand}
          fillOpacity={0.25}
          dot={{ r: 3, fill: brand }}
          /* 判定外を線でつながない。つなぐと0点として面積に混ざってしまう */
          connectNulls={false}
          isAnimationActive={false}
        />
      </RadarChart>
    </ReportChartBox>
  );
}

export interface ReportTrendDatum {
  cycle: string;
  gradeName: string | null;
  value: number | null;
  /** 同じ等級の平均。出せない期（3人未満・本人向け）は null */
  average: number | null;
  /** 同じ等級の幅（最小〜最大）。出せない期は null */
  range: [number, number] | null;
}

/* 期の名前は「2025年度」と「上期」の2段に分け、その下に当時の等級を描く。
   等級は分類名として添え、点数と同じ数値軸には載せない。 */
function CycleTick({ x, y, payload, gradeName }: { x?: number | string; y?: number | string; payload?: { value?: unknown }; gradeName?: string | null }) {
  const [head, ...rest] = shortenTick(String(payload?.value ?? "")).split(" ");
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={CHART_FS_TICK} fill={CHART_COLORS.inkMuted}>
      <tspan x={x} dy="0.9em">{head}</tspan>
      {rest.length > 0 && (
        <tspan x={x} dy="1.2em">
          {rest.join(" ")}
        </tspan>
      )}
      {gradeName !== undefined && <tspan x={x} dy="1.2em">{shortenTick(gradeName ?? "—")}</tspan>}
    </text>
  );
}

/** ⑤ 全確定期の等級と達成率の推移。本人を実線と点、同じ等級の平均を破線、幅を薄い帯で描く */
export function ReportTrendChart({
  data,
  width,
  height = REPORT_CHART_HEIGHT,
}: {
  data: ReportTrendDatum[];
  width?: number;
  height?: number;
}) {
  const { brand, brandSoft, line, inkMuted } = CHART_COLORS;
  const { tickInterval } = chartDensity(data.length);
  const hasPeer = data.some((d) => d.average !== null);
  // tickのindexは間引き後の順番なので使わない。期間名が重複しても、元の期の等級へ対応させる。
  const chartData = data.map((point, pointIndex) => ({ ...point, pointIndex }));
  return (
    <ReportChartBox width={width} height={height}>
      <ComposedChart data={chartData} margin={{ top: 12, right: 20, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={line} vertical={false} />
        <XAxis
          dataKey="pointIndex"
          tick={(props) => {
            const point = data[Number(props.payload?.value)];
            return <CycleTick {...props} payload={{ value: point?.cycle }} gradeName={point?.gradeName ?? null} />;
          }}
          height={56}
          tickLine={false}
          axisLine={{ stroke: line }}
          interval={tickInterval}
          /* 端の期の名前が図の外へはみ出して切れないよう、最初と最後の点を内側へ寄せる */
          padding={{ left: 28, right: 28 }}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }} tickLine={false} axisLine={false} />
        {hasPeer && (
          <Area dataKey="range" stroke="none" fill={brandSoft} fillOpacity={0.2} isAnimationActive={false} />
        )}
        {hasPeer && (
          <Line
            dataKey="average"
            stroke={inkMuted}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        <Line
          dataKey="value"
          stroke={brand}
          strokeWidth={2}
          dot={{ r: 4, fill: brand }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ReportChartBox>
  );
}

export interface ReportGradeDatum {
  grade: string;
  value: number | null;
  /** 同じ等級の平均。出せない等級（3人未満・本人向け）は null */
  average: number | null;
}

/** ⑥ 等級ごとの値。本人を塗った棒、同じ等級の平均を破線の枠だけの棒で描く */
export function ReportGradeBars({
  data,
  width,
  height = REPORT_CHART_HEIGHT,
}: {
  data: ReportGradeDatum[];
  width?: number;
  height?: number;
}) {
  const { brand, line, inkMuted, surface } = CHART_COLORS;
  const hasPeer = data.some((d) => d.average !== null);
  return (
    <ReportChartBox width={width} height={height}>
      <BarChart data={data} margin={{ top: 12, right: 20, bottom: 4, left: -8 }} barGap={4}>
        <CartesianGrid stroke={line} vertical={false} />
        <XAxis
          dataKey="grade"
          tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }}
          tickLine={false}
          axisLine={{ stroke: line }}
          tickFormatter={shortenTick}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: CHART_FS_TICK, fill: inkMuted }} tickLine={false} axisLine={false} />
        <Bar dataKey="value" fill={brand} maxBarSize={48} isAnimationActive={false} />
        {hasPeer && (
          <Bar
            dataKey="average"
            fill={surface}
            stroke={inkMuted}
            strokeWidth={2}
            strokeDasharray="4 3"
            maxBarSize={48}
            isAnimationActive={false}
          />
        )}
      </BarChart>
    </ReportChartBox>
  );
}
