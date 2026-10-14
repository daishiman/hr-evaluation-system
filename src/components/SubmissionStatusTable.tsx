import type { ComponentProps, ReactNode } from "react";
import { Badge, ChipLink } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import {
  SUBMISSION_STATE_LABEL,
  SUBMISSION_STATES,
  filterSubmissionRows,
  type SubmissionCounts,
  type SubmissionFilter,
  type SubmissionState,
} from "@/lib/domain/submission-status";
import { formatDateTime } from "@/lib/view";

/**
 * 提出状況の一覧（S8・A7）。対象者全員を、提出済み・入力途中・未回答のどれかと提出日時つきで並べる。
 *
 * 状態の絞り込みは URL（?status=）で持つ。サーバーで描く一覧なので、絞った状態をそのまま共有・再読み込みできる。
 * 件数は絞り込む前の全員ぶんを出す（絞り込んでも「全体で何人中何人か」が分かるように）。
 */

const STATE_TONE: Record<SubmissionState, NonNullable<ComponentProps<typeof Badge>["tone"]>> = {
  submitted: "done",
  draft: "active",
  none: "required",
};

export function SubmissionStateBadge({ state }: { state: SubmissionState }) {
  return <Badge tone={STATE_TONE[state]}>{SUBMISSION_STATE_LABEL[state]}</Badge>;
}

type Row = { employeeId: string; name: string; state: SubmissionState; submittedAt: Date | null };

export function SubmissionStatusTable<T extends Row>({
  rows,
  counts,
  filter,
  filterHref,
  caption,
  nameCell,
  columns = [],
}: {
  rows: readonly T[];
  counts: SubmissionCounts;
  filter: SubmissionFilter;
  /** 絞り込みのリンク先。いまの画面の他の条件（評価期間など）を残したまま status だけを変える */
  filterHref: (filter: SubmissionFilter) => string;
  /** 表が何の一覧かを読み上げに伝える一文 */
  caption: string;
  /** 氏名の欄（回答へのリンクなど）。省略すると名前だけ */
  nameCell?: (row: T) => ReactNode;
  /** 状態・提出日時のあとに足す列 */
  columns?: Column<T>[];
}) {
  const shown = filterSubmissionRows(rows, filter);
  const filters: { key: SubmissionFilter; label: string; count: number }[] = [
    { key: "all", label: "全員", count: counts.total },
    ...SUBMISSION_STATES.map((state) => ({ key: state, label: SUBMISSION_STATE_LABEL[state], count: counts[state] })),
  ];

  return (
    <>
      <nav aria-label="状態で絞り込む" className="mb-3 flex flex-wrap gap-2">
        {filters.map((f) => (
          <ChipLink key={f.key} href={filterHref(f.key)} current={f.key === filter}>
            {f.label} {f.count}人
          </ChipLink>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="footnote">「{filters.find((f) => f.key === filter)?.label}」の方はいません。</p>
      ) : (
        <DataTable
          caption={caption}
          rows={shown}
          rowKey={(r) => r.employeeId}
          columns={[
            { key: "name", header: "氏名", role: "title", cell: (r) => (nameCell ? nameCell(r) : r.name) },
            { key: "state", header: "状況", role: "mark", cell: (r) => <SubmissionStateBadge state={r.state} /> },
            { key: "submittedAt", header: "提出日時", cell: (r) => formatDateTime(r.submittedAt) },
            ...columns,
          ]}
        />
      )}
    </>
  );
}
