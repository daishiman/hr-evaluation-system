"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { copiedBandSetName } from "@/lib/domain/behavior";
import {
  BAND_SET_ASSIGNED_NEXT,
  BLOCKED_HELP_LABEL,
  BLOCKED_KEEP,
  BLOCKED_WHAT,
  BLOCKED_WHY,
  DELETE_LABEL,
  blockedMark,
  deleteConfirmText,
} from "@/lib/domain/master-delete";
import { requestMasterDelete } from "@/components/master-delete-request";

/**
 * 行動指針の「基準セット」を作る・呼び名を直す・使用を止める。
 *
 * 会社によって、行動指針を何セット用意するかは違う。以前は2セットで固定だったが、
 * ここで会社が足せるようにしている。
 *
 * 作り方は「既存を複製する」を先に出す。ゼロから作ると観点5つ × 5段階の文章を
 * 全部書き起こすことになり、実際にはまず使われない。
 *
 * 止め方は2段階にしている（等級要件・昇格要件と同じ作法）。
 *   - 「使わない」: 選択肢から外すだけ。中身は残り、あとからもう一度使える。
 *   - 「完全に消す」: 一度もアンケートに出しておらず、評価の記録にも無いときだけ出す。
 *     試しに作ったセットが一覧に残り続けないようにするための操作。
 * 一度でも使ったセットに「完全に消す」は出さない。消すと、公開したアンケートと
 * 確定済みの評価がぶら下げている観点まで巻き込むため。判定はサーバー側で行う。
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
  /** そのセットの観点を使っている場所（アンケート・評価）。空なら完全に消せる。 */
  usedBy: string[];
  /** 一緒に消えることになる観点の数（使わない設定のものも含む） */
  totalAspectCount: number;
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

  /** 完全に消す。消せるかどうかの判定はサーバー側が持つ。 */
  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await requestMasterDelete("behaviorBandSet", id);
    if (result.ok) {
      setMessage(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
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
      {message && <p className="m-0 mt-3 text-sub text-brand-deep">{message}</p>}

      {draft !== null && (
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="field-grid">
            <label>
              <span className="block text-note text-ink-muted">新しい基準の呼び名</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="input mt-1 w-full"
                placeholder="例：Manager向け"
              />
            </label>
            <label>
              <span className="block text-note text-ink-muted">中身の作り方</span>
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
          /* 止められない理由は2種類あり、扱いが違う。
             ①どれかの等級に出す設定が残っている … 行ごとに内容が違い、直す順番も示すので畳まない
             ②観点をアンケートに出したことがある … 行には「使用中（◯件）」だけ残し、
               どこで使っているかは押したら出す。全行で同じになる理由は一番下に1つだけ置く。 */
          /* 等級名はすぐ上の行に出ているので、理由の文では繰り返さない
             （繰り返すと、等級が増えたぶんだけ長い1文が行の中に出る）。 */
          const assignedReason = inUse ? BAND_SET_ASSIGNED_NEXT : null;
          const mark = blockedMark(set.usedBy);
          return (
            <div
              key={set.id}
              className="card-row items-start rounded-lg border border-line"
              data-off={set.isActive ? undefined : "true"}
            >
              <div className="row-main">
                {nameDraft === undefined ? (
                  <>
                    <p className="m-0 text-sub font-bold">{set.name}</p>
                    <p className="footnote m-0">
                      観点{set.aspectCount}件・
                      {inUse ? `${set.usedByGradeNames.join("／")}に出します` : "どの等級にも出していません"}
                    </p>
                    {/* 止められないときは、その理由と直す順番をここで読めるようにする */}
                    {assignedReason !== null && <p className="footnote m-0 mt-1">{assignedReason}</p>}
                    {mark !== null && <UsedByDetail mark={mark} usedBy={set.usedBy} />}
                  </>
                ) : (
                  <label className="block text-note text-ink-muted">
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
                    /* 使用中（どれかの等級に出している）ときは押せる形にしない。
                       押してから断るより、なぜ止められないかを左で先に読めるほうが早い。 */
                    inUse ? null : (
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
                  {assignedReason === null && mark === null && (
                    <ConfirmButton
                      label={DELETE_LABEL}
                      variant="danger-outline"
                      busy={busy}
                      confirm={deleteConfirmText(
                        set.name,
                        set.totalAspectCount > 0 ? `中に入っている観点${set.totalAspectCount}件も一緒に消えます。` : undefined,
                      )}
                      onConfirm={() => void remove(set.id)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全行で同じ文になる「なぜ消せないか」は、行から外してここへ1つだけ置く。
          「使用中」の基準が1つも無い画面には出さない（関わりのない説明を並べない）。 */}
      {sets.some((set) => set.usedBy.length > 0) && (
        <div className="mt-3">
          <Disclosure summary={BLOCKED_HELP_LABEL}>
            <p className="m-0 text-sub">{BLOCKED_WHY}</p>
            <p className="m-0 mt-1 text-sub">{BLOCKED_KEEP}</p>
            <p className="m-0 mt-1 text-sub">{BLOCKED_WHAT}</p>
          </Disclosure>
        </div>
      )}
    </Card>
  );
}
