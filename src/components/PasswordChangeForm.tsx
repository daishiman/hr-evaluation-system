"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ReasonNote } from "@/components/ui";

/**
 * パスワードの変更。
 *
 * 入力欄は3つだけにし、判定は「欄から離れたとき」に出す（打っている途中で赤くしない）。
 * Enter は次の欄へ移り、送信はボタンだけで行う（打ち間違いのまま送らないため）。
 */
export function PasswordChangeForm() {
  const router = useRouter();
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const nextError =
    touched.next && next.length > 0 && next.length < 10 ? "10文字以上にしてください。" : null;
  const confirmError =
    touched.confirm && confirm.length > 0 && confirm !== next ? "新しいパスワードと一致していません。" : null;

  const submit = async () => {
    setError(null);
    setDone(null);
    if (!current || !next || !confirm) {
      setTouched({ current: true, next: true, confirm: true });
      setError("3つとも入力してください。");
      return;
    }
    if (next.length < 10) {
      setTouched((t) => ({ ...t, next: true }));
      setError("新しいパスワードは10文字以上にしてください。");
      return;
    }
    if (next !== confirm) {
      setTouched((t) => ({ ...t, confirm: true }));
      setError("新しいパスワードと確認用が一致していません。");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "変更できませんでした。");
        return;
      }
      setDone(json.message ?? "パスワードを変更しました。");
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched({});
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  const enterMovesTo = (el: HTMLInputElement | null) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.nativeEvent as KeyboardEvent).isComposing) {
      e.preventDefault();
      el?.focus();
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className="field">
        <label htmlFor="current">いまのパスワード</label>
        <input
          id="current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={enterMovesTo(nextRef.current)}
        />
      </div>

      <div className={`field ${nextError ? "has-error" : ""}`}>
        <label htmlFor="next">新しいパスワード（10文字以上）</label>
        <input
          id="next"
          ref={nextRef}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            if (touched.next) setTouched((t) => ({ ...t, next: false }));
          }}
          onBlur={() => setTouched((t) => ({ ...t, next: true }))}
          onKeyDown={enterMovesTo(confirmRef.current)}
        />
        {nextError && <p className="error-msg">{nextError}</p>}
      </div>

      <div className={`field ${confirmError ? "has-error" : ""}`}>
        <label htmlFor="confirm">新しいパスワード（確認）</label>
        <input
          id="confirm"
          ref={confirmRef}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (touched.confirm) setTouched((t) => ({ ...t, confirm: false }));
          }}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
        />
        {confirmError && <p className="error-msg">{confirmError}</p>}
      </div>

      {error && <ReasonNote>{error}</ReasonNote>}
      {done && (
        <p className="m-0 text-[13px] text-[var(--brand-deep)]" role="status">
          {done}
        </p>
      )}

      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "変更しています…" : "パスワードを変更する"}
        </Button>
      </div>
    </form>
  );
}
