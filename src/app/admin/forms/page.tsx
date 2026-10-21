import { requireRoute } from "@/lib/session";
import { listCycles, listForms, listGrades } from "@/lib/queries";
import { formRowTitle } from "@/lib/domain/grade-label";
import { SUBMISSION_STATE_LABEL } from "@/lib/domain/submission-status";
import { ActionButton } from "@/components/ActionButton";
import { createForms, updateForm } from "@/actions/forms";
import { ComparisonGapNotice } from "@/components/ComparisonGapNotice";
import { loadCycleComparisonGaps } from "@/lib/comparison-gap-loader";
import { CopyUrl } from "@/components/CopyUrl";
import { SetupGapList } from "@/components/SetupGapList";
import { appOrigin, formUrl } from "@/lib/origin";
import { Badge, Card, ChipLink, EmptyState, LinkButton, Num, PageTitle, SectionHeading, SplitRow } from "@/components/ui";
import { FORM_STATUS_LABEL, formatPeriod } from "@/lib/view";
import { formPublicationReadiness } from "@/lib/domain/setup-readiness";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";
import { loadStaleAsking } from "@/lib/stale-asking-loader";
import { schemeIdForCycle } from "@/lib/cycle-scheme";
import { listFormSubmissionCounts } from "@/lib/submission-queries";
import { NEW_VERSION_LABEL, formTransitions } from "@/lib/domain/form-transitions";

export const dynamic = "force-dynamic";

/**
 * アンケートの一覧と作成。
 * 制度マスタから下書きを自動で作り、設問はクリック操作で組み立てて公開する。
 */
