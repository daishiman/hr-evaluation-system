import type { ReactNode } from "react";

/**
 * 画面下に固定する操作の帯。
 *
 * 縦に長い画面（アンケート回答・アンケート組み立て・評価セットの項目選択・
 * 等級要件の編集・評価詳細）で、「いま保存できているか」と「次に押すもの」を
 * スクロール位置に関係なく見えるようにする。
 *
 * 規律（docs/product/spec.md §6）:
 * - 固定する帯はこのファイル1箇所だけ。画面ごとに position: sticky を書かない。
 * - 同じ主要ボタンを本文と帯の両方に置かない（どちらか一方）。
 * - `status` には保存状態・進捗・締切など「事実」だけを置く。操作は children へ。
 *
 * ページの一番下に置くこと（本文の途中に置くと、そこから下でしか貼り付かない）。
 */
export function StickyActionBar({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        <div className="action-bar-status">{status}</div>
        <div className="action-bar-actions">{children}</div>
      </div>
    </div>
  );
}
