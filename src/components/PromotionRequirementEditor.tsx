"use client";

import { useMasterAction } from "@/components/use-master-action";
import { useState } from "react";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { classifyVersionedItems, VersionedMasterSections } from "@/components/VersionedMasterSections";
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
import { ReorderList } from "@/components/reorder/ReorderList";
import { RevisableRequirementBody, revisableRequirementActions } from "@/components/RevisableRequirementRow";
import { useDraftMap } from "@/components/use-draft-map";

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
  stepLabel,
  rows,
  usage,
}: {
  gradeId: string;
  gradeName: string;
  /**
   * この等級から上がる昇格の段階の呼び名（「等級1→等級2」）。等級名から作った値を受け取り、最上位なら null（S1・A1）。
   * 行に保存してある transitionLabel は等級名を変えても追従しないので、画面には出さない（改訂の比較のためにだけ送り返す）。
   */
  stepLabel: string | null;
  rows: PromotionRow[];
  /** 項目ごとの「どこで使っているか」。空＝一度も使っていない＝完全に消せる。 */
  usage: UsageMap;
}) {
  const { send, remove, saving, error, message } = useMasterAction("promotionRequirement");
  const [drafts, setDrafts] = useState<Record<string, { open: boolean; text: string; gate: boolean }>>({});
  const editing = useDraftMap<string>();
  /* 並べ替えの保存中は、一覧を包む fieldset を止めない。止めると、いま押したつまみや矢印のボタンが
     disabled になってフォーカスが外れ、キーボードで続けて動かせなくなる（busy で受け付けだけを止める）。 */
  const [reordering, setReordering] = useState(false);
  const commitOrder = async (ids: string[]) => {
    setReordering(true);
    try {
      return await send({ kind: "promotionRequirementOrder", ids });
    } finally {
      setReordering(false);
    }
  };

  /* 使っている場所があるなら消させない。
     行に残すのは「使用中（◯件）」の一言だけで、どこで使っているかは押したら出す。
     全行で同じになる「なぜ消せないか」は、この部品の一番下に1つだけ置く。 */
  const usedByOf = (id: string) => usage[id] ?? [];
  const markOf = (id: string) => blockedMark(usedByOf(id));
  const anyBlocked = rows.some((r) => usedByOf(r.id).length > 0);
  /** 並べ替えの一覧の1行（本文と行の操作）に、どちらにも同じく渡す値 */
  const rowOf = (r: PromotionRow) => ({ id: r.id, text: r.text, usedBy: usedByOf(r.id), editing, busy: saving });

  const activeOf = (kind: PromoKind) =>
    classifyVersionedItems(rows.filter((row) => row.kind === kind))
      .current.filter((row) => row.isActive)
      .sort((a, b) => a.seq - b.seq);

  const block = (kind: PromoKind) => {
    const list = activeOf(kind);
    const draft = drafts[kind] ?? { open: false, text: "", gate: true };
    return (
      <Card key={kind}>
        {/* 項目を上から書き足していく画面なので、頭は固定表示にする。
            帯に載せるのは「いま何の種類を書いているか」と「いま何項目あるか」だけ。 */}
        {/* 「件数の上限なし・0項目でもよい」は2つの種類で同じ文なので、カードの頭ではなく冒頭の説明に1回だけ書く */}
        <CardHead
          pinned
          title={KIND_LABEL[kind]}
          actions={
            <span className="num text-title font-bold">
              {list.length}
              <span className="unit"> 項目</span>
            </span>
          }
        />

        {/* 追加の入力欄を開いているときだけ、ここに「まだありません」を出す。閉じているときは追加ボタンと同じ行に置く */}
        {list.length === 0 && draft.open && (
          <div className="card-pad">
            <p className="footnote m-0">この種類の項目はまだありません。</p>
          </div>
        )}

        {/* 並べ替えはつまみの長押し・ドラッグか矢印のボタン（S11・DD-005）。置いたら並び全体を1回で保存する */}
        {list.length > 0 && (
          <ReorderList
            items={list.map((r) => ({ ...r, label: r.text }))}
            label={`${KIND_LABEL[kind]}の並び`}
            className="reorder-in-card"
            busy={saving}
            onCommit={(ids) => commitOrder(ids)}
            renderItem={(r, i) => (
              <RevisableRequirementBody
                {...rowOf(r)}
                index={i}
                groupLabel={KIND_LABEL[kind]}
                /* 札は必須・任意だけ。対象の昇格（等級1→等級2）はこのタブの全行で同じなので、行ごとには繰り返さない */
                badge={r.isGate ? <Badge tone="alert">必須</Badge> : <Badge tone="done">任意</Badge>}
                onSave={(text) =>
                  send({
                    kind: "promotionRequirementRevise",
                    id: r.id,
                    text,
                    transitionLabel: r.transitionLabel,
                    isGate: r.isGate,
                  })
                }
              />
            )}
            renderActions={(r) =>
              revisableRequirementActions({
                ...rowOf(r),
                extraAction: (
                  <Button
                    variant="tertiary"
                    disabled={saving}
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
                ),
                onStop: () => void send({ kind: "promotionRequirementActivation", id: r.id, isActive: false }),
                onDelete: () => void remove(r.id),
              })
            }
          />
        )}

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
              {/* 対象の昇格は等級で決まるので、手では書かせない（手書きの等級名は、名前を変えると古いまま残る） */}
              {stepLabel && <p className="footnote m-0">対象の昇格：{stepLabel}（等級名から自動で表示します）</p>}
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
                  disabled={saving || draft.text.trim() === ""}
                  onClick={async () => {
                    const ok = await send({
                      kind: "promotionRequirementCreate",
                      gradeId,
                      reqKind: kind,
                      text: draft.text.trim(),
                      transitionLabel: null,
                      isGate: draft.gate,
                    });
                    if (ok) setDrafts((s) => ({ ...s, [kind]: { open: true, text: "", gate: draft.gate } }));
                  }}
                >
                  この内容で追加する
                </Button>
                <Button variant="tertiary" disabled={saving} onClick={() => setDrafts((s) => ({ ...s, [kind]: { open: false, text: "", gate: true } }))}>
                  閉じる
                </Button>
              </div>
            </div>
          ) : (
            /* 行の操作（内容を直す・今後使わない）と同じく右端に置く（左に1つだけ置くと右側が空いたまま残る。§28-9）。
               項目が無いときは「まだありません」を同じ行の左に置く（別の段にすると、その段は右側が空く） */
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {list.length === 0 && <p className="footnote m-0 mr-auto">この種類の項目はまだありません。</p>}
              <Button variant="secondary" disabled={saving} onClick={() => setDrafts((s) => ({ ...s, [kind]: { open: true, text: "", gate: true } }))}>
                ＋ 項目を追加
              </Button>
            </div>
          )}
        </div>

        <div className="card-pad grid gap-2 border-t border-line">
          <VersionedMasterSections
            sectionId={`promotion-${gradeId}-${kind}`}
            rows={rows.filter((row) => row.kind === kind)}
            busy={saving}
            renderDetail={(row) => (
              <>
                {stepLabel && <p className="footnote m-0">{stepLabel}</p>}
                <p className="footnote m-0">{row.isGate ? "必須" : "任意"}</p>
                {markOf(row.id) !== null && <UsedByDetail mark={markOf(row.id)!} usedBy={usedByOf(row.id)} />}
              </>
            )}
            renderStoppedAction={(row) =>
              markOf(row.id) === null ? (
                <ConfirmButton
                  label={DELETE_LABEL}
                  variant="danger-outline"
                  busy={saving}
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
    <fieldset disabled={saving && !reordering} aria-busy={saving} className="stack m-0 min-w-0 border-0 p-0">
      {/* 冒頭の説明は1つの段落にまとめる（短い文を1行ずつ積むと、その行ごとに右側が空く。§28-9） */}
      <p className="footnote m-0">
        いま編集しているのは <b>{gradeName}</b> の昇格要件です{stepLabel && `（${stepLabel}）`}。ここでの変更は次に作るアンケートから反映されます。
        すでに作成・公開したアンケートと確定済みの評価は変わりません。内容を直すと、新版を作ります。
        どちらの種類も件数の上限はなく、0項目のままでもかまいません。
      </p>
      {error && <div role="alert"><ReasonNote>{error}</ReasonNote></div>}
      <RefreshStatus message={message} refreshing={saving} />
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
    </fieldset>
  );
}
