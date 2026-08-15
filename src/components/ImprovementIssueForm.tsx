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
/**
 * 案内文の中の URL を、押せる形にして出す。
 *
 * 「取得先はここです」と文字で書いても、選んで貼り直す手間が残る。
 * 設定を入れられるのは運営者本人だけで、その人が詰まると機能ごと止まる。
 * 外部のサイトへ出るので新しいタブで開き、元の画面を渡さない。
 */
function withLinks(line: string) {
  return line.split(/(https:\/\/\S+)/).map((part, i) =>
    part.startsWith("https://") ? (
      <a key={i} href={part} className="underline break-all" target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * 失敗の理由。1行目に何が起きたかを出し、2行目から先は手順として並べる。
 * 設定不足のときだけ複数行になる（ふつうの失敗は1行のまま）。
 */
function IssueError({ message }: { message: string }) {
  const [head, ...steps] = message.split("\n");
  return (
    <>
      <ReasonNote>{head}</ReasonNote>
      {steps.length > 0 && (
        <ol className="footnote mt-2 mb-0 list-decimal pl-5">
          {steps.map((line) => (
            <li key={line}>{withLinks(line)}</li>
          ))}
        </ol>
      )}
    </>
  );
}

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
      {error && <IssueError message={error} />}
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
