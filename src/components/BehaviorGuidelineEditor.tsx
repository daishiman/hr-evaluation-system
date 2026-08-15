"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useState } from "react";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { requestMasterDelete } from "@/components/master-delete-request";
import { behaviorBandLabel, type BehaviorBandSetRow } from "@/lib/domain/behavior";
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

/**
 * 行動指針（観点 × 5段階の文言）の編集。
 *
 * 点数（模範3／信頼2／安定1／不安定0／悪影響-1）は制度の骨格なので変えられない。
 * 変えられるのは「どういう状態をその点数と見なすか」の文章、その呼び名、
 * 次に作るアンケートでその観点を使うかどうかだけにしている。
 * 点数まで会社ごとに動かせるようにすると、昇格に必要な点数（等級ごとに設定）の意味が
 * 会社ごとにずれ、過去の評価と比べられなくなる。
 *
 * 等級要件・昇格要件の編集と同じ作法に揃える:
 *   - 1件＝1行で読み、「直す」を押したときだけ入力欄が開く
 *   - 保存すると次に作るアンケートから反映される（公開済みと確定済みは動かない）
 */

export interface BehaviorLevelRow {
  id: string;
  score: number;
  label: string;
  text: string;
}

export interface BehaviorGuidelineRow {
  id: string;
  band: string;
  aspect: string;
  aspectName: string;
  seq: number;
  isActive: boolean;
  levels: BehaviorLevelRow[];
}

