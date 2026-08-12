import Link from "next/link";
import { Badge, Card, CardRow } from "@/components/ui";
import {
  STALLED_KIND_LABEL,
  stalledHeadline,
  stalledHref,
  summarizeStalled,
  type StalledLevel,
  type StalledRow,
} from "@/lib/domain/stalled-evaluations";

/**
 * 「締め切ったのに確定されていない評価がある」ことの知らせ。
 *
 * 置き場所はホームのいちばん上。締め切られた期間は、どの一覧からも自然には出てこない
 * （ホームは開いている期間だけを見る作りになっている）ため、
 * わざわざ見に行かないと分からない場所に置くと今までと何も変わらない。
 *
 * 件数だけを大きく出さない。「誰の・どの期の・何日」を行として出し、
 * 押せばその評価そのものへ飛べるようにする。数字だけの知らせは、
 * 増えても減っても同じ見た目になり、じきに読まれなくなる。
 *
 * ここからは確定も削除もしない。行き先を示すだけで、扱いは人が決める。
 */

/** 度合いに応じた札。色だけに頼らず、必ず言葉を出す。 */
function LevelBadge({ level, days }: { level: StalledLevel; days: number }) {
  if (level === "long") return <Badge tone="alert">{days}日そのまま</Badge>;
  if (level === "overdue") return <Badge tone="required">{days}日経過</Badge>;
  return <Badge tone="active">{days}日経過</Badge>;
}

export function StalledEvaluationsNotice({
  rows,
  /** 一覧に出す上限。残りは件数だけ伝える */
  limit = 5,
  /** 全体を見に行く先。役割によって画面が違うので呼び出し側から渡す */
  moreHref = "/manager/cycles",
}: {
  rows: StalledRow[];
  limit?: number;
  moreHref?: string;
}) {
  if (rows.length === 0) return null;
  const summary = summarizeStalled(rows);
  const shown = rows.slice(0, limit);

  return (
    <Card className="card-pad">
      <p className="todo-row-title m-0 text-head">{stalledHeadline(summary)}</p>
      <p className="todo-row-sub m-0 mt-1">
        締め切った評価期間は、ふだんのホームには出てきません。ここに残っているものは、
        誰かが確定するまでご本人に結果が表示されないままになります。
      </p>
      <p className="m-0 mt-2 text-note text-[var(--ink-muted)]">
        内訳：確定待ち {summary.finalize}件 ／ 集計待ち {summary.build}件
        {summary.long > 0 && `（うち30日以上そのまま ${summary.long}件）`}
      </p>

      <div className="mt-3">
        {shown.map((row) => (
          <CardRow
            key={`${row.kind}-${row.cycleId}-${row.employeeId}`}
            title={
              <Link href={stalledHref(row)} className="text-[var(--brand-deep)]">
                {row.employeeName ?? "氏名未設定"}
              </Link>
            }
            sub={`${row.cycleName} ／ ${row.gradeName ?? "等級未設定"} ／ ${STALLED_KIND_LABEL[row.kind]}`}
            marks={<LevelBadge level={row.level} days={row.days} />}
          />
        ))}
      </div>

      {rows.length > shown.length && (
        <p className="footnote m-0 mt-2">
          ほか {rows.length - shown.length}件あります。
          <Link href={moreHref} className="ml-1 text-[var(--brand-deep)]">
            評価期間を選んで確認する
          </Link>
        </p>
      )}

      <p className="footnote m-0 mt-2">
        経過日数は、その評価期間の終了日から数えています。確定済みの評価と公開済みのアンケートは、
        この知らせでは何も変わりません。
      </p>
    </Card>
  );
}

/**
 * 会社ごとの件数だけを出す版（システム全体管理者のホーム）。
 *
 * 他社の個人名を、毎日開く画面へ常時並べない。誰の分かを見るときは
 * 操作する会社を切り替えてから会社の管理者の画面で確認する。
 */
export function StalledByCompanyNotice({
  companies,
}: {
  companies: { companyId: string; companyName: string; total: number; worstDays: number | null; long: number }[];
}) {
  if (companies.length === 0) return null;
  const total = companies.reduce((sum, c) => sum + c.total, 0);

  return (
    <Card className="card-pad">
      <p className="todo-row-title m-0 text-head">
        締め切った期間に、確定されていない評価が{total}件あります（{companies.length}社）
      </p>
      <p className="todo-row-sub m-0 mt-1">
        誰の分かを見るには、上の「操作する会社」でその会社に切り替えてから、会社のホームを開いてください。
      </p>
      <div className="mt-3">
        {companies.map((company) => (
          <CardRow
            key={company.companyId}
            title={company.companyName}
            sub={`確定されていない評価 ${company.total}件`}
            marks={
              company.long > 0 ? (
                <Badge tone="alert">最長 {company.worstDays}日</Badge>
              ) : (
                <Badge tone="required">最長 {company.worstDays}日</Badge>
              )
            }
          />
        ))}
      </div>
    </Card>
  );
}
