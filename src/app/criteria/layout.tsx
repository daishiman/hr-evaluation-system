import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { canSeeCriteria, homePathFor, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 採点基準の確認ページ。
 *
 * マネージャー以上のみ。一般の方がURLを直接開いても、ここで自分のホームに戻される。
 * 「配点・ランクの閾値・昇格に必要な点数を見てよいか」の判断は canSeeCriteria が正なので、
 * 最低ロールの指定に加えてその関数でももう一度確かめる（定義が変わったときの取り残しを防ぐため）。
 */
export default async function CriteriaLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("MANAGER");
  if (!canSeeCriteria(viewer.role)) redirect(`${homePathFor(viewer.role)}?denied=1`);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
