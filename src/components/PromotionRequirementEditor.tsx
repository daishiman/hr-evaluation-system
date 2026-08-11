"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";

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
}

export function PromotionRequirementEditor({
  gradeId,
  gradeName,
  rows,
}: {
  gradeId: string;
  gradeName: string;
  rows: PromotionRow[];
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

  const activeOf = (kind: PromoKind) => rows.filter((r) => r.kind === kind && r.isActive).sort((a, b) => a.seq - b.seq);
  const unused = rows.filter((r) => !r.isActive);

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
                </>
              ) : (
                <>
                  <textarea
                    value={editing[r.id]}
                    onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={2}
                    className="input w-full"
                    aria-label={`${KIND_LABEL[kind]} ${i + 1}件目の内容`}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      disabled={busy || editing[r.id].trim() === ""}
                      onClick={async () => {
                        const ok = await send({
                          kind: "promotionRequirement",
                          id: r.id,
                          gradeId,
                          reqKind: kind,
                          text: editing[r.id].trim(),
                          transitionLabel: r.transitionLabel,
                        });
                        if (ok) setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; });
                      }}
                    >
                      保存する
                    </Button>
                    <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; })}>
                      やめる
                    </Button>
                  </div>
                </>
              )}
            </div>
            {editing[r.id] === undefined && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {r.isGate ? <Badge tone="alert">必須</Badge> : <Badge tone="done">任意</Badge>}
                <Button
                  variant="tertiary"
                  disabled={busy || i === 0}
                  aria-label="1つ上に移動"
                  onClick={() => void send({ kind: "promotionRequirementOrder", id: r.id, gradeId, reqKind: kind, direction: "up" })}
                >
                  ↑
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy || i === list.length - 1}
                  aria-label="1つ下に移動"
                  onClick={() => void send({ kind: "promotionRequirementOrder", id: r.id, gradeId, reqKind: kind, direction: "down" })}
                >
                  ↓
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={() => setEditing((s) => ({ ...s, [r.id]: r.text }))}>
                  直す
                </Button>
                <Button
                  variant="tertiary"
                  disabled={busy}
                  onClick={() =>
                    void send({
                      kind: "promotionRequirement",
                      id: r.id,
                      gradeId,
                      reqKind: kind,
                      text: r.text,
                      transitionLabel: r.transitionLabel,
                      isGate: !r.isGate,
                    })
                  }
                >
                  {r.isGate ? "任意にする" : "必須にする"}
                </Button>
                <ConfirmButton
                  label="使わない"
                  variant="danger-outline"
                  busy={busy}
                  confirm={`「${r.text}」を今後のアンケートに出さないようにします。すでに公開したアンケートと、確定済みの評価はそのまま残ります。`}
                  onConfirm={() =>
                    void send({
                      kind: "promotionRequirement",
                      id: r.id,
                      gradeId,
                      reqKind: kind,
                      text: r.text,
                      transitionLabel: r.transitionLabel,
                      isActive: false,
                    })
                  }
                />
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
                      kind: "promotionRequirement",
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
      </Card>
    );
  };

  return (
    <div className="stack">
      <p className="footnote m-0">
        いま編集しているのは <b>{gradeName}</b> の昇格要件です。ここでの変更は次に作るアンケートから反映され、
        すでに作成・公開したアンケートと確定済みの評価は変わりません。
      </p>
      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 text-sub text-[var(--brand-deep)]">{message}</p>}
      {block("report")}
      {block("test")}
      {unused.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sub text-[var(--ink-muted)]">
            使わないことにした項目（{unused.length}件）を見る
          </summary>
          <Card className="mt-2">
            {unused.map((r) => (
              <div key={r.id} className="card-row items-center">
                <div className="row-main">
                  <p className="m-0 text-sub text-[var(--ink-muted)]">{r.text}</p>
                  <p className="footnote m-0">{KIND_LABEL[r.kind as PromoKind] ?? r.kind}</p>
                </div>
                <Badge tone="closed">使わない</Badge>
                <Button
                  variant="tertiary"
                  disabled={busy}
                  onClick={() =>
                    void send({
                      kind: "promotionRequirement",
                      id: r.id,
                      gradeId,
                      reqKind: r.kind,
                      text: r.text,
                      transitionLabel: r.transitionLabel,
                      isActive: true,
                    })
                  }
                >
                  戻す
                </Button>
              </div>
            ))}
          </Card>
        </details>
      )}
    </div>
  );
}
