import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Bar, Card, CardHead, DefList, LinkButton, Num, PageTitle, ProvisionalMark, ReasonNote, SectionHeading } from "@/components/ui";
import { CYCLE_STATUS_LABEL, formatPeriod } from "@/lib/view";

export interface AdminDashboardSnapshot {
  companyName: string;
  memberCount: number;
  gradeCount: number;
  activeGradeRequirementCount: number;
  activePromotionRequirementCount: number;
  activeBehaviorGuidelineCount: number;
  behaviorAppliedGradeCount: number;
  kpiItemCount: number;
  hasActiveScheme: boolean;
  schemeItemCount: number;
  cycleCount: number;
  cycle: {
    id: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    status: string;
  } | null;
  hasOpenCycle: boolean;
  formCount: number;
  draftFormCount: number;
  publishedFormCount: number;
  respondentCount: number;
  submittedCount: number;
  evaluationCount: number;
  finalizedEvaluationCount: number;
  provisionalCount: number;
}

export interface DashboardAction {
  title: string;
  body: string;
  href: string;
  label: string;
}

export interface AdminDashboardModel {
  nextAction: DashboardAction;
  preparation: {
    completed: number;
    total: number;
    requirementsReady: boolean;
    behaviorReady: boolean;
    schemeReady: boolean;
  };
  operationState: "no_cycle" | "preparing_forms" | "waiting_responses" | "responses_ready";
  reviewState: "not_started" | "in_progress" | "complete";
}

/**
 * 次の一手は、この順番を飛ばさない。
 * 等級要件・昇格要件 → 行動指針 → KPI・評価セット → 評価期間 → アンケート。
 * その後だけ、回答回収と評価確定へ進める。
 */
