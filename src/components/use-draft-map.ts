"use client";

import { useState } from "react";

/** 行ごとの開いている入力欄。行の id をキーにして、開いているものだけを持つ。 */
export type DraftMap<T> = {
  drafts: Readonly<Record<string, T>>;
  /** 入力欄を開く。初めの値（いまの内容）を入れておく */
  start: (id: string, value: T) => void;
  change: (id: string, value: T) => void;
  /** 入力欄を閉じる（保存できたとき・やめたとき）。キーごと消すので、空欄のまま開いている行とは区別がつく */
  stop: (id: string) => void;
  isEditing: (id: string) => boolean;
};

/**
 * 一覧の行ごとの下書き（等級要件・昇格要件の本文、行動指針の呼び名・段階の文章）。
 * 開く・書き換える・閉じるの3つを、どの編集画面でも同じ形で持つ。
 */
export function useDraftMap<T>(): DraftMap<T> {
  const [drafts, setDrafts] = useState<Record<string, T>>({});
  const put = (id: string, value: T) => setDrafts((s) => ({ ...s, [id]: value }));
  return {
    drafts,
    start: put,
    change: put,
    stop: (id) =>
      setDrafts((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      }),
    isEditing: (id) => drafts[id] !== undefined,
  };
}
