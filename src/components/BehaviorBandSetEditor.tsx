"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { copiedBandSetName } from "@/lib/domain/behavior";

/**
 * 行動指針の「基準セット」を作る・呼び名を直す・使用を止める。
 *
 * 会社によって、行動指針を何セット用意するかは違う。以前は2セットで固定だったが、
 * ここで会社が足せるようにしている。
 *
 * 作り方は「既存を複製する」を先に出す。ゼロから作ると観点5つ × 5段階の文章を
 * 全部書き起こすことになり、実際にはまず使われない。
 *
 * 消す操作は用意しない。物理削除にすると、すでに公開したアンケートや確定済みの
 * 評価がぶら下げている観点まで巻き込む。使わなくなったセットは「使用を止める」で
 * 選択肢から外し、あとから戻せるようにする（等級要件・昇格要件と同じ作法）。
 */

export interface BehaviorBandSetRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  /** そのセットに入っている観点の数（使用中のものだけ） */
  aspectCount: number;
  /** そのセットを出す設定になっている等級名 */
  usedByGradeNames: string[];
}

export function BehaviorBandSetEditor({ sets, currentBand }: { sets: BehaviorBandSetRow[]; currentBand: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<Record<string, string>>({});
  /** 「新しく作る」を開いているときだけ持つ下書き。閉じているときは null。 */
  const [draft, setDraft] = useState<{ name: string; copyFromBand: string } | null>(null);

  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "behaviorBandSet", ...payload }),
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

  const openDraft = () => {
    const source = sets.find((set) => set.code === currentBand) ?? sets.find((set) => set.isActive) ?? sets[0] ?? null;
    setDraft({
      name: source ? copiedBandSetName(sets.map((set) => set.name), source.name) : "",
      copyFromBand: source?.code ?? "",
    });
    setError(null);
    setMessage(null);
  };

  return (
    <Card className="card-pad">
      <CardHead
        title="基準は何セット用意するか"
        sub="等級ごとに問う内容を変えたいときは、基準を分けて作ります。よく使うのは、いまの基準を複製して一部だけ書き換えるやり方です。"
        actions={
          draft === null ? (
            <Button variant="secondary" disabled={busy} onClick={openDraft}>
              基準を新しく作る
            </Button>
          ) : (
            <Button variant="tertiary" disabled={busy} onClick={() => setDraft(null)}>
              やめる
            </Button>
          )
        }
      />

      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="m-0 mt-3 text-sub text-[var(--brand-deep)]">{message}</p>}

      {draft !== null && (
        <div className="mt-3 rounded-lg border border-[var(--line)] p-3">
          <div className="field-grid">
            <label>
              <span className="block text-note text-[var(--ink-muted)]">新しい基準の呼び名</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="input mt-1 w-full"
                placeholder="例：Manager向け"
              />
            </label>
            <label>
              <span className="block text-note text-[var(--ink-muted)]">中身の作り方</span>
              <select
                value={draft.copyFromBand}
                onChange={(event) => setDraft({ ...draft, copyFromBand: event.target.value })}
                className="input mt-1 w-full"
              >
                {sets.map((set) => (
                  <option key={set.code} value={set.code}>
                    {set.name}を複製する
                  </option>
                ))}
                <option value="">空から作る（観点をひとつずつ足す）</option>
              </select>
            </label>
          </div>
          <p className="footnote m-0 mt-2">
            {draft.copyFromBand === ""
              ? "観点がひとつも無い状態で作られます。作ったあとに「何を問うか」で観点を足してください。"
              : "選んだ基準の観点と5段階の文章をそのまま写します。作ったあとにどちらを直しても、もう一方は変わりません。"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={busy || draft.name.trim() === ""}
              onClick={async () => {
                const ok = await send({
                  name: draft.name.trim(),
                  ...(draft.copyFromBand ? { copyFromBand: draft.copyFromBand } : {}),
                });
                if (ok) setDraft(null);
              }}
            >
              {busy ? "作っています…" : "この内容で作る"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        {sets.map((set) => {
          const nameDraft = editingName[set.id];
          const inUse = set.usedByGradeNames.length > 0;
          return (
            <div key={set.id} className="card-row items-start rounded-lg border border-[var(--line)]">
              <div className="row-main">
                {nameDraft === undefined ? (
                  <>
                    <p className="m-0 text-sub font-bold">{set.name}</p>
                    <p className="footnote m-0">
                      観点{set.aspectCount}件・
                      {inUse ? `${set.usedByGradeNames.join("／")}に出します` : "どの等級にも出していません"}
                    </p>
                  </>
                ) : (
                  <label className="block text-note text-[var(--ink-muted)]">
                    この基準の呼び名
                    <input
                      value={nameDraft}
                      onChange={(event) => setEditingName((s) => ({ ...s, [set.id]: event.target.value }))}
                      className="input mt-1 w-full"
                    />
                  </label>
                )}
                {nameDraft !== undefined && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      disabled={busy || nameDraft.trim() === ""}
                      onClick={async () => {
                        const ok = await send({ id: set.id, name: nameDraft.trim() });
                        if (ok) setEditingName((s) => { const n = { ...s }; delete n[set.id]; return n; });
                      }}
                    >
                      保存する
                    </Button>
                    <Button
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => setEditingName((s) => { const n = { ...s }; delete n[set.id]; return n; })}
                    >
                      やめる
                    </Button>
                  </div>
                )}
              </div>
              {nameDraft === undefined && (
                <div className="row-actions">
                  <Badge tone={set.isActive ? "active" : "dropped"}>{set.isActive ? "使用中" : "使用しない"}</Badge>
                  <Button
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => setEditingName((s) => ({ ...s, [set.id]: set.name }))}
                  >
                    呼び名を直す
                  </Button>
                  {set.isActive ? (
                    inUse ? (
                      /* 使用中は押せる形にしない。押してから断るより、
                         なぜ止められないかを先に読めるほうが早い。 */
                      <span className="footnote">
                        {set.usedByGradeNames.join("／")}に出しているため、使用を止められません
                      </span>
                    ) : (
                      <ConfirmButton
                        label="使わない"
                        variant="danger-outline"
                        busy={busy}
                        confirm={`「${set.name}」を次に作るアンケートで選べないようにします。中身は残るので、あとからもう一度使えます。すでに公開したアンケートと確定済みの評価はそのまま残ります。`}
                        onConfirm={() => void send({ id: set.id, isActive: false })}
                      />
                    )
                  ) : (
                    <Button variant="secondary" disabled={busy} onClick={() => void send({ id: set.id, isActive: true })}>
                      もう一度使う
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
