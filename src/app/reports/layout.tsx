import { AppShell } from "@/components/AppShell";
import { requireRoute } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 評価レポートの骨格。ほかの画面と同じメニュー・ヘッダー・本文の余白を付ける。
 * 誰のレポートをどの形で開けるかは、人ごとに page.tsx が canViewEvaluationOf で決める。
 */
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRoute("/reports/[id]");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
