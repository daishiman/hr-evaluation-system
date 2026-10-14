import { AppShell } from "@/components/AppShell";
import { requireRoute } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRoute("/system");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
