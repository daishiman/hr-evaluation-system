import { AppShell } from "@/components/AppShell";
import { requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 自分の設定。ロールを問わず、ログインしていれば使える。 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
