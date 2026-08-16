"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { installUsageTracking, trackScreen } from "@/lib/usage-client";

/**
 * 利用状況の数え始め。画面には何も出さない。
 *
 * 全画面共通の骨格（AppShell）に1つだけ置く。数えるのは画面の形と回数だけで、
 * 入力した中身も利用者を特定する値も送らない（→ src/lib/usage-client.ts）。
 * 会社と役割はサーバー側がセッションから決めるので、ここでは渡さない。
 */
export function UsageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    installUsageTracking();
  }, []);

  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);

  return null;
}
