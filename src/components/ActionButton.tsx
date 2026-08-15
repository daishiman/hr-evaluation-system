"use client";

import { useState, type ReactNode } from "react";
import { Button, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useRefreshAfterSave } from "@/lib/use-refresh";

/**
 * サーバーに1回だけ送る操作のボタン。
 *
 * 取り消しのきかない操作（確定・締め切り・削除）には confirm を渡し、
 * 「何が起きるか」をその場に出してから実行する。確認は1回だけにする。
 */
export function ActionButton({
  url,
  method = "POST",
  body,
  label,
  confirm,
  variant = "primary",
  onDoneMessage,
  children,
}: {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  body: Record<string, unknown>;
  label: string;
  /** 実行前に出す確認文。省略すると即実行。 */
  confirm?: string;
  variant?: "primary" | "secondary" | "tertiary";
  onDoneMessage?: string;
  children?: ReactNode;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "実行できませんでした。");
        return;
      }
      setResult(onDoneMessage ?? json.message ?? "完了しました。");
      refresh();
    } catch {
      setError("通信できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
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
        refreshing={refreshing}
        target="画面"
        className="m-0 mb-2 max-w-[22rem] text-note text-brand-deep"
      />
      {confirm ? (
        <ConfirmButton
          label={label}
          confirm={confirm}
          variant={variant}
          busy={busy || refreshing}
          busyLabel={busy ? "実行しています…" : "画面に反映しています…"}
          onConfirm={() => void run()}
        >
          {children}
        </ConfirmButton>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={variant} disabled={busy || refreshing} onClick={() => void run()}>
            {busy ? "実行しています…" : refreshing ? "画面に反映しています…" : label}
          </Button>
          {children}
        </div>
      )}
    </div>
  );
}
