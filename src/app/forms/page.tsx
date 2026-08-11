import Link from "next/link";
import { canSeeFormResponses, requireViewer } from "@/lib/session";
import { listCycles, listForms } from "@/lib/queries";
import { Badge, Card, CardRow, EmptyState, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { FORM_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケートの中身を読む一覧（全ロール共通・確認専用）。
 *
 * 使われる場面：「今期、どの等級の人に何を聞いているのか」を、自分あての1本だけでなく
 * 全部まとめて確かめたいとき。管理者・マネージャーは配る前の文面確認に、
 * 一般の方は「他の等級では何を聞かれるのか」を知るために開く。
 *
 * ここには回答（誰がどう答えたか）を一切出さない。回答の一覧は
 * これまでどおり会社の管理者だけが /admin/forms から見る。
 */
export default async function FormContentList({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.companyId) {
    return <EmptyState title="所属している会社がありません" body="会社の管理者にご連絡ください。" />;
  }
  const companyId = viewer.companyId;

  const cycles = await listCycles(companyId);
  if (cycles.length === 0) {
    return (
      <>
        <PageTitle title="アンケートの中身" />
        <EmptyState
          title="まだアンケートはありません"
          body="評価期間ができると、等級ごとのアンケートがここに並びます。"
        />
      </>
    );
  }

  const sp = await searchParams;
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];
  const forms = await listForms(companyId, selected.id);

  return (
    <>
      <PageTitle
        title="アンケートの中身"
        lede="等級ごとのアンケートを、答えずに読めます。設問文・補足・選択肢・答え方まで確認できます。"
      />

      <SectionHeading>評価期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <Link key={c.id} href={`/forms?cycle=${c.id}`} className="chip" aria-current={c.id === selected.id ? "true" : undefined}>
            {c.name}
          </Link>
        ))}
      </div>

      <SectionHeading>この期間のアンケート（{forms.length}件）</SectionHeading>
      {forms.length === 0 ? (
        <EmptyState title="この評価期間のアンケートはまだありません" body="準備ができると、等級ごとに1つずつ並びます。" />
      ) : (
        <Card>
          {forms.map((f) => (
            <CardRow
              key={f.id}
              off={f.status === "closed"}
              title={
                <Link href={`/forms/${f.id}`} className="text-[var(--brand-deep)]">
                  {f.title}
                </Link>
              }
              sub={
                <>
                  対象 {f.gradeName ?? "—"} ／ 第{f.version}版 ／ 全{f.questionCount}問
                </>
              }
              detail={<p className="footnote m-0">回答期間 {formatPeriod(f.opensAt, f.closesAt)}</p>}
              marks={
                <Badge tone={f.status === "published" ? "active" : f.status === "closed" ? "closed" : "dropped"}>
                  {FORM_STATUS_LABEL[f.status] ?? f.status}
                </Badge>
              }
            />
          ))}
        </Card>
      )}

      <div className="mt-4">
        <ReasonNote>
          この画面に出るのはアンケートの中身だけです。誰がどう答えたかは表示されません
          {canSeeFormResponses(viewer.role)
            ? "（回答の一覧は「アンケート」の各アンケートから確認できます）。"
            : "。"}
        </ReasonNote>
      </div>
    </>
  );
}
