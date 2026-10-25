import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** KPIカテゴリは「KPI・評価セット」の下の画面に移したため、そちらへ案内する（DD-027）。 */
export default function AdminKpiCategoriesRedirect() {
  redirect("/admin/scheme/categories");
}
