"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote } from "@/components/ui";

type RowResult = {
  row: number;
  name: string;
  status: "取り込み" | "スキップ";
  reason?: string;
  answered?: number;
  unreadable?: string[];
};

/**
 * 回答一覧（スプレッドシートの書き出し）の取り込み。
 *
 * ファイルを選ぶか、スプレッドシートからそのまま貼り付けて取り込む。
 * 取り込めなかった行も理由つきで一覧に出す（揃った分だけ先に進める）。
 */
export function CsvImport({ formId, formTitle }: { formId: string; formTitle: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowResult[] | null>(null);

  const preview = text.trim() === "" ? [] : text.trim().split(/\r?\n/).slice(0, 3);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setMessage(null);
    setError(null);
    setRows(null);
  };

  const run = async () => {
    if (text.trim() === "") {
      setError("取り込む内容がありません。ファイルを選ぶか、表を貼り付けてください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/import/responses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ formId, csv: text }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; rows?: RowResult[] };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "取り込みできませんでした。");
        return;
      }
      setMessage(data.message ?? "取り込みました。");
      setRows(data.rows ?? []);
      router.refresh();
    } catch {
      setError("通信できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      <p className="m-0 text-[13px]">
        「{formTitle}」の回答として取り込みます。1行目に設問名、2行目から回答を入れてください。
        氏名（または社員番号）でこのシステムの登録者と突き合わせます。
      </p>

      <div className="mt-3 grid gap-3">
        <label className="block text-[13px] font-bold">
          回答一覧のファイル（CSV）
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-[13px] font-normal"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {fileName && <span className="footnote block">選択中：{fileName}</span>}
        </label>

        <label className="block text-[13px] font-bold">
          または、表をそのまま貼り付ける
          <textarea
            className="input mt-1 w-full font-mono text-[12px]"
            rows={4}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            placeholder="タイムスタンプ,氏名（回答者）,【支援】１）…"
          />
        </label>
      </div>

      {preview.length > 0 && (
        <div className="mt-3">
          <p className="footnote m-0">取り込む内容の先頭（確認用）</p>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-subtle p-2 text-[11px] leading-5">{preview.join("\n")}</pre>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? "取り込んでいます…" : "この内容を取り込む"}
        </Button>
        <span className="footnote">同じ方の回答がすでにある場合は、新しい内容で置き換えます。</span>
      </div>

      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="mt-3 m-0 text-[13px] font-bold">{message}</p>}

      {rows && rows.length > 0 && (
        <div className="table-scroll mt-3">
          <table>
            <thead>
              <tr>
                <th className="col-num">行</th>
                <th>氏名</th>
                <th>結果</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td className="col-num num">{r.row}</td>
                  <td>{r.name || "（空欄）"}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === "取り込み" ? `${r.answered ?? 0}問を保存` : (r.reason ?? "")}
                    {r.unreadable && r.unreadable.length > 0 && (
                      <span className="footnote block">
                        値を読み取れなかった設問{r.unreadable.length}問（点数に入りません）：{r.unreadable.slice(0, 3).join("／")}
                        {r.unreadable.length > 3 ? " ほか" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