export function BehaviorGuidelineEditor({
  band,
  bandSets,
  rows,
  usage,
}: {
  band: string;
  bandSets: readonly BehaviorBandSetRow[];
  rows: BehaviorGuidelineRow[];
  /** 観点ごとの「どこで使っているか」。空＝一度も使っていない＝完全に消せる。 */
  usage: UsageMap;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** 開いている入力欄。行のidをキーにして、開いているものだけを持つ */
  const [editingLevel, setEditingLevel] = useState<Record<string, { label: string; text: string }>>({});
  const [editingName, setEditingName] = useState<Record<string, string>>({});
  /** 「観点を追加する」を開いているときだけ持つ下書き。 */
  const [newAspectName, setNewAspectName] = useState<string | null>(null);

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
    const result = await requestMasterDelete("behaviorGuideline", id);
    if (result.ok) {
      setMessage(result.message);
      refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
  };

  const list = rows.filter((r) => r.band === band).sort((a, b) => a.seq - b.seq);

  /* 観点ごとに残すのは「使用中（◯件）」の一言だけ。どこで使っているかは押したら出す。
     全観点で同じになる「なぜ消せないか」は、この部品の一番下に1つだけ置く。 */
  const usedByOf = (id: string) => usage[id] ?? [];
  const anyBlocked = list.some((g) => usedByOf(g.id).length > 0);

  return (
    <fieldset disabled={busy || refreshing} aria-busy={busy || refreshing} className="stack m-0 min-w-0 border-0 p-0">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={refreshing} />

      {list.length === 0 && (
        <ReasonNote>
          {behaviorBandLabel(bandSets, band)}にはまだ問う内容がありません。下の「観点を追加する」から作るか、
          ほかの基準を複製して作り直してください。この基準を等級に出しても、行動指針の設問は出ません。
        </ReasonNote>
      )}

      {list.map((g) => {
        const mark = blockedMark(usedByOf(g.id));
        return (
        <Card key={g.id} className="card-pad" off={!g.isActive}>
          {/* 5段階ぶんの文章を続けて書くので、頭は固定表示にする。
              いま何の観点の文章を書いているかが見えないまま下まで進んでしまう。 */}
          <CardHead
            pinned
            title={
              editingName[g.id] === undefined ? (
                g.aspectName
              ) : (
                <input
                  value={editingName[g.id]}
                  onChange={(e) => setEditingName((s) => ({ ...s, [g.id]: e.target.value }))}
                  className="input w-full"
                  aria-label="観点の呼び名"
                />
              )
            }
            sub={
              g.isActive
                ? `次に作るアンケートでは、この呼び名がそのまま設問になります（${g.levels.length}段階）`
                : `現在は使いません。すでに公開したアンケートと確定済みの評価はそのまま残ります（${g.levels.length}段階）`
            }
            actions={
              <>
                <Badge tone={g.isActive ? "active" : "dropped"}>{g.isActive ? "使用中" : "使用しない"}</Badge>
                {g.isActive ? (
                  <ConfirmButton
                    label="使わない"
                    variant="danger-outline"
                    busy={busy}
                    confirm={`「${g.aspectName}」を次に作るアンケートから出さないようにします。すでに公開したアンケートと確定済みの評価はそのまま残ります。`}
                    onConfirm={() => void send({ kind: "behaviorGuideline", id: g.id, isActive: false })}
                  />
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void send({ kind: "behaviorGuideline", id: g.id, isActive: true })}
                  >
                    もう一度使う
                  </Button>
                )}
                {editingName[g.id] === undefined ? (
                  <Button variant="tertiary" disabled={busy} onClick={() => setEditingName((s) => ({ ...s, [g.id]: g.aspectName }))}>
                    呼び名を直す
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      disabled={busy || editingName[g.id].trim() === ""}
                      onClick={async () => {
                        const ok = await send({ kind: "behaviorGuideline", id: g.id, aspectName: editingName[g.id].trim() });
                        if (ok) setEditingName((s) => { const n = { ...s }; delete n[g.id]; return n; });
                      }}
                    >
                      保存する
                    </Button>
                    <Button
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => setEditingName((s) => { const n = { ...s }; delete n[g.id]; return n; })}
                    >
                      やめる
                    </Button>
                  </>
                )}
                {editingName[g.id] === undefined && mark === null && (
                  <ConfirmButton
                    label={DELETE_LABEL}
                    variant="danger-outline"
                    busy={busy}
                    confirm={deleteConfirmText(g.aspectName, `5段階の文章${g.levels.length}件も一緒に消えます。`)}
                    onConfirm={() => void remove(g.id)}
                  />
                )}
              </>
            }
          />

          {/* 観点ごとに残すのは「使用中（◯件）」だけ。どこで使っているかは押したら出す。
              全観点で同じになる理由は、この部品の一番下にまとめてある。 */}
          {mark !== null && <UsedByDetail mark={mark} usedBy={usedByOf(g.id)} />}

          <div className="mt-3 grid gap-2">
            {[...g.levels]
              .sort((a, b) => b.score - a.score)
              .map((lv) => {
                const draft = editingLevel[lv.id];
                return (
                  <div key={lv.id} className="card-row items-start rounded-lg border border-line">
                    <span className="num w-8 shrink-0 text-sub font-bold">{lv.score > 0 ? `+${lv.score}` : lv.score}</span>
                    <div className="row-main">
                      {draft === undefined ? (
                        <>
                          <p className="m-0 text-sub">
                            <b>【{lv.label}】</b>
                            {lv.text}
                          </p>
                        </>
                      ) : (
                        <>
                          <label className="block text-note text-ink-muted">
                            この段階の呼び名
                            <input
                              value={draft.label}
                              onChange={(e) => setEditingLevel((s) => ({ ...s, [lv.id]: { ...draft, label: e.target.value } }))}
                              className="input mt-1 w-full"
                            />
                          </label>
                          <label className="mt-2 block text-note text-ink-muted">
                            どういう状態か
                            <textarea
                              value={draft.text}
                              rows={2}
                              onChange={(e) => setEditingLevel((s) => ({ ...s, [lv.id]: { ...draft, text: e.target.value } }))}
                              className="input mt-1 w-full"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              disabled={busy || draft.label.trim() === "" || draft.text.trim() === ""}
                              onClick={async () => {
                                const ok = await send({
                                  kind: "behaviorLevel",
                                  id: lv.id,
                                  label: draft.label.trim(),
                                  text: draft.text.trim(),
                                });
                                if (ok) setEditingLevel((s) => { const n = { ...s }; delete n[lv.id]; return n; });
                              }}
                            >
                              保存する
                            </Button>
                            <Button
                              variant="tertiary"
                              disabled={busy}
                              onClick={() => setEditingLevel((s) => { const n = { ...s }; delete n[lv.id]; return n; })}
                            >
                              やめる
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    {draft === undefined && (
                      <div className="row-actions">
                        <Badge tone={lv.score >= 1 ? "done" : "dropped"}>{lv.score}点</Badge>
                        <Button
                          variant="tertiary"
                          disabled={busy}
                          onClick={() => setEditingLevel((s) => ({ ...s, [lv.id]: { label: lv.label, text: lv.text } }))}
                        >
                          直す
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
        );
      })}

      <Card className="card-pad">
        {newAspectName === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setNewAspectName("")}>
              観点を追加する
            </Button>
            <span className="footnote">この基準で問う項目を1つ増やします（5段階の文章は下書きが入ります）。</span>
          </div>
        ) : (
          <>
            <label className="block text-note text-ink-muted">
              観点の呼び名（そのまま設問になります）
              <input
                value={newAspectName}
                onChange={(event) => setNewAspectName(event.target.value)}
                className="input mt-1 w-full"
                placeholder="例：協調性について"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busy || newAspectName.trim() === ""}
                onClick={async () => {
                  const ok = await send({ kind: "behaviorGuideline", band, aspectName: newAspectName.trim() });
                  if (ok) setNewAspectName(null);
                }}
              >
                追加する
              </Button>
              <Button variant="tertiary" disabled={busy} onClick={() => setNewAspectName(null)}>
                やめる
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* 全観点で同じ文になる「なぜ消せないか」は、観点の箱から外してここへ1つだけ置く。
          「使用中」の観点が1つも無い画面には出さない（関わりのない説明を並べない）。 */}
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
