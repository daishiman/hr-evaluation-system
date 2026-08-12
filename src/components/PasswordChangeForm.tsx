"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton, ReasonNote } from "@/components/ui";
import { Icon } from "@/components/Icon";

/**
 * パスワードの変更。
 *
 * この画面の作法（他の入力画面と同じ）:
 * - 条件は**打ち込む前から**見せる。打ってから初めて怒られない（rule-list）。
 * - 判定は「欄から離れたとき」に出し、直している最中は消す。
 * - Enter は次の欄へ移り、送信はボタンだけ（打ち間違いのまま送らない）。
 * - 何が足りないかは具体的に言う。ただし「いまのパスワード」が合っているかどうかの
 *   詳しい理由はサーバーの言い方のまま出す（総当たりの手掛かりを増やさない）。
 *
 * 決まり事の値（10文字以上）は api/account/password と同じものを**表示のためだけに**持つ。
 * ここを変えても実際の判定は変わらない（判定はサーバーが行う）。
 */
const MIN_LENGTH = 10;
const MAX_LENGTH = 200;

export function PasswordChangeForm() {
  const router = useRouter();
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  /** 送信中に二重で押されても2回送らないための札（setState は間に合わないことがある） */
  const sending = useRef(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // 新しいパスワードが満たすべき条件。画面の表示と送信前の確認で同じものを見る。
  const rules = [
    { key: "len", label: `${MIN_LENGTH}文字以上（いまは${next.length}文字）`, met: next.length >= MIN_LENGTH && next.length <= MAX_LENGTH },
    { key: "diff", label: "いまのパスワードとは違うもの", met: next.length > 0 && next !== current },
    { key: "same", label: "確認用と同じ", met: confirm.length > 0 && confirm === next },
  ];
  const unmet = rules.filter((r) => !r.met).length;

  const nextError =
    touched.next && next.length > 0 && next.length < MIN_LENGTH
      ? `${MIN_LENGTH}文字以上にしてください。`
      : touched.next && next.length > MAX_LENGTH
        ? `${MAX_LENGTH}文字までにしてください。`
        : touched.next && next.length > 0 && next === current
          ? "いまのパスワードとは違うものにしてください。"
          : null;
  const confirmError =
    touched.confirm && confirm.length > 0 && confirm !== next ? "新しいパスワードと一致していません。" : null;

  const submit = async () => {
    if (sending.current) return;
    setError(null);
    if (!current || !next || !confirm) {
      setTouched({ current: true, next: true, confirm: true });
      setError("3つとも入力してください。");
      return;
    }
    if (next.length < MIN_LENGTH || next.length > MAX_LENGTH) {
      setTouched((t) => ({ ...t, next: true }));
      setError(`新しいパスワードは${MIN_LENGTH}文字以上${MAX_LENGTH}文字までにしてください。`);
      return;
    }
    if (next === current) {
      setTouched((t) => ({ ...t, next: true }));
      setError("新しいパスワードは、いまのパスワードとは違うものにしてください。");
      return;
    }
    if (next !== confirm) {
      setTouched((t) => ({ ...t, confirm: true }));
      setError("新しいパスワードと確認用が一致していません。");
      return;
    }
    sending.current = true;
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
      sending.current = false;
      setBusy(false);
    }
  };

  // 変更が済んだら、この画面ですることはもう無い。入力欄を残して迷わせない。
  if (done) {
    return (
      <div className="grid gap-3" role="status">
        <p className="m-0 flex items-center gap-2 text-strong font-bold">
          <Icon name="check" size={18} />
          パスワードを変更しました
        </p>
        <p className="m-0 text-sub">{done}</p>
        <p className="m-0 text-sub text-[var(--ink-muted)]">
          この端末はそのまま使えます。ほかの端末やブラウザで開いていた場合は、ログインし直してください。
          そのときは新しいパスワードをお使いください。
        </p>
        <div>
          <LinkButton href="/account" variant="secondary">
            自分の情報に戻る
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <PasswordField
        id="current"
        label="いまのパスワード"
        value={current}
        autoComplete="current-password"
        autoFocus
        onChange={setCurrent}
        onEnter={() => nextRef.current?.focus()}
      />

      <PasswordField
        id="next"
        label="新しいパスワード"
        value={next}
        autoComplete="new-password"
        inputRef={nextRef}
        error={nextError}
        describedBy="password-rules"
        onChange={(v) => {
          setNext(v);
          if (touched.next) setTouched((t) => ({ ...t, next: false }));
        }}
        onBlur={() => setTouched((t) => ({ ...t, next: true }))}
        onEnter={() => confirmRef.current?.focus()}
      >
        <ul className="rule-list" id="password-rules">
          {rules.map((r) => (
            <li key={r.key} className="rule-item" data-met={r.met}>
              <span className="rule-mark" aria-hidden>
                {r.met ? <Icon name="check" size={12} /> : "・"}
              </span>
              {r.label}
              <span className="sr-only">{r.met ? "満たしています" : "まだです"}</span>
            </li>
          ))}
        </ul>
      </PasswordField>

      <PasswordField
        id="confirm"
        label="新しいパスワード（確認）"
        value={confirm}
        autoComplete="new-password"
        inputRef={confirmRef}
        error={confirmError}
        onChange={(v) => {
          setConfirm(v);
          if (touched.confirm) setTouched((t) => ({ ...t, confirm: false }));
        }}
        onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
        // 最後の欄でも Enter では送らない。押すものへ移るだけにする
        onEnter={() => submitRef.current?.focus()}
      />

      {error && <ReasonNote>{error}</ReasonNote>}

      <div className="flex flex-wrap items-center gap-3">
        <Button ref={submitRef} type="submit" variant="primary" disabled={busy}>
          {busy ? "変更しています…" : "パスワードを変更する"}
        </Button>
        {/* 押せなくして黙らせず、残りをその場で伝える（押せば足りない欄まで案内が出る） */}
        <span className="footnote m-0" aria-live="polite">
          {unmet === 0 ? "3つの条件を満たしています" : `満たしていない条件が${unmet}つあります`}
        </span>
      </div>
    </form>
  );
}

/**
 * パスワードの入力欄。
 *
 * 3つの欄で同じ作法（表示の切り替え・Enterで次へ・判定の出し方）にするため、
 * 欄ごとに書き起こさずここ1箇所にまとめる。
 */
function PasswordField({
  id,
  label,
  value,
  autoComplete,
  inputRef,
  error,
  describedBy,
  autoFocus,
  onChange,
  onBlur,
  onEnter,
  children,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  inputRef?: RefObject<HTMLInputElement | null>;
  error?: string | null;
  describedBy?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  children?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const described = [describedBy, error ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>
        {label}
        <button
          type="button"
          className="field-toggle"
          aria-pressed={visible}
          aria-controls={id}
          // 「表示する」は次に起きること。読み上げでもどの欄のことか分かるようにする
          aria-label={`${label}を${visible ? "隠す" : "表示する"}`}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "隠す" : "表示する"}
        </button>
      </label>
      <input
        id={id}
        ref={inputRef}
        // 表示中も入力の意味は変わらない。ブラウザのパスワード管理は autoComplete が受け持つ
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        enterKeyHint={onEnter ? "next" : "done"}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && !(e.nativeEvent as unknown as { isComposing: boolean }).isComposing && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {children}
      {error && (
        <p className="error-msg" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
