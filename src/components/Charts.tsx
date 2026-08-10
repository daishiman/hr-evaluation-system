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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * 評価の見える化。
 * 色はプライマリ1色だけを使い、比較のときだけ薄い方を過去分に割り当てる。
 */

const BRAND = "#1d63be";
const BRAND_SOFT = "#9dbde6";
const LINE = "#e3e6ea";
const INK_MUTED = "#545e6b";

export interface RadarPoint {
  /** 項目名（軸のラベル） */
  item: string;
  /** 0〜100 の達成度 */
  value: number;
  rank: string | null;
}

/**
 * 8角形レーダーチャート。
 * 8項目の達成度を1枚で見せ、どの方向が弱いかを形で分かるようにする。
 */
export function EightAxisRadar({
  data,
  compare,
  compareLabel,
  label = "今回",
}: {
  data: RadarPoint[];
  compare?: RadarPoint[];
  compareLabel?: string;
  label?: string;
}) {
  const merged = data.map((d) => ({
    item: d.item,
    rank: d.rank,
    [label]: d.value,
    ...(compare ? { [compareLabel ?? "前回"]: compare.find((c) => c.item === d.item)?.value ?? 0 } : {}),
  }));

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <RadarChart data={merged} outerRadius="72%">
          <PolarGrid stroke={LINE} />
          <PolarAngleAxis
            dataKey="item"
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 9)}…` : v)}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: INK_MUTED }} tickCount={6} />
          {compare && (
            <Radar
              name={compareLabel ?? "前回"}
              dataKey={compareLabel ?? "前回"}
              stroke={BRAND_SOFT}
              fill={BRAND_SOFT}
              fillOpacity={0.25}
            />
          )}
          <Radar name={label} dataKey={label} stroke={BRAND} fill={BRAND} fillOpacity={0.3} />
          <Tooltip
            formatter={(v) => [`${v ?? "—"}%`, "達成度"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }}
          />
          {compare && <Legend wrapperStyle={{ fontSize: 12 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface TrendPoint {
  cycle: string;
  [key: string]: string | number | null;
}

/** サイクルごとの推移。過去の評価を並べて比較する。 */
export function TrendChart({
  data,
  series,
}: {
  data: TrendPoint[];
  series: { key: string; label: string; unit?: string }[];
}) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: LINE }} />
          <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((sr, i) => (
            <Line
              key={sr.key}
              type="monotone"
              dataKey={sr.key}
              name={sr.label}
              stroke={i === 0 ? BRAND : BRAND_SOFT}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
