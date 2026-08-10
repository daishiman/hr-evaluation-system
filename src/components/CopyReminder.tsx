"use client";

import { useState } from "react";
import { Button, ReasonNote } from "@/components/ui";

/**
 * 未回答の方への連絡文を1クリックで作る。
 *
 * これまでは「誰が出していないか」をスプレッドシートで目視して、
 * 名前を手で書き写して催促していた。ここでは名前と回答URLを入れた文面を
 * そのまま作って渡す（送信はしない。宛先と送る手段は現場の判断に任せる）。
 */
export function CopyReminder({
  names,
  url,
  deadline,
}: {
  names: string[];
  url: string;
  deadline?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const text = [
    "評価アンケートのご提出のお願い",
    "",
    `下記の方は、まだご提出が確認できていません（${names.length}名）。`,
    names.map((n) => `・${n}`).join("\n"),
    "",
    `回答はこちらから：${url}`,
    deadline ? `提出期限：${deadline}` : "",
    "",
    "入力の途中で閉じても、次に開いたときに続きから入力できます。",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFallback(null);
    } catch {
      // クリップボードが使えない環境では、選んでコピーできる形で出す
      setFallback(text);
    }
  };

  return (
    <div>
      <Button type="button" variant="secondary" onClick={() => void copy()}>
        未回答の方への連絡文をコピーする
      </Button>
      {copied && <p className="m-0 mt-2 text-[13px] text-[var(--brand-deep)]">コピーしました。メールやチャットに貼り付けてお使いください。</p>}
      {fallback && (
        <div className="mt-2">
          <ReasonNote>この環境では自動でコピーできませんでした。下の文面を選んでコピーしてください。</ReasonNote>
          <textarea className="input mt-2 w-full font-mono text-[12px]" rows={8} readOnly value={fallback} />
        </div>
      )}
    </div>
  );
}
