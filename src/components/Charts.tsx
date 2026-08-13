"use client";

import {
  CartesianGrid,
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
    <div style={{ width: "100%", height: 340 }}>
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

/* 推移1枚ぶんの高さ。読み込み中の場所取り（LazyCharts.tsx の Placeholder）と
   対で保つ。片方だけ動かすと、グラフが出た瞬間に下の内容が飛び跳ねる。
   ここから値を輸出して共有はできない（このファイルは描画ライブラリごと
   遅れて読み込む決まりで、定数1つのために先に読み込ませては本末転倒になる）。 */
const TREND_HEIGHT = 220;

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
