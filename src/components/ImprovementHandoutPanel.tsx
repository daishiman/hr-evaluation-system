"use client";

import { useState } from "react";
import { RefreshStatus } from "@/components/RefreshStatus";
import { Button, Card, InlineDetail, ReasonNote } from "@/components/ui";
import { useRefreshAfterSave } from "@/lib/use-refresh";

/**
 * 届いた要望1件を、作業する側（Claude Code）へ渡す。
 *
 * 渡し方は2通りある。どちらでも中身は同じ文面になる。
 *  ・指示文そのものを貼る（その場で読ませたいとき）
 *  ・取得コマンドを貼る（作業する側に取りにいかせるとき）
 * 外へ出す通信はここには無い。押した瞬間に社外へ何かが出ることはない。
 *
 * 「払い出し済みにする」だけがサーバーへ届く操作で、渡した日時と
 * そのときの内容を控える。控えがあるので、あとで内容が変わったときに
 * 「更新あり」と出せる。
 */

type CopyResult = "idle" | "copied" | "manual";

/** コピーの押しもの1つ分。うまくいかない環境では、選んで取れる形に切り替える。 */
function CopyBlock({
  label,
  text,
  summary,
  ariaLabel,
}: {
  label: string;
  text: string;
  summary: string;
  ariaLabel: string;
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
      <InlineDetail summary={summary} open={result === "manual"}>
        <textarea
          aria-label={ariaLabel}
          className="input mt-2 w-full font-mono text-note"
          rows={8}
          readOnly
          value={text}
        />
      </InlineDetail>
      <div className="mt-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {label}
        </Button>
      </div>
      {result === "copied" && <p className="m-0 mt-2 text-sub text-brand-deep">コピーしました。そのまま貼り付けてください。</p>}
      {result === "manual" && (
        <div className="mt-2" role="alert" aria-live="assertive">
          <ReasonNote>この環境では自動でコピーできませんでした。上で開いた文面を選んでコピーしてください。</ReasonNote>
        </div>
      )}
    </div>
  );
}

export function ImprovementHandoutPanel({
  id,
  document,
  prompt,
}: {
  id: string;
  /** 作業指示文の全文。下見と「指示文をコピー」で同じものを使う。 */
  document: string;
  /** 作業する側に貼る文。取得コマンドを含む。 */
  prompt: string;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (busy || refreshing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/improvements", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "handout" }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; result?: { reason?: string } };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "払い出しを記録できませんでした。");
        return;
      }
      setMessage(json.result?.reason ?? "払い出しを記録しました。");
      refresh();
    } catch {
      setError("通信できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={refreshing} target="画面" />
      <p className="footnote m-0">
        下の内容をそのまま渡します。氏名とメールアドレスは含めません。画面の写しも渡しません。
      </p>
      <div className="mt-3 grid gap-4">
        <CopyBlock
          label="Claude Code 用の指示文をコピー"
          text={document}
          summary="渡す指示文を読む"
          ariaLabel="作業指示文"
        />
        <CopyBlock
          label="取得コマンドをコピー"
          text={prompt}
          summary="取得コマンドを読む"
          ariaLabel="取得コマンド"
        />
      </div>
      <div className="mt-4">
        <Button type="button" variant="primary" onClick={() => void submit()} disabled={busy || refreshing}>
          {busy ? "記録中…" : refreshing ? "画面に反映しています…" : "払い出し済みにする"}
        </Button>
      </div>
      <p className="footnote m-0 mt-2">押すと、渡した日時とそのときの内容を控えます。未対応のものは対応中に進みます。</p>
    </Card>
  );
}