export function buildAdminDashboardModel(snapshot: AdminDashboardSnapshot): AdminDashboardModel {
  const requirementsReady =
    snapshot.gradeCount > 0 &&
    snapshot.activeGradeRequirementCount > 0 &&
    snapshot.activePromotionRequirementCount > 0;
  const behaviorReady = snapshot.activeBehaviorGuidelineCount > 0 && snapshot.behaviorAppliedGradeCount > 0;
  const schemeReady = snapshot.kpiItemCount > 0 && snapshot.hasActiveScheme && snapshot.schemeItemCount > 0;
  const preparation = {
    completed: [requirementsReady, behaviorReady, schemeReady].filter(Boolean).length,
    total: 3,
    requirementsReady,
    behaviorReady,
    schemeReady,
  };

  const formsHref = snapshot.cycle ? `/admin/forms?cycle=${snapshot.cycle.id}` : "/admin/forms";
  let nextAction: DashboardAction;
  if (snapshot.gradeCount === 0) {
    nextAction = {
      title: "等級と要件の土台を確認します",
      body: "アンケートの対象になる等級がまだありません。最初に制度の土台を整えます。",
      href: "/admin/masters",
      label: "等級・昇格の設定を確認する",
    };
  } else if (snapshot.activeGradeRequirementCount === 0) {
    nextAction = {
      title: "等級要件を確認します",
      body: "支援・運営について、アンケートで確認する項目を等級ごとに決めます。",
      href: "/admin/masters/requirements",
      label: "等級要件を確認する",
    };
  } else if (snapshot.activePromotionRequirementCount === 0) {
    nextAction = {
      title: "昇格要件を確認します",
      body: "点数だけでは決められない、報告書やテストなどの条件を確認します。",
      href: "/admin/masters",
      label: "昇格要件を確認する",
    };
  } else if (!behaviorReady) {
    nextAction = {
      title: "行動指針を確認します",
      body: "どの等級に、どの行動指針を適用するかを確認します。",
      href: "/admin/masters",
      label: "行動指針を確認する",
    };
  } else if (snapshot.kpiItemCount === 0) {
    nextAction = {
      title: "KPIの基準を確認します",
      body: "成果を何で測るかを確認してから、評価セットを組みます。",
      href: "/admin/masters",
      label: "KPIの基準を確認する",
    };
  } else if (!schemeReady) {
    nextAction = {
      title: "評価セットを整えます",
      body: "等級区分ごとに、今回の評価で使う項目を選びます。",
      href: "/admin/scheme",
      label: "評価セットを設定する",
    };
  } else if (!snapshot.hasOpenCycle) {
    nextAction = {
      title: "次の評価期間を用意します",
      body:
        snapshot.cycleCount > 0
          ? "いま開いている評価期間がありません。次の半期を作成・開始します。"
          : "制度の準備ができました。次に、運用する半期の期間を作ります。",
      href: "/admin/cycles",
      label: "評価期間を設定する",
    };
  } else if (snapshot.formCount === 0) {
    nextAction = {
      title: "等級ごとのアンケートを作ります",
      body: "評価期間と制度の内容から、回答してもらうアンケートを作ります。",
      href: formsHref,
      label: "アンケートを作る",
    };
  } else if (snapshot.draftFormCount > 0 || snapshot.publishedFormCount === 0) {
    nextAction = {
      title: "アンケートの中身を確認して公開します",
      body: `下書きが${snapshot.draftFormCount}件あります。設問文・答え方・選択肢を確認してから公開します。`,
      href: formsHref,
      label: "アンケートを確認する",
    };
  } else if (snapshot.memberCount === 0 || snapshot.respondentCount === 0) {
    nextAction = {
      title: "回答する方を確認します",
      body: "アンケートは公開済みです。社員の等級と利用状態を確認します。",
      href: "/admin/members",
      label: "社員を確認する",
    };
  } else if (snapshot.submittedCount < snapshot.respondentCount) {
    nextAction = {
      title: "アンケートの回答状況を確認します",
      body: `対象${snapshot.respondentCount}人のうち、${snapshot.submittedCount}人が提出済みです。`,
      href: formsHref,
      label: "回答状況を見る",
    };
  } else if (snapshot.evaluationCount === 0) {
    nextAction = {
      title: "提出済みの回答を集計します",
      body: "回答がそろいました。評価を作成し、判定内容を確認します。",
      href: "/manager/cycles",
      label: "評価を集計する",
    };
  } else if (snapshot.finalizedEvaluationCount < snapshot.evaluationCount) {
    nextAction = {
      title: "確認中の評価を確定します",
      body: `${snapshot.evaluationCount - snapshot.finalizedEvaluationCount}件の評価が確認中です。`,
      href: "/manager/cycles",
      label: "評価を確認する",
    };
  } else {
    nextAction = {
      title: "この期の運用は完了しています",
      body: "提出と評価確定まで完了しています。必要に応じて確定済みの内容を確認できます。",
      href: "/manager/cycles",
      label: "確定した評価を見る",
    };
  }

  const operationState: AdminDashboardModel["operationState"] = !snapshot.hasOpenCycle
    ? "no_cycle"
    : snapshot.publishedFormCount === 0 || snapshot.draftFormCount > 0
      ? "preparing_forms"
      : snapshot.respondentCount > 0 && snapshot.submittedCount >= snapshot.respondentCount
        ? "responses_ready"
        : "waiting_responses";
  const reviewState: AdminDashboardModel["reviewState"] =
    snapshot.evaluationCount === 0
      ? "not_started"
      : snapshot.finalizedEvaluationCount >= snapshot.evaluationCount
        ? "complete"
        : "in_progress";

  return { nextAction, preparation, operationState, reviewState };
}

const OPERATION_LABEL: Record<AdminDashboardModel["operationState"], string> = {
  no_cycle: "期間の準備前",
  preparing_forms: "公開準備中",
  waiting_responses: "回答受付中",
  responses_ready: "回答がそろいました",
};

const REVIEW_LABEL: Record<AdminDashboardModel["reviewState"], string> = {
  not_started: "集計前",
  in_progress: "確認中",
  complete: "確定済み",
};

