import { AppShell } from "@/components/AppShell";
import { requireRoute } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRoute("/manager");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
