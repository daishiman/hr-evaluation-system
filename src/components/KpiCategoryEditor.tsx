"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useState } from "react";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { requestMasterDelete } from "@/components/master-delete-request";
import {
  DELETE_LABEL,
  KPI_CATEGORY_BLOCKED_KEEP,
  KPI_CATEGORY_BLOCKED_WHY,
  blockedMark,
  kpiCategoryDeleteConfirmText,
} from "@/lib/domain/master-delete";
import type { UsageMap } from "@/lib/master-usage";
import { RefreshStatus } from "@/components/RefreshStatus";

export interface KpiCategoryRow {
  id: string;
  name: string;
  description: string | null;
}

/**
 * KPIカテゴリ（等級要件達成率を除く項目の分類）の追加・削除。
 *
 * カテゴリの中身（どのKPI項目が入るか）は初期データの投入で決まっていて、
 * 項目そのものを足す・直す画面はまだ無い（→ docs/product/backlog.md）。
 * そのためここでできるのは「新しい分類の枠を作る」「一度も使っていない枠を消す」の2つだけ。
 * 既存7カテゴリはすべて何らかのKPI項目に紐づいているため、常に消せない（＝壊れない）。
 */
export function KpiCategoryEditor({ categories, usage }: { categories: KpiCategoryRow[]; usage: UsageMap }) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);

  const create = async () => {
    if (newName === null || newName.trim() === "") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "kpiCategoryCreate", name: newName.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "追加できませんでした。");
        return;
      }
      setMessage(json.message ?? "追加しました。");
      setNewName(null);
      refresh();
    } catch {
      setError("通信できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await requestMasterDelete("kpiCategory", id);
    if (result.ok) {
      setMessage(result.message);
      refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
  };

  const usedByOf = (id: string) => usage[id] ?? [];
  const anyBlocked = categories.some((c) => usedByOf(c.id).length > 0);

  return (
    <div className="stack">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={refreshing} />

      {categories.map((c) => {
        const mark = blockedMark(usedByOf(c.id));
        return (
          <Card key={c.id} className="card-pad">
            <CardHead
              title={c.name}
              sub={c.description ?? undefined}
              actions={
                <>
                  {mark !== null ? (
                    <Badge tone="active">使用中</Badge>
                  ) : (
                    <ConfirmButton
                      label={DELETE_LABEL}
                      variant="danger-outline"
                      busy={busy || refreshing}
                      busyLabel={busy ? "削除しています…" : "一覧に反映しています…"}
                      confirm={kpiCategoryDeleteConfirmText(c.name)}
                      onConfirm={() => void remove(c.id)}
                    />
                  )}
                </>
              }
            />
            {mark !== null && <UsedByDetail mark={mark} usedBy={usedByOf(c.id)} />}
          </Card>
        );
      })}

      <Card className="card-pad">
        {newName === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy || refreshing} onClick={() => setNewName("")}>
              カテゴリを追加する
            </Button>
            <span className="footnote">新しいKPIの分類を1つ増やします。</span>
          </div>
        ) : (
          <>
            <label className="block text-note text-ink-muted">
              カテゴリの名前
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="input mt-1 w-full"
                placeholder="例：品質"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy || refreshing || newName.trim() === ""} onClick={() => void create()}>
                {busy ? "追加しています…" : refreshing ? "一覧に反映しています…" : "追加する"}
              </Button>
              <Button variant="tertiary" disabled={busy || refreshing} onClick={() => setNewName(null)}>
                やめる
              </Button>
            </div>
          </>
        )}
      </Card>

      {anyBlocked && (
        <Disclosure summary="「使用中」のカテゴリを消せない理由">
          <p className="m-0 text-sub">{KPI_CATEGORY_BLOCKED_WHY}</p>
          <p className="m-0 mt-1 text-sub">{KPI_CATEGORY_BLOCKED_KEEP}</p>
        </Disclosure>
      )}
    </div>
  );
}
