import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ロールごとのホームに振り分ける。 */
export default async function Root() {
  const viewer = await getViewer();
  redirect(viewer ? homePathFor(viewer.role) : "/login");
}
