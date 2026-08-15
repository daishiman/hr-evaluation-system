"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote } from "@/components/ui";

/**
 * 届いた要望から、開発の記録票（GitHub Issue）を作る。
 *
 * 押すと社外のサービスへ文面が出る。だから
 * ・出る内容は押す前に上の折りたたみで丸ごと読める
 * ・押すのは1回だけ（連打しても二重に立たない。境界はサーバー側の主キー）
 * ・作ったあとは行き先だけを残し、この押しものは消える（画面を作り直す）
 */
export function ImprovementIssueForm({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/improvements/${id}`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "記録票を作れませんでした。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      {error && <ReasonNote>{error}</ReasonNote>}
      <p className="footnote m-0">
        押すと、上の内容で開発の記録票を作ります。氏名・メールアドレス・画面の写しは記録票に載せません。
      </p>
      <div className="mt-3">
        <Button type="button" variant="primary" onClick={submit} disabled={busy}>
          {busy ? "作成中…" : "開発の記録票を作る"}
        </Button>
      </div>
    </Card>
  );
}
