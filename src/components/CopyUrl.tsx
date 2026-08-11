"use client";

import { useState } from "react";

/**
 * 配布用URLを、そのまま開ける形で見せて、1クリックでコピーできるようにする。
 *
 * URLは手で書き写すと必ず打ち間違える（トークンは意味のない文字列なので、
 * 間違えても気づけない）。表示とコピーを同じ文字列から作り、写経の余地を無くす。
 */
export function CopyUrl({ url, label = "配布用のURL" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // クリップボードが使えない環境（http や古いブラウザ）では、選択してコピーしてもらう
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="footnote m-0">{label}：</span>
      <a href={url} className="text-[11px] underline break-all" target="_blank" rel="noreferrer">
        {url}
      </a>
      <button type="button" className="btn btn-tertiary text-[11px]" onClick={() => void copy()}>
        {copied ? "コピーしました" : "コピー"}
      </button>
    </span>
  );
}
