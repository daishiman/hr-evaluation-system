"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReasonNote } from "@/components/ui";

/**
 * システム全体管理者が「いまどの会社を操作しているか」を切り替える。
 *
 * どの会社を見ているかを常に見える位置に出す（見間違えたまま他社の設定を触らないため）。
 * 切り替えると、社員・評価サイクル・制度マスタなど会社ごとの画面がすべてその会社に変わる。
 *
 * 置き場所はサイドバーの上部。以前はヘッダーに置いて横幅1024px未満では隠していたため、
 * スマートフォンでは会社を切り替えられなかった。サイドバーは狭い画面では引き出しとして
 * 開けるので、どの画面幅でも切り替えられる。
 */
export function CompanyScopeSwitcher({
  companies,
  currentId,
}: {
  companies: { id: string; name: string }[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (companies.length === 0) return null;

  return (
    <div className="grid gap-1 text-note text-ink-muted">
      <label htmlFor="company-scope">操作する会社</label>
      {/* 高さは付けない。px で決め打ちすると、文字の段を上げたときに下が欠ける（spec §18）。
          文字の大きさも指定しない。入力欄の共通の見た目（.input）が正本で、
          ここで text-note と書いても効かない（効いていないまま残っていた）。 */}
      <select
        id="company-scope"
        className="input w-full"
        value={currentId ?? ""}
        disabled={busy}
        onChange={async (e) => {
          const companyId = e.target.value;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/account/company-scope", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ companyId }),
            });
            if (!res.ok) {
              setError("会社を切り替えられませんでした。時間をおいてもう一度お試しください。");
              return;
            }
            router.refresh();
          } catch {
            setError("通信できませんでした。時間をおいてもう一度お試しください。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-1" role="alert" aria-live="assertive">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
    </div>
  );
}
