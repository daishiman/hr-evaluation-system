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
/**
 * 読むだけの窓（押すと開く「詳しく」）。
 *
 * 長い説明・手順・書式の決まりは、画面に置きっぱなしにすると
 * 毎回そこを読み飛ばす手間になる（発注者の指摘、2026-08-12）。
 * かといって消すことはできない（＝情報は減らさず、見せ方だけ変える）。
 * そこで「押したら読み切れる場所に出す」形にする。
 *
 * その場で開く（InlineDetail）と使い分ける基準は、
 * **読み切る必要があるか**。手順・書式のように上から順に読むものはこちら。
 * 行の中の一言で足りるものは InlineDetail。
 *
 * 窓（<dialog>）を書いてよいのはこのファイルだけ、という決まりを守るため
 * ConfirmButton と同じ場所に置く（ui-rules.test.ts の検査）。
 * Esc で閉じる・背面を触らせない・開いた先へフォーカスを移すはブラウザに任せる。
 */
export function DetailDialogButton({
  label,
  title,
  variant = "tertiary",
  children,
}: {
  /** 押す場所の文言。何が出るか分かる言葉にする（「詳しく」だけにしない）。 */
  label: string;
  /** 窓の見出し。 */
  title: string;
  variant?: "primary" | "secondary" | "tertiary";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-label={title}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="confirm-dialog-body">
          {/* 長い説明はここだけがスクロールする。閉じるボタンは窓の中に残す */}
          <div className="confirm-dialog-text">
            <p className="detail-dialog-title m-0">{title}</p>
            {children}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" autoFocus onClick={() => setOpen(false)}>
              閉じる
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

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
          {/* 長い確認文はここだけがスクロールする。ボタンは窓の中に残す */}
          <div className="confirm-dialog-text">
            <p className="m-0 text-sub">{confirm}</p>
          </div>
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
