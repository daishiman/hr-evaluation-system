import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("SUPER_ADMIN");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
