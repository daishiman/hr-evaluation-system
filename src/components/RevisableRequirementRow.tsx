import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import type { DraftMap } from "@/components/use-draft-map";
import { DELETE_LABEL, blockedMark, deleteConfirmText } from "@/lib/domain/master-delete";

/**
 * 版を持つ要件（等級要件・昇格要件）の、並べ替えの一覧の1行。
 * ReorderList の renderItem に本文（RevisableRequirementBody）、renderActions に行の操作を渡す。
 *
 * 2つの画面で行の形をそろえる:
 *   - 本文: 番号・本文・「使用中（◯件）」。直している間は入力欄と「新版として保存」「やめる」
 *   - 行の操作: 内容を直す・今後使わない・完全に消す（一度も使っていない行だけ）
 * 画面ごとに違うのは、本文の後ろの札・保存で送る中身・足す操作・入力欄の読み上げ名の頭の語だけなので、それを受け取る。
 * 内容を直しても上書きはせず、新版を作る（以前の内容は変更履歴に残る）。
 */

type RowBase = {
  id: string;
  text: string;
  /** この行を使っている場所。空＝一度も使っていない＝完全に消せる */
  usedBy: readonly string[];
  /** 直している行の下書き。画面ごとに1つ持ち、本文と行の操作で同じものを渡す */
  editing: DraftMap<string>;
  busy: boolean;
};

export function RevisableRequirementBody({
  id,
  text,
  usedBy,
  editing,
  busy,
  index,
  groupLabel,
  badge,
  onSave,
}: RowBase & {
  /** 一覧の中の位置（0 から）。番号と入力欄の読み上げ名に使う */
  index: number;
  /** 区分・種類の呼び名。入力欄の読み上げ名の頭に付ける（「支援について 1件目の内容」） */
  groupLabel: string;
  /** 本文の直後に付ける札（昇格要件の必須・任意） */
  badge?: ReactNode;
  /** 新版として保存する。前後の空白は落として渡す。true が返ったときだけ入力欄を閉じる（失敗したら書いた内容を残す） */
  onSave: (text: string) => Promise<boolean>;
}) {
  const mark = blockedMark(usedBy);
  const draft = editing.drafts[id];
  return (
    <div className="flex items-start gap-3">
      <span className="num mt-[2px] w-6 shrink-0 text-sub text-ink-muted">{index + 1}</span>
      <div className="row-main">
        {draft === undefined ? (
          <>
            {/* 札は行の性質なので、押すボタンの列ではなく本文の直後に置く */}
            <p className="m-0 text-sub">
              {text}
              {badge && <>{" "}{badge}</>}
            </p>
            {mark !== null && <UsedByDetail mark={mark} usedBy={usedBy} />}
          </>
        ) : (
          <>
            <textarea
              value={draft}
              autoFocus
              onChange={(e) => editing.change(id, e.target.value)}
              rows={2}
              className="input w-full"
              aria-label={`${groupLabel} ${index + 1}件目の内容`}
            />
            <p className="footnote m-0 mt-1">以前の内容は変更履歴に残ります。</p>
            <div className="mt-2 flex gap-2">
              <Button
                variant="primary"
                disabled={busy || draft.trim() === ""}
                onClick={async () => {
                  const ok = await onSave(draft.trim());
                  if (ok) editing.stop(id);
                }}
              >
                新版として保存
              </Button>
              <Button variant="tertiary" disabled={busy} onClick={() => editing.stop(id)}>
                やめる
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 行の操作。直している行は null を返し、操作の列を作らず入力欄を行の幅いっぱいに使う
 * （ReorderList は null が返った行にだけ操作の列を作らない）。
 * 部品（<… />）にしないのは、何も描かない部品でも、ReorderList から見ると中身のある操作になり、空の列が残るため。
 */
export function revisableRequirementActions({
  id,
  text,
  usedBy,
  editing,
  busy,
  extraAction,
  onStop,
  onDelete,
}: RowBase & {
  /** 「内容を直す」の次に置く、画面ごとの操作（昇格要件の「任意の新版にする／必須の新版にする」） */
  extraAction?: ReactNode;
  /** 今後使わない（次に作るアンケートから外す。あとから戻せる） */
  onStop: () => void;
  /** 完全に消す。一度も使っていない行にだけ出す */
  onDelete: () => void;
}): ReactNode {
  if (editing.isEditing(id)) return null;
  return (
    <>
      <Button variant="tertiary" disabled={busy} onClick={() => editing.start(id, text)}>
        内容を直す
      </Button>
      {extraAction}
      <ConfirmButton
        label="今後使わない"
        variant="danger-outline"
        busy={busy}
        confirm={`「${text}」を今後使わない設定にします。過去のアンケートと評価は変わりません。`}
        onConfirm={onStop}
      />
      {blockedMark(usedBy) === null && (
        <ConfirmButton
          label={DELETE_LABEL}
          variant="danger-outline"
          busy={busy}
          confirm={deleteConfirmText(text)}
          onConfirm={onDelete}
        />
      )}
    </>
  );
}
