"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useState } from "react";
import { Button, Card, CardHead, Disclosure, InlineDetail, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { VersionedMasterSections } from "@/components/VersionedMasterSections";
import { requestMasterDelete } from "@/components/master-delete-request";
import {
  BLOCKED_HELP_LABEL,
  BLOCKED_KEEP,
  BLOCKED_WHAT,
  BLOCKED_WHY,
  DELETE_LABEL,
  blockedMark,
  deleteConfirmText,
} from "@/lib/domain/master-delete";
import type { UsageMap } from "@/lib/master-usage";
import { RefreshStatus } from "@/components/RefreshStatus";
import {
  CATEGORY_LABEL,
  GRADE_REQUIREMENT_MAX,
  activeOf,
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
 * 保存はすべて /api/masters（PUT）。止め方は2段階:
 *   - 「使わない」: 次に作るアンケートから外すだけ。あとから戻せる。
 *   - 「完全に消す」: まだ一度もアンケートに出しておらず、評価の記録にも無いときだけ出る。
 * 一度でも使った項目は消せない（過去のアンケート・確定済みの評価がこの行を参照しているため、
 * 消すと過去が読めなくなる）。判定はサーバー側で行う。
 */

type Draft = { open: boolean; text: string };

export function GradeRequirementEditor({
  gradeId,
  gradeName,
  rows,
  usage,
}: {
  gradeId: string;
  gradeName: string;
  rows: RequirementRow[];
  /** 項目ごとの「どこで使っているか」。空＝一度も使っていない＝完全に消せる。 */
  usage: UsageMap;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
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
      refresh();
      return true;
    } catch {
      setError("通信できませんでした。入力した内容はこの画面に残っています。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** 完全に消す。消せるかどうかの判定はサーバー側が持つ。 */
  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await requestMasterDelete("gradeRequirement", id);
    if (result.ok) {
      setMessage(result.message);
      refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
  };

  /* 使っている場所があるなら消させない。
     行に残すのは「使用中（◯件）」の一言だけで、どこで使っているかは押したら出す。
     全行で同じになる「なぜ消せないか」は、この部品の一番下に1つだけ置く。 */
  const usedByOf = (id: string) => usage[id] ?? [];
  const markOf = (id: string) => blockedMark(usedByOf(id));
  const anyBlocked = rows.some((r) => usedByOf(r.id).length > 0);

  const support = activeOf(rows, "support");
  const operation = activeOf(rows, "operation");
  const denominator = support.length + operation.length;

  const block = (category: RequirementCategory, list: RequirementRow[]) => {
    const label = CATEGORY_LABEL[category];
    const rest = remainingSlots(list.length);
    const draft = drafts[category] ?? { open: false, text: "" };

    return (
      <Card key={category}>
        {/* 項目を上から書き足していく画面なので、頭は固定表示にする。
            帯に載せるのは「いま何の区分を書いているか」と「あと何項目書けるか」だけ。
            上限に達したことに気づかないまま入力を続ける事故を防ぐ。 */}
        <CardHead
          pinned
          title={label}
          sub={
            rest === 0
              ? `${GRADE_REQUIREMENT_MAX}項目まで登録済みです。`
              : `あと ${rest}項目 登録できます（登録は0項目でもかまいません）。`
          }
          actions={
            <span className="num text-title font-bold">
              {list.length}
              <span className="unit"> / {GRADE_REQUIREMENT_MAX}</span>
            </span>
          }
        />

        {list.length === 0 && (
          <div className="card-pad">
            <p className="footnote m-0">
              この等級の「{label}」はまだ1項目もありません。0項目のままでも保存できます（そのぶん達成率の分母が小さくなります）。
            </p>
          </div>
        )}

        {list.map((r, i) => (
          <div key={r.id} className="card-row items-start">
            <span className="num mt-[2px] w-6 shrink-0 text-sub text-ink-muted">{i + 1}</span>
            <div className="row-main">
              {editing[r.id] === undefined ? (
                <>
                  <p className="m-0 text-sub">{r.text}</p>
                  {markOf(r.id) !== null && <UsedByDetail mark={markOf(r.id)!} usedBy={usedByOf(r.id)} />}
                </>
              ) : (
                <>
                  <textarea
                    value={editing[r.id]}
                    autoFocus
                    onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={2}
                    className="input w-full"
                    aria-label={`${label} ${i + 1}件目の内容`}
                  />
                  <p className="footnote m-0 mt-1">以前の内容は変更履歴に残ります。</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      disabled={busy || editing[r.id].trim() === ""}
                      onClick={async () => {
                        const ok = await send({
                          kind: "gradeRequirementRevise",
                          id: r.id,
                          text: editing[r.id].trim(),
                        });
                        if (ok) setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; });
                      }}
                    >
                      新版として保存
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
              <div className="row-actions">
                <Button
                  variant="tertiary"
                  disabled={busy || i === 0}
                  aria-label="先頭に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, direction: "top" })}
                >
                  ⇈
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === 0}
                  aria-label="1つ上に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, direction: "up" })}
                >
                  ↑
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === list.length - 1}
                  aria-label="1つ下に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, direction: "down" })}
                >
                  ↓
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === list.length - 1}
                  aria-label="末尾に移動"
                  onClick={() => void send({ kind: "gradeRequirementOrder", id: r.id, direction: "bottom" })}
                >
                  ⇊
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => ({ ...s, [r.id]: r.text }))}>
                  内容を直す
                </Button>
                <ConfirmButton
                  label="今後使わない"
                  variant="danger-outline"
                  busy={busy}
                  confirm={`「${r.text}」を今後使わない設定にします。過去のアンケートと評価は変わりません。`}
                  onConfirm={() => void send({ kind: "gradeRequirementActivation", id: r.id, isActive: false })}
                />
                {markOf(r.id) === null && (
                  <ConfirmButton
                    label={DELETE_LABEL}
                    variant="danger-outline"
                    busy={busy}
                    confirm={deleteConfirmText(r.text)}
                    onConfirm={() => void remove(r.id)}
                  />
                )}
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
                    const ok = await send({ kind: "gradeRequirementCreate", gradeId, category, text: draft.text.trim() });
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
                  追加したい場合は、いまある項目を1つ「今後使わない」にしてください。
                </p>
              )}
            </>
          )}
        </div>

        <div className="card-pad grid gap-2 border-t border-line">
          <VersionedMasterSections
            sectionId={`grade-${gradeId}-${category}`}
            rows={rows.filter((row) => row.category === category)}
            busy={busy}
            maxActive={GRADE_REQUIREMENT_MAX}
            renderDetail={(row) =>
              markOf(row.id) !== null ? <UsedByDetail mark={markOf(row.id)!} usedBy={usedByOf(row.id)} /> : null
            }
            renderStoppedAction={(row) =>
              markOf(row.id) === null ? (
                <ConfirmButton
                  label={DELETE_LABEL}
                  variant="danger-outline"
                  busy={busy}
                  confirm={deleteConfirmText(row.text)}
                  onConfirm={() => void remove(row.id)}
                />
              ) : null
            }
            onReactivate={(row) =>
              void send({ kind: "gradeRequirementActivation", id: row.id, isActive: true })
            }
            onRestoreContent={({ row, currentId }) =>
              void send({ kind: "gradeRequirementRestoreContent", id: currentId, sourceVersionId: row.id })
            }
          />
        </div>
      </Card>
    );
  };

  return (
    <fieldset disabled={busy || refreshing} aria-busy={busy || refreshing} className="stack m-0 min-w-0 border-0 p-0">
      <Card className="card-pad">
        <p className="m-0 text-sub">
          いま編集しているのは <b>{gradeName}</b> の等級要件です。
          この等級のアンケートには <b>支援について {support.length}項目</b>・<b>運営について {operation.length}項目</b>（合計{" "}
          <b>{denominator}項目</b>）が出ます。
        </p>
        <p className="footnote m-0 mt-1">
          ここでの変更は<b>次に作るアンケートから反映されます</b>。すでに作成・公開したアンケートと、確定済みの評価は変わりません。
        </p>
        <p className="footnote m-0 mt-1">内容を直すと、新版を作ります。</p>
        {/* 達成率の出し方は、いま項目を書くうえでは要らない背景。押したときだけ出す */}
        <InlineDetail summary="達成率の出し方">
          <p className="m-0">等級要件達成率は「達成した項目数 ÷ 登録した{denominator}項目」です。</p>
          <p className="m-0 mt-1">項目を増やすと分母も増えます。</p>
        </InlineDetail>
      </Card>

      {error && <div role="alert"><ReasonNote>{error}</ReasonNote></div>}
      <RefreshStatus message={message} refreshing={refreshing} />

      {block("support", support)}
      {block("operation", operation)}

      <Card className="card-pad">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sub font-bold">回答する人にはこう見えます</p>
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
                        <div key={r.id} className="rounded-lg border border-line p-3">
                          <p className="m-0 text-sub">{r.text}</p>
                          <div className="mt-2 flex gap-3 text-sub text-ink-muted">
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

      {/* 全行で同じ文になる「なぜ消せないか」は、行から外してここへ1つだけ置く。
          「使用中」の行が1つも無い画面には出さない（関わりのない説明を並べない）。 */}
      {anyBlocked && (
        <Disclosure summary={BLOCKED_HELP_LABEL}>
          <p className="m-0 text-sub">{BLOCKED_WHY}</p>
          <p className="m-0 mt-1 text-sub">{BLOCKED_KEEP}</p>
          <p className="m-0 mt-1 text-sub">{BLOCKED_WHAT}</p>
        </Disclosure>
      )}
    </fieldset>
  );
}
