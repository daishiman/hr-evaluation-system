"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, ReasonNote } from "@/components/ui";
import {
  CATEGORY_LABEL,
  GRADE_REQUIREMENT_MAX,
  activeOf,
  inactiveOf,
  remainingSlots,
  type RequirementCategory,
  type RequirementRow,
} from "@/lib/domain/grade-requirements";

/**
 * 等級要件（支援について／運営について）の編集。
 *
 * 制度の形をそのまま画面にする:
 *   - 区分は2つだけ。画面上でも2つの塊に分ける。
 *   - 各区分は 0〜10 項目。10個ちょうどにする必要はないので、空欄を10個並べない。
 *   - 「いま何個 / あと何個」を常に出す。ここが達成率の分母になるため、数が見えないと制度が読めない。
 *
 * 保存はすべて /api/masters（PUT）。削除はせず「使わない」に切り替える。
 * 過去のアンケート・確定済みの評価がこの項目を参照しているため、行ごと消すと過去が読めなくなる。
 */

type Draft = { open: boolean; text: string };

export function GradeRequirementEditor({
  gradeId,
  gradeName,
  rows,
}: {
  gradeId: string;
  gradeName: string;
  rows: RequirementRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);

  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return false;
      }
      setMessage(json.message ?? "保存しました。");
      router.refresh();
      return true;
    } catch {
      setError("通信できませんでした。入力した内容はこの画面に残っています。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const support = activeOf(rows, "support");
  const operation = activeOf(rows, "operation");
  const unused = inactiveOf(rows);
  const denominator = support.length + operation.length;

  const block = (category: RequirementCategory, list: RequirementRow[]) => {
    const label = CATEGORY_LABEL[category];
    const rest = remainingSlots(list.length);
    const draft = drafts[category] ?? { open: false, text: "" };

    return (
      <Card key={category}>
        <div className="card-row items-center bg-[var(--subtle)]">
          <div className="row-main">
            <p className="m-0 text-[14px] font-bold">{label}</p>
            <p className="footnote m-0">
              {rest === 0
                ? `${GRADE_REQUIREMENT_MAX}項目まで登録済みです。`
                : `あと ${rest}項目 登録できます（登録は0項目でもかまいません）。`}
            </p>
          </div>
          <span className="num text-[18px] font-bold">
            {list.length}
            <span className="unit"> / {GRADE_REQUIREMENT_MAX}</span>
          </span>
        </div>

        {list.length === 0 && (
          <div className="card-pad">
            <p className="footnote m-0">
              この等級の「{label}」はまだ1項目もありません。0項目のままでも保存できます（そのぶん達成率の分母が小さくなります）。
            </p>
          </div>
        )}

        {list.map((r, i) => (
          <div key={r.id} className="card-row items-start">
            <span className="num mt-[2px] w-6 shrink-0 text-[13px] text-[var(--ink-muted)]">{i + 1}</span>
            <div className="row-main">
              {editing[r.id] === undefined ? (
                <p className="m-0 text-[13px]">{r.text}</p>
              ) : (
                <>
                  <textarea
                    value={editing[r.id]}
                    onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={2}
                    className="input w-full"
                    aria-label={`${label} ${i + 1}件目の内容`}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      disabled={busy || editing[r.id].trim() === ""}
                      onClick={async () => {
                        const ok = await send({
                          kind: "gradeRequirement",
                          id: r.id,
                          gradeId,
                          category,
                          text: editing[r.id].trim(),
                        });
                        if (ok) setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; });
                      }}
                    >
                      保存する
                    </Button>
                    <Button
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; })}
                    >
                      やめる
                    </Button>
                  </div>
                </>
              )}
            </div>
            {editing[r.id] === undefined && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="tertiary"
                  disabled={busy || i === 0}
                  aria-label="1つ上に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, gradeId, category, direction: "up" })}
                >
                  ↑
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === list.length - 1}
                  aria-label="1つ下に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, gradeId, category, direction: "down" })}
                >
                  ↓
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => ({ ...s, [r.id]: r.text }))}>
                  直す
                </Button>
                <Button
                  variant="danger-outline"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`「${r.text}」を今後のアンケートに出さないようにします。よろしいですか？\n（すでに公開したアンケートと確定済みの評価はそのまま残ります）`)) return;
                    void send({ kind: "gradeRequirement", id: r.id, gradeId, category, text: r.text, isActive: false });
                  }}
                >
                  使わない
                </Button>
              </div>
            )}
          </div>
        ))}

        <div className="card-pad">
          {draft.open ? (
            <div className="grid gap-2">
              <textarea
                value={draft.text}
                autoFocus
                rows={2}
                placeholder="例）担当する利用者の支援計画を期限内に作成できる"
                className="input w-full"
                aria-label={`${label}に追加する項目の内容`}
                onChange={(e) => setDrafts((s) => ({ ...s, [category]: { open: true, text: e.target.value } }))}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={busy || draft.text.trim() === ""}
                  onClick={async () => {
                    const ok = await send({ kind: "gradeRequirement", gradeId, category, text: draft.text.trim() });
                    if (ok) setDrafts((s) => ({ ...s, [category]: { open: true, text: "" } }));
                  }}
                >
                  この内容で追加する
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setDrafts((s) => ({ ...s, [category]: { open: false, text: "" } }))}>
                  閉じる
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="secondary" disabled={busy || rest === 0} onClick={() => setDrafts((s) => ({ ...s, [category]: { open: true, text: "" } }))}>
                ＋ 項目を追加
              </Button>
              {rest === 0 && (
                <p className="footnote m-0 mt-2">
                  「{label}」は{GRADE_REQUIREMENT_MAX}項目までのため、これ以上追加できません。
                  追加したい場合は、いまある項目のどれかを「使わない」にしてください。
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="stack">
      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          いま編集しているのは <b>{gradeName}</b> の等級要件です。
          この等級のアンケートには <b>支援について {support.length}項目</b>・<b>運営について {operation.length}項目</b>（合計{" "}
          <b>{denominator}項目</b>）が出ます。
        </p>
        <p className="footnote m-0 mt-1">
          等級要件達成率は「達成した項目数 ÷ ここに登録した{denominator}項目」で計算します。項目を増やすと分母も増えます。
        </p>
        <p className="footnote m-0 mt-1">
          ここでの変更は<b>次に作るアンケートから反映されます</b>。すでに作成・公開したアンケートと、確定済みの評価は変わりません。
        </p>
      </Card>

      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 text-[13px] text-[var(--brand-deep)]">{message}</p>}

      {block("support", support)}
      {block("operation", operation)}

      {unused.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] text-[var(--ink-muted)]">
            使わないことにした項目（{unused.length}件）を見る
          </summary>
          <Card className="mt-2">
            {unused.map((r) => (
              <div key={r.id} className="card-row items-center">
                <div className="row-main">
                  <p className="m-0 text-[13px] text-[var(--ink-muted)]">{r.text}</p>
                  <p className="footnote m-0">{CATEGORY_LABEL[r.category as RequirementCategory] ?? r.category}</p>
                </div>
                <Badge tone="closed">使わない</Badge>
                <Button
                  variant="tertiary"
                  disabled={busy}
                  onClick={() => void send({ kind: "gradeRequirement", id: r.id, gradeId, category: r.category, text: r.text, isActive: true })}
                >
                  戻す
                </Button>
              </div>
            ))}
          </Card>
        </details>
      )}

      <Card className="card-pad">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[13px] font-bold">回答する人にはこう見えます</p>
          <Button variant="tertiary" onClick={() => setPreview((v) => !v)}>
            {preview ? "閉じる" : "見てみる"}
          </Button>
        </div>
        {preview && (
          <div className="stack mt-3">
            {denominator === 0 ? (
              <p className="footnote m-0">
                いまは1項目も登録されていないため、次に作るアンケートに等級要件の設問は出ません。その場合、達成率は「判定外」になります。
              </p>
            ) : (
              (["support", "operation"] as RequirementCategory[]).map((c) => {
                const list = activeOf(rows, c);
                if (list.length === 0) return null;
                return (
                  <div key={c}>
                    <p className="section-heading m-0 mb-1">{CATEGORY_LABEL[c]}</p>
                    <div className="grid gap-2">
                      {list.map((r) => (
                        <div key={r.id} className="rounded-lg border border-[var(--line)] p-3">
                          <p className="m-0 text-[13px]">{r.text}</p>
                          <div className="mt-2 flex gap-3 text-[13px] text-[var(--ink-muted)]">
                            <span>○ できている</span>
                            <span>× まだできていない</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            <p className="footnote m-0">
              回答画面には点数・評価基準は出ません（この画面の見本も同じです）。
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
