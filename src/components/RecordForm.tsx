"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote } from "@/components/ui";

/**
 * 管理画面の小さな入力フォーム（共通）。
 *
 * 入力の作法を1組に揃えるためにここへ集約する。
 *  - Enter は「次の欄へ移動」。送信はボタンだけ（日本語変換の確定Enterでは何も起きない）。
 *  - 数値欄は右寄せ・数字キーボード。
 *  - 保存に失敗しても入力内容は消さない。
 */

export type FieldSpec =
  | { name: string; label: string; type: "text" | "email" | "password" | "date"; required?: boolean; placeholder?: string; help?: string; defaultValue?: string }
  | { name: string; label: string; type: "number"; required?: boolean; help?: string; defaultValue?: number | null; unit?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; help?: string; defaultValue?: string }
  | { name: string; label: string; type: "checkbox"; help?: string; defaultValue?: boolean }
  | { name: string; label: string; type: "textarea"; required?: boolean; help?: string; defaultValue?: string };

export function RecordForm({
  url,
  method = "POST",
  fields,
  fixed,
  submitLabel,
  title,
  description,
  resetAfterSubmit,
}: {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  fields: FieldSpec[];
  /** 画面に出さずに一緒に送る値（対象のIDなど） */
  fixed?: Record<string, unknown>;
  submitLabel: string;
  title?: string;
  description?: string;
  resetAfterSubmit?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA") return;
    // 日本語変換の確定Enterでは何もしない
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    e.preventDefault();
    const els = Array.from(formRef.current?.elements ?? []).filter(
      (x): x is HTMLElement => x instanceof HTMLElement && !(x instanceof HTMLButtonElement),
    );
    const i = els.indexOf(t);
    if (i >= 0 && i + 1 < els.length) els[i + 1].focus();
  };

  const submit = async () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = { ...fixed };
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (f.type === "checkbox") {
        payload[f.name] = raw === "on";
        continue;
      }
      const str = typeof raw === "string" ? raw.trim() : "";
      if (f.type === "number") {
        if (str === "") {
          payload[f.name] = null;
        } else {
          const n = Number(str.replace(/[,\s]/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
          if (Number.isNaN(n)) {
            setError(`「${f.label}」には数字を入力してください。`);
            return;
          }
          payload[f.name] = n;
        }
        continue;
      }
      payload[f.name] = str === "" ? null : str;
    }

    const missing = fields.find((f) => "required" in f && f.required && (payload[f.name] === null || payload[f.name] === ""));
    if (missing) {
      setError(`「${missing.label}」を入力してください。`);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。入力内容をご確認ください。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      if (resetAfterSubmit) form.reset();
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      {title && <p className="section-heading m-0 mb-1">{title}</p>}
      {description && <p className="footnote m-0 mb-3">{description}</p>}
      <form
        ref={formRef}
        onKeyDown={onKeyDown}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="grid gap-3 md:grid-cols-2"
      >
        {fields.map((f) => (
          <label key={f.name} className={f.type === "textarea" ? "md:col-span-2" : undefined}>
            <span className="block text-[12px] text-[var(--ink-muted)]">
              {f.label}
              {"required" in f && f.required && <span className="ml-1 text-[var(--danger)]">必須</span>}
            </span>
            {f.type === "select" ? (
              <select name={f.name} defaultValue={f.defaultValue ?? ""} className="input mt-1 w-full">
                {/* 「空欄」に意味がある項目（例: 適用しない）は自前の選択肢を持っているので、案内文の行を足さない */}
                {!f.options.some((o) => o.value === "") && <option value="">選択してください</option>}
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <span className="mt-1 flex items-center gap-2 text-[13px]">
                <input type="checkbox" name={f.name} defaultChecked={f.defaultValue ?? false} />
                {f.help}
              </span>
            ) : f.type === "textarea" ? (
              <textarea name={f.name} defaultValue={f.defaultValue ?? ""} rows={3} className="input mt-1 w-full" />
            ) : f.type === "number" ? (
              <span className="mt-1 flex items-center gap-2">
                <input
                  name={f.name}
                  defaultValue={f.defaultValue ?? ""}
                  inputMode="decimal"
                  enterKeyHint="next"
                  className="input input-num w-32"
                />
                {f.unit && <span className="unit">{f.unit}</span>}
              </span>
            ) : (
              <input
                name={f.name}
                type={f.type === "date" ? "date" : f.type}
                defaultValue={"defaultValue" in f ? (f.defaultValue ?? "") : ""}
                placeholder={"placeholder" in f ? f.placeholder : undefined}
                autoComplete={f.type === "password" ? "new-password" : "off"}
                enterKeyHint="next"
                className="input mt-1 w-full"
              />
            )}
            {f.help && f.type !== "checkbox" && <span className="footnote block">{f.help}</span>}
          </label>
        ))}
        <div className="md:col-span-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "保存しています…" : submitLabel}
          </Button>
        </div>
      </form>
      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="m-0 mt-3 text-[13px] text-[var(--brand-deep)]">{message}</p>}
    </Card>
  );
}
