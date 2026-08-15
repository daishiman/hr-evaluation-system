import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getImprovementRequest, listImprovementEvents } from "@/lib/queries";
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
import { ImprovementHandoutPanel } from "@/components/ImprovementHandoutPanel";
import { ImprovementDispositionForm } from "@/components/ImprovementDispositionForm";
import {
  canDisposeImprovements,
  improvementEventLabel,
  improvementDisplayState,
  improvementDisplayStateLabel,
  improvementDisplayStateTone,
} from "@/lib/domain/improvement-disposition";
import { diagnosticsLevelFor, improvementKindLabel, parseDiagnostics } from "@/lib/domain/improvement-instruction";
import {
  handoutNote,
  handoutState,
  handoutStateLabel,
  handoutStateTone,
} from "@/lib/domain/improvement-handout";
import { agentPromptText } from "@/lib/domain/agent-api";
import { buildImprovementInstruction, improvementFingerprintOf } from "@/lib/improvement-instruction-draft";
import { appOrigin } from "@/lib/origin";
import { formatDateTime } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * 届いた改善要望1件。
 *
 * 読む順は「何を直してほしいか → どの画面か → 画像 → 作業する側へ渡す → 対応状況」。
 * 自社のものだけを引き当て、他社のIDを入れられても404にする。
 *
 * 渡せるのはシステム全体管理者だけ。渡る文面はこの画面でそのまま読める
 * （渡したあとに「何を渡したのか」を探し直さずに済む）。
 */
export default async function AdminImprovementDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const { id } = await params;
  const item = await getImprovementRequest(viewer.companyId, id);
  if (!item) notFound();

  const diagnostics = parseDiagnostics(item.diagnostics, diagnosticsLevelFor(item.kind));
  const canHandOut = viewer.role === "SUPER_ADMIN";
  const canDispose = canDisposeImprovements(viewer.role);
  const displayState = improvementDisplayState(item);
  // 誰がいつどの状態に変えたかは、上書きせず積み上げてある（→ improvement_status_events）。
  const events = await listImprovementEvents(item.id);
  // 下見と、実際に払い出す文面は同じ関数から作る（確認した内容と渡る内容を一致させる）。
  const draft = canHandOut ? await buildImprovementInstruction(item) : null;
  const prompt = canHandOut ? agentPromptText(await appOrigin(), `?id=${item.id}`) : "";
  const snapshot =
    item.contentFingerprint === null
      ? null
      : { contentFingerprint: item.contentFingerprint, handedOutAt: item.handedOutAt };
  const handout = handoutState(snapshot, improvementFingerprintOf(item));

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

      <SectionHeading help="作業する側が読む指示文です。">作業する側へ渡す</SectionHeading>
      <Card className="card-pad">
        <DefList
          rows={[
            {
              label: "払い出し",
              value: <Badge tone={handoutStateTone(handout)}>{handoutStateLabel(handout)}</Badge>,
            },
            { label: "渡した日時", value: item.handedOutAt ? formatDateTime(item.handedOutAt) : "—" },
            { label: "いまの状態", value: handoutNote(handout) },
          ]}
        />
      </Card>
      {canHandOut && draft ? (
        <>
          <Disclosure summary="渡す指示文をそのまま読む" meta={draft.title}>
            <Code block>{draft.document}</Code>
          </Disclosure>
          <ImprovementHandoutPanel id={item.id} document={draft.document} prompt={prompt} />
        </>
      ) : (
        <ReasonNote>
          指示文の払い出しはシステム全体管理者が行います。追記が要るときは、下の対応メモに書いてください。
        </ReasonNote>
      )}

      <SectionHeading>対応状況</SectionHeading>
      <ImprovementStatusForm id={item.id} status={item.status} note={item.handledNote} />
      {item.handledByName && (
        <p className="footnote">最後に更新した人：{item.handledByName}（{formatDateTime(item.updatedAt)}）</p>
      )}

      {item.discarded && (
        <ReasonNote>
          この要望は廃棄されています。指示文としては払い出されません。
        </ReasonNote>
      )}

      {canDispose && (
        <>
          <SectionHeading help="落とした判断は、あとから元に戻せます。">この要望の扱い</SectionHeading>
          <ImprovementDispositionForm id={item.id} discarded={item.discarded} />
        </>
      )}

      <SectionHeading help="消さずに積み上げています。">操作の履歴</SectionHeading>
      {events.length === 0 ? (
        <ReasonNote>まだ状態を変えた記録はありません。</ReasonNote>
      ) : (
        <RecordList
          items={events.map((e) => ({
            key: e.id,
            title: improvementEventLabel(e.action),
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
