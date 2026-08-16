import { UsageDashboard } from "@/app/system/UsageDashboard";
import { getDb } from "@/lib/db";
import { USAGE_DEFAULT_RANGE_DAYS, USAGE_RANGE_DAYS } from "@/lib/domain/usage";
import { listCompanies } from "@/lib/queries";
import { requireRole } from "@/lib/session";
import { readUsageReport } from "@/lib/usage";

export const dynamic = "force-dynamic";

/**
 * 利用状況（システム全体管理者だけ）。
 *
 * 会社をまたいで数字を見られる唯一の画面なので、入口で必ず役割を確かめる。
 * URLに会社を書けば他社ぶんが見られる形になっているが、ここを通れるのは
 * 全体管理者だけで、その人はもともと全社を見られる（＝権限の抜け道にならない）。
 */
export default async function SystemUsage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; company?: string }>;
}) {
  await requireRole("SUPER_ADMIN");
  const sp = await searchParams;

  /* 期間は決めた3つだけ受け付ける。任意の日数を通すと、
     読む行が増えるだけの重い問い合わせを外から作れてしまう。 */
  const requested = Number(sp.days);
  const days = (USAGE_RANGE_DAYS as readonly number[]).includes(requested) ? requested : USAGE_DEFAULT_RANGE_DAYS;

  const companies = await listCompanies();
  const selected = companies.find((company) => company.id === sp.company) ?? null;

  const db = await getDb();
  const report = await readUsageReport(db, { companyId: selected?.id ?? null, days });

  return (
    <UsageDashboard
      report={report}
      companies={companies.filter((company) => company.isActive).map((c) => ({ id: c.id, name: c.name }))}
      companyId={selected?.id ?? null}
      companyName={selected?.name ?? null}
    />
  );
}
