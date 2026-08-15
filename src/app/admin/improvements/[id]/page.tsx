import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getImprovementRequest, listImprovementEvents, listRelatedIssueLinks } from "@/lib/queries";
import {
  Badge,
  Card,
  Code,
  DefList,
  Disclosure,
  EmptyState,
  LinkButton,
  PageTitle,
  ReasonNote,
  RecordList,
  SectionHeading,
} from "@/components/ui";
import { ImprovementStatusForm } from "@/components/ImprovementStatusForm";
import { ImprovementIssueForm } from "@/components/ImprovementIssueForm";
import { ImprovementDispositionForm } from "@/components/ImprovementDispositionForm";
import {
  canDisposeImprovements,
  isDispositionAction,
  dispositionActionLabel,
  improvementDisplayState,
  improvementDisplayStateLabel,
  improvementDisplayStateTone,
} from "@/lib/domain/improvement-disposition";
import { diagnosticsLevelFor, improvementKindLabel, parseDiagnostics } from "@/lib/domain/improvement-issue";
import { buildImprovementIssueDraft } from "@/lib/improvement-issue-draft";
import { formatDateTime } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 届いた改善要望1件。
 *
 * 読む順は「何を直してほしいか → どの画面か → 画像 → 開発へ渡す → 対応状況」。
 * 自社のものだけを引き当て、他社のIDを入れられても404にする。
 *
 * 開発へ渡す（記録票を作る）のはシステム全体管理者だけ。記録票は社外の
 * リポジトリに残るため、出る前に**そのままの文面**をこの画面で確かめられるようにする。
 */
