import Link from "next/link";
import { DetailDialogButton } from "@/components/ConfirmButton";
import {
  Badge,
  Bar,
  Card,
  CardHead,
  CardRow,
  Disclosure,
  EmptyState,
  LinkButton,
  Num,
  PageTitle,
  SectionHeading,
} from "@/components/ui";
import { gradeLabel } from "@/lib/domain/grade-label";
import { conclusionText, DECISION_SUBJECTS, finalDecisionOf, type DecisionKind } from "@/lib/domain/final-decision";

export interface MyActionForm {
  formId: string;
  title: string;
  cycleName: string | null;
  questionCount: number;
  responseStatus: string | null;
  deadlineLabel: string | null;
  daysUntilDeadline: number | null;
}

export interface MyResultSummary {
  id: string;
  cycleName: string | null;
  gradeName: string | null;
  requirementRate: number | null;
  requirementAchieved: number | null;
  requirementTotal: number | null;
  raiseEligible: boolean;
  promotionEligible: boolean;
  raiseDecision: DecisionKind | null;
  promotionDecision: DecisionKind | null;
}

/**
 * 回答するアンケートの1枚。
 * wide は横幅いっぱいに置くとき（1件だけのとき）で、「どのアンケートか」を左、「締切と回答への入口」を右に並べる
 * （下の「自分の結果」と同じ分け方。カードが狭ければ左寄せで縦に積む）。
 * 並べるときは高さをそろえ、ボタンをカードの下端にそろえる。
 */
export function FormActionCard({ form, primary, wide = false }: { form: MyActionForm; primary: boolean; wide?: boolean }) {
  const what = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="todo-row-title m-0 text-strong">{form.title}</p>
        <Badge tone={form.responseStatus === "draft" ? "active" : "required"}>
          {form.responseStatus === "draft" ? "入力途中" : "未着手"}
        </Badge>
      </div>
      <p className="todo-row-sub m-0 mt-1">
        {form.cycleName ?? "評価期間"} ／ 全{form.questionCount}問
      </p>
    </>
  );
  const deadline = form.deadlineLabel && (
    <p className="m-0 mt-3 text-note">
      回答締切：<strong>{form.deadlineLabel}</strong>
      {form.daysUntilDeadline !== null && (
        <span className="text-ink-muted">
          {form.daysUntilDeadline === 0 ? "（本日）" : `（あと${form.daysUntilDeadline}日）`}
        </span>
      )}
    </p>
  );
  const action = (
    <LinkButton href={`/me/forms/${form.formId}`} variant={primary ? "primary" : "secondary"}>
      {form.responseStatus === "draft" ? "続きから回答する" : "回答を始める"}
    </LinkButton>
  );
  const className = `card-pad${primary ? " hero-tint" : ""}`;
  if (wide) {
    return (
      <Card className={`${className} split-host`}>
        <div className="split-row">
          <div className="split-main">{what}</div>
          <div className="split-aside">
            {deadline}
            <div className="mt-3">{action}</div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className={className}>
      {what}
      {deadline}
      <div className="card-foot">{action}</div>
    </Card>
  );
}

/**
 * 回答するアンケートの並び。マネージャー・会社管理者のホーム（自分自身の未提出アンケート）でも同じ見え方にするため公開する。
 * 1件だけのときは2列の枠に入れない。左の列にだけ置くと、右半分が空いたまま残る（S13・A12）。
 */
export function FormActionList({ forms }: { forms: MyActionForm[] }) {
  if (forms.length === 1) return <FormActionCard form={forms[0]} primary wide />;
  return (
    <div className="card-grid">
      {forms.map((form, index) => (
        <FormActionCard key={form.formId} form={form} primary={index === 0} />
      ))}
    </div>
  );
}

/** 昇給・昇格の最終の結論。上司が変えたときは「（上司の判断）」の語で示す（色だけで区別しない。DD-024） */
function ResultBadges({ result }: { result: MyResultSummary }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DECISION_SUBJECTS.map((subject) => {
        const fd = finalDecisionOf(subject, result);
        return (
          <Badge key={subject} tone={fd.approved ? "active" : "done"}>
            {conclusionText(subject, fd)}
          </Badge>
        );
      })}
    </div>
  );
}

