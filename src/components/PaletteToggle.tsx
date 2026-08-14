"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ChoiceChip } from "@/components/ui";
import {
  DEFAULT_PALETTE,
  explicitPalette,
  PALETTE_LABELS,
  PALETTE_NOTES,
  PALETTE_STORAGE_KEY,
  PALETTES,
  storedPalette,
  type Palette,
} from "@/lib/palette";
import { recordAppliedThemeChoice } from "@/lib/theme-usage";

/**
 * 配色（色の系統）の切り替え。
 *
 * 作りは ThemeToggle と同じ。色そのものは globals.css の
 * html[data-palette] が持っていて、ここがやるのは属性の付け外しだけ。
 * ・グレー（既定） … 属性を外す。これまでと同じ見た目に戻る
 * ・それ以外       … data-palette を入れて、その系統の値へ入れ替える
 *
 * 明るさ（自動・明るい・暗い）とは独立している。
 * どちらを変えても、もう片方の選択はそのまま残る。
 */
function applyPalette(palette: Palette) {
  const root = document.documentElement;
  const explicit = explicitPalette(palette);
  if (explicit === null) delete root.dataset.palette;
  else root.dataset.palette = explicit;
}

export function PaletteToggle() {
  /* 初期値は既定の系統。保存されている値は下の useEffect で読み直す
     （サーバーには localStorage が無いので、ここで読むと表示がずれる）。 */
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    try {
      setPalette(storedPalette(localStorage.getItem(PALETTE_STORAGE_KEY)));
    } catch {
      /* 保存できない設定の端末では、毎回いつもの配色から始める */
    }
  }, []);

  function choose(next: Palette) {
    // 選択中の札を押し直しても、保存や計測を繰り返さない。
    if (next === palette) return;
    setPalette(next);
    applyPalette(next);
    try {
      if (next === DEFAULT_PALETTE) localStorage.removeItem(PALETTE_STORAGE_KEY);
      else localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      /* 保存できなくても、この画面の間は選んだ配色のまま使える */
    }
    // 見た目を変えてから数える。数えられなくても画面は変わっている。
    recordAppliedThemeChoice();
  }

  return (
    <div className="palette-choices" role="group" aria-label="画面の配色">
      {PALETTES.map((value) => {
        const selected = palette === value;
        return (
          <ChoiceChip
            key={value}
            selected={selected}
            onClick={() => choose(value)}
            aria-label={`画面の配色: ${PALETTE_LABELS[value]}（${PALETTE_NOTES[value]}）`}
            title={PALETTE_NOTES[value]}
          >
            <span className="palette-swatch" data-palette={value} aria-hidden />
            <span>{PALETTE_LABELS[value]}</span>
            <span className="palette-choice-status" aria-hidden>
              {selected && <Icon name="check" size={15} />}
            </span>
          </ChoiceChip>
        );
      })}
    </div>
  );
}
