"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * システム全体管理者が「いまどの会社を操作しているか」を切り替える。
 *
 * どの会社を見ているかを常に見える位置に出す（見間違えたまま他社の設定を触らないため）。
 * 切り替えると、社員・評価サイクル・制度マスタなど会社ごとの画面がすべてその会社に変わる。
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

  if (companies.length === 0) return null;

  return (
    <label className="hidden items-center gap-1 text-[12px] text-[var(--ink-muted)] lg:flex">
      操作する会社
      <select
        className="input h-8 py-0 text-[12px]"
        value={currentId ?? ""}
        disabled={busy}
        onChange={async (e) => {
          const companyId = e.target.value;
          setBusy(true);
          try {
            await fetch("/api/account/company-scope", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ companyId }),
            });
            router.refresh();
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
    </label>
  );
}