export function AdminDashboard({ snapshot }: { snapshot: AdminDashboardSnapshot }) {
  const model = buildAdminDashboardModel(snapshot);
  const unfinalized = Math.max(0, snapshot.evaluationCount - snapshot.finalizedEvaluationCount);

  return (
    <>
      <PageTitle
        title={`${snapshot.companyName}の管理`}
        lede="制度を整え、アンケートを配り、評価を確定するまでの現在地です。"
      />

      <section aria-labelledby="admin-next-action">
        <Card className="card-pad hero-tint">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Badge tone="active">次の一手</Badge>
              {/* この画面で唯一の「視覚的な主役」。節見出し（SectionHeading・13px）ではなく
                  本文より大きい文字で出す意図的な例外。ほかの画面に増やさない。 */}
              <h2 id="admin-next-action" className="m-0 mt-2 text-[18px] font-bold">
                {model.nextAction.title}
              </h2>
              <p className="m-0 mt-1 text-[13px] text-[var(--ink-muted)]">{model.nextAction.body}</p>
            </div>
            <LinkButton href={model.nextAction.href} variant="primary">
              {model.nextAction.label}
            </LinkButton>
          </div>
        </Card>
      </section>

      <section aria-labelledby="admin-progress-heading">
        <SectionHeading>
          <span id="admin-progress-heading">進め方と現在地</span>
        </SectionHeading>
        <div className="card-grid card-grid-3">
          <StageCard
            number="1"
            title="制度準備"
            badge={model.preparation.completed === model.preparation.total ? "準備済み" : "要確認"}
            badgeTone={model.preparation.completed === model.preparation.total ? "done" : "required"}
          >
            <Bar value={model.preparation.completed} max={model.preparation.total} label="準備できた設定" />
            <div className="mt-3">
              <DefList
                rows={[
                  stateRow(
                    "等級要件・昇格要件",
                    `${snapshot.activeGradeRequirementCount}件・${snapshot.activePromotionRequirementCount}件`,
                    model.preparation.requirementsReady,
                  ),
                  stateRow(
                    "行動指針",
                    `${snapshot.activeBehaviorGuidelineCount}観点・適用${snapshot.behaviorAppliedGradeCount}等級`,
                    model.preparation.behaviorReady,
                  ),
                  stateRow(
                    "KPI・評価セット",
                    model.preparation.schemeReady ? "設定あり" : "要確認",
                    model.preparation.schemeReady,
                  ),
                ]}
              />
            </div>
          </StageCard>

          <StageCard
            number="2"
            title="評価運用"
            badge={OPERATION_LABEL[model.operationState]}
            badgeTone={model.operationState === "responses_ready" ? "done" : "active"}
          >
            <Bar value={snapshot.submittedCount} max={snapshot.respondentCount} label="提出済み" />
            <div className="mt-3">
              <DefList
                rows={[
                  stateRow(
                    "評価期間",
                    snapshot.cycle
                      ? `${snapshot.cycle.name}（${CYCLE_STATUS_LABEL[snapshot.cycle.status] ?? snapshot.cycle.status}）`
                      : "未設定",
                    snapshot.hasOpenCycle,
                  ),
                  stateRow(
                    "公開アンケート",
                    `${snapshot.publishedFormCount} / ${snapshot.formCount}件`,
                    snapshot.publishedFormCount > 0 && snapshot.draftFormCount === 0,
                  ),
                  stateRow("回答対象", `${snapshot.respondentCount}人`, snapshot.respondentCount > 0),
                ]}
              />
            </div>
          </StageCard>

          <StageCard
            number="3"
            title="確認"
            badge={REVIEW_LABEL[model.reviewState]}
            badgeTone={model.reviewState === "complete" ? "done" : model.reviewState === "in_progress" ? "active" : "closed"}
          >
            <Bar value={snapshot.finalizedEvaluationCount} max={snapshot.evaluationCount} label="確定済み" />
            <div className="mt-3">
              <DefList
                rows={[
                  stateRow("作成された評価", `${snapshot.evaluationCount}件`, snapshot.evaluationCount > 0),
                  stateRow("確認中", `${unfinalized}件`, snapshot.evaluationCount > 0 && unfinalized === 0),
                  stateRow(
                    "確定済み",
                    `${snapshot.finalizedEvaluationCount}件`,
                    snapshot.evaluationCount > 0 && unfinalized === 0,
                  ),
                ]}
              />
            </div>
          </StageCard>
        </div>
      </section>

      {snapshot.cycle && (
        <Card className="card-pad mt-4">
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">表示中の評価期間</p>
          <p className="m-0 mt-1 text-[14px] font-bold">
            {snapshot.cycle.name} ／ {formatPeriod(snapshot.cycle.periodStart, snapshot.cycle.periodEnd)}
          </p>
          <p className="m-0 mt-2 text-[13px]">
            社員 <Num value={snapshot.memberCount} unit="人" /> ／ 公開アンケート{" "}
            <Num value={snapshot.publishedFormCount} unit="件" /> ／ 未確定評価 <Num value={unfinalized} unit="件" />
          </p>
        </Card>
      )}

      {snapshot.provisionalCount > 0 && (
        <div className="mt-4">
          <ReasonNote action={<LinkButton href="/admin/masters">等級・昇格の設定で確認する</LinkButton>}>
            <ProvisionalMark /> の設定が{snapshot.provisionalCount}件あります。運用前に昇格条件・昇給額を確認してください。
          </ReasonNote>
        </div>
      )}

      <details className="mt-5 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-bold">設定する順番と役割を確認する</summary>
        <p className="m-0 mt-2 text-[12px] text-[var(--ink-muted)]">
          後の設定は前の設定を使って作られます。迷ったときは上から順に確認してください。
        </p>
        <ol className="m-0 mt-3 grid list-decimal gap-2 pl-5 text-[13px]">
          <li>
            <Link href="/admin/masters/requirements" className="text-[var(--brand-deep)]">等級要件</Link>・
            <Link href="/admin/masters" className="text-[var(--brand-deep)]">昇格要件</Link> — 何を満たすかを決める
          </li>
          <li>
            <Link href="/admin/masters" className="text-[var(--brand-deep)]">行動指針</Link> — どの等級に適用するかを決める
          </li>
          <li>
            <Link href="/admin/masters" className="text-[var(--brand-deep)]">KPIの基準</Link>・
            <Link href="/admin/scheme" className="text-[var(--brand-deep)]">評価セット</Link> — 測る項目を決める
          </li>
          <li>
            <Link href="/admin/cycles" className="text-[var(--brand-deep)]">評価期間</Link> — 今回の半期を作る
          </li>
          <li>
            <Link href="/admin/forms" className="text-[var(--brand-deep)]">アンケート</Link> — 内容を確認して公開する
          </li>
        </ol>
      </details>
    </>
  );
}

function StageCard({
  number,
  title,
  badge,
  badgeTone,
  children,
}: {
  number: string;
  title: string;
  badge: string;
  badgeTone: "active" | "done" | "closed" | "required";
  children: ReactNode;
}) {
  return (
    <Card className="card-pad">
      {/* 手順の札つきカードの頭。制度設定ガイド（SetupGuide）と同じ組み方にそろえている。 */}
      <CardHead
        heading
        lead={<span className="num text-[var(--ink-muted)]">{number}</span>}
        title={title}
        actions={<Badge tone={badgeTone}>{badge}</Badge>}
      />
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/**
 * 現在地カードの1行（DefList に渡す形）。
 * 「準備済み／要確認」は色や太さでは伝わらないので、読み上げ用の語を値の頭に付ける。
 */
function stateRow(label: string, value: string, ready: boolean) {
  return {
    label,
    value: (
      <span className="font-bold">
        <span className="sr-only">{ready ? "準備済み: " : "要確認: "}</span>
        {value}
      </span>
    ),
  };
}
