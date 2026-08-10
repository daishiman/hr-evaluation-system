import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("MANAGER");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
