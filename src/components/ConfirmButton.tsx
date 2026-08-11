"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

/**
 * 取り消しのきかない操作の「1回だけの確認」。
 *
 * ブラウザの confirm ダイアログは使わない。何が起きるかを自分たちの言葉で出し、
 * 押す前に読めるようにする（ux-design §3 摩擦の非対称性）。
 * 確認は1回だけ。2回3回に増やすと読まれなくなる。
 *
 * **確認文は行の中に展開しない。**
 * 一覧の行（.card-row）はボタンが並ぶ側が shrink-0 で、そこに長い文章の箱を
 * 差し込むと本文側（.row-main は min-width: 0）が 0 まで潰れ、1文字ずつ縦に
 * 折り返される。行の幅に左右されない中央のダイアログで出すことで、
 * 「置き場所を用意し忘れた行だけ崩れる」という壊れ方を構造的に無くす。
 *
 * <dialog> を使うのは、Esc で閉じる・背面を触らせない・開いた先にフォーカスを移す
 * といった作法をブラウザに任せるため（画面ごとに実装しない）。
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (asking && !d.open) d.showModal();
    if (!asking && d.open) d.close();
  }, [asking]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant={variant} disabled={disabled || busy} onClick={() => setAsking(true)}>
        {busy ? busyLabel : label}
      </Button>
      {children}
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-label={`${label}の確認`}
        /* Esc・背景クリックのどちらで閉じても、開いているかの控えを合わせる */
        onClose={() => setAsking(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setAsking(false);
        }}
      >
        <div className="confirm-dialog-body">
          <p className="m-0 text-[13px]">{confirm}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" autoFocus onClick={() => setAsking(false)}>
              やめる
            </Button>
            <Button
              type="button"
              variant={variant}
              disabled={busy}
              onClick={() => {
                setAsking(false);
                onConfirm();
              }}
            >
              {busy ? busyLabel : label}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
