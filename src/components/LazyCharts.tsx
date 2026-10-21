"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { RADAR_HEIGHT, REPORT_CHART_HEIGHT, REPORT_RADAR_HEIGHT, TREND_HEIGHT } from "./chart-dimensions";
import type {
  EightAxisRadar as Radar,
  ReportGradeBars as GradeBars,
  ReportRadarChart as ReportRadar,
  ReportTrendChart as ReportTrend,
  TrendChart as Trend,
} from "@/components/Charts";

/**
 * グラフはブラウザ側でだけ読み込む。
 *
 * グラフの描画ライブラリは容量が大きく、サーバー側の実行ファイルに入れると
 * Cloudflare Workers の上限を超えてしまう。表示に必要なのはブラウザだけなので、
 * 画面が出たあとで読み込む形にしている（そのぶん最初の表示も速くなる）。
 */
function Placeholder({ height }: { height: number }) {
  return (
    <div
      style={{ width: "100%", height }}
      className="skeleton rounded-lg"
      aria-label="グラフを読み込んでいます"
      role="img"
    />
  );
}

export const EightAxisRadar = dynamic<ComponentProps<typeof Radar>>(
  () => import("@/components/Charts").then((m) => m.EightAxisRadar),
  { ssr: false, loading: () => <Placeholder height={RADAR_HEIGHT} /> },
);

export const TrendChart = dynamic<ComponentProps<typeof Trend>>(
  () => import("@/components/Charts").then((m) => m.TrendChart),
  { ssr: false, loading: () => <Placeholder height={TREND_HEIGHT} /> },
);

/* 評価レポートの図。描画本体と共通の高さを使う。
   場所取りの高さは画面のものに合わせる。印刷用の写しは、ReportTemplate.tsx の枠が紙の大きさを先に取り、
   読み込み中の場所取りをはみ出させない（届く前に刷られても紙面が伸びない）。 */
export const ReportRadarChart = dynamic<ComponentProps<typeof ReportRadar>>(
  () => import("@/components/Charts").then((m) => m.ReportRadarChart),
  { ssr: false, loading: () => <Placeholder height={REPORT_RADAR_HEIGHT} /> },
);

export const ReportTrendChart = dynamic<ComponentProps<typeof ReportTrend>>(
  () => import("@/components/Charts").then((m) => m.ReportTrendChart),
  { ssr: false, loading: () => <Placeholder height={REPORT_CHART_HEIGHT} /> },
);

export const ReportGradeBars = dynamic<ComponentProps<typeof GradeBars>>(
  () => import("@/components/Charts").then((m) => m.ReportGradeBars),
  { ssr: false, loading: () => <Placeholder height={REPORT_CHART_HEIGHT} /> },
);
