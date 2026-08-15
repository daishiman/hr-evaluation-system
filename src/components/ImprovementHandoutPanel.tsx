"use client";

import { useState } from "react";
import { CopyBlock } from "@/components/CopyBlock";
import { RefreshStatus } from "@/components/RefreshStatus";
import { Button, Card, ReasonNote } from "@/components/ui";
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
