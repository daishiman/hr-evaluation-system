"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

/**
 * 取り消しのきかない操作の「1回だけの確認」。
 *
 * ブラウザの confirm ダイアログは使わない。何が起きるかを画面のその場に出し、
 * 押す前に読めるようにする（ux-design §3 摩擦の非対称性）。
 * 確認は1回だけ。2回3回に増やすと読まれなくなる。
 *
 * 画面ごとに確認の出し方を変えないため、確認つきのボタンはすべてこれを通す。
 */
export function ConfirmButton({
  label,
  confirm,
  variant = "primary",
  disabled,
  busy,
  busyLabel = "実行しています…",
  onConfirm,
  children,
}: {
  label: string;
  /** 実行前に出す確認文。「何が起きるか」「何が残るか」を書く。 */
  confirm: ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "danger-outline";
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  /** 確認を出していないときにボタンの横に並べるもの。 */
  children?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div className="rounded-lg border border-[var(--caution-border)] bg-[var(--caution-soft)] p-3">
        <p className="m-0 text-[13px]">{confirm}</p>
        <div className="mt-2 flex gap-2">
          <Button
            variant={variant}
            disabled={busy}
            onClick={() => {
              setAsking(false);
              onConfirm();
            }}
          >
            {busy ? busyLabel : label}
          </Button>
          <Button onClick={() => setAsking(false)}>やめる</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={variant} disabled={disabled || busy} onClick={() => setAsking(true)}>
        {busy ? busyLabel : label}
      </Button>
      {children}
    </div>
  );
}
