"use client";

import { useEffect } from "react";
import { watchFreshness } from "@/lib/freshness";
import { useRouterRefresh } from "@/lib/use-refresh";

/**
 * 表示中の画面を、他で起きた変更に追いつかせる見張り役。画面には何も出さない（D-001）。
 *
 * 取り直すきっかけは3つ。
 * 1. 同じブラウザの他のタブで保存された（BroadcastChannel の知らせ）。
 *    このタブが裏にあるときはすぐには取り直さず、表に戻ったときに1回だけ取り直す。
 * 2. タブ・アプリに戻ってきた（visibilitychange）。スマホやタブレットで別の端末の
 *    変更を待っていた人が、アプリを開き直しただけで新しい一覧を見られるようにする。
 * 3. 戻るボタンで、保存しておいた古い画面がそのまま出た（pageshow の persisted）。
 *    通信が切れて戻ったとき（online）も同じ扱いにする。
 *
 * 取り直しは router.refresh。入力中の欄の中身とスクロール位置は残る
 * （サーバー側の部分だけを差し替え、画面側の状態は作り直さないため）。
 * 続けて起きたきっかけは FRESHNESS_THROTTLE_MS の間隔で1回にまとめる。
 * 見張りの中身（きっかけの順序と間引き）は watchFreshness にある。
 *
 * 全画面共通の骨格（AppShell）に1つだけ置く。
 */
export function FreshnessSync() {
  const { refresh } = useRouterRefresh();

  useEffect(() => watchFreshness(refresh, { document, window }), [refresh]);

  return null;
}
