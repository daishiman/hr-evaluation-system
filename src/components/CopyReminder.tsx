"use client";

import { useState } from "react";
import { Button, InlineDetail, ReasonNote } from "@/components/ui";

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
  const [result, setResult] = useState<"idle" | "copied" | "manual">("idle");

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
      setResult("copied");
    } catch {
      // クリップボードが使えない環境では、選んでコピーできる形で出す
      setResult("manual");
    }
  };

  return <CopyReminderView text={text} result={result} onCopy={() => void copy()} />;
}

export function CopyReminderView({
  text,
  result,
  onCopy,
}: {
  text: string;
  result: "idle" | "copied" | "manual";
  onCopy: () => void;
}) {
  return (
    <div>
      {/* 送る前に中身（宛先・URL・期限）を確認できるようにする。
          クリップボードAPIの成否に関わらず、常にこの場で開ける。 */}
      <InlineDetail summary="送る文面を確認する" open={result === "manual"}>
        <textarea
          aria-label="未回答者への連絡文"
          className="input mt-2 w-full font-mono text-note"
          rows={8}
          readOnly
          value={text}
        />
      </InlineDetail>
      <div className="mt-2">
        <Button type="button" variant="secondary" onClick={onCopy}>
          未回答の方への連絡文をコピーする
        </Button>
      </div>
      {result === "copied" && (
        <p className="m-0 mt-2 text-sub text-brand-deep">
          コピーしました。メールやチャットに貼り付けてお使いください。
        </p>
      )}
      {result === "manual" && (
        <div className="mt-2" role="alert" aria-live="assertive">
          <ReasonNote>この環境では自動でコピーできませんでした。上で開いた文面を選んでコピーしてください。</ReasonNote>
        </div>
      )}
    </div>
  );
}
