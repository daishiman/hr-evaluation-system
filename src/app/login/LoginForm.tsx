"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui";

/**
 * ログイン。
 * メール欄の Enter はパスワード欄へ移動し、パスワード欄の Enter で送信する
 * （ログインはやり直しがきく操作なので、慣習どおり Enter を受ける）。
 * 日本語入力の変換確定 Enter では送信しない。
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const pwRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailError = touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "メールアドレスの形式で入力してください。" : null;

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setTouched({ email: true, password: true });
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    setBusy(true);
    const res = await signIn.email({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (res.error) {
      setError("メールアドレスかパスワードが違います。もう一度お試しください。");
      return;
    }
    router.replace(next ?? "/");
    router.refresh();
  }

  return (
    <form
      className="card card-pad grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className={`field ${emailError ? "has-error" : ""}`}>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          value={email}
          autoComplete="username"
          inputMode="email"
          enterKeyHint="next"
          autoFocus
          onChange={(e) => {
            setEmail(e.target.value);
            if (touched.email) setTouched((t) => ({ ...t, email: false }));
          }}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              pwRef.current?.focus();
            }
          }}
        />
        {emailError && <p className="error-msg">{emailError}</p>}
      </div>

      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          ref={pwRef}
          type="password"
          value={password}
          autoComplete="current-password"
          enterKeyHint="go"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="badge-alert m-0 rounded-md px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? "確認中…" : "ログイン"}
      </Button>

      <p className="footnote m-0">
        パスワードが分からない場合は、会社の管理者に再発行を依頼してください。
      </p>
    </form>
  );
}
