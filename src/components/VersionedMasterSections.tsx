import type { ReactNode } from "react";
import { Badge, Button, CardRow, Disclosure } from "@/components/ui";
import {
  classifyVersionedRows,
  type HistoricalVersionRow,
} from "@/lib/domain/versioned-master";

export interface VersionedMasterItem {
  id: string;
  text: string;
  isActive: boolean;
  previousVersionId?: string | null;
}

export type HistoricalMasterItem<T extends VersionedMasterItem> = HistoricalVersionRow<T>;

/** 既存のUI呼び出しとの互換名。判定の実装はドメイン層だけに置く。 */
export const classifyVersionedItems = classifyVersionedRows;

export function VersionedMasterSections<T extends VersionedMasterItem>({
  sectionId,
  rows,
  busy,
  maxActive,
  renderDetail,
  renderStoppedAction,
  onReactivate,
  onRestoreContent,
}: {
  /** aria-describedby の重複を避ける、画面内で一意な短い名前。 */
  sectionId: string;
  rows: readonly T[];
  busy: boolean;
  /** 再開できる現行項目数の上限。上限なしなら省略する。 */
  maxActive?: number;
  renderDetail?: (row: T) => ReactNode;
  renderStoppedAction?: (row: T) => ReactNode;
  onReactivate: (row: T) => void;
  onRestoreContent: (item: HistoricalMasterItem<T>) => void;
}) {
  const { current, history } = classifyVersionedRows(rows);
  const stopped = current.filter((row) => !row.isActive);
  const activeCount = current.filter((row) => row.isActive).length;
  const reactivationBlocked = maxActive !== undefined && activeCount >= maxActive;
  const reasonId = `${sectionId}-reactivation-reason`;

  return (
    <>
      <Disclosure summary="以前使っていた項目" meta={`${stopped.length}件`}>
        <p className="footnote m-0">ここには、今後使わない現行項目が出ます。</p>
        <p className="footnote m-0 mt-1">再開は次に作るアンケートから反映されます。</p>
        {reactivationBlocked && stopped.length > 0 && (
          <p id={reasonId} className="footnote m-0 mt-2 text-danger">
            先に1項目を「今後使わない」にしてください。
          </p>
        )}
        {stopped.length === 0 ? (
          <p className="footnote m-0 mt-3">今後使わない項目はありません。</p>
        ) : (
          <div className="mt-2">
            {stopped.map((row) => (
              <CardRow
                key={row.id}
                title={row.text}
                detail={renderDetail?.(row)}
                off
                marks={
                  <div className="row-actions">
                    <Badge tone="closed">今後使わない</Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || reactivationBlocked}
                      aria-label={`「${row.text}」をもう一度使う`}
                      aria-describedby={reactivationBlocked ? reasonId : undefined}
                      onClick={() => onReactivate(row)}
                    >
                      もう一度使う
                    </Button>
                    {renderStoppedAction?.(row)}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Disclosure>

      <Disclosure summary="変更履歴" meta={`${history.length}件`}>
        <p className="footnote m-0">以前の内容は変更せず残っています。</p>
        <p className="footnote m-0 mt-1">選んだ内容をもとに、新版を作れます。</p>
        {history.length === 0 ? (
          <p className="footnote m-0 mt-3">変更履歴はありません。</p>
        ) : (
          <div className="mt-2">
            {history.map((item) => (
              <HistoryRow
                key={item.row.id}
                item={item}
                current={current.find((row) => row.id === item.currentId)}
                busy={busy}
                renderDetail={renderDetail}
                onRestoreContent={onRestoreContent}
                sectionId={sectionId}
              />
            ))}
          </div>
        )}
      </Disclosure>
    </>
  );
}

function HistoryRow<T extends VersionedMasterItem>({
  item,
  current,
  busy,
  renderDetail,
  onRestoreContent,
  sectionId,
}: {
  item: HistoricalMasterItem<T>;
  current?: T;
  busy: boolean;
  renderDetail?: (row: T) => ReactNode;
  onRestoreContent: (item: HistoricalMasterItem<T>) => void;
  sectionId: string;
}) {
  const restoreBlocked = current?.isActive === false;
  const reasonId = `${sectionId}-${item.row.id}-restore-reason`;
  return (
    <CardRow
      title={item.row.text}
      detail={
        <>
          {renderDetail?.(item.row)}
          {restoreBlocked && (
            <p id={reasonId} className="footnote m-0 mt-1 text-danger">
              先に現在版を「もう一度使う」にしてください。
            </p>
          )}
        </>
      }
      marks={
        <div className="row-actions">
          <Badge tone="dropped">過去版</Badge>
          <Button
            type="button"
            variant="tertiary"
            disabled={busy || restoreBlocked}
            aria-label={`「${item.row.text}」をもとに新版を作る`}
            aria-describedby={restoreBlocked ? reasonId : undefined}
            onClick={() => onRestoreContent(item)}
          >
            この内容をもとに新版を作る
          </Button>
        </div>
      }
    />
  );
}
