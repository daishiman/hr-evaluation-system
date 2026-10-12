"use client";

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
import { useAppearanceChoice } from "@/lib/use-appearance-choice";

/**
 * 配色（色の系統）の切り替え。
 *
 * 作りは ThemeToggle と同じ。色そのものは globals.css の
 * html[data-palette] が持っていて、ここがやるのは属性の付け外しだけ。
 * ・既定（インディゴ） … 属性を外す。:root の値がそのまま当たる
 * ・それ以外           … data-palette を入れて、その系統の値へ入れ替える
 *
 * 明るさ（自動・明るい・暗い）とは独立している。
 * どちらを変えても、もう片方の選択はそのまま残る。
 */
export function PaletteToggle() {
  const { value: palette, choose } = useAppearanceChoice<Palette>({
    attribute: "palette",
    storageKey: PALETTE_STORAGE_KEY,
    defaultValue: DEFAULT_PALETTE,
    stored: storedPalette,
    explicit: explicitPalette,
  });

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
