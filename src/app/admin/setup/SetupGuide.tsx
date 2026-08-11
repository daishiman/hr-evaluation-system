import { Badge, Card, LinkButton } from "@/components/ui";

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] font-bold text-[var(--brand-deep)]"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <div className="min-w-0">
                  <h2 className="todo-row-title m-0">{step.title}</h2>
                  <p className="todo-row-sub m-0 mt-1">{step.summary}</p>
                </div>
              </div>
              <Badge tone={step.complete ? "done" : "alert"}>{step.statusLabel}</Badge>
            </div>

            <p className="m-0 mt-3 text-[13px]">
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

            <details className="mt-3 border-t border-[var(--line)] pt-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-[var(--ink-muted)]">
                この順番で進める理由
              </summary>
              <p className="footnote m-0 mt-2">{step.detail}</p>
            </details>
          </article>
        </Card>
      ))}
    </div>
  );
}
