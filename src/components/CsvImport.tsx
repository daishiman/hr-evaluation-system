"use client";

import { useReadAction, useSaveAction } from "@/lib/use-refresh";
import { importResponses, previewResponsesImport } from "@/actions/response-import";
import { useRef, useState } from "react";
import { Button, Card, ReasonNote } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { RefreshStatus } from "@/components/RefreshStatus";

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
 * 取り込めない行は理由つきで一覧に出し、1行でもあればファイル全体を保存しない。
 *
 * 「まず内容を確認する」は何も保存しない読み出し（画面は描き直さない）。
 * 「この内容を取り込む」は書き込みで、応答に取り込み後の回答一覧が同梱される。
 */
export function CsvImport({ formId, formTitle }: { formId: string; formTitle: string }) {
  const { save, saving } = useSaveAction(importResponses, { resource: "responses" });
  const { read: check, reading } = useReadAction(previewResponsesImport, { resource: "responses" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowResult[] | null>(null);
  /** 直前の結果が「確認だけ（まだ保存していない）」かどうか */
  const [checked, setChecked] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  const preview = text.trim() === "" ? [] : text.trim().split(/\r?\n/).slice(0, 3);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setMessage(null);
    setError(null);
    setRows(null);
    setChecked(false);
    setConfirmationToken(null);
  };

  const run = async (dryRun: boolean) => {
    if (text.trim() === "") {
      setError("取り込む内容がありません。ファイルを選ぶか、表を貼り付けてください。");
      return;
    }
    setError(null);
    setMessage(null);
    if (dryRun) {
      const result = await check({ formId, csv: text });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setRows(result.rows);
      setChecked(true);
      setConfirmationToken(result.confirmationToken);
      return;
    }
    const result = await save({ formId, csv: text, confirmationToken: confirmationToken ?? undefined });
    // 失敗しても貼り付けた内容は消さない（直してもう一度確認できるように）
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    setRows(result.rows);
    setChecked(false);
    setConfirmationToken(null);
  };

  return (
    <Card className="card-pad">
      <p className="m-0 text-sub">
        「{formTitle}」の回答として取り込みます。1行目に設問名、2行目から回答を入れてください。
        氏名（または社員番号）でこのシステムの登録者と突き合わせます。
        1行でも修正が必要な場合は、ほかの行も含めて保存しません。
      </p>

      <div className="mt-3 grid gap-3">
        <label className="block text-sub font-bold">
          回答一覧のファイル（CSV）
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sub font-normal"
            disabled={saving || reading}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {fileName && <span className="footnote block">選択中：{fileName}</span>}
        </label>

        <label className="block text-sub font-bold">
          または、表をそのまま貼り付ける
          <textarea
            className="input mt-1 w-full font-mono text-note"
            rows={4}
            value={text}
            disabled={saving || reading}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
              setRows(null);
              setChecked(false);
              setConfirmationToken(null);
            }}
            placeholder="タイムスタンプ,氏名（回答者）,【支援】１）…"
          />
        </label>
      </div>

      {preview.length > 0 && (
        <div className="mt-3">
          <p className="footnote m-0">取り込む内容の先頭（確認用）</p>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-subtle p-2 text-note leading-5">{preview.join("\n")}</pre>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="tertiary" onClick={() => void run(true)} disabled={saving || reading}>
          {reading ? "確認しています…" : "まず内容を確認する"}
        </Button>
        <Button onClick={() => void run(false)} disabled={saving || reading || !checked || !confirmationToken}>
          {saving ? "取り込んでいます…" : "この内容を取り込む"}
        </Button>
        <span className="footnote">同じ方の回答がすでにある場合は、新しい内容で置き換えます。</span>
      </div>

      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      <RefreshStatus message={message} refreshing={saving} className="mt-3 m-0 text-sub font-bold" />

      {rows && rows.length > 0 && (
        <div className="mt-3">
          {checked && <p className="footnote m-0 mb-1">まだ保存していません。内容でよければ「この内容を取り込む」を押してください。</p>}
          {/* 取り込み結果は行番号順に上から突き合わせる一覧なので表のまま（狭い画面では自動でカードに畳む）。 */}
          <DataTable
            caption="取り込みの結果"
            rows={rows}
            rowKey={(r) => String(r.row)}
            columns={[
              { key: "name", header: "氏名", role: "title", cell: (r) => r.name || "（空欄）" },
              { key: "status", header: "結果", role: "mark", cell: (r) => r.status },
              { key: "row", header: "行", num: true, cell: (r) => <span className="num">{r.row}</span> },
              {
                key: "detail",
                header: "内容",
                cell: (r) => (
                  <>
                    {r.status === "取り込み" ? `${r.answered ?? 0}問を保存` : (r.reason ?? "")}
                    {r.unreadable && r.unreadable.length > 0 && (
                      <span className="footnote block">
                        値を読み取れなかった設問{r.unreadable.length}問（点数に入りません）：{r.unreadable.slice(0, 3).join("／")}
                        {r.unreadable.length > 3 ? " ほか" : ""}
                      </span>
                    )}
                  </>
                ),
              },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
