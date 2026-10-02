"use client";

import { useState } from "react";
import { saveScheme } from "@/actions/scheme";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useSaveAction } from "@/lib/use-refresh";

/**
 * 全等級区分に共通の設定。
 *
 * 等級区分ごとの画面に置くと「どの等級区分に効く設定なのか」が分からなくなるため、
 * 入口の画面にだけ置く（1画面1目的。等級区分の設定と混ぜない）。
 */
export function SchemeCommonSettings({
  schemeId,
  raiseRequiresAllA,
}: {
  schemeId: string;
  raiseRequiresAllA: boolean;
}) {
  /* 保存の応答に保存後の画面が同梱されるので、別に取り直しを頼まない。
     saving は「保存して画面に出し終えるまで」の間ずっと true。 */
  const { save, saving } = useSaveAction(saveScheme, { resource: "scheme" });
  const [allA, setAllA] = useState(raiseRequiresAllA);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = allA !== raiseRequiresAllA;

  const submit = async () => {
    setError(null);
    setMessage(null);
    const result = await save({ schemeId, raiseRequiresAllA: allA });
    if (!result.ok) {
      // 選んだ内容はそのまま残す（直して押し直せるように）
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  return (
    <Card className="card-pad">
      <fieldset disabled={saving} aria-busy={saving} className="m-0 min-w-0 border-0 p-0">
      <label className="flex items-center gap-2 text-sub">
        <input type="checkbox" checked={allA} onChange={(e) => setAllA(e.target.checked)} />
        昇給の条件を「選んだ項目がすべてA」にする
      </label>
      <p className="footnote m-0 mt-1">
        外すと「配点の満点と同じ点数を取ったとき」が昇給の条件になります。この設定は全等級区分に共通です。
      </p>
      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      <RefreshStatus message={message} refreshing={saving} target="画面" className="m-0 mt-3 text-sub text-brand-deep" />
      <div className="mt-3">
        <Button variant="secondary" onClick={() => void submit()} disabled={saving || !changed}>
          {saving ? "保存しています…" : changed ? "共通の設定を保存する" : "変更はありません"}
        </Button>
      </div>
      </fieldset>
    </Card>
  );
}
