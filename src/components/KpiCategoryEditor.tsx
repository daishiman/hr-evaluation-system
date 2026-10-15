"use client";

import { useSaveAction } from "@/lib/use-refresh";
import { useState } from "react";
import { Button, Card, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListAddRow, ListRowBody } from "@/components/ListRow";
import { UsedByDetail } from "@/components/UsedByDetail";
import { masterDelete, masterRequest, masterSave } from "@/components/master-request";
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
  const { save, saving } = useSaveAction(masterRequest, { resource: "masters" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);

  const create = async () => {
    if (newName === null || newName.trim() === "") return;
    setError(null);
    setMessage(null);
    const result = await save(masterSave({ kind: "kpiCategoryCreate", name: newName.trim() }));
    if (!result.ok) {
      // 入力した名前は残す（直してもう一度押せるように）
      setError(result.message);
      return;
    }
    setMessage(result.message);
    setNewName(null);
  };

  const remove = async (id: string) => {
    setError(null);
    setMessage(null);
    const result = await save(masterDelete("kpiCategory", id));
    if (result.ok) setMessage(result.message);
    else setError(result.message);
  };

  const usedByOf = (id: string) => usage[id] ?? [];
  const anyBlocked = categories.some((c) => usedByOf(c.id).length > 0);

  return (
    <div className="stack">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={saving} />

      {/* 行の形はほかの一覧と同じ（番号 → 本文 → 補足 → 使っている場所、操作は右の列。spec §28-14） */}
      <Card>
        {categories.length > 0 && (
          <ol className="list-rows" aria-label="KPIカテゴリ">
            {categories.map((c, index) => {
              const mark = blockedMark(usedByOf(c.id));
              return (
                <li key={c.id} className="card-row">
                  <ListRowBody number={index + 1} text={c.name} note={c.description ?? undefined}>
                    {mark !== null && <UsedByDetail mark={mark} usedBy={usedByOf(c.id)} />}
                  </ListRowBody>
                  {/* 使っているカテゴリは消せないので、操作の列を作らない（使っている場所は本文の下に出る） */}
                  {mark === null && (
                    <div className="row-actions">
                      <ConfirmButton
                        label={DELETE_LABEL}
                        variant="danger-outline"
                        busy={saving}
                        busyLabel="削除しています…"
                        confirm={kpiCategoryDeleteConfirmText(c.name)}
                        onConfirm={() => void remove(c.id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {/* 足すボタンは、どの一覧でも一覧の下の左端に置く。カテゴリが無いことは、その右に書く（spec §28-14） */}
        <div className={categories.length > 0 ? "card-pad border-t border-line" : "card-pad"}>
          {newName === null ? (
            <ListAddRow empty={categories.length === 0 && "カテゴリはまだありません。"} note="新しいKPIの分類を1つ増やします。">
              <Button variant="secondary" disabled={saving} onClick={() => setNewName("")}>
                ＋ カテゴリを追加
              </Button>
            </ListAddRow>
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
                <Button variant="primary" disabled={saving || newName.trim() === ""} onClick={() => void create()}>
                  {saving ? "追加しています…" : "追加する"}
                </Button>
                <Button variant="tertiary" disabled={saving} onClick={() => setNewName(null)}>
                  やめる
                </Button>
              </div>
            </>
          )}
        </div>
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
