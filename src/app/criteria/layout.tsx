import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 評価基準の確認ページ。
 * マネージャー以上のみ。評価される方がURLを直接開いても、ここで自分のホームに戻される。
 */
export default async function CriteriaLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("MANAGER");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
