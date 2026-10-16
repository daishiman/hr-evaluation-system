import type { ReactNode } from "react";

/**
 * 回答者に向けた指示の文（節の説明・アンケートの説明文）を、見本の画面で引用の形にして出す。
 *
 * 見本を開くのは管理者や別の等級の人もいる。「入力してください」をそのまま出すと、
 * 見ている人への指示と読まれ、入力できないことが不具合に見える（spec §28-16）。
 * 札は太字にして引用の文と分ける。回答画面は読み手が回答者本人なので、これを使わない。
 */
export function RespondentGuide({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="font-bold">回答者への案内</span>：「{children}」
    </>
  );
}
