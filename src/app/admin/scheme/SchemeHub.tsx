import type { ReactNode } from "react";
import { SettingsFollowScope } from "@/components/SettingsFollowScope";
import { Badge, Bar, Card, CardHead, DefList, Disclosure, LinkButton, Num, PageTitle, SectionHeading } from "@/components/ui";
import { KPI_ITEMS_PATH, overallProgress, schemeStepPath, stepTitle, type GroupProgress } from "@/lib/domain/scheme-steps";
import type { SchemeGroup } from "./data";

/**
 * KPI・評価セットの入口の見た目（DD-027）。
 *
 * 置くのは「等級区分ごとのカード」と「ほかの作業（共通の設定・KPI項目・KPIカテゴリ）への入口」だけ。
 * 以前はこの1画面に、共通の設定・KPI項目の一覧と追加・カテゴリの一覧まで積んでいて、
 * どこで何をするのかを読み取るのに縦に長く送る必要があった。作業ごとに画面を分け、
 * ここはどこへ行けばよいかを選ぶだけの画面にしている。
 *
 * データは page.tsx が読んで渡す。ここは描くだけにして、表示を DB なしで確かめられるようにしている
 * （guideline-kpi-disclosure.test.ts）。
 */

export type SchemeHubGroup = Pick<SchemeGroup, "pointGroup" | "label" | "gradeNames" | "progress">;

/** カードの右上の札。終わっているか、どの手順の途中か（文を読まなくても分かるように） */
function stateBadge(p: GroupProgress): ReactNode {
  if (p.done) return <Badge tone="done">設定済み</Badge>;
  if (p.selectedCount === 0) return <Badge tone="required">未着手</Badge>;
  return p.nextStep === "criteria" ? (
    <Badge tone="required">基準が未設定</Badge>
  ) : (
    <Badge tone="active">KPIを選ぶ途中</Badge>
  );
}

function raiseRuleLabel(raiseRequiresAllA: boolean | null): string {
  if (raiseRequiresAllA === null) return "評価セットが未登録";
  return raiseRequiresAllA ? "昇給の条件：選んだ項目がすべてA" : "昇給の条件：配点の満点と同じ点数";
}

export function SchemeHub({
  notices,
  groups,
  raiseRequiresAllA,
  items,
  categoryCount,
}: {
  /** 見出しの下に出す知らせ（古くなった評価期間・配点の決まりの食い違い・未登録） */
  notices?: ReactNode;
  groups: SchemeHubGroup[];
  /** 評価セットが無ければ null */
  raiseRequiresAllA: boolean | null;
  /** KPI項目の数（使う＝使用中・全部） */
  items: { active: number; total: number };
  categoryCount: number;
}) {
  /* 区分は鍵（pointGroup）で照合し、文には等級名から作った呼び名（label）を出す */
  const labelOf = (pointGroup: string) => groups.find((g) => g.pointGroup === pointGroup)?.label ?? "";
  const overall = overallProgress(
    groups.map((g) => g.progress),
    labelOf,
  );

  return (
    <>
      <PageTitle title="KPI・評価セット" lede="等級区分ごとに、評価に使うKPIと基準を決めます。" />
      {notices}

      {groups.length > 0 && (
        <>
          <div className="mt-3">
            <Bar value={overall.done} max={overall.total} label="等級区分の設定が完了" />
            <p className="mt-2 text-sub">{overall.summary}</p>
          </div>

          <section aria-labelledby="scheme-groups-heading">
            <SectionHeading>
              <span id="scheme-groups-heading">等級区分ごとの設定</span>
            </SectionHeading>
            {/* 次に手をつける区分のボタンだけを主にする（主の操作は1つの面に1つ） */}
            <div className="card-grid">
              {groups.map((g) => {
                const p = g.progress;
                const step = p.nextStep ?? "select";
                return (
                  <Card key={g.pointGroup} className="card-pad">
                    <CardHead heading title={g.label} actions={stateBadge(p)} />
                    <div className="mt-3">
                      <DefList
                        rows={[
                          {
                            // 等級名は差し込みで長いので「・」でつながず、並びで出す
                            label: "等級",
                            value:
                              g.gradeNames.length === 0 ? (
                                "未登録"
                              ) : (
                                <ul className="m-0 list-disc pl-5">
                                  {g.gradeNames.map((name) => (
                                    <li key={name}>{name}</li>
                                  ))}
                                </ul>
                              ),
                          },
                          {
                            label: "使うKPI",
                            value: (
                              <>
                                <Num value={p.selectedCount} unit="件" /> / {p.expectedCount}件
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
                          ...(p.done ? [] : [{ label: "次にやること", value: p.nextAction }]),
                        ]}
                      />
                    </div>
                    <p className="card-foot m-0 mt-3">
                      <LinkButton
                        variant={overall.nextGroup === g.pointGroup ? "primary" : "secondary"}
                        href={schemeStepPath(g.pointGroup, step)}
                      >
                        {p.done ? `${g.label}の設定を見直す` : `${g.label}の${stepTitle(step)}`}
                      </LinkButton>
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="scheme-others-heading">
        <SectionHeading>
          <span id="scheme-others-heading">ほかの設定</span>
        </SectionHeading>
        <div className="card-grid card-grid-3">
          <OtherCard title="全等級区分に共通の設定" sub={raiseRuleLabel(raiseRequiresAllA)} href="/admin/scheme/common" open="共通の設定を開く" />
          <OtherCard title="KPI項目" sub={`使う ${items.active}件・全 ${items.total}件`} href={KPI_ITEMS_PATH} open="KPI項目を開く" />
          <OtherCard title="KPIカテゴリ" sub={`${categoryCount}件`} href="/admin/scheme/categories" open="KPIカテゴリを開く" />
        </div>
      </section>

      <Disclosure summary="変更が反映される範囲">
        <SettingsFollowScope kinds={["scheme"]} />
      </Disclosure>
    </>
  );
}

/** ほかの作業への入口のカード。中身はその画面で見るので、ここは数と状態の1行だけ */
function OtherCard({ title, sub, href, open }: { title: string; sub: string; href: string; open: string }) {
  return (
    <Card className="card-pad">
      <CardHead heading title={title} sub={sub} />
      <p className="card-foot m-0 mt-3">
        <LinkButton href={href}>{open}</LinkButton>
      </p>
    </Card>
  );
}
