"use client";

import { useState } from "react";
import { switchCompanyScope } from "@/actions/company-scope";
import { useSaveAction } from "@/lib/use-refresh";
import { ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

/**
 * システム全体管理者が「いまどの会社を操作しているか」を切り替える。
 *
 * どの会社を見ているかを常に見える位置に出す（見間違えたまま他社の設定を触らないため）。
 * 切り替えると、社員・評価サイクル・制度マスタなど会社ごとの画面がすべてその会社に変わる。
 *
 * 置き場所はサイドバーの上部。以前はヘッダーに置いて横幅1024px未満では隠していたため、
 * スマートフォンでは会社を切り替えられなかった。サイドバーは狭い画面では引き出しとして
 * 開けるので、どの画面幅でも切り替えられる。
 *
 * 切り替えは Server Action（src/actions/company-scope.ts）で行う。切り替えた後の画面は
 * 返事と一緒に届くので、別に取り直さない。送っている間は select を押せなくし、
 * 「会社の画面に反映しています…」を出す。
 */
export function CompanyScopeSwitcher({
  companies,
  currentId,
}: {
  companies: { id: string; name: string }[];
  currentId: string | null;
}) {
  const { save, saving } = useSaveAction(switchCompanyScope, { resource: "company-scope" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (companies.length === 0) return null;

  return (
    <div className="grid gap-1 text-note text-ink-muted" aria-busy={saving}>
      <label htmlFor="company-scope">操作する会社</label>
      {/* 高さは付けない。px で決め打ちすると、文字の段を上げたときに下が欠ける（spec §18）。
          文字の大きさも指定しない。入力欄の共通の見た目（.input）が正本で、
          ここで text-note と書いても効かない（効いていないまま残っていた）。 */}
      <select
        id="company-scope"
        className="input w-full"
        value={currentId ?? ""}
        disabled={saving}
        onChange={async (e) => {
          const companyId = e.target.value;
          setError(null);
          setMessage(null);
          const result = await save({ companyId });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage("操作する会社を切り替えました。");
        }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <RefreshStatus
        message={message}
        refreshing={saving}
        target="会社の画面"
        className="m-0 text-note text-ink-muted"
      />
      {error && (
        <div className="mt-1" role="alert" aria-live="assertive">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
    </div>
  );
}
