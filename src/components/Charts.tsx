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
            <p style={{ margin: 0, fontSize: 12, color: INK_MUTED }}>
              {d.item}
              {unratedNames.has(d.item) ? "（判定外）" : ""}
            </p>
            <div style={{ height: 8, borderRadius: 4, background: LINE, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${d.value ?? 0}%`,
                  background: d.value === null ? "transparent" : BRAND,
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
          <PolarGrid stroke={LINE} />
          <PolarAngleAxis
            dataKey="item"
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickFormatter={(v: string) =>
              `${v.length > 9 ? `${v.slice(0, 9)}…` : v}${unratedNames.has(v) ? "※" : ""}`
            }
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: INK_MUTED }} tickCount={6} />
          {compare && (
            <Radar
              name={compareLabel ?? "前回"}
              dataKey={compareLabel ?? "前回"}
              stroke={BRAND_SOFT}
              fill={BRAND_SOFT}
              fillOpacity={0.25}
              connectNulls={false}
            />
          )}
          <Radar
            name={label}
            dataKey={label}
            stroke={BRAND}
            fill={BRAND}
            fillOpacity={0.3}
            /* 判定外を線でつながない。つなぐと0点として面積に混ざってしまう */
            connectNulls={false}
          />
          <Tooltip
            formatter={(v) => [v === null || v === undefined ? "判定外（実績が未入力）" : `${v}%`, valueLabel]}
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
