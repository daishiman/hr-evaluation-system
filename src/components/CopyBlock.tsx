"use client";

import { useState } from "react";
import { Button, InlineDetail, ReasonNote } from "@/components/ui";

/**
 * 「押すとコピーできる1かたまり」。
 *
 * コピーできない環境（クリップボードを許していないブラウザ、古い端末）が
 * 実際にあるため、失敗したときは選んで取れる形へ自分で切り替える。
 * 「コピーしました」と出しておいて実は何も入っていない、が一番困る。
 *
 * 指示文の受け渡しと鍵の受け渡しで同じ作法にするため、置き場所は1つにする。
 */
type CopyResult = "idle" | "copied" | "manual";

export function CopyBlock({
  label,
  text,
  summary,
  ariaLabel,
  rows = 8,
  open,
}: {
  label: string;
  text: string;
  summary: string;
  ariaLabel: string;
  rows?: number;
  /** 最初から中身を見せるか（発行直後の鍵のように、その場で控えてほしいもの）。 */
  open?: boolean;
}) {
  const [result, setResult] = useState<CopyResult>("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setResult("copied");
    } catch {
      // クリップボードが使えない環境では、選んでコピーできる形で出す
      setResult("manual");
    }
  };

  return (
    <div>
      <InlineDetail summary={summary} open={open || result === "manual"}>
        <textarea
          aria-label={ariaLabel}
          className="input mt-2 w-full font-mono text-note"
          rows={rows}
          readOnly
          value={text}
        />
      </InlineDetail>
      <div className="mt-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {label}
        </Button>
      </div>
      {result === "copied" && (
        <p className="m-0 mt-2 text-sub text-brand-deep">コピーしました。そのまま貼り付けてください。</p>
      )}
      {result === "manual" && (
        <div className="mt-2" role="alert" aria-live="assertive">
          <ReasonNote>この環境では自動でコピーできませんでした。上で開いた文面を選んでコピーしてください。</ReasonNote>
        </div>
      )}
    </div>
  );
}
