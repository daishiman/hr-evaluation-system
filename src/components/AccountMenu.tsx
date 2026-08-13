"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/auth-client";

/**
 * 右上の自分のアイコン。押すと自分のことだけがまとまって出る。
 *
 * 平常時に出しておくのは「丸いアイコン」だけ。名前・メール・役割・会社と、
 * 自分の情報／パスワード／ログアウトは、押したときに初めて見せる。
 * ヘッダーは全画面に出るので、ここに文字を置くと全画面の読む量が増えるため。
 */
export function AccountMenu({
  userId,
  name,
  email,
  roleLabel,
  companyContextLabel,
  needsPasswordChange,
}: {
  userId: string;
  name: string;
  email: string;
  roleLabel: string;
  /** 例: 「操作中: ○○社」「所属: ○○社」。意味を誤認しない、文脈込みの表示。 */
  companyContextLabel: string | null;
  needsPasswordChange: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 画面を移ったら閉じる（開いたまま残って本文を隠さないように）
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      // 背景などフォーカスできない場所を押した場合だけ、現在地をトリガーへ戻す。
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) triggerRef.current?.focus();
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      // ポップオーバー内のリンクが消えても、キーボードの現在地を失わない。
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={boxRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-trigger pressable"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={popoverId}
        // 絵だけのボタンになるので、読み上げと吹き出しに用件を必ず持たせる
        aria-label={`${name}さんのアカウント`}
        title={`${name}さんのアカウント`}
      >
        <Avatar name={name} seed={userId} size={30} />
        {needsPasswordChange && <span className="account-dot" aria-hidden />}
        <Icon name="chevron" size={14} className="account-caret" />
      </button>

      {open && (
        <div id={popoverId} className="account-pop pop-in" role="region" aria-label="アカウントメニュー">
          <div className="account-pop-head">
            <Avatar name={name} seed={userId} size={40} />
            <div className="min-w-0">
              <p className="m-0 truncate text-body font-semibold">{name}</p>
              <p className="m-0 truncate text-note text-[var(--ink-muted)]">{email}</p>
            </div>
          </div>

          <div className="account-pop-tags">
            <span className="tag">
              <Icon name="shield" size={13} />
              {roleLabel}
            </span>
            {companyContextLabel && (
              <span className="tag">
                <Icon name="building" size={13} />
                {companyContextLabel}
              </span>
            )}
          </div>

          {needsPasswordChange && (
            <p className="account-pop-alert">
              仮のパスワードのままです。あなただけが知っているものに変えてください。
            </p>
          )}

          {/* 見た目の設定は「自分のこと」なので、ヘッダーに出さずここへ置く。
              メニューを閉じていても、このアイコンからは必ず辿り着ける。 */}
          <div className="account-pop-theme">
            <p className="account-pop-theme-label">画面の明るさ</p>
            <ThemeToggle />
          </div>

          <div className="account-pop-links">
            <Link href="/account" className="account-pop-link no-underline">
              <Icon name="user" size={16} />
              自分の情報
            </Link>
            <Link href="/account/password" className="account-pop-link no-underline">
              <Icon name="lock" size={16} />
              パスワードを変える
            </Link>
            <button
              type="button"
              className="account-pop-link account-pop-signout"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await signOut();
                  if (result.error) throw new Error(result.error.message);
                  router.replace("/login");
                  router.refresh();
                } catch {
                  setError("ログアウトできませんでした。通信状況を確認して、もう一度お試しください。");
                  setBusy(false);
                }
              }}
            >
              <Icon name="signout" size={16} />
              {busy ? "ログアウトしています…" : "ログアウト"}
            </button>
          </div>
          {error && (
            <p
              className="m-0 mt-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-2 py-1 text-note"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
