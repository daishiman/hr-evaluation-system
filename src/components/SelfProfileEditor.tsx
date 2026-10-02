"use client";

import { useState } from "react";
import { updateOwnProfile } from "@/actions/account";
import { useSaveAction } from "@/lib/use-refresh";
import { hasIcon, Icon } from "@/components/Icon";
import { Button, HintToggle, RowAction } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

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
  // 成功の応答には保存後の画面（ヘッダーの名前を含む）が同梱される（runAction の refresh）
  const { save, saving } = useSaveAction(updateOwnProfile, { resource: "account" });
  const [editing, setEditing] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const startEdit = (row: ProfileRow) => {
    setEditing(row.key);
    setDraft((row.editValue !== undefined ? row.editValue : row.value) ?? "");
    setError(null);
    setSaved(null);
  };

  const submit = async (row: ProfileRow) => {
    setError(null);
    const result = await save({
      [row.key]: row.key === "name" ? draft.trim() : draft.trim() === "" ? null : draft.trim(),
    });
    // 会社の管理者だけが変えられる項目の断りも、サーバーの言葉をそのまま出す。
    // 失敗したときは入力欄を開いたまま残す。
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(null);
    setSaved(row.key);
  };

  return (
    <fieldset disabled={saving} aria-busy={saving} className="profile-rows m-0 min-w-0 border-0 p-0">
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
              <HintToggle
                open={hintOpen}
                controls={hintId}
                onClick={() => setOpenHint(hintOpen ? null : row.key)}
              >
                {row.label}
              </HintToggle>

              {isEditing ? (
                <form
                  className="mt-1 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit(row);
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
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? "保存しています…" : "保存"}
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={saving}
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
                  {row.value ?? <span className="text-ink-muted">未設定</span>}
                  {saved === row.key && (
                    <RefreshStatus
                      message="保存しました。"
                      refreshing={saving}
                      target="表示"
                      className="profile-saved pop-in"
                    />
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
                <RowAction icon="pencil" onClick={() => startEdit(row)}>
                  変える
                </RowAction>
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
    </fieldset>
  );
}
