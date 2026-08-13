"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { EightAxisRadar as Radar, TrendChart as Trend } from "@/components/Charts";

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
  { ssr: false, loading: () => <Placeholder height={340} /> },
);

export const TrendChart = dynamic<ComponentProps<typeof Trend>>(
  () => import("@/components/Charts").then((m) => m.TrendChart),
  // 高さは Charts.tsx の TREND_HEIGHT と対で保つ（ずれると出た瞬間に下が飛び跳ねる）
  { ssr: false, loading: () => <Placeholder height={220} /> },
);
