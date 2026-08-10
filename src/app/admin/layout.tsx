import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
