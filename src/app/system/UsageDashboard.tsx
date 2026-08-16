import { DataTable, type Column } from "@/components/DataTable";
import { TrendChart } from "@/components/LazyCharts";
import {
  Badge,
  Card,
  ChipLink,
  Disclosure,
  EmptyState,
  Num,
  PageTitle,
  ReasonNote,
  SectionHeading,
} from "@/components/ui";
import {
  averageApiMs,
  averageDwellMs,
  fillUnusedScreens,
  formatDateTick,
  formatDuration,
  FRICTION_HINT,
  FRICTION_LABEL,
  frictionBreakdown,
  frictionPer100Views,
  frictionSignals,
  dateKeyRange,
  EMPTY_SCREEN_COUNTERS,
  pickNextScreenToFix,
  rankByDwell,
  rankByFriction,
  USAGE_LONG_STAY_MS,
  USAGE_MIN_VIEWS_FOR_RANKING,
  USAGE_RANGE_DAYS,
  USAGE_RETENTION_DAYS,
  USAGE_SLOW_API_MS,
} from "@/lib/domain/usage";
import { ROLE_LABEL, type Role } from "@/lib/session";
import type { UsageApiRow, UsageReport, UsageScreenRow } from "@/lib/usage";

/**
 * 使われる場面の1文:
 * 「システム全体管理者が、次に直す画面を1つ決めるために、どこで人が詰まっているかを見る」。
 *
 * ── なぜこの並びなのか ──
 * 一覧を先に出すと、44画面ぶんの数字の中から自分で問題を探すことになる。
 * ①いま勧める1画面 → ②詰まっている画面 → ③時間がかかっている画面 → ④推移
 * → ⑤全画面と通信（畳む）の順で、「読む量」を後ろにいくほど増やす。
 *
 * ── 表示形式の決め手 ──
 * 主目的=比較、情報量=1画面あたり4〜6項目、件数=数十、識別の手がかり=画面の名前、
 * 関係=独立、求められる操作=見比べて1つ選ぶ。→ 骨格は表。
 * ただし「先に直す画面」だけは順位そのものが主役なので、表ではなく上位5件の
 * 帯（bar-track）にして、長さで差が読めるようにしている。
 * 推移は「日ごとの増減」＝時系列なので折れ線。表示回数と兆候は単位が違うので
 * 1本の縦軸へ重ねず、横軸をそろえて2枚に分ける。
 */

/** 数字がゼロでも「0」と出す（—にすると計測できていないのと区別が付かない）。 */
function Count({ value, unit }: { value: number; unit?: string }) {
  return <Num value={value} unit={unit} />;
}

