import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { PALETTE_INIT_SCRIPT } from "@/lib/palette";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * 欧文と数字を描く2書体。
 *
 * 和文は端末が持っているもの（Hiragino / Noto Sans JP）をそのまま使う。
 * ここで読み込むのは、数字・ラテン文字・等幅の値だけを受け持つぶん。
 * next/font はビルド時にフォントを取り込んで自分のところから配るので、
 * 表示のたびに外部へ取りに行くことはない。
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "人事評価管理システム",
  description: "半期ごとの実績報告から、等級要件・行動指針・KPIをまとめて評価するしくみ",
};

/* viewportFit: "cover" を付けて、切り欠きのある端末でも画面の端まで描く。
   隠れる範囲は globals.css が env(safe-area-inset-*) で避けている。 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* suppressHydrationWarning は、下のスクリプトが描画前に data-theme を足すため。
       サーバーが出した html と食い違うのは想定どおりで、警告だけを止める。 */
    <html lang="ja" className={`${plexSans.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* 暗い設定の人に、明るい画面が一瞬見えるのを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 同じ理由で、選んだ配色も描画より先に当てる（前回と違う色が一瞬見えるのを防ぐ）。
            明るさとは別のスクリプトにして、片方が壊れても、もう片方は当たるようにする。 */}
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
