import { requireRole } from "@/lib/session";
import { Badge, Bar, EmptyState, LinkButton, Num, PageTitle, ReasonNote, RecordList, SectionHeading } from "@/components/ui";
import { detectStaleCycles } from "@/lib/impact";
import { StaleCyclesNotice } from "@/components/StaleCyclesNotice";
import { checkGradePointRule } from "@/lib/domain/grade-points";
import { overallProgress, schemeStepPath, stepTitle } from "@/lib/domain/scheme-steps";
import { loadSchemeSetup } from "./data";
import { SchemeCommonSettings } from "@/components/SchemeCommonSettings";

export const dynamic = "force-dynamic";

/**
 * KPI・評価セットの入口。会社の管理者のみ。
 *
 * この画面の目的は1つだけ：**どの等級区分を設定するかを選ぶ**。
 * 実際の設定（使うKPIを選ぶ／基準を決める）は等級区分ごとの手順画面で行う。
 *
 * 以前はこの1画面で「等級区分の切り替え・配点の確認・項目の選択・基準の編集・KPIの比較」を
 * 同時にやらせていて、何をする画面なのか分からなくなっていた（2026-08-11 の指摘）。
 */
export default async function AdminSchemePage() {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;

  const [setup, staleCycles] = await Promise.all([loadSchemeSetup(viewer.companyId), detectStaleCycles(viewer.companyId)]);

  if (!setup.scheme) {
    return (
      <>
        <PageTitle title="KPI・評価セット" />
        <StaleCyclesNotice cycles={staleCycles} />
        <ReasonNote>有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
      </>
    );
  }

  if (setup.groups.length === 0) {
    return (
      <>
        <PageTitle title="KPI・評価セット" />
        <StaleCyclesNotice cycles={staleCycles} />
        <ReasonNote>等級区分ごとの配点ルールが登録されていません。初期データの投入をご確認ください。</ReasonNote>
      </>
    );
  }

  const overall = overallProgress(setup.groups.map((g) => g.progress));

  /* 配点の型そのものが壊れていると、どう選んでも保存できない状態になる。
     「保存できない」とだけ出すと画面の不具合に見えるため、原因をここで名指しする。 */
  const ruleErrors = setup.groups.flatMap((g) => checkGradePointRule(g.rule));

  return (
    <>
      <PageTitle
        title="KPI・評価セット"
        lede="等級区分ごとに、評価に使うKPIと、その項目の基準を決めます。1つの等級区分につき2つの手順に分かれています。設定した内容は、次に作るアンケートと集計に使われます。"
      />
      <StaleCyclesNotice cycles={staleCycles} />

      {ruleErrors.length > 0 && (
        <ReasonNote>
          <p className="m-0 font-bold">配点の決まりに食い違いがあります（このままでは保存できません）</p>
          <ul className="m-0 list-disc pl-5">
            {ruleErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </ReasonNote>
      )}

      <div className="mt-3">
        <Bar value={overall.done} max={overall.total} label="等級区分の設定が完了" />
        <p className="mt-2 text-sub">{overall.summary}</p>
        {overall.nextGroup && (
          <p className="m-0 mt-2">
            <LinkButton variant="primary" href={schemeStepPath(overall.nextGroup, "select")}>
              {overall.nextGroup} の設定を始める
            </LinkButton>
          </p>
        )}
      </div>

      <SectionHeading help="上から順に設定します。設定済みの等級区分も、押せばいつでも見直せます。">
        等級区分ごとの設定
      </SectionHeading>

      <RecordList
        items={setup.groups.map((g) => {
          const p = g.progress;
          const step = p.nextStep ?? "select";
          return {
            key: g.pointGroup,
            title: (
              <>
                {g.pointGroup}
                <span className="unit"> （{g.gradeLabel}）</span>
              </>
            ),
            marks: p.done ? <Badge tone="done">設定済み</Badge> : <Badge tone="required">設定が未完了</Badge>,
            rows: [
              {
                label: "使うKPI",
                value: (
                  <>
                    <Num value={p.selectedCount} unit="件" /> / {p.expectedCount}件
                    {p.selectionDone ? "" : "（選び終わっていません）"}
                  </>
                ),
              },
              {
                label: "配点の合計",
                value: (
                  <>
                    <Num value={p.totalPoints} unit="点" /> / {p.maxPoints}点
                  </>
                ),
              },
              {
                label: "基準（A〜E）",
                value:
                  !p.selectionDone ? (
                    "項目を選んでから設定します"
                  ) : p.unratedCount > 0 ? (
                    <>
                      未設定 <Num value={p.unratedCount} unit="件" />
                    </>
                  ) : (
                    "設定済み"
                  ),
              },
            ],
            note: <>次にやること：{p.nextAction}</>,
            action: (
              <LinkButton
                variant={overall.nextGroup === g.pointGroup ? "primary" : "secondary"}
                href={schemeStepPath(g.pointGroup, step)}
              >
                {p.done ? `${g.pointGroup} の設定を見直す` : `${g.pointGroup} の${stepTitle(step)}`}
              </LinkButton>
            ),
          };
        })}
      />

      <SectionHeading help="等級区分ごとではなく、会社全体で1つだけ決める設定です。">
        全等級区分に共通の設定
      </SectionHeading>
      <SchemeCommonSettings schemeId={setup.scheme.id} raiseRequiresAllA={setup.scheme.raiseRequiresAllA} />

      <p className="footnote mt-4">
        確定済みの評価は判定した当時の配点・基準のまま残ります。ここでの変更は、次に作るアンケートと、
        まだ確定していない評価にだけ反映されます。
      </p>
    </>
  );
}