/** 順位の帯。1本ぶんの長さは、その一覧の中の最大値に対する割合。 */
function RankBar({ label, value, max, caption }: { label: string; value: number; max: number; caption: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sub">
        <span className="min-w-0 font-semibold">{label}</span>
        <span className="tnum shrink-0 text-ink-muted">{caption}</span>
      </div>
      <div className="bar-track mt-1" role="img" aria-label={`${label} ${caption}`}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** 迷いの内訳。何が起きているかを名前で出す（点数1つに潰さない）。 */
function FrictionDetail({ row }: { row: UsageScreenRow }) {
  const breakdown = frictionBreakdown(row.counters);
  if (breakdown.length === 0) return null;
  const roles = [...row.byRole]
    .filter((r) => frictionSignals(r.counters) > 0)
    .sort((a, b) => frictionSignals(b.counters) - frictionSignals(a.counters));

  return (
    <div className="mt-2">
      <ul className="m-0 list-none p-0 text-note text-ink-muted">
        {breakdown.map(({ kind, count }) => (
          <li key={kind} className="mt-1">
            <span className="text-ink">
              {FRICTION_LABEL[kind]} <Num value={count} unit="回" />
            </span>
            <br />
            {FRICTION_HINT[kind]}
          </li>
        ))}
      </ul>
      {roles.length > 0 && (
        <p className="m-0 mt-2 text-note text-ink-muted">
          詰まっている立場:{" "}
          {roles
            .map((r) => `${ROLE_LABEL[r.role as Role]}（${frictionSignals(r.counters)}件）`)
            .join(" ／ ")}
        </p>
      )}
    </div>
  );
}

export function UsageDashboard({
  report,
  companies,
  companyId,
  companyName,
}: {
  report: UsageReport;
  companies: { id: string; name: string }[];
  /** null なら全社の合算 */
  companyId: string | null;
  companyName: string | null;
}) {
  const { screens, apis, days } = report;

  /* 記録に無い画面を0件として補う。使われていない画面こそ
     「作ったのに誰も使えていない」の手がかりなので、一覧から消さない。 */
  const allScreens = fillUnusedScreens<UsageScreenRow>(screens, report.allScreens, (screen) => ({
    routePattern: screen.routePattern,
    label: screen.label,
    counters: { ...EMPTY_SCREEN_COUNTERS },
    byRole: [],
  }));
  const unused = allScreens.filter((row) => row.counters.views === 0);
  const used = allScreens
    .filter((row) => row.counters.views > 0)
    .sort((a, b) => b.counters.views - a.counters.views);

  const totals = screens.reduce(
    (acc, row) => ({
      views: acc.views + row.counters.views,
      signals: acc.signals + frictionSignals(row.counters),
      dwellMs: acc.dwellMs + row.counters.dwellMs,
      dwellSamples: acc.dwellSamples + row.counters.dwellSamples,
    }),
    { views: 0, signals: 0, dwellMs: 0, dwellSamples: 0 },
  );
  const apiTotals = apis.reduce(
    (acc, row) => ({
      calls: acc.calls + row.counters.calls,
      errors: acc.errors + row.counters.errors,
      slowCalls: acc.slowCalls + row.counters.slowCalls,
    }),
    { calls: 0, errors: 0, slowCalls: 0 },
  );

  const friction = rankByFriction(screens).slice(0, 5);
  const slowest = rankByDwell(screens).slice(0, 5);
  const next = pickNextScreenToFix(screens);

  /* 記録が無い日も0として並べる。抜けた日を線でつなぐと、
     使われていない日が「そこそこ使われた日」に見えてしまう。 */
  const byDate = new Map(report.daily.map((point) => [point.date, point]));
  const trend = dateKeyRange(report.to, days).map((date) => ({
    cycle: formatDateTick(date),
    表示回数: byDate.get(date)?.views ?? 0,
    迷いの兆候: byDate.get(date)?.frictionSignals ?? 0,
  }));

  const screenColumns: Column<UsageScreenRow>[] = [
    { key: "label", header: "画面", role: "title", cell: (r) => r.label },
    { key: "views", header: "開いた回数", num: true, cell: (r) => <Count value={r.counters.views} unit="回" /> },
    {
      key: "dwell",
      header: "1回あたりの滞在",
      num: true,
      cell: (r) => <span className="tnum">{formatDuration(averageDwellMs(r.counters))}</span>,
    },
    {
      key: "friction",
      header: "迷いの兆候",
      num: true,
      cell: (r) =>
        frictionSignals(r.counters) === 0 ? (
          <span className="text-ink-muted">0</span>
        ) : (
          <span className="tnum">
            <Num value={frictionSignals(r.counters)} unit="件" />
            <span className="text-ink-muted">（100回あたり {frictionPer100Views(r.counters)}）</span>
          </span>
        ),
    },
  ];

  const apiColumns: Column<UsageApiRow>[] = [
    {
      key: "path",
      header: "連絡先",
      role: "title",
      cell: (r) => (
        <span className="break-words">
          {r.method} {r.routePattern}
        </span>
      ),
    },
    { key: "calls", header: "回数", num: true, cell: (r) => <Count value={r.counters.calls} unit="回" /> },
    {
      key: "avg",
      header: "1回あたり",
      num: true,
      cell: (r) => <span className="tnum">{formatDuration(averageApiMs(r.counters))}</span>,
    },
    {
      key: "slow",
      header: "時間がかかった",
      num: true,
      cell: (r) =>
        r.counters.slowCalls === 0 ? (
          <span className="text-ink-muted">0</span>
        ) : (
          <Num value={r.counters.slowCalls} unit="回" />
        ),
    },
    {
      key: "errors",
      header: "失敗",
      num: true,
      cell: (r) =>
        r.counters.errors === 0 ? <span className="text-ink-muted">0</span> : <Badge tone="alert">{r.counters.errors}回</Badge>,
    },
  ];

  const scopeHref = (nextDays: number, nextCompany: string | null) =>
    `/system/usage?days=${nextDays}${nextCompany ? `&company=${nextCompany}` : ""}`;

  return (
    <>
      <PageTitle
        title="利用状況"
        lede="どの画面で人が詰まっているかを見て、次に直す1画面を決めます。"
        tags={
          <span className="text-note text-ink-muted">
            {report.from} 〜 {report.to}
            {companyName ? ` ／ ${companyName}` : " ／ すべての会社"}
          </span>
        }
      />

      {/* 絞り込みはグラフ・表より上に1行でまとめる（画面ごとに置き場所を変えない） */}
      <div className="flex flex-wrap items-center gap-2">
        {USAGE_RANGE_DAYS.map((d) => (
          <ChipLink key={d} href={scopeHref(d, companyId)} current={d === days}>
            直近{d}日
          </ChipLink>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ChipLink href={scopeHref(days, null)} current={companyId === null}>
          すべての会社
        </ChipLink>
        {companies.map((c) => (
          <ChipLink key={c.id} href={scopeHref(days, c.id)} current={c.id === companyId}>
            {c.name}
          </ChipLink>
        ))}
      </div>

      {!report.measured ? (
        <div className="mt-5">
          <EmptyState
            title="まだ記録が集まっていません"
            body={`利用者が画面を開くと、その日のうちに集計されます。個人を特定する値は保存せず、会社・画面・立場ごとの件数だけを${USAGE_RETENTION_DAYS}日間だけ残します。`}
          />
        </div>
      ) : (
        <>
          <div className="kpi-strip" aria-label="この期間の合計">
            <div className="kpi">
              <div className="kpi-label">画面を開いた回数</div>
              <div className="kpi-value">
                <Num value={totals.views} unit="回" />
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">迷いの兆候</div>
              <div className="kpi-value">
                <Num value={totals.signals} unit="件" />
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">1回あたりの滞在</div>
              <div className="kpi-value">
                {formatDuration(totals.dwellSamples > 0 ? Math.round(totals.dwellMs / totals.dwellSamples) : null)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">通信の失敗</div>
              <div className="kpi-value">
                <Num value={apiTotals.errors} unit="回" />
              </div>
            </div>
          </div>

          {next && (
            <div className="mt-5">
              <ReasonNote>
                <strong>次に直すなら「{next.label}」です。</strong>
                {next.counters.views}回開かれて、迷いの兆候が{frictionSignals(next.counters)}件
                （100回あたり{frictionPer100Views(next.counters)}件）出ています。
              </ReasonNote>
            </div>
          )}

          <SectionHeading help={`開いた回数に対して、詰まった気配が多い順です。この期間に${USAGE_MIN_VIEWS_FOR_RANKING}回未満の画面は外しています。`}>
            詰まっている画面
          </SectionHeading>
          {friction.length === 0 ? (
            <Card className="card-pad">
              <p className="m-0 text-sub text-ink-muted">
                この期間、詰まった気配のある画面はありませんでした。
              </p>
            </Card>
          ) : (
            <Card className="card-pad">
              <div className="grid gap-4">
                {friction.map((row) => (
                  <div key={row.routePattern}>
                    <RankBar
                      label={row.label}
                      value={frictionPer100Views(row.counters)}
                      max={frictionPer100Views(friction[0].counters)}
                      caption={`100回あたり ${frictionPer100Views(row.counters)}件 ／ ${row.counters.views}回`}
                    />
                    <FrictionDetail row={row} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <SectionHeading
            help={`1回開くごとに、平均どれだけ留まっているかの順です。${Math.round(USAGE_LONG_STAY_MS / 1000)}秒以上を「長く止まった」として数えています。`}
          >
            時間がかかっている画面
          </SectionHeading>
          {slowest.length === 0 ? (
            <Card className="card-pad">
              <p className="m-0 text-sub text-ink-muted">滞在時間を測れた画面がまだありません。</p>
            </Card>
          ) : (
            <Card className="card-pad">
              <div className="grid gap-4">
                {slowest.map((row) => (
                  <RankBar
                    key={row.routePattern}
                    label={row.label}
                    value={averageDwellMs(row.counters) ?? 0}
                    max={averageDwellMs(slowest[0].counters) ?? 0}
                    caption={`${formatDuration(averageDwellMs(row.counters))} ／ ${row.counters.views}回`}
                  />
                ))}
              </div>
            </Card>
          )}

          <SectionHeading help="数え方が違うので、日付だけをそろえて2枚に分けています。">
            日ごとの動き
          </SectionHeading>
          <Card className="card-pad">
            <p className="m-0 text-note text-ink-muted">画面を開いた回数</p>
            <TrendChart data={trend} series={[{ key: "表示回数", label: "画面を開いた回数" }]} height={180} />
            <p className="m-0 mt-3 text-note text-ink-muted">迷いの兆候</p>
            <TrendChart data={trend} series={[{ key: "迷いの兆候", label: "迷いの兆候" }]} height={180} />
          </Card>

          {unused.length > 0 && (
            <div className="mt-5">
              <Disclosure
                summary="この期間に一度も開かれていない画面"
                meta={`${unused.length}画面`}
                defaultOpen={false}
              >
                <div className="p-4">
                  <p className="m-0 mb-2 text-note text-ink-muted">
                    作ったのに使われていない画面です。案内が届いていないか、そもそも要らない可能性があります。
                  </p>
                  <ul className="m-0 grid list-none gap-1 p-0 text-sub sm:grid-cols-2">
                    {unused.map((row) => (
                      <li key={row.routePattern}>{row.label}</li>
                    ))}
                  </ul>
                </div>
              </Disclosure>
            </div>
          )}

          <div className="mt-3">
            <Disclosure summary="全画面の一覧" meta={`${used.length}画面が使われました`}>
              <div className="p-0">
                <DataTable
                  columns={screenColumns}
                  rows={used}
                  rowKey={(r) => r.routePattern}
                  caption="画面ごとの開いた回数・滞在時間・迷いの兆候"
                />
              </div>
            </Disclosure>
          </div>

          <div className="mt-3">
            <Disclosure
              summary="画面と保管場所の連絡（通信）"
              meta={`${apiTotals.calls}回 ／ 時間がかかった ${apiTotals.slowCalls}回`}
            >
              <div className="p-0">
                {apis.length === 0 ? (
                  <p className="m-0 p-4 text-sub text-ink-muted">通信の記録はまだありません。</p>
                ) : (
                  <>
                    <p className="m-0 px-4 pt-4 text-note text-ink-muted">
                      {Math.round(USAGE_SLOW_API_MS / 1000)}秒以上かかったものを「時間がかかった」として数えています。
                    </p>
                    <DataTable
                      columns={apiColumns}
                      rows={apis}
                      rowKey={(r) => `${r.method} ${r.routePattern}`}
                      caption="通信ごとの回数・所要時間・失敗"
                    />
                  </>
                )}
              </div>
            </Disclosure>
          </div>

          <p className="mt-5 text-note text-ink-muted">
            この画面の数字に個人は含まれません。日 × 会社 × 画面 × 立場の件数だけを{USAGE_RETENTION_DAYS}
            日間だけ保存し、それより古い記録は自動で消えます。
          </p>
        </>
      )}
    </>
  );
}
