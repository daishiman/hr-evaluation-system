"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, ChoiceChip, ReasonNote, SectionHeading } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useRefreshAfterSave } from "@/lib/use-refresh";
import { DataTable, type Column } from "@/components/DataTable";
import { type ImprovementStatus } from "@/lib/domain/improvement";
import { improvementKindLabel, type ImprovementKind } from "@/lib/domain/improvement-instruction";
import {
  bulkActionLabel,
  bulkActionTone,
  bulkSummaryText,
  handoutStateLabel,
  handoutStateTone,
  plannedAction,
  summarizeBulk,
  type BulkAction,
  type HandoutState,
} from "@/lib/domain/improvement-handout";
import {
  bulkDispositionConfirm,
  dispositionActionLabel,
  dispositionNeedsReason,
  dispositionReasonError,
  improvementDisplayState,
  improvementDisplayStateLabel,
  improvementDisplayStateTone,
  reasonChoices,
  type DispositionAction,
} from "@/lib/domain/improvement-disposition";

/** 一覧の1行。画面で使う形まで整えたものをサーバーから受け取る。 */
export interface ImprovementRow {
  id: string;
  headline: string;
  screenLabel: string;
  reporterName: string;
  createdAtText: string;
  kind: ImprovementKind;
  status: ImprovementStatus;
  discarded: boolean;
  duplicateOfId: string | null;
  stateNote: string;
  handoutState: HandoutState;
  handoutNote: string;
  off: boolean;
}

interface BulkResult {
  id: string;
  label: string;
  action: BulkAction;
  reason: string;
}

/** まとめて選べる操作。指示文を払い出すのと、落とす・戻すを同じ場所から行う。 */
type BulkOperation = "handout" | DispositionAction;

/**
 * 届いた要望の一覧と、そこからのまとめ操作。
 *
 * 使われる場面: 週に一度まとめて読み、直すものを作業する側へ渡し、
 * 直さないもの・誤って届いたものをその場で片付ける。
 * 1件ずつ詳細を開く作りだと、20件で20往復する。だから
 *  ・行を見比べる表（状態・払い出し・種類が縦に並ぶ）
 *  ・選んだぶんをまとめて処理する
 *  ・処理のあと、行ごとに何が起きたかを表で返す
 * の3つをこの1画面で完結させる。
 *
 * 見えなくする操作（廃棄）も、まとめての払い出しも、1件も選ばれていない
 * 状態から始める。手間を省く操作だけを既定にする。
 */
