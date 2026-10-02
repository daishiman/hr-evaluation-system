import { Icon } from "@/components/Icon";

/**
 * 保存できたことと、Server Component の画面へ反映し終えたことを分けて伝える。
 *
 * 保存を送ってから、応答に同梱された新しい画面を描き終えるまでの待ち時間は、
 * 画面ごとに書き分けず、この短い live region に集約する。
 * refreshing には useSaveAction の saving（その間ずっと true）を渡す。
 * 操作を押せなくする責務は、対象ボタンの `disabled={saving}`（または busy）が持つ。
 */
export function RefreshStatus({
  message,
  refreshing,
  target = "一覧",
  className = "m-0 text-sub text-brand-deep",
}: {
  message: string | null;
  refreshing: boolean;
  target?: string;
  className?: string;
}) {
  if (!message && !refreshing) return null;

  return (
    <p className={className} role="status" aria-live="polite" aria-busy={refreshing}>
      {refreshing ? (
        <>
          {message ? `${message} ` : ""}
          {target}に反映しています…
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="success" size={14} />
          {message}
        </span>
      )}
    </p>
  );
}
