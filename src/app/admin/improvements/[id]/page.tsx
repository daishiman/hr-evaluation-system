import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getImprovementRequest } from "@/lib/queries";
import { Badge, Card, DefList, EmptyState, LinkButton, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { ImprovementStatusForm } from "@/components/ImprovementStatusForm";
import { improvementStatusLabel, improvementStatusTone } from "@/lib/domain/improvement";
import { formatDateTime } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 届いた改善要望1件。
 *
 * 読む順は「何を直してほしいか → どの画面か → 画像 → 対応状況」。
 * 自社のものだけを引き当て、他社のIDを入れられても404にする。
 */
export default async function AdminImprovementDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const { id } = await params;
  const item = await getImprovementRequest(viewer.companyId, id);
  if (!item) notFound();

  return (
    <>
      <PageTitle
        title="要望1件"
        lede="送られた内容と、そのときの画面です。"
        tags={<Badge tone={improvementStatusTone(item.status)}>{improvementStatusLabel(item.status)}</Badge>}
        actions={<LinkButton href="/admin/improvements">一覧へ戻る</LinkButton>}
      />

      <SectionHeading>改善したいこと</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 whitespace-pre-wrap">{item.body}</p>
      </Card>

      <SectionHeading help="送信時に自動で記録したものです。">どこで起きたか</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            { label: "画面", value: item.screenLabel },
            { label: "URL", value: item.path },
            { label: "送った人", value: item.reporterName ?? "退職された方" },
            { label: "届いた日時", value: formatDateTime(item.createdAt) },
            { label: "画面の広さ", value: item.viewport ?? "—" },
          ]}
        />
      </Card>

      <SectionHeading>そのときの画面</SectionHeading>
      {item.shot ? (
        /* 画像は data URL でDBに入っている（R2 を使っていないため）。
           next/image は data URL を扱えないので素の img で出す。 */
        // eslint-disable-next-line @next/next/no-img-element
        <img className="improvement-shot" src={item.shot} alt={`${item.screenLabel}の画面`} />
      ) : (
        <ReasonNote>画像は添えられていません。文章だけで届いています。</ReasonNote>
      )}

      <SectionHeading>対応状況</SectionHeading>
      <ImprovementStatusForm id={item.id} status={item.status} note={item.handledNote} />
      {item.handledByName && (
        <p className="footnote">最後に更新した人：{item.handledByName}（{formatDateTime(item.updatedAt)}）</p>
      )}
    </>
  );
}
