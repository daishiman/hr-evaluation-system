"use client";

import { useState } from "react";
import {
  formatOnBlur,
  normalizeNumericText,
  normalizeWhileTyping,
  parseNumberInput,
  type NumberFieldPolicy,
} from "@/lib/domain/number-input";

/**
 * 数値を入れる欄（共通）。数値の欄はすべてこれを使う。
 *
 * 作法（画面ごとに変えない）:
 *  - **全角で打たれても黙って半角にする。**「半角で入力してください」と叱らない。
 *  - 表計算から貼り付けたときのカンマ・空白・単位の % も黙って落とす。
 *  - **打っている間は形を見ない。**「-」だけ・「1.」まででも消さない。
 *    形を整えるのは欄から離れたときだけ（打っている最中に文字数が変わるとカーソルが飛ぶ）。
 *  - **空欄を 0 にしない。** 空欄が「制限なし」を意味する欄があるため。
 *  - スマートフォン・タブレットでは最初から数字のキーボードを出す（そもそも全角が入りにくくする）。
 *
 * マイナス・小数を許すかは欄ごとに指定する（`policy`）。
 * 一律に禁止すると行動指針の -1 点や、達成率の小数が入らなくなる。
 */
export function NumberField({
  name,
  defaultValue,
  policy,
  unit,
  className,
  ariaLabel,
  id,
  onValueChange,
  reportWhileTyping,
  onEnter,
}: {
  name: string;
  defaultValue?: number | string | null;
  policy?: NumberFieldPolicy;
  /** 欄の右に出す単位（% / 件 / 点 など） */
  unit?: string | null;
  className?: string;
  ariaLabel?: string;
  id?: string;
  /** 確定した値を親へ渡す（空欄・読めない値は null） */
  onValueChange?: (value: number | null) => void;
  /**
   * 打っている最中も親へ値を渡す。
   * 下書きの自動保存がある画面で使う（欄から離れるまで保存されないと、
   * 打ったところで画面を閉じた人の入力が消えてしまうため）。
   */
  reportWhileTyping?: boolean;
  /** Enter を押したとき（次の設問へ送るなど） */
  onEnter?: () => void;
}) {
  const [text, setText] = useState(defaultValue === null || defaultValue === undefined ? "" : String(defaultValue));
  const [error, setError] = useState<string | null>(null);

  const numeric = policy?.allowDecimal === false && !policy?.allowNegative;

  return (
    <span className="inline-flex flex-col">
      <span className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          value={text}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          /* 数字キーボードの出し分け。整数だけ・マイナス無しの欄は numeric、
             それ以外は小数点や符号も打てる decimal にする。 */
          inputMode={numeric ? "numeric" : "decimal"}
          enterKeyHint="next"
          autoComplete="off"
          onChange={(e) => {
            /* 打っている間は全角→半角の置き換えだけ。文字数が変わらないのでカーソルがずれない。 */
            const next = normalizeWhileTyping(e.target.value);
            setText(next);
            if (error) setError(null);
            if (reportWhileTyping) {
              const parsed = parseNumberInput(next, policy);
              onValueChange?.(parsed.kind === "ok" ? parsed.value : null);
            }
          }}
          onPaste={(e) => {
            /* 貼り付けは「打っている途中」ではないので、その場でカンマ・空白まで落とす。
               既定の貼り付けを止めて自分で差し込み、カーソルを貼った文字の直後に置く。 */
            const pasted = e.clipboardData.getData("text");
            if (pasted === "") return;
            e.preventDefault();
            const el = e.currentTarget;
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            const cleaned = normalizeNumericText(pasted);
            const next = el.value.slice(0, start) + cleaned + el.value.slice(end);
            setText(next);
            if (error) setError(null);
            if (reportWhileTyping) {
              const parsed = parseNumberInput(next, policy);
              onValueChange?.(parsed.kind === "ok" ? parsed.value : null);
            }
            const caret = start + cleaned.length;
            requestAnimationFrame(() => el.setSelectionRange(caret, caret));
          }}
          onKeyDown={(e) => {
            if (!onEnter || e.key !== "Enter") return;
            // 日本語変換の確定Enterでは動かさない
            if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
            e.preventDefault();
            onEnter();
          }}
          onBlur={() => {
            const shaped = formatOnBlur(text, policy);
            setText(shaped);
            const parsed = parseNumberInput(shaped, policy);
            setError(parsed.kind === "invalid" ? parsed.reason : null);
            onValueChange?.(parsed.kind === "ok" ? parsed.value : null);
          }}
          className={className ?? "input input-num w-32"}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
      {error && <span className="footnote text-[var(--danger)]">{error}</span>}
    </span>
  );
}
