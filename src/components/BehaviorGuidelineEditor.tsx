"use client";

import { useMasterAction } from "@/components/use-master-action";
import { useState } from "react";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListAddRow, ListRowBody } from "@/components/ListRow";
import { UsedByDetail } from "@/components/UsedByDetail";
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
import { useDraftMap } from "@/components/use-draft-map";

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
 *   - 1件＝1行で読み、「内容を直す」を押したときだけ入力欄が開く（行の形は ListRowBody。spec §28-14）
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
  const { send, remove, saving, error, message } = useMasterAction("behaviorGuideline");
  /** 開いている入力欄。行のidをキーにして、開いているものだけを持つ */
  const editingLevel = useDraftMap<{ label: string; text: string }>();
  const editingName = useDraftMap<string>();
  /** 「＋ 観点を追加」を開いているときだけ持つ下書き。 */
  const [newAspectName, setNewAspectName] = useState<string | null>(null);

  const list = rows.filter((r) => r.band === band).sort((a, b) => a.seq - b.seq);

  /* 観点ごとに残すのは「使用中（◯件）」の一言だけ。どこで使っているかは押したら出す。
     全観点で同じになる「なぜ消せないか」は、この部品の一番下に1つだけ置く。 */
  const usedByOf = (id: string) => usage[id] ?? [];
  const anyBlocked = list.some((g) => usedByOf(g.id).length > 0);

  return (
    <fieldset disabled={saving} aria-busy={saving} className="stack m-0 min-w-0 border-0 p-0">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={saving} />

      {list.length === 0 && (
        <ReasonNote>
          {behaviorBandLabel(bandSets, band)}にはまだ問う内容がありません。下の「＋ 観点を追加」から作るか、
          ほかの基準を複製して作り直してください。この基準を等級に出しても、行動指針の設問は出ません。
        </ReasonNote>
      )}

      {list.map((g) => {
        const mark = blockedMark(usedByOf(g.id));
        const renaming = editingName.drafts[g.id] !== undefined;
        return (
        <Card key={g.id} off={!g.isActive}>
          {/* 5段階ぶんの文章を続けて書くので、頭は固定表示にする。
              いま何の観点の文章を書いているかが見えないまま下まで進んでしまう。
              操作の並びは、ほかの一覧の行と同じ（直す → 今後使わない／もう一度使う → 完全に消す。spec §28-14） */}
          <CardHead
            pinned
            title={
              !renaming ? (
                <>
                  {g.aspectName}
                  {!g.isActive && (
                    <>
                      {" "}
                      <Badge tone="dropped">使用しない</Badge>
                    </>
                  )}
                </>
              ) : (
                <input
                  value={editingName.drafts[g.id]}
                  onChange={(e) => editingName.change(g.id, e.target.value)}
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
              renaming ? (
                <>
                  <Button
                    variant="primary"
                    disabled={saving || editingName.drafts[g.id].trim() === ""}
                    onClick={async () => {
                      const ok = await send({ kind: "behaviorGuideline", id: g.id, aspectName: editingName.drafts[g.id].trim() });
                      if (ok) editingName.stop(g.id);
                    }}
                  >
                    保存する
                  </Button>
                  <Button variant="tertiary" disabled={saving} onClick={() => editingName.stop(g.id)}>
                    やめる
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="tertiary" disabled={saving} onClick={() => editingName.start(g.id, g.aspectName)}>
                    呼び名を直す
                  </Button>
                  {g.isActive ? (
                    <ConfirmButton
                      label="今後使わない"
                      variant="danger-outline"
                      busy={saving}
                      confirm={`「${g.aspectName}」を次に作るアンケートから出さないようにします。すでに公開したアンケートと確定済みの評価はそのまま残ります。`}
                      onConfirm={() => void send({ kind: "behaviorGuideline", id: g.id, isActive: false })}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void send({ kind: "behaviorGuideline", id: g.id, isActive: true })}
                    >
                      もう一度使う
                    </Button>
                  )}
                  {mark === null && (
                    <ConfirmButton
                      label={DELETE_LABEL}
                      variant="danger-outline"
                      busy={saving}
                      confirm={deleteConfirmText(g.aspectName, `5段階の文章${g.levels.length}件も一緒に消えます。`)}
                      onConfirm={() => void remove(g.id)}
                    />
                  )}
                </>
              )
            }
          />

          {/* 観点ごとに残すのは「使用中（◯件）」だけ。どこで使っているかは押したら出す。
              全観点で同じになる理由は、この部品の一番下にまとめてある。 */}
          {mark !== null && (
            <div className="card-pad border-b border-line">
              <UsedByDetail mark={mark} usedBy={usedByOf(g.id)} />
            </div>
          )}

          {/* 段階の行は、ほかの一覧と同じ行の形（番号の列に点数、本文、右の列に操作。spec §28-14） */}
          <ol className="list-rows" aria-label={`「${g.aspectName}」の段階`}>
            {[...g.levels]
              .sort((a, b) => b.score - a.score)
              .map((lv) => {
                const draft = editingLevel.drafts[lv.id];
                const score = (
                  <>
                    {lv.score > 0 ? `+${lv.score}` : lv.score}
                    <span className="sr-only">点</span>
                  </>
                );
                return (
                  <li key={lv.id} className="card-row">
                    {draft === undefined ? (
                      <ListRowBody
                        number={score}
                        text={
                          <>
                            <b>【{lv.label}】</b>
                            {lv.text}
                          </>
                        }
                      />
                    ) : (
                      <ListRowBody number={score}>
                        <label className="block text-note text-ink-muted">
                          この段階の呼び名
                          <input
                            value={draft.label}
                            onChange={(e) => editingLevel.change(lv.id, { ...draft, label: e.target.value })}
                            className="input mt-1 w-full"
                          />
                        </label>
                        <label className="mt-2 block text-note text-ink-muted">
                          どういう状態か
                          <textarea
                            value={draft.text}
                            rows={2}
                            onChange={(e) => editingLevel.change(lv.id, { ...draft, text: e.target.value })}
                            className="input mt-1 w-full"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            disabled={saving || draft.label.trim() === "" || draft.text.trim() === ""}
                            onClick={async () => {
                              const ok = await send({
                                kind: "behaviorLevel",
                                id: lv.id,
                                label: draft.label.trim(),
                                text: draft.text.trim(),
                              });
                              if (ok) editingLevel.stop(lv.id);
                            }}
                          >
                            保存する
                          </Button>
                          <Button variant="tertiary" disabled={saving} onClick={() => editingLevel.stop(lv.id)}>
                            やめる
                          </Button>
                        </div>
                      </ListRowBody>
                    )}
                    {draft === undefined && (
                      <div className="row-actions">
                        <Button
                          variant="tertiary"
                          disabled={saving}
                          onClick={() => editingLevel.start(lv.id, { label: lv.label, text: lv.text })}
                        >
                          内容を直す
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ol>
        </Card>
        );
      })}

      {/* 足すボタンは、どの一覧でも一覧の下の左端に置く（spec §28-14） */}
      <Card className="card-pad">
        {newAspectName === null ? (
          <ListAddRow note="この基準で問う項目を1つ増やします（5段階の文章は下書きが入ります）。">
            <Button variant="secondary" disabled={saving} onClick={() => setNewAspectName("")}>
              ＋ 観点を追加
            </Button>
          </ListAddRow>
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
                disabled={saving || newAspectName.trim() === ""}
                onClick={async () => {
                  const ok = await send({ kind: "behaviorGuideline", band, aspectName: newAspectName.trim() });
                  if (ok) setNewAspectName(null);
                }}
              >
                追加する
              </Button>
              <Button variant="tertiary" disabled={saving} onClick={() => setNewAspectName(null)}>
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
