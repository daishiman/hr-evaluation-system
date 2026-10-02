"use client";

import { useState } from "react";
import { revealCredentialMemo } from "@/actions/credential-memos";
import { useReadAction } from "@/lib/use-refresh";
import { formatDateTime } from "@/lib/view";
import { Button, Code, RowAction } from "@/components/ui";

/**
 * 一覧の行から、初期パスワードの控えを開き直す。
 *
 * 発行した直後の画面でしか値を見られないと、書き写す前に一覧が新しくなった・
 * 別の画面へ移った、で二度と見られなくなる。控えは暗号化して残してあるので、
 * 押した人にだけ、押したときに取りに行く（画面を開いた時点では値を持たない）。
 *
 * 出すのは控えがある行だけ（本人がパスワードを変えると控えは消える。発行から14日で開けなくなる）。
 * 開いた値は伏せ字にしない（渡す側が読み上げ・書き写しをするため。新規発行と同じ作法）。
 */
type Copy = "idle" | "copied" | "manual";

export function CredentialMemoButton({ userId, name }: { userId: string; name: string }) {
  const { read, reading } = useReadAction(revealCredentialMemo, { resource: "credential-memos" });
  const [memo, setMemo] = useState<{ password: string; issuedAt: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<Copy>("idle");

  const open = async () => {
    setError(null);
    const result = await read({ userId });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMemo({ password: result.password, issuedAt: result.issuedAt, expiresAt: result.expiresAt });
    setCopy("idle");
  };

  const write = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch {
      // クリップボードが使えない環境では、値を選んで写してもらう（値は画面に出ている）
      setCopy("manual");
    }
  };

  if (!memo) {
    return (
      <div className="credential-memo">
        <RowAction
          icon="key"
          onClick={() => void open()}
          disabled={reading}
          aria-label={`${name}さんの仮パスワードの控えを見る`}
        >
          {reading ? "開いています…" : "仮パスワードの控えを見る"}
        </RowAction>
        {error && (
          <p className="credential-memo-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="credential-memo" role="group" aria-label={`${name}さんの仮パスワードの控え`}>
      <span className="credential-memo-value">
        <Code>{memo.password}</Code>
      </span>
      <Button type="button" variant="secondary" onClick={() => void write(memo.password)}>
        {copy === "copied" ? "写しました" : "写す"}
      </Button>
      <Button type="button" variant="tertiary" onClick={() => setMemo(null)}>
        隠す
      </Button>
      <span className="footnote m-0">
        {formatDateTime(new Date(memo.issuedAt))}に発行・{formatDateTime(new Date(memo.expiresAt))}まで開けます
      </span>
      {copy === "manual" && (
        <p className="credential-memo-error" role="alert">
          自動で写せませんでした。値を選んで写してください。
        </p>
      )}
    </div>
  );
}
