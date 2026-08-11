"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote } from "@/components/ui";
import { DataTable } from "@/components/DataTable";

type MemberRowResult = {
  row: number;
  name: string;
  email: string;
  status: "新規作成" | "更新" | "エラー";
  reason?: string;
};

/**
 * 社員一覧のまとめ登録。
 *
 * 表を貼り付けるか、CSVを選んで取り込む。取り込む前に「まず内容を確認する」で
 * 何行目の何が不正かを確かめられる（確認の段階では何も保存しない）。
 */
export function MembersCsvImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberRowResult[] | null>(null);
  const [checked, setChecked] = useState(false);

  const reset = () => {
    setMessage(null);
    setError(null);
    setRows(null);
  };

  const run = async (dryRun: boolean) => {
    if (text.trim() === "") {
      setError("取り込む内容がありません。ファイルを選ぶか、表を貼り付けてください。");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/import/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          csv: text,
          dryRun,
          initialPassword: password.trim() === "" ? undefined : password.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; rows?: MemberRowResult[] };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "取り込みできませんでした。");
        return;
      }
      setMessage(data.message ?? "取り込みました。");
      setRows(data.rows ?? []);
      setChecked(dryRun);
      if (!dryRun) router.refresh();
    } catch {
      setError("通信できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
      <p className="m-0 text-[13px]">
        1行目に「氏名」「メールアドレス」「社員番号」「役割」「等級」「事業所」「所属」「上長」「入社日」「利用状態」の見出しを入れ、2行目から社員を並べてください。
        この画面の「社員一覧を書き出す」で作ったCSVは、そのまま取り込めます。
      </p>
      <p className="footnote m-0 mt-1">
        メールアドレスが同じ方はすでにいる方として情報を更新します。上長は氏名・メールアドレス・社員番号のどれでも指定でき、同じファイルの中の方も指定できます。
      </p>

      <div className="mt-3 grid gap-3">
        <label className="block text-[13px] font-bold">
          社員一覧のファイル（CSV）
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-[13px] font-normal"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              setText(await file.text());
              reset();
            }}
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
              reset();
            }}
            placeholder="氏名,メールアドレス,社員番号,役割,等級,事業所,所属,上長,入社日,利用状態"
          />
        </label>

        <label className="block text-[13px] font-bold">
          新しく登録する方の最初のパスワード
          <input
            type="password"
            className="input mt-1 w-full font-normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="footnote block">
            8文字以上。すでに登録済みの方だけを更新するときは空欄のままで構いません。発行後、ご本人にお伝えください。
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="tertiary" onClick={() => run(true)} disabled={busy}>
          まず内容を確認する
        </Button>
        <Button onClick={() => run(false)} disabled={busy}>
          {busy ? "処理しています…" : "この内容を取り込む"}
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="mt-3 m-0 text-[13px] font-bold">{message}</p>}

      {rows && rows.length > 0 && (
        <div className="mt-3">
          {checked && <p className="footnote m-0 mb-1">まだ保存していません。内容でよければ「この内容を取り込む」を押してください。</p>}
          {/* 取り込み結果は行番号順に上から突き合わせる一覧なので表のまま（狭い画面では自動でカードに畳む）。 */}
          <DataTable
            caption="取り込みの結果"
            rows={rows}
            rowKey={(r) => `${r.row}-${r.status}`}
            columns={[
              { key: "name", header: "氏名", role: "title", cell: (r) => r.name || "（空欄）" },
              { key: "status", header: "結果", role: "mark", cell: (r) => r.status },
              { key: "row", header: "行", num: true, cell: (r) => <span className="num">{r.row}</span> },
              { key: "email", header: "メールアドレス", cell: (r) => <span className="text-[12px]">{r.email}</span> },
              { key: "reason", header: "内容", cell: (r) => r.reason ?? "" },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
