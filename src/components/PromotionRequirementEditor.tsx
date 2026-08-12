"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { classifyVersionedItems, VersionedMasterSections } from "@/components/VersionedMasterSections";
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

/**
 * 昇格要件（受講して報告書を提出／独学してテストに合格）の編集。
 *
 * 等級要件と同じ作法に揃える:
 *   - 種類ごとに塊を分けて、それぞれ何項目あるかを出す
 *   - 空欄を並べず「＋ 項目を追加」で必要な数だけ増やす
 *   - 並べ替え・見直し・使わないをその場でできる
 *
 * 等級要件と違って上限はない（制度上、件数の決まりがないため）。
 */

const KIND_LABEL = { report: "受講して報告書を提出", test: "独学してテストに合格" } as const;
type PromoKind = keyof typeof KIND_LABEL;

export interface PromotionRow {
  id: string;
  kind: string;
  seq: number;
  text: string;
  transitionLabel: string | null;
  isGate: boolean;
  isActive: boolean;
  previousVersionId?: string | null;
}

export function PromotionRequirementEditor({
  gradeId,
  gradeName,
  rows,
  usage,
}: {
  gradeId: string;
  gradeName: string;
  rows: PromotionRow[];
  /** 項目ごとの「どこで使っているか」。空＝一度も使っていない＝完全に消せる。 */
  usage: UsageMap;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { open: boolean; text: string; gate: boolean; label: string }>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});

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

  /** 完全に消す。消せるかどうかの判定はサーバー側が持つ。 */
  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await requestMasterDelete("promotionRequirement", id);
    if (result.ok) {
      setMessage(result.message);
      router.refresh();
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

  const activeOf = (kind: PromoKind) =>
    classifyVersionedItems(rows.filter((row) => row.kind === kind))
      .current.filter((row) => row.isActive)
      .sort((a, b) => a.seq - b.seq);

  const block = (kind: PromoKind) => {
    const list = activeOf(kind);
    const draft = drafts[kind] ?? { open: false, text: "", gate: true, label: "" };
    return (
      <Card key={kind}>
        {/* 項目を上から書き足していく画面なので、頭は固定表示にする。
            帯に載せるのは「いま何の種類を書いているか」と「いま何項目あるか」だけ。 */}
        <CardHead
          pinned
          title={KIND_LABEL[kind]}
          sub="件数の上限はありません。0項目のままでもかまいません。"
          actions={
            <span className="num text-title font-bold">
              {list.length}
              <span className="unit"> 項目</span>
            </span>
          }
        />

        {list.length === 0 && (
          <div className="card-pad">
            <p className="footnote m-0">この種類の項目はまだありません。</p>
          </div>
        )}

        {list.map((r, i) => (
          <div key={r.id} className="card-row items-start">
            <span className="num mt-[2px] w-6 shrink-0 text-sub text-[var(--ink-muted)]">{i + 1}</span>
            <div className="row-main">
              {editing[r.id] === undefined ? (
                <>
                  <p className="m-0 text-sub">{r.text}</p>
                  {r.transitionLabel && <p className="footnote m-0">{r.transitionLabel}</p>}
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
                    aria-label={`${KIND_LABEL[kind]} ${i + 1}件目の内容`}
                  />
                  <p className="footnote m-0 mt-1">以前の内容は変更履歴に残ります。</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      disabled={busy || editing[r.id].trim() === ""}
                      onClick={async () => {
                        const ok = await send({
                          kind: "promotionRequirementRevise",
                          id: r.id,
                          text: editing[r.id].trim(),
                          transitionLabel: r.transitionLabel,
                          isGate: r.isGate,
                        });
                        if (ok) setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; });
                      }}
                    >
                      新版として保存
                    </Button>
                    <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; })}>
                      やめる
                    </Button>
                  </div>
                </>
              )}
            </div>
            {editing[r.id] === undefined && (
              <div className="row-actions">
                {r.isGate ? <Badge tone="alert">必須</Badge> : <Badge tone="done">任意</Badge>}
                <Button
                  variant="tertiary"
                  disabled={busy || i === 0}
                  aria-label="1つ上に移動"
                  onClick={() => void send({ kind: "promotionRequirementOrder", id: r.id, direction: "up" })}
                >
                  ↑
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === list.length - 1}
                  aria-label="1つ下に移動"
                  onClick={() => void send({ kind: "promotionRequirementOrder", id: r.id, direction: "down" })}
                >
                  ↓
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => ({ ...s, [r.id]: r.text }))}>
                  内容を直す
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy}
                  onClick={() =>
                    void send({
                      kind: "promotionRequirementRevise",
                      id: r.id,
                      text: r.text,
                      transitionLabel: r.transitionLabel,
                      isGate: !r.isGate,
                    })
                  }
                >
                  {r.isGate ? "任意の新版にする" : "必須の新版にする"}
                </Button>
                <ConfirmButton
                  label="今後使わない"
                  variant="danger-outline"
                  busy={busy}
                  confirm={`「${r.text}」を今後使わない設定にします。過去のアンケートと評価は変わりません。`}
                  onConfirm={() => void send({ kind: "promotionRequirementActivation", id: r.id, isActive: false })}
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
                placeholder="例）新任職員研修を受講し、報告書を提出している"
                className="input w-full"
                aria-label={`${KIND_LABEL[kind]}に追加する項目の内容`}
                onChange={(e) => setDrafts((s) => ({ ...s, [kind]: { ...draft, open: true, text: e.target.value } }))}
              />
              <label className="text-note text-[var(--ink-muted)]">
                対象の昇格（任意。例：Beginner → Regular）
                <input
                  value={draft.label}
                  className="input mt-1 w-full"
                  onChange={(e) => setDrafts((s) => ({ ...s, [kind]: { ...draft, open: true, label: e.target.value } }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sub">
                <input
                  type="checkbox"
                  checked={draft.gate}
                  onChange={(e) => setDrafts((s) => ({ ...s, [kind]: { ...draft, open: true, gate: e.target.checked } }))}
                />
                必須にする（満たさないと、点数が高くても昇格できません）
              </label>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={busy || draft.text.trim() === ""}
                  onClick={async () => {
                    const ok = await send({
                      kind: "promotionRequirementCreate",
                      gradeId,
                      reqKind: kind,
                      text: draft.text.trim(),
                      transitionLabel: draft.label.trim() || null,
                      isGate: draft.gate,
                    });
                    if (ok) setDrafts((s) => ({ ...s, [kind]: { open: true, text: "", gate: draft.gate, label: draft.label } }));
                  }}
                >
                  この内容で追加する
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setDrafts((s) => ({ ...s, [kind]: { open: false, text: "", gate: true, label: "" } }))}>
                  閉じる
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setDrafts((s) => ({ ...s, [kind]: { open: true, text: "", gate: true, label: "" } }))}>
              ＋ 項目を追加
            </Button>
          )}
        </div>

        <div className="card-pad grid gap-2 border-t border-[var(--line)]">
          <VersionedMasterSections
            sectionId={`promotion-${gradeId}-${kind}`}
            rows={rows.filter((row) => row.kind === kind)}
            busy={busy}
            renderDetail={(row) => (
              <>
                {row.transitionLabel && <p className="footnote m-0">{row.transitionLabel}</p>}
                <p className="footnote m-0">{row.isGate ? "必須" : "任意"}</p>
                {markOf(row.id) !== null && <UsedByDetail mark={markOf(row.id)!} usedBy={usedByOf(row.id)} />}
              </>
            )}
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
              void send({ kind: "promotionRequirementActivation", id: row.id, isActive: true })
            }
            onRestoreContent={({ row, currentId }) =>
              void send({ kind: "promotionRequirementRestoreContent", id: currentId, sourceVersionId: row.id })
            }
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="stack">
      <p className="footnote m-0">
        いま編集しているのは <b>{gradeName}</b> の昇格要件です。ここでの変更は次に作るアンケートから反映されます。
        すでに作成・公開したアンケートと確定済みの評価は変わりません。
      </p>
      <p className="footnote m-0">内容を直すと、新版を作ります。</p>
      {error && <div role="alert"><ReasonNote>{error}</ReasonNote></div>}
      {message && <p role="status" aria-live="polite" className="m-0 text-sub text-[var(--brand-deep)]">{message}</p>}
      {block("report")}
      {block("test")}
      {/* 全行で同じ文になる「なぜ消せないか」は、行から外してここへ1つだけ置く。
          「使用中」の行が1つも無い画面には出さない（関わりのない説明を並べない）。 */}
      {anyBlocked && (
        <Disclosure summary={BLOCKED_HELP_LABEL}>
          <p className="m-0 text-sub">{BLOCKED_WHY}</p>
          <p className="m-0 mt-1 text-sub">{BLOCKED_KEEP}</p>
          <p className="m-0 mt-1 text-sub">{BLOCKED_WHAT}</p>
        </Disclosure>
      )}
    </div>
  );
}