export function ImprovementBulkTable({
  rows,
  canHandOut,
  canDispose,
}: {
  rows: ImprovementRow[];
  canHandOut: boolean;
  canDispose: boolean;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, setPending] = useState<DispositionAction | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const lastIndex = useRef(-1);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const selectable = canHandOut || canDispose;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Shift を押しながらだと、前に触った行からここまでをまとめて選ぶ。 */
  const clickRow = useCallback(
    (index: number, shiftKey: boolean) => {
      if (shiftKey && lastIndex.current >= 0) {
        const [a, b] = [lastIndex.current, index].sort((x, y) => x - y);
        setSelected((prev) => new Set([...prev, ...rows.slice(a, b + 1).map((r) => r.id)]));
      } else {
        toggle(rows[index].id);
      }
      lastIndex.current = index;
    },
    [rows, toggle],
  );

  const openPanel = (action: DispositionAction) => {
    setPending(action);
    setReasonCode(reasonChoices(action)[0]?.code ?? "");
    setReasonNote("");
  };

  /**
   * 選んだぶんを、順番に1件ずつ処理する。
   * まとめて1回で送らないのは、どこまで進んだかを件数で見せるため。
   * 済んだ分はその場で確定し、失敗した行だけをやり直せる。
   */
  const run = async (targets: string[], operation: BulkOperation) => {
    if (targets.length === 0 || progress || refreshing) return;
    setResults(null);
    setProgress({ done: 0, total: targets.length });
    const collected: BulkResult[] = [];
    for (const id of targets) {
      const row = rows.find((r) => r.id === id);
      try {
        const res = await fetch("/api/improvements", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            operation === "handout" ? { id, action: "handout" } : { id, action: operation, reasonCode, reasonNote },
          ),
        });
        const json = (await res.json()) as { ok?: boolean; result?: BulkResult; message?: string };
        if (res.ok && json.ok && json.result) collected.push(json.result);
        else {
          collected.push({
            id,
            label: row?.headline ?? id,
            action: "failed",
            reason: json.message ?? "処理できませんでした。",
          });
        }
      } catch {
        collected.push({
          id,
          label: row?.headline ?? id,
          action: "failed",
          reason: "通信できませんでした。この行だけやり直せます。",
        });
      }
      // 済んだ分はここで確定している。途中でやめても、済んだものは残る。
      setProgress({ done: collected.length, total: targets.length });
      setResults([...collected]);
    }
    setProgress(null);
    setSelected(new Set());
    setPending(null);
    // 一覧はサーバー側で作っている。処理しただけでは古いままなので作り直させ、
    // 終わるまで「反映しています…」を出す（読み直しに走らせない）。
    refresh();
  };

  /** 選んだぶんの指示文を払い出す（まとめ払い出しと、失敗した行のやり直しの両方で使う）。 */
  const send = (ids: string[]) => run(ids, "handout");

  const chosen = rows.filter((r) => selected.has(r.id));
  const count = (plan: string) => chosen.filter((r) => plannedAction(r.handoutState) === plan).length;

  // 理由の判定は画面とサーバーで同じ関数を使う（片方だけ緩い状態を作らない）。
  // 足りないうちは実行ボタンを押せなくし、何が足りないかをその場に出す。
  const reasonError = pending ? dispositionReasonError(pending, reasonCode, reasonNote) : null;

  const columns: Column<ImprovementRow>[] = [
    {
      key: "body",
      role: "title",
      header: selectable ? (
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
            aria-label="表示中の要望をすべて選ぶ"
          />
          要望
        </span>
      ) : (
        "要望"
      ),
      cell: (r) => (
        <span className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => undefined}
              onClick={(e) => clickRow(rows.indexOf(r), e.shiftKey)}
              aria-label={`この要望を選ぶ：${r.headline}`}
            />
          )}
          <Link href={`/admin/improvements/${r.id}`} className="min-w-0">
            {r.headline}
          </Link>
        </span>
      ),
    },
    {
      key: "kind",
      role: "mark",
      header: "種類",
      cell: (r) => <Badge tone={r.kind === "bug" ? "alert" : "closed"}>{improvementKindLabel(r.kind)}</Badge>,
    },
    {
      key: "status",
      header: "対応状況",
      cell: (r) => {
        const state = improvementDisplayState(r);
        return (
          <>
            <Badge tone={improvementDisplayStateTone(state)}>{improvementDisplayStateLabel(state)}</Badge>
            {r.stateNote && <span className="footnote">{r.stateNote}</span>}
          </>
        );
      },
    },
    {
      key: "handout",
      header: "払い出し",
      cell: (r) => (
        <>
          <Badge tone={handoutStateTone(r.handoutState)}>{handoutStateLabel(r.handoutState)}</Badge>
          <span className="footnote">{r.handoutNote}</span>
        </>
      ),
    },
    { key: "screen", header: "画面", cell: (r) => r.screenLabel },
    { key: "reporter", header: "送った人", cell: (r) => r.reporterName },
    { key: "at", header: "届いた日時", cell: (r) => r.createdAtText },
  ];

  const failed = (results ?? []).filter((r) => r.action === "failed");

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowOff={(r) => r.off}
        caption="届いた改善要望の一覧"
      />

      {pending && (
        <>
          <SectionHeading help="理由は履歴に残り、あとから読み返せます。">
            {dispositionNeedsReason(pending) ? `${dispositionActionLabel(pending)}にする理由` : "実行の確認"}
          </SectionHeading>
          <Card className="card-pad">
            {reasonError && <ReasonNote>{reasonError}</ReasonNote>}
            <p className="footnote m-0">{`選んだ${chosen.length}件をまとめて処理します。`}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {reasonChoices(pending).map((r) => (
                <ChoiceChip
                  key={r.code}
                  selected={reasonCode === r.code}
                  onClick={() => {
                    setReasonCode(r.code);
                  }}
                >
                  {r.label}
                </ChoiceChip>
              ))}
            </div>
            <label className="footnote mt-3 block" htmlFor="bulk_reason_note">
              補足（その他を選んだときは必須）
            </label>
            <textarea
              id="bulk_reason_note"
              className="input min-h-[64px] w-full"
              value={reasonNote}
              maxLength={1000}
              onChange={(e) => {
                setReasonNote(e.target.value);
              }}
              placeholder="例：同じ内容を先週まとめて直しました。"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmButton
                label={`${chosen.length}件に実行する`}
                variant={pending === "discard" ? "danger-outline" : "primary"}
                disabled={progress !== null || refreshing || reasonError !== null || chosen.length === 0}
                confirm={bulkDispositionConfirm(pending, chosen.length)}
                onConfirm={() => void run(chosen.map((r) => r.id), pending)}
              >
                <Button type="button" variant="tertiary" disabled={progress !== null || refreshing} onClick={() => setPending(null)}>
                  やめる
                </Button>
              </ConfirmButton>
            </div>
          </Card>
        </>
      )}

      {results && (
        <>
          <SectionHeading help="処理した1件ずつの結果です。">処理の結果</SectionHeading>
          <RefreshStatus message={bulkSummaryText(summarizeBulk(results))} refreshing={refreshing} />
          <DataTable
            caption="まとめ処理の結果"
            rows={results}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "label",
                role: "title",
                header: "対象",
                cell: (r) => <Link href={`/admin/improvements/${r.id}`}>{r.label}</Link>,
              },
              {
                key: "action",
                role: "mark",
                header: "実行内容",
                cell: (r) => <Badge tone={bulkActionTone(r.action)}>{bulkActionLabel(r.action)}</Badge>,
              },
              { key: "reason", header: "理由", cell: (r) => r.reason },
            ]}
          />
          {failed.length > 0 && (
            <ReasonNote
              action={
                <Button
                  type="button"
                  variant="secondary"
                  disabled={progress !== null || refreshing}
                  onClick={() => send(failed.map((r) => r.id))}
                >
                  {`失敗した${failed.length}件をやり直す`}
                </Button>
              }
            >
              できなかった行があります。理由を直してからやり直してください。
            </ReasonNote>
          )}
        </>
      )}

      {selectable && selected.size > 0 && (
        <StickyActionBar
          status={
            progress
              ? `処理しています（${progress.done}/${progress.total}件目）`
              : `${selected.size}件を選択中／払い出し${count("handout")}・再払い出し${count("rehandout")}・スキップ${count("skip")}`
          }
        >
          <Button type="button" variant="tertiary" disabled={progress !== null || refreshing} onClick={() => setSelected(new Set())}>
            選択をすべて解除
          </Button>
          {canDispose && (
            <>
              <Button type="button" variant="secondary" disabled={progress !== null || refreshing} onClick={() => openPanel("restore")}>
                元に戻す
              </Button>
              <Button type="button" variant="secondary" disabled={progress !== null || refreshing} onClick={() => openPanel("reject")}>
                対応しない
              </Button>
              <Button
                type="button"
                variant="danger-outline"
                disabled={progress !== null || refreshing}
                onClick={() => openPanel("discard")}
              >
                廃棄する
              </Button>
            </>
          )}
          {canHandOut && (
            <Button
              type="button"
              variant="primary"
              disabled={progress !== null || refreshing}
              onClick={() => send(chosen.map((r) => r.id))}
            >
              {progress ? "処理しています…" : `${selected.size}件をまとめて払い出す`}
            </Button>
          )}
        </StickyActionBar>
      )}
    </>
  );
}
