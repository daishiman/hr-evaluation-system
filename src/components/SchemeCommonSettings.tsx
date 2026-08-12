"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote } from "@/components/ui";

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
  const router = useRouter();
  const [allA, setAllA] = useState(raiseRequiresAllA);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = allA !== raiseRequiresAllA;

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/scheme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemeId, raiseRequiresAllA: allA }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。選んだ内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-pad">
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
      {message && <p className="m-0 mt-3 text-sub text-[var(--brand-deep)]">{message}</p>}
      <div className="mt-3">
        <Button variant="secondary" onClick={save} disabled={busy || !changed}>
          {busy ? "保存しています…" : changed ? "共通の設定を保存する" : "変更はありません"}
        </Button>
      </div>
    </Card>
  );
}