export default async function AdminForms({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const viewer = await requireRoute("/admin/forms");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const cycles = await listCycles(companyId);
  if (cycles.length === 0) {
    return (
      <>
        <PageTitle title="アンケート" />
        <EmptyState
          title="先に評価期間を作ってください"
          body="アンケートは評価期間ごと・等級ごとに作ります。"
          action={<LinkButton href="/admin/cycles" variant="primary">評価期間を作る</LinkButton>}
        />
      </>
    );
  }

  const sp = await searchParams;
  /* 配布用URLは実行時に組み立てる（本番・プレビュー・ローカルでホストが違うため、
     ドメインを書き込むと必ずどこかで間違ったURLを配ることになる）。 */
  const origin = await appOrigin();
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];
  // 公開の判定に使う評価セット。アンケートの作成・点数の計算と同じ選び方（DD-024）
  const schemeId = await schemeIdForCycle(companyId, selected);
  const [forms, grades, comparisonGaps, schemeReadiness, submissionCounts] = await Promise.all([
    listForms(companyId, selected.id),
    listGrades(companyId),
    loadCycleComparisonGaps(companyId, selected.id, { role: viewer.role, current: null }),
    loadSchemeReadiness(companyId, schemeId),
    listFormSubmissionCounts(companyId, selected.id),
  ]);
  // 公開ボタンを出すかは、公開の処理（updateForm）と同じ読み出しで決める。見るのは下書きだけ
  const staleAsking = await loadStaleAsking(companyId, schemeId, forms.filter((f) => f.status === "draft"));
  // 締切を過ぎたかの判定の基準時刻（カードごとに読み直さない）
  const now = new Date();

  return (
    <>
      <PageTitle
        title="アンケート"
        lede="等級ごとに1つのアンケートを配ります。公開前に、設問文だけでなく選択肢や答え方まで確認できます。"
      />

      {/* 期間の札は見出しの右に並べる。見出しの下に1行で置くと、札の右側が空いたまま残る（§28-9） */}
      <SectionHeading
        aside={
          <div className="flex flex-wrap justify-end gap-2" role="group" aria-label="評価期間を選ぶ">
            {cycles.map((c) => (
              <ChipLink key={c.id} href={`/admin/forms?cycle=${c.id}`} current={c.id === selected.id}>
                {c.name}
              </ChipLink>
            ))}
          </div>
        }
      >
        評価期間を選ぶ
      </SectionHeading>

      <Card className="card-pad">
        <SplitRow
          aside={
            <ActionButton
              action={createForms}
              resource="forms"
              input={{ cycleId: selected.id }}
              label="等級ごとの下書きをまとめて作る"
              confirm="等級ごとのアンケート下書きを作ります。もとにするのは、等級要件・昇格要件・行動指針・評価セットです。既存のアンケートは残し、新しい版として追加します。よろしいですか？"
            />
          }
        >
          <p className="m-0 text-sub">
            {selected.name}（{formatPeriod(selected.periodStart, selected.periodEnd)}）のアンケートを、
            等級{grades.length}段階ぶんまとめて下書きで作ります。作ったあとに1つずつ内容を確認して公開してください。
          </p>
        </SplitRow>
      </Card>

      {/* 配布用のURLを開くにはログインが要る、という注記は公開中のどのカードでも同じ。
          カードごとに URL の後ろへ付けると、狭い列で「す）」だけが次の行へ折り返して右側が空く（§28-9）。
          見出しの右に1回だけ置く。 */}
      <SectionHeading
        aside={
          forms.some((f) => f.status === "published") ? (
            <span className="footnote">配布用のURLを開くにはログインが必要です</span>
          ) : undefined
        }
      >
        この期間のアンケート（{forms.length}件）
      </SectionHeading>
      {forms.length === 0 ? (
        <EmptyState title="アンケートがまだありません" body="上のボタンで等級ごとの下書きを作ってください。" />
      ) : (
        <div className="stack">
          {forms.map((f) => {
            const publication = formPublicationReadiness({
              schemeGaps: schemeReadiness.schemeGaps,
              cycleStatus: selected.status,
              questionCount: Number(f.questionCount ?? 0),
              formId: f.id,
              staleAsking: staleAsking.get(f.id) ?? [],
            });
            const comparisonGap = comparisonGaps.get(f.id);
            const submission = submissionCounts.get(f.id);
            /* 出すボタンは、API（updateForm・延長）と同じ規則で決める（form-transitions.ts）。
               締め切り済みに「公開中に戻す」は無く、もう一度集めるときは新しい版を作る。 */
            const responseCount = Number(f.responseCount ?? 0);
            const allowed = formTransitions(
              f.status,
              { closesAt: f.closesAt, now, cycleStatus: selected.status },
              responseCount > 0,
            );
            // 新しい版は、その等級でいちばん後の版からだけ作る（古い版のカードにも出すと、同じ等級に下書きが重なる）
            const isLatest = !forms.some((o) => o.gradeId === f.gradeId && o.version > f.version);
            return (
            <Card key={f.id} className="card-pad" off={f.status === "closed"}>
              {/* 左に「どのアンケートか」（題名・対象・件数・配布URL）、右にそのアンケートへの操作。
                  頭の行だけを左右に分けて下に公開・締切のボタンを積むと、カードの右側が空いたまま縦に伸びる（§28-9）。 */}
              <SplitRow
                aside={
                  <>
                    <div className="flex flex-wrap gap-2">
                      <LinkButton href={`/admin/forms/${f.id}/responses`} variant="secondary">
                        回答一覧を見る
                      </LinkButton>
                      <LinkButton href={`/admin/forms/${f.id}`} variant="tertiary">
                        内容を確認・編集
                      </LinkButton>
                    </div>
                    {allowed.publish && publication.ready && (
                      <div className="mt-3">
                        <ActionButton
                          action={updateForm}
                          resource="forms"
                          input={{ formId: f.id, status: "published" }}
                          label="公開する"
                          confirm={`「${formRowTitle(f)}」を公開します。${f.gradeName ?? ""}の方の画面に表示され、回答できるようになります。同じ等級で公開中の古い版は自動で締め切られます。よろしいですか？`}
                        />
                      </div>
                    )}
                    {allowed.close && (
                      <div className="mt-3">
                        <ActionButton
                          action={updateForm}
                          resource="forms"
                          input={{ formId: f.id, status: "closed" }}
                          label="締め切る"
                          variant="secondary"
                          confirm={`「${formRowTitle(f)}」を締め切ります。以後は回答できず、公開中にも戻せません。もう一度集めるときは新しい版を作ります。提出済みの回答は残ります。間に合わない方がいるときは、締め切らずに回答一覧から本人ごとに期限を延ばせます。よろしいですか？`}
                        />
                      </div>
                    )}
                    {allowed.newVersion && isLatest && (
                      <div className="mt-3">
                        <ActionButton
                          action={createForms}
                          resource="forms"
                          input={{ cycleId: selected.id, gradeIds: [f.gradeId] }}
                          label={NEW_VERSION_LABEL}
                          variant="secondary"
                          confirm={`${f.gradeName ?? "この等級"}のアンケートの新しい版を下書きで作ります。設問は、いまの等級要件・昇格要件・行動指針・評価セットから作ります。第${f.version}版と集まった回答はそのまま残ります。新しい版を公開すると、公開中の前の版は自動で締め切られます。よろしいですか？`}
                        />
                      </div>
                    )}
                  </>
                }
              >
                <p className="todo-row-title m-0">
                  {formRowTitle(f)}{" "}
                  {f.status === "published" ? (
                    <Badge tone="active">公開中</Badge>
                  ) : f.status === "closed" ? (
                    <Badge tone="closed">締め切り済み</Badge>
                  ) : (
                    <Badge tone="done">下書き</Badge>
                  )}
                </p>
                <p className="todo-row-sub card-head-sub m-0">
                  対象：{f.gradeName ?? "—"} ／ 第{f.version}版 ／ 設問 <Num value={Number(f.questionCount ?? 0)} unit="問" />
                  {/* 件数は対象等級の在籍者全員に対して数える（未回答の人も見えるように） */}
                  {submission ? (
                    <>
                      {" "}／ {SUBMISSION_STATE_LABEL.submitted} <Num value={submission.submitted} unit="人" /> ／{" "}
                      {SUBMISSION_STATE_LABEL.draft} <Num value={submission.draft} unit="人" /> ／{" "}
                      {SUBMISSION_STATE_LABEL.none} <Num value={submission.none} unit="人" />
                    </>
                  ) : (
                    <>
                      {" "}／ 回答 <Num value={Number(f.responseCount ?? 0)} unit="件" />
                    </>
                  )}
                </p>
                {allowed.share && (
                  <p className="footnote m-0 mt-1">
                    <CopyUrl url={formUrl(origin, f.publicToken)} />
                  </p>
                )}
                {responseCount > 0 && f.status !== "closed" && (
                  <p className="footnote m-0 mt-2">
                    すでに回答があるため、設問は変更できません。内容を変えるときは新しい版を作ってください（{FORM_STATUS_LABEL[f.status]}）。
                  </p>
                )}
              </SplitRow>

              {/* 設問0件の不足も publication.gaps に入っている（別の注意を重ねて出さない） */}
              {f.status === "draft" && !publication.ready && (
                <div className="mt-3">
                  <SetupGapList gaps={publication.gaps} title="公開する前に、次の設定が必要です" />
                </div>
              )}

              {/* 使うKPIを選ぶで選んだ項目と、このアンケートが聞いている項目の比べ（DD-012） */}
              {comparisonGap && (
                <div className="mt-3">
                  <ComparisonGapNotice gaps={[comparisonGap]} />
                </div>
              )}
            </Card>
          );})}
        </div>
      )}
    </>
  );
}
