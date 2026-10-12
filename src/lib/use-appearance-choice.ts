"use client";

import { useEffect, useState } from "react";
import { recordAppliedThemeChoice } from "@/lib/theme-usage";

/** 明るさ・配色で共有する選択操作。値の契約と表示部品は各軸が持つ。 */
export function useAppearanceChoice<T extends string>({
  attribute,
  storageKey,
  defaultValue,
  stored,
  explicit,
}: {
  attribute: "theme" | "palette";
  storageKey: string;
  defaultValue: T;
  stored: (value: unknown) => T;
  explicit: (value: T) => string | null;
}) {
  // SSR と初回描画は既定値で揃える。描画前スクリプトが適用した DOM を mount 後に読む。
  const [value, setValue] = useState<T>(defaultValue);
  useEffect(() => {
    // 保存失敗後にメニューを開き直しても、古い保存値へ選択表示を巻き戻さない。
    setValue(stored(document.documentElement.dataset[attribute]));
  }, [attribute, stored]);

  function choose(next: T) {
    if (next === value) return;
    setValue(next);
    const root = document.documentElement;
    const applied = explicit(next);
    if (applied === null) delete root.dataset[attribute];
    else root.dataset[attribute] = applied;
    try {
      if (applied === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, next);
    } catch {
      // 保存できなくても、現在の画面とメニューの選択は適用済み DOM に揃う。
    }
    // 両軸が反映された DOM を記録する。保存・計測は見た目の変更を妨げない。
    recordAppliedThemeChoice();
  }

  return { value, choose };
}
