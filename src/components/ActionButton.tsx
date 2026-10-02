"use client";

import { useState, type ReactNode } from "react";
import { Button, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RefreshStatus } from "@/components/RefreshStatus";
import type { SaveAction } from "@/lib/action-result";
import type { FreshnessResource } from "@/lib/freshness";
import { useSaveAction } from "@/lib/use-refresh";

/**
 * サーバーに1回だけ送る操作のボタン。
 *
 * 取り消しのきかない操作（確定・締め切り・削除）には confirm を渡し、
 * 「何が起きるか」をその場に出してから実行する。確認は1回だけにする。
 * 送り先は Server Action（action）。成功の応答に実行後の画面が同梱される。
 */
export function ActionButton({
  action,
  resource,
  input,
  label,
  confirm,
  variant = "primary",
  onDoneMessage,
  children,
}: {
  /** 実行する Server Action（src/actions/*） */
  action: SaveAction<Record<string, unknown>>;
  /** 変わるものの種類。他のタブへの知らせと利用状況の集計に使う */
  resource: FreshnessResource;
  /** 一緒に送る値（対象のIDなど） */
  input: Record<string, unknown>;
  label: string;
  /** 実行前に出す確認文。省略すると即実行。 */
  confirm?: string;
  variant?: "primary" | "secondary" | "tertiary";
  onDoneMessage?: string;
  children?: ReactNode;
}) {
  const { save, saving } = useSaveAction(action, { resource });
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setResult(null);
    const outcome = await save(input);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setResult(onDoneMessage ?? outcome.message);
  };

  return (
    /* 一覧の行の中に置かれることがある。実行の結果やエラーの文が幅を要求すると
       行の本文が潰れるので、通知は幅の上限を持たせて折り返す。 */
    <div className="min-w-0 max-w-full">
      {error && (
        <div className="mb-2 max-w-[22rem]">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {/* 実行できたことと、画面へ出し終えたことを分けて出す（RecordForm と同じ作法） */}
      <RefreshStatus
        message={result}
        refreshing={saving}
        target="画面"
        className="m-0 mb-2 max-w-[22rem] text-note text-brand-deep"
      />
      {confirm ? (
        <ConfirmButton
          label={label}
          confirm={confirm}
          variant={variant}
          busy={saving}
          busyLabel="実行しています…"
          onConfirm={() => void run()}
        >
          {children}
        </ConfirmButton>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={variant} disabled={saving} onClick={() => void run()}>
            {saving ? "実行しています…" : label}
          </Button>
          {children}
        </div>
      )}
    </div>
  );
}
