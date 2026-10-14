import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { InlineDetail } from "@/components/ui";
import type { SetupGap } from "@/lib/domain/setup-gaps";

/**
 * 設定不足（S9・A8）を、画面ごとに1か所へまとめて出す。
 *
 * 1件ごとに「何が足りないか」「どう直すか」「直す画面へのリンク」をそろえて並べる。
 * 文だけを出すと、読んだ人がどこで何を直せばよいかを探すことになるため。
 * 不足が多いと画面の本文が埋もれるので、初めの3件だけを見せ、残りは開いて見る。
 * 見た目は ReasonNote と同じ注意の面（色だけでなく印でも示す）。
 */

const VISIBLE_COUNT = 3;

export function SetupGapList({
  gaps,
  title,
  action,
  children,
}: {
  gaps: readonly SetupGap[];
  /** まとめの見出し（例「公開する前に、次の設定が必要です」） */
  title?: ReactNode;
  /** その場で直せる操作（作り直すボタンなど）。リンク先へ行かずに済む場合だけ渡す */
  action?: ReactNode;
  /** 一覧のあとに添える補足（直さなくてよいものの説明など） */
  children?: ReactNode;
}) {
  if (gaps.length === 0) return null;
  const shown = gaps.slice(0, VISIBLE_COUNT);
  const rest = gaps.slice(VISIBLE_COUNT);

  return (
    <div className="caution-panel">
      <div className="flex min-w-0 items-start gap-2">
        <Icon name="info" className="reason-note-mark" />
        <div className="min-w-0 flex-1">
          {title && <p className="m-0 font-bold">{title}</p>}
          <GapItems gaps={shown} />
          {rest.length > 0 && (
            <div className="mt-2">
              <InlineDetail summary={`残り${rest.length}件を見る`}>
                <GapItems gaps={rest} />
              </InlineDetail>
            </div>
          )}
          {children}
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

function GapItems({ gaps }: { gaps: readonly SetupGap[] }) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {gaps.map((gap) => (
        <li key={`${gap.href}|${gap.what}`}>
          <p className="m-0 font-bold">{gap.what}</p>
          <p className="m-0">
            {gap.how}{" "}
            <Link href={gap.href} className="text-brand-deep">
              {gap.linkLabel}
            </Link>
          </p>
        </li>
      ))}
    </ul>
  );
}
