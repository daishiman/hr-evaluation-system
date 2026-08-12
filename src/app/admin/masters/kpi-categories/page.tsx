import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** KPIカテゴリの追加・削除は「KPI・評価セット」画面に統合したため、そちらへ案内する。 */
export default function AdminKpiCategoriesRedirect() {
  redirect("/admin/scheme");
}