export default async function AdminImprovementDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const { id } = await params;
  const item = await getImprovementRequest(viewer.companyId, id);
  if (!item) notFound();

  const diagnostics = parseDiagnostics(item.diagnostics, diagnosticsLevelFor(item.kind));
  const canPushIssue = viewer.role === "SUPER_ADMIN";
  const canDispose = canDisposeImprovements(viewer.role);
  const displayState = improvementDisplayState(item);
  // 誰がいつどの状態に変えたかは、上書きせず積み上げてある（→ improvement_status_events）。
  const events = await listImprovementEvents(item.id);
  // 似ている記録票は、実際に出すときと同じ条件で引く（下見と実物を一致させる）。
  const draft = canPushIssue && !item.issueUrl
    ? await buildImprovementIssueDraft(
        item,
        await listRelatedIssueLinks(viewer.companyId, item.routePattern, item.kind, item.id),
      )
    : null;

  return (
    <>
      <PageTitle
        title="要望1件"
        lede="送られた内容と、そのときの画面です。"
        tags={
          <>
            <Badge tone={improvementDisplayStateTone(displayState)}>
              {improvementDisplayStateLabel(displayState)}
            </Badge>
            <Badge tone={item.kind === "bug" ? "alert" : "closed"}>{improvementKindLabel(item.kind)}</Badge>
          </>
        }
        actions={<LinkButton href="/admin/improvements">一覧へ戻る</LinkButton>}
      />

      <SectionHeading>改善したいこと</SectionHeading>
      <Card className="card-pad">
        <p className="m-0 whitespace-pre-wrap">{item.body}</p>
      </Card>

      <SectionHeading help="本人が書いたときだけ出ます。">どうなってほしいか</SectionHeading>
      {item.expected ? (
        <Card className="card-pad">
          <p className="m-0 whitespace-pre-wrap">{item.expected}</p>
        </Card>
      ) : (
        <ReasonNote>本人からの記入はありません。上の文面から読み取ってください。</ReasonNote>
      )}

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

      <SectionHeading help="送信時にブラウザ側で自動収集したものです。">技術情報</SectionHeading>
      {diagnostics ? (
        <Disclosure summary="自動で記録された技術情報" meta={`エラー${diagnostics.logs.length}件／通信の失敗${diagnostics.network.length}件`}>
          <DefList
            rows={[
              { label: "ブラウザ", value: diagnostics.browser || "不明" },
              { label: "OS", value: diagnostics.os || "不明" },
              { label: "表示倍率", value: String(diagnostics.devicePixelRatio) },
              { label: "見た目の設定", value: diagnostics.theme || "不明" },
              { label: "通信状態", value: diagnostics.online ? "オンライン" : "オフライン" },
              {
                label: "直前の操作",
                value:
                  diagnostics.breadcrumbs.length > 0 ? (
                    <ul className="m-0">
                      {diagnostics.breadcrumbs.map((c, i) => (
                        <li key={`${c.agoMs}-${i}`}>{c.label || "（名前なし）"}</li>
                      ))}
                    </ul>
                  ) : (
                    "記録なし"
                  ),
              },
              {
                label: "出たエラー",
                value:
                  diagnostics.logs.length > 0 ? (
                    <ul className="m-0">
                      {diagnostics.logs.map((l, i) => (
                        <li key={`${l.agoMs}-${i}`}>{l.text}</li>
                      ))}
                    </ul>
                  ) : (
                    "記録なし"
                  ),
              },
              {
                label: "失敗した通信",
                value:
                  diagnostics.network.length > 0 ? (
                    <ul className="m-0">
                      {diagnostics.network.map((n, i) => (
                        <li key={`${n.agoMs}-${i}`}>
                          {n.method} {n.path}（{n.status === null ? "応答なし" : n.status}）
                          {/* やりとりの中身は伏せ字ずみのものだけを持っている（→ maskPayload）。 */}
                          {n.requestBody && <Code block>{n.requestBody}</Code>}
                          {n.responseBody && <Code block>{n.responseBody}</Code>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "記録なし"
                  ),
              },
            ]}
          />
        </Disclosure>
      ) : (
        <ReasonNote>
          この要望には技術情報が付いていません。自動収集を入れる前に届いたものです。
        </ReasonNote>
      )}

      <SectionHeading help="開発が読む作業票です。">開発への記録票</SectionHeading>
      {item.issueUrl ? (
        <Card className="card-pad">
          <p className="m-0">
            記録票 #{item.issueNumber} を作成済みです。
          </p>
          <p className="footnote mt-1 mb-0">{item.issueUrl}</p>
        </Card>
      ) : canPushIssue && draft ? (
        <>
          <Disclosure summary="記録票に出る内容をそのまま確認する" meta={draft.title}>
            <Code block>{draft.body}</Code>
          </Disclosure>
          <ImprovementIssueForm id={item.id} />
        </>
      ) : (
        <ReasonNote>
          記録票づくりはシステム全体管理者が行います。内容の追記が必要なときは、下の対応メモに書いてください。
        </ReasonNote>
      )}

      <SectionHeading>対応状況</SectionHeading>
      <ImprovementStatusForm id={item.id} status={item.status} note={item.handledNote} />
      {item.handledByName && (
        <p className="footnote">最後に更新した人：{item.handledByName}（{formatDateTime(item.updatedAt)}）</p>
      )}

      {item.discarded && (
        <ReasonNote>
          この要望は廃棄されています。記録票へは送られません。
        </ReasonNote>
      )}

      {canDispose && (
        <>
          <SectionHeading help="落とした判断は、あとから元に戻せます。">この要望の扱い</SectionHeading>
          <ImprovementDispositionForm id={item.id} hasIssue={Boolean(item.issueNumber)} discarded={item.discarded} />
        </>
      )}

      <SectionHeading help="消さずに積み上げています。">操作の履歴</SectionHeading>
      {events.length === 0 ? (
        <ReasonNote>まだ状態を変えた記録はありません。</ReasonNote>
      ) : (
        <RecordList
          items={events.map((e) => ({
            key: e.id,
            title: isDispositionAction(e.action) ? dispositionActionLabel(e.action) : "対応状況の変更",
            rows: [
              { label: "日時", value: formatDateTime(e.createdAt) },
              { label: "操作した人", value: e.actorName ?? "退職された方" },
            ],
            note: e.reason ?? undefined,
          }))}
        />
      )}
    </>
  );
}
