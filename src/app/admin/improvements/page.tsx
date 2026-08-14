import { requireRole } from "@/lib/session";
import { listImprovementRequests } from "@/lib/queries";
import { Badge, Card, CardRow, ChipLink, EmptyState, LinkButton, PageTitle, ReasonNote, SectionHeading, StatGrid } from "@/components/ui";
import { formatDateTime } from "@/lib/view";
import {
  IMPROVEMENT_STATUSES,
  countImprovementsByStatus,
  filterImprovements,
  groupImprovementsByScreen,
  improvementPeriodStart,
  improvementStatusLabel,
  improvementStatusTone,
  isImprovementPeriod,
  isImprovementStatus,
} from "@/lib/domain/improvement";

export const dynamic = "force-dynamic";

/**
 * 各画面から届いた改善要望の一覧。
 *
 * 使われる場面: 会社の管理者が週に一度まとめて読み、次に直すものを決める。
 * だから最初に見せるのは「未対応が何件か」で、次が絞り込み、最後が本文。
 *
 * 見えるのは自社ぶんだけ。会社の絞り込みは requireRole が返す companyId で行う。
 */
export default async function AdminImprovements({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; path?: string; period?: string }>;
}) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const sp = await searchParams;
  const status = sp.status && isImprovementStatus(sp.status) ? sp.status : null;
  const period = sp.period && isImprovementPeriod(sp.period) ? sp.period : "all";
  const path = sp.path ?? null;

  const all = await listImprovementRequests(viewer.companyId);
  const counts = countImprovementsByStatus(all);
  const screens = groupImprovementsByScreen(all).slice(0, 6);
  const rows = filterImprovements(all, { status, path, since: improvementPeriodStart(period, new Date()) });

  const query = (next: { status?: string | null; path?: string | null; period?: string | null }) => {
    const merged = { status, path, period, ...next };
    const params = new URLSearchParams();
    if (merged.status) params.set("status", merged.status);
    if (merged.path) params.set("path", merged.path);
    if (merged.period && merged.period !== "all") params.set("period", merged.period);
    const q = params.toString();
    return q ? `/admin/improvements?${q}` : "/admin/improvements";
  };

  return (
    <>
      <PageTitle
        title="届いた改善要望"
        lede="各画面の右下から送られた「ここが使いにくい」を、ここでまとめて読みます。"
      />

      <StatGrid
        stats={IMPROVEMENT_STATUSES.map((s) => ({
          label: improvementStatusLabel(s),
          value: `${counts[s]}件`,
        }))}
      />

      <SectionHeading help="絞り込みは重ねられます。">絞り込む</SectionHeading>
      <div className="mb-4 flex flex-wrap gap-2">
        <ChipLink href={query({ status: null })} current={status === null}>
          状態すべて
        </ChipLink>
        {IMPROVEMENT_STATUSES.map((s) => (
          <ChipLink key={s} href={query({ status: s })} current={status === s}>
            {improvementStatusLabel(s)}
          </ChipLink>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <ChipLink href={query({ period: "7d" })} current={period === "7d"}>
          直近7日
        </ChipLink>
        <ChipLink href={query({ period: "30d" })} current={period === "30d"}>
          直近30日
        </ChipLink>
        <ChipLink href={query({ period: "all" })} current={period === "all"}>
          期間すべて
        </ChipLink>
      </div>
      {screens.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <ChipLink href={query({ path: null })} current={path === null}>
            画面すべて
          </ChipLink>
          {screens.map((s) => (
            <ChipLink key={s.path} href={query({ path: s.path })} current={path === s.path}>
              {s.screenLabel}（{s.count}）
            </ChipLink>
          ))}
        </div>
      )}

      <SectionHeading>要望（{rows.length}件）</SectionHeading>
      {all.length === 0 ? (
        <EmptyState
          title="まだ要望は届いていません"
          body="どの画面でも右下の「改善要望」から送れます。届くとここに並びます。"
        />
      ) : rows.length === 0 ? (
        <ReasonNote>この絞り込みに当てはまる要望はありません。条件を外してください。</ReasonNote>
      ) : (
        <Card>
          {rows.map((r) => (
            <CardRow
              key={r.id}
              alignTop
              off={r.status === "done" || r.status === "dropped"}
              title={r.body}
              sub={`${r.screenLabel}／${r.reporterName ?? "退職された方"}`}
              detail={
                <p className="footnote m-0">
                  {formatDateTime(r.createdAt)}
                  {r.hasShot ? "／画像あり" : ""}
                </p>
              }
              marks={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={improvementStatusTone(r.status)}>{improvementStatusLabel(r.status)}</Badge>
                  <LinkButton href={`/admin/improvements/${r.id}`}>開く</LinkButton>
                </div>
              }
            />
          ))}
        </Card>
      )}
    </>
  );
}
