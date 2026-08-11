"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hasIcon, Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

/**
 * 自分の登録内容の一覧と、その場での書き換え。
 *
 * 画面に最初から出すのは「項目名・いまの値・変えられるかどうか」の3つだけにする。
 * なぜその項目があるのか、なぜ変えられないのかは、押したときに初めて出す。
 * 変えられない項目にも値は必ず出す（自分の情報を隠さない。制限するのは変更だけ）。
 */

export interface ProfileRow {
  key: string;
  label: string;
  hint: string;
  icon: string;
  /** 本人が変更してよいか */
  editable: boolean;
  /** 画面に出す値。未設定は null（日付は「2024年4月1日」のように読める形） */
  value: string | null;
  /** 入力欄に入れる値。日付だけ表示と形が違う（2024-04-01） */
  editValue?: string | null;
  /** 画面に出すときの見せ方（日付は入力欄の型を変える） */
  type: "text" | "date";
  /** 変えられない項目に添える、誰が変えるのかの一言 */
  managedBy?: string;
}

export function SelfProfileEditor({ rows }: { rows: ProfileRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const startEdit = (row: ProfileRow) => {
    setEditing(row.key);
    setDraft((row.editValue !== undefined ? row.editValue : row.value) ?? "");
    setError(null);
    setSaved(null);
  };

  const save = async (row: ProfileRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          [row.key]: row.key === "name" ? draft.trim() : draft.trim() === "" ? null : draft.trim(),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(
          res.status === 403
            ? "この項目は会社の管理者だけが変更できます。変更が必要なときは会社の管理者にご相談ください。"
            : (json.message ?? "保存できませんでした。"),
        );
        return;
      }
      setEditing(null);
      setSaved(row.key);
      router.refresh();
    } catch {
      setError("通信できませんでした。入力した内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-rows">
      {rows.map((row) => {
        const isEditing = editing === row.key;
        const hintOpen = openHint === row.key;
        const inputId = `self-profile-${row.key}`;
        const hintId = `${inputId}-hint`;
        return (
          <div key={row.key} className="profile-row" data-locked={row.editable ? undefined : "true"}>
            <span className="profile-row-icon">
              <Icon name={hasIcon(row.icon) ? row.icon : "user"} size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="profile-row-label"
                onClick={() => setOpenHint(hintOpen ? null : row.key)}
                aria-expanded={hintOpen}
              >
                {row.label}
                <Icon name="chevron" size={12} className={hintOpen ? "rot-180" : undefined} />
              </button>

              {isEditing ? (
                <form
                  className="mt-1 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(row);
                  }}
                >
                  <label htmlFor={inputId} className="sr-only">
                    {row.label}
                  </label>
                  <input
                    id={inputId}
                    name={row.key}
                    className="input"
                    type={row.type === "date" ? "date" : "text"}
                    value={draft}
                    aria-describedby={hintOpen ? hintId : undefined}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditing(null);
                        setError(null);
                      }
                    }}
                  />
                  <Button type="submit" variant="primary" disabled={busy}>
                    {busy ? "保存しています…" : "保存"}
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      setError(null);
                    }}
                  >
                    やめる
                  </Button>
                </form>
              ) : (
                <p className="profile-row-value">
                  {row.value ?? <span className="text-[var(--ink-muted)]">未設定</span>}
                  {saved === row.key && (
                    <span className="profile-saved pop-in" role="status">
                      <Icon name="check" size={13} />
                      保存しました
                    </span>
                  )}
                </p>
              )}

              {hintOpen && (
                <p id={hintId} className="profile-row-hint">
                  {row.hint}
                  {!row.editable && row.managedBy && ` 変更は${row.managedBy}にご相談ください。`}
                </p>
              )}
            </div>

            {row.editable ? (
              !isEditing && (
                <button type="button" className="profile-row-action" onClick={() => startEdit(row)}>
                  <Icon name="pencil" size={14} />
                  変える
                </button>
              )
            ) : (
              <span className="profile-row-lock" title="会社の管理者だけが変更できます">
                <Icon name="lock" size={14} />
                会社の管理者のみ
              </span>
            )}
          </div>
        );
      })}

      {error && (
        <p className="profile-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
