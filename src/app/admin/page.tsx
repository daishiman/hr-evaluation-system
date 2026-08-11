import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  getActiveScheme,
  listCycles,
  listEvaluations,
  listForms,
  listGrades,
  listMembers,
  listPromotionThresholds,
  listRaiseSettings,
  listSchemeItems,
} from "@/lib/queries";
import { listPendingRespondents } from "@/lib/evaluate";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";
import { CYCLE_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 会社の管理者のホーム。
 * 「いま手を付けるべきこと → 次の作業の入口 → 状況の数字」の順に並べる。
 */
export default async function AdminHome() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="システム管理者にご連絡ください。" />;
  const companyId = viewer.companyId;

  const [cycles, members, grades, scheme, thresholds, raises] = await Promise.all([
    listCycles(companyId),
    listMembers(companyId),
    listGrades(companyId),
    getActiveScheme(companyId),
    listPromotionThresholds(companyId),
    listRaiseSettings(companyId),
  ]);

  const current = cycles.find((c) => c.status === "open") ?? cycles[0] ?? null;
  const [pending, evals, forms, items] = await Promise.all([
    current ? listPendingRespondents(companyId, current.id) : Promise.resolve([]),
    current ? listEvaluations(companyId, viewer.role, { cycleId: current.id }) : Promise.resolve([]),
    current ? listForms(companyId, current.id) : Promise.resolve([]),
    scheme ? listSchemeItems(companyId, scheme.id) : Promise.resolve([]),
  ]);

  const submitted = pending.filter((p) => p.status === "submitted").length;
  const drafts = evals.filter((e) => e.status !== "finalized").length;
  const draftForms = forms.filter((f) => f.status === "draft").length;
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const provisionalCount =
    thresholds.filter((t) => t.isProvisional).length + raises.filter((r) => r.isProvisional).length;

  const todos: { title: string; body: string; href: string; label: string }[] = [];
  if (!scheme) {
    todos.push({ title: "評価セットが未設定です", body: "8項目と配点を決めると、評価の計算ができるようになります。", href: "/admin/scheme", label: "評価セットを設定する" });
  } else if (scheme && totalWeight !== scheme.totalPoints) {
    todos.push({ title: "配点の合計が満点になっていません", body: `いまの合計は${totalWeight}点です（満点${scheme.totalPoints}点）。`, href: "/admin/scheme", label: "配点を直す" });
  }
  if (cycles.length === 0) {
    todos.push({ title: "評価期間がありません", body: "半期の期間を作ると、アンケートを配れるようになります。", href: "/admin/cycles", label: "評価期間を作る" });
  } else if (draftForms > 0) {
    todos.push({ title: `下書きのアンケートが${draftForms}件あります`, body: "内容を確認して公開すると、対象の方が回答できます。", href: "/admin/forms", label: "アンケートを確認する" });
  }
  if (drafts > 0) {
    todos.push({ title: `確認中の評価が${drafts}件あります`, body: "内容を確認して確定すると、ご本人に結果が公開されます。", href: "/manager/cycles", label: "評価を確認する" });
  }

  return (
    <>
      <PageTitle
        title={`${viewer.companyName ?? "会社"}の管理`}
        lede="制度の設定・社員の登録・アンケートの配布と、半期の進行状況をここから確認できます。"
      />

      <SectionHeading>いま手を付けること</SectionHeading>
      {todos.length === 0 ? (
        <p className="footnote">急ぎの作業はありません。</p>
      ) : (
        <Card>
          {todos.map((t) => (
            <div key={t.title} className="card-row items-start">
              <div className="row-main">
                <p className="todo-row-title m-0">{t.title}</p>
                <p className="todo-row-sub m-0">{t.body}</p>
              </div>
              <LinkButton href={t.href} variant="primary">
                {t.label}
              </LinkButton>
            </div>
          ))}
        </Card>
      )}

      <SectionHeading>いまの評価期間</SectionHeading>
      {!current ? (
        <EmptyState
          title="評価期間がまだありません"
          body="半期の期間を作ると、アンケートの配布と評価の作成ができます。"
          action={<LinkButton href="/admin/cycles" variant="primary">評価期間を作る</LinkButton>}
        />
      ) : (
        <Card className="card-pad hero-tint">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">
            {current.name} ／ {formatPeriod(current.periodStart, current.periodEnd)} ／{" "}
            {CYCLE_STATUS_LABEL[current.status] ?? current.status}
          </p>
          <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
            {submitted}
            <span className="unit"> / {pending.length} 人が提出済み</span>
          </p>
          <p className="m-0 mt-2 text-[13px]">
            評価は{evals.length}件作成済み（確認中 {drafts}件）。アンケートは{forms.length}件（下書き {draftForms}件）。
          </p>
        </Card>
      )}

      <SectionHeading>会社の状況</SectionHeading>
      <div className="card-grid card-grid-3">
        <Card className="card-pad">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">登録されている社員</p>
          <p className="m-0">
            <Num value={members.length} display unit="人" />
          </p>
          <p className="footnote card-foot m-0">
            <Link href="/admin/members" className="text-[var(--brand-deep)]">社員を管理する</Link>
          </p>
        </Card>
        <Card className="card-pad">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">等級</p>
          <p className="m-0">
            <Num value={grades.length} display unit="段階" />
          </p>
          <p className="footnote card-foot m-0">
            <Link href="/admin/masters" className="text-[var(--brand-deep)]">制度マスタを開く</Link>
          </p>
        </Card>
        <Card className="card-pad">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">評価セットの配点</p>
          <p className="m-0">
            <Num value={totalWeight} display unit={`点 / ${scheme?.totalPoints ?? 100}点`} />
          </p>
          <p className="footnote card-foot m-0">
            <Link href="/admin/scheme" className="text-[var(--brand-deep)]">8項目と配点を見る</Link>
          </p>
        </Card>
      </div>

      {provisionalCount > 0 && (
        <div className="mt-4">
          <ReasonNote action={<LinkButton href="/admin/masters">制度マスタで決める</LinkButton>}>
            <ProvisionalMark /> の付いた設定が{provisionalCount}件あります（昇格に必要な点数・昇給額）。
            制度が決まったら実際の値に変更してください。いまは叩き台の初期値で動いています。
          </ReasonNote>
        </div>
      )}

      <SectionHeading>この期の評価</SectionHeading>
      {evals.length === 0 ? (
        <p className="footnote">まだ評価は作られていません。</p>
      ) : (
        <Card>
          {evals.slice(0, 5).map((e) => (
            <div key={e.id} className="card-row">
              <div className="row-main">
                <p className="todo-row-title m-0">
                  <Link href={`/manager/evaluations/${e.id}`} className="text-[var(--brand-deep)]">
                    {e.employeeName}
                  </Link>
                </p>
                <p className="todo-row-sub m-0">{e.gradeName}</p>
              </div>
              <div className="shrink-0 text-right">
                <Num value={e.totalScore} display />
                <span className="unit">点</span>
              </div>
              {e.status === "finalized" ? <Badge tone="done">確定済み</Badge> : <Badge tone="active">確認中</Badge>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
