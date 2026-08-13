import { Badge, Card, CardHead, InlineDetail, LinkButton } from "@/components/ui";

export interface SetupAction {
  href: string;
  label: string;
}

export interface SetupStep {
  number: number;
  title: string;
  summary: string;
  current: string;
  complete: boolean;
  statusLabel: string;
  actions: SetupAction[];
  detail: string;
}

/**
 * 制度設定から評価結果までを、依存する順番で見せる。
 *
 * 件数の取得は page.tsx のサーバー側だけで行い、この部品は受け取った事実を
 * 静的に描くだけにする。details の開閉にも追加読み込みはない。
 */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="grid gap-3">
      {steps.map((step) => (
        <Card key={step.number} className="card-pad">
          <article data-setup-step={step.number}>
            <CardHead
              heading
              lead={
                <span
                  className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-deep"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
              }
              title={step.title}
              sub={step.summary}
              actions={<Badge tone={step.complete ? "done" : "alert"}>{step.statusLabel}</Badge>}
            />

            <p className="m-0 mt-3 text-sub">
              <span className="font-semibold">現在：</span>
              {step.current}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {step.actions.map((action, index) => (
                <LinkButton key={action.href} href={action.href} variant={index === 0 ? "primary" : "tertiary"}>
                  {action.label}
                </LinkButton>
              ))}
            </div>

            {/* 「なぜこの順番か」は進めるのに要らない。押したときだけ出す（畳む仕組みは共通部品に寄せる）。 */}
            <div className="mt-3 border-t border-line pt-3">
              <InlineDetail summary="この順番で進める理由">
                <p className="footnote m-0">{step.detail}</p>
              </InlineDetail>
            </div>
          </article>
        </Card>
      ))}
    </div>
  );
}