export function MyDashboard({
  viewerName,
  cycleName,
  actionableForms,
  latestSubmittedForm,
  results,
  gradeAssigned,
}: {
  viewerName: string;
  cycleName: string | null;
  actionableForms: MyActionForm[];
  latestSubmittedForm: { formId: string; title: string } | null;
  results: MyResultSummary[];
  gradeAssigned: boolean;
}) {
  const latest = results[0] ?? null;
  const previous = results.slice(1);

  return (
    <>
      <PageTitle
        title={`${viewerName} さんの評価ページ`}
        lede={cycleName ? `${cycleName}の回答と、自分に公開された評価結果を確認できます。` : "回答するアンケートと、自分に公開された評価結果を確認できます。"}
        /* 画面の読み方は見出しの右に置く。画面の末尾に畳んでおくと、読む前に見つからない */
        actions={
          <DetailDialogButton label="この画面に表示される内容" title="この画面に表示される内容">
            <p className="m-0">アンケートは入力途中でも自動保存されます。</p>
            <p className="m-0 mt-1">評価結果には、結論だけでなく判定の理由も残ります。</p>
            <p className="m-0 mt-1">自分が提出した回答も、あとから見返せます。</p>
            <p className="m-0 mt-1">評価基準の配点や、昇格に必要な点数は表示されません。</p>
          </DetailDialogButton>
        }
      />

      {/* 一覧への入口は見出しの右端に常に置く（回答対象が無いときも、提出済みを見返せる） */}
      <SectionHeading aside={<Link href="/me/forms" className="footnote">アンケート一覧を見る</Link>}>今やること</SectionHeading>
      {actionableForms.length > 0 ? (
        <FormActionList forms={actionableForms} />
      ) : latestSubmittedForm ? (
        <Card className="card-pad hero-tint">
          <CardHead
            title={
              <>
                {latestSubmittedForm.title} <Badge tone="done">提出済み</Badge>
              </>
            }
            sub="提出は完了しています。評価が確定すると、この下に結果が表示されます。"
            actions={<LinkButton href={`/me/forms/${latestSubmittedForm.formId}`}>提出した内容を見る</LinkButton>}
          />
        </Card>
      ) : (
        <EmptyState
          title="いま回答するアンケートはありません"
          body={
            gradeAssigned
              ? "新しいアンケートが公開されると、ここに回答ボタンと締切が表示されます。"
              : "等級が設定されていないため、アンケートが割り当てられていません。会社の管理者に確認してください。"
          }
        />
      )}

      <SectionHeading aside={results.length > 0 && <Link href="/me/results" className="footnote">すべての結果を見る</Link>}>
        自分の結果
      </SectionHeading>
      {!latest ? (
        <EmptyState
          title="確定した評価はまだありません"
          body="上長の確認が済んで評価が確定すると、結果と理由をここから確認できます。"
        />
      ) : (
        <Card className="card-pad">
          {/* 広い画面では「どの評価か」を左、「達成率と結果への入口」を右に並べ、右側が空いたまま縦に長くならないようにする（S13・A12）。
              狭い画面では左→右の順に縦に積む。 */}
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 md:items-start">
            <div className="min-w-0">
              <p className="m-0 text-note text-ink-muted">最新の評価</p>
              <p className="todo-row-title m-0 mt-1 text-head">{latest.cycleName ?? "評価結果"}</p>
              <p className="todo-row-sub m-0">{gradeLabel({ name: latest.gradeName })}</p>
              <div className="mt-3"><ResultBadges result={latest} /></div>
            </div>
            <div className="min-w-0">
              {latest.requirementRate !== null ? (
                <Bar value={latest.requirementRate} max={100} label="等級要件の達成率（%）" />
              ) : (
                <p className="footnote m-0">等級要件の達成率は判定対象外です。</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {latest.requirementRate !== null && (
                  <p className="m-0 text-sub">
                    <Num value={latest.requirementAchieved} /> / <Num value={latest.requirementTotal} /> 項目を達成
                  </p>
                )}
                <LinkButton href={`/me/results/${latest.id}`} variant="primary" className="ml-auto">結果と理由を見る</LinkButton>
              </div>
            </div>
          </div>

          {previous.length > 0 && (
            <div className="mt-5">
              <Disclosure summary="過去の結果を見る" meta={`${previous.length}件`}>
                <div className="p-0 text-ink">
                  {previous.map((result) => (
                    <CardRow
                      key={result.id}
                      title={
                        <Link href={`/me/results/${result.id}`} className="text-brand-deep">
                          {result.cycleName ?? "評価結果"}
                        </Link>
                      }
                      sub={
                        <>
                          {gradeLabel({ name: result.gradeName })} ／ 等級要件の達成率{" "}
                          <Num value={result.requirementRate} unit="%" />
                        </>
                      }
                      marks={<ResultBadges result={result} />}
                    />
                  ))}
                </div>
              </Disclosure>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
