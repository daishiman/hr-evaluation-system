import { requireRole } from "@/lib/session";
import { listImprovementRequests } from "@/lib/queries";
import { ChipLink, EmptyState, PageTitle, ReasonNote, SectionHeading, StatGrid } from "@/components/ui";
import { ImprovementBulkTable } from "@/components/ImprovementBulkTable";
import { formatDateTime } from "@/lib/view";
import {
  IMPROVEMENT_STATUSES,
  countImprovementsByStatus,
  filterImprovements,
  groupImprovementsByScreen,
  improvementPeriodStart,
  improvementStatusLabel,
  isImprovementPeriod,
  isImprovementStatus,
} from "@/lib/domain/improvement";
import {
  IMPROVEMENT_SORTS,
  IMPROVEMENT_VIEWS,
  canDisposeImprovements,
  filterImprovementsByView,
  improvementSortLabel,
  improvementViewLabel,
  isImprovementSort,
  isImprovementView,
  sortImprovements,
} from "@/lib/domain/improvement-disposition";

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
  searchParams: Promise<{ status?: string; route?: string; period?: string; view?: string; sort?: string }>;
}) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const sp = await searchParams;
  const status = sp.status && isImprovementStatus(sp.status) ? sp.status : null;
  const period = sp.period && isImprovementPeriod(sp.period) ? sp.period : "all";
  const routePattern = sp.route ?? null;
  // 既定は「まだ片付いていないもの」だけ。終わったもの・廃棄したものは、
  // 探すときにだけ見えればよい（毎週読む人の視界に残さない）。
  const view = sp.view && isImprovementView(sp.view) ? sp.view : "active";
  const sort = sp.sort && isImprovementSort(sp.sort) ? sp.sort : "new";

  const all = await listImprovementRequests(viewer.companyId);
  const counts = countImprovementsByStatus(all);
  const screens = groupImprovementsByScreen(all).slice(0, 6);
  const visible = filterImprovementsByView(all, view);
  const rows = sortImprovements(
    filterImprovements(visible, { status, routePattern, since: improvementPeriodStart(period, new Date()) }),
    sort,
  );

  const query = (next: {
    status?: string | null;
    routePattern?: string | null;
    period?: string | null;
    view?: string | null;
    sort?: string | null;
  }) => {
    const merged = { status, routePattern, period, view, sort, ...next };
    const params = new URLSearchParams();
    if (merged.status) params.set("status", merged.status);
    if (merged.routePattern) params.set("route", merged.routePattern);
    if (merged.period && merged.period !== "all") params.set("period", merged.period);
    if (merged.view && merged.view !== "active") params.set("view", merged.view);
    if (merged.sort && merged.sort !== "new") params.set("sort", merged.sort);
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
        {IMPROVEMENT_VIEWS.map((v) => (
          <ChipLink key={v} href={query({ view: v })} current={view === v}>
            {improvementViewLabel(v)}
          </ChipLink>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {IMPROVEMENT_SORTS.map((v) => (
          <ChipLink key={v} href={query({ sort: v })} current={sort === v}>
            {improvementSortLabel(v)}
          </ChipLink>
        ))}
      </div>
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
          <ChipLink href={query({ routePattern: null })} current={routePattern === null}>
            画面すべて
          </ChipLink>
          {screens.map((s) => (
            <ChipLink
              key={s.routePattern}
              href={query({ routePattern: s.routePattern })}
              current={routePattern === s.routePattern}
            >
              {s.screenLabel}（{s.count}）
            </ChipLink>
          ))}
        </div>
      )}

      <SectionHeading
        help={
          viewer.role === "SUPER_ADMIN"
            ? "選んだ要望を、まとめて開発の記録票へ送れます。"
            : undefined
        }
      >
        要望（{rows.length}件）
      </SectionHeading>
      {all.length === 0 ? (
        <EmptyState
          title="まだ要望は届いていません"
          body="どの画面でも右下の「改善要望」から送れます。届くとここに並びます。"
        />
      ) : rows.length === 0 ? (
        <ReasonNote>この絞り込みに当てはまる要望はありません。条件を外してください。</ReasonNote>
      ) : (
        <ImprovementBulkTable
          canPush={viewer.role === "SUPER_ADMIN"}
          canDispose={canDisposeImprovements(viewer.role)}
          rows={rows.map((r) => ({
            id: r.id,
            headline: r.body,
            screenLabel: r.screenLabel,
            reporterName: r.reporterName ?? "退職された方",
            createdAtText: `${formatDateTime(r.createdAt)}${r.hasShot ? "／画像あり" : ""}`,
            kind: r.kind,
            status: r.status,
            discarded: r.discarded,
            duplicateOfId: r.duplicateOfId,
            stateNote: r.discarded ? (r.discardReason ?? "") : r.duplicateOfId ? "他の要望にまとめました" : "",
            syncState: r.syncState,
            syncNote: r.syncNote,
            issueNumber: r.issueNumber,
            issueUrl: r.issueUrl,
            issueClosed: r.issueClosed,
            off: r.discarded || r.status === "done" || r.status === "dropped",
          }))}
        />
      )}
    </>
  );
}
