import Link from "next/link";
import { Badge, Card, CardRow } from "@/components/ui";
import { selfLockedHeadline, type SelfLockedRow } from "@/lib/domain/self-locked-evaluations";

/**
 * 「本人が確定できず、確定を頼まれている評価」の知らせ（会社の管理者のホーム）。
 *
 * 対象者本人は自分の評価を確定できず（`src/lib/domain/evaluation-authority.ts`）、
 * かつ上長が未設定・または上長が本人自身になっているため、頼める先が記録の上に無い分。
 * 会社の管理者自身がこの状態に当てはまることもある（自社に管理者が1人だけの会社など）。
 * その場合はここに出したうえで、押した先の画面（`/manager/evaluations/{id}`）が
 * 確定できない理由をそのまま表示する。
 *
 * ここからは確定も差し戻しもしない。行き先を示すだけ。
 */
export function SelfLockedEvaluationsNotice({
  rows,
  /** 一覧に出す上限。残りは件数だけ伝える */
  limit = 8,
}: {
  rows: SelfLockedRow[];
  limit?: number;
}) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, limit);

  return (
    <Card className="card-pad">
      <p className="todo-row-title m-0 text-head">{selfLockedHeadline(rows.length)}</p>
      <p className="todo-row-sub m-0 mt-1">
        上長が未設定か、上長がご本人と同じで、ご本人では確定できません。
      </p>
      <p className="todo-row-sub m-0 mt-1">別の方（会社の管理者など）が代わりに確定してください。</p>

      <div className="mt-3">
        {shown.map((row) => (
          <CardRow
            key={row.evaluationId}
            title={
              <Link href={`/manager/evaluations/${row.evaluationId}`} className="text-brand-deep">
                {row.employeeName ?? "氏名未設定"}
              </Link>
            }
            sub={`${row.cycleName} ／ ${row.gradeName ?? "等級未設定"}`}
            marks={<Badge tone="required">確定待ち</Badge>}
          />
        ))}
      </div>

      {rows.length > shown.length && (
        <p className="footnote m-0 mt-2">ほか {rows.length - shown.length}件あります。</p>
      )}
    </Card>
  );
}
