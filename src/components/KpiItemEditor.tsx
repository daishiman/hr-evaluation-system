"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, Disclosure, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { UsedByDetail } from "@/components/UsedByDetail";
import { requestMasterDelete } from "@/components/master-delete-request";
import {
  DELETE_LABEL,
  KPI_ITEM_BLOCKED_KEEP,
  KPI_ITEM_BLOCKED_WHY,
  KPI_ITEM_LOCKED_NOTE,
  blockedMark,
  kpiItemDeleteConfirmText,
} from "@/lib/domain/master-delete";
import type { UsageMap } from "@/lib/master-usage";

export interface KpiItemCategoryOption {
  id: string;
  name: string;
}

export interface KpiItemRow {
  id: string;
  no: number;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  measureType: string;
  unit: string;
  direction: "higher" | "lower";
  formula: string | null;
  formulaNote: string | null;
  remarks: string | null;
  isMonetary: boolean;
  isProvisional: boolean;
  isActive: boolean;
  isFixedSlot: boolean;
}

/** 新規作成・編集で送る下書きの形。 */
interface Draft {
  name: string;
  unit: string;
  direction: "higher" | "lower";
  measureType: string;
  categoryId: string;
  formula: string;
  formulaNote: string;
  remarks: string;
  isMonetary: boolean;
}

const MEASURE_TYPES = ["個人実績", "事業所実績", "個人・事業所実績", "管理者実績"];

const emptyDraft = (): Draft => ({
  name: "",
  unit: "",
  direction: "higher",
  measureType: MEASURE_TYPES[0],
  categoryId: "",
  formula: "",
  formulaNote: "",
  remarks: "",
  isMonetary: false,
});

const draftFromRow = (row: KpiItemRow): Draft => ({
  name: row.name,
  unit: row.unit,
  direction: row.direction,
  measureType: row.measureType,
  categoryId: row.categoryId ?? "",
  formula: row.formula ?? "",
  formulaNote: row.formulaNote ?? "",
  remarks: row.remarks ?? "",
  isMonetary: row.isMonetary,
});

/**
 * KPI項目そのもの（名前・単位・向き・分類・実績区分・計算式）の追加・編集・削除。
 *
 * これまでKPI項目は初期データの投入でしか登録できなかった（→ docs/product/backlog.md）。
 * ここではカテゴリと同じ「使ったら消せない」に加えて、**使ったら意味の変わる列は直せない**
 * という制約を持つ。単位・向き（高いほど良い／低いほど良い）・実績区分・分類・金銭系の扱いは、
 * 一度でもアンケート・評価セット・評価の記録に登場すると計算の前提になるため、
 * 使用中は名前・計算式の説明・備考だけを直せる形にしている（サーバー側でも二重に弾く）。
 */
export function KpiItemEditor({
  items,
  categories,
  usage,
}: {
  items: KpiItemRow[];
  categories: KpiItemCategoryOption[];
  usage: UsageMap;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);

  const usedByOf = (id: string) => usage[id] ?? [];
  const anyBlocked = items.some((i) => usedByOf(i.id).length > 0);

  const send = async (payload: Record<string, unknown>): Promise<{ ok: boolean; message: string }> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/masters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        const msg = json.message ?? "保存できませんでした。";
        setError(msg);
        return { ok: false, message: msg };
      }
      const msg = json.message ?? "保存しました。";
      setMessage(msg);
      return { ok: true, message: msg };
    } catch {
      const msg = "通信できませんでした。入力した内容はこの画面に残っています。";
      setError(msg);
      return { ok: false, message: msg };
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (creating === null) return;
    if (creating.name.trim() === "" || creating.unit.trim() === "") return;
    const result = await send({
      kind: "kpiItemCreate",
      name: creating.name.trim(),
      unit: creating.unit.trim(),
      direction: creating.direction,
      measureType: creating.measureType,
      categoryId: creating.categoryId || null,
      formula: creating.formula.trim() || null,
      formulaNote: creating.formulaNote.trim() || null,
      remarks: creating.remarks.trim() || null,
      isMonetary: creating.isMonetary,
    });
    if (result.ok) {
      setCreating(null);
      router.refresh();
    }
  };

  const startEdit = (row: KpiItemRow) => {
    setEditingId(row.id);
    setEditDraft(draftFromRow(row));
    setError(null);
    setMessage(null);
  };

  const save = async (row: KpiItemRow) => {
    if (editDraft === null) return;
    const locked = usedByOf(row.id).length > 0;
    const payload: Record<string, unknown> = {
      kind: "kpiItemUpdate",
      id: row.id,
      name: editDraft.name.trim(),
      formula: editDraft.formula.trim() || null,
      formulaNote: editDraft.formulaNote.trim() || null,
      remarks: editDraft.remarks.trim() || null,
    };
    if (!locked) {
      payload.unit = editDraft.unit.trim();
      payload.direction = editDraft.direction;
      payload.measureType = editDraft.measureType;
      payload.categoryId = editDraft.categoryId || null;
      payload.isMonetary = editDraft.isMonetary;
    }
    const result = await send(payload);
    if (result.ok) {
      setEditingId(null);
      setEditDraft(null);
      router.refresh();
    }
  };

  const toggleActive = async (row: KpiItemRow) => {
    await send({ kind: "kpiItemUpdate", id: row.id, isActive: !row.isActive });
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await requestMasterDelete("kpiItem", id);
    if (result.ok) {
      setMessage(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 text-sub text-[var(--brand-deep)]">{message}</p>}

      {items.map((row) => {
        const mark = blockedMark(usedByOf(row.id));
        const locked = usedByOf(row.id).length > 0;
        const isEditing = editingId === row.id;

        return (
          <Card key={row.id} className="card-pad" off={!row.isActive}>
            {!isEditing ? (
              <>
                <CardHead
                  title={`No.${row.no} ${row.name}`}
                  sub={`${row.categoryName ?? "分類未設定"} ／ ${row.measureType} ／ 単位 ${row.unit} ／ ${
                    row.direction === "lower" ? "低いほど良い" : "高いほど良い"
                  }`}
                  actions={
                    <>
                      {row.isFixedSlot && <Badge tone="done">固定枠</Badge>}
                      {row.isProvisional && <Badge tone="dropped">仮置き</Badge>}
                      <Badge tone={row.isActive ? "active" : "dropped"}>{row.isActive ? "使用中" : "使用しない"}</Badge>
                      {mark !== null && <Badge tone="active">{mark}</Badge>}
                    </>
                  }
                />
                {row.formula && <p className="footnote m-0 mt-1">計算式：{row.formula}</p>}
                {mark !== null && <UsedByDetail mark={mark} usedBy={usedByOf(row.id)} />}
                {!row.isFixedSlot && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="tertiary" disabled={busy} onClick={() => startEdit(row)}>
                      内容を直す
                    </Button>
                    <Button variant="tertiary" disabled={busy} onClick={() => void toggleActive(row)}>
                      {row.isActive ? "使わない" : "もう一度使う"}
                    </Button>
                    {mark === null && (
                      <ConfirmButton
                        label={DELETE_LABEL}
                        variant="danger-outline"
                        busy={busy}
                        confirm={kpiItemDeleteConfirmText(row.name)}
                        onConfirm={() => void remove(row.id)}
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <ItemForm
                draft={editDraft!}
                onChange={setEditDraft}
                categories={categories}
                locked={locked}
                busy={busy}
                submitLabel="保存する"
                onSubmit={() => void save(row)}
                onCancel={() => {
                  setEditingId(null);
                  setEditDraft(null);
                }}
              />
            )}
          </Card>
        );
      })}

      <Card className="card-pad">
        {creating === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setCreating(emptyDraft())}>
              KPI項目を追加する
            </Button>
            <span className="footnote">名前・単位・向き・分類などを決めて、新しい項目を1件増やします。</span>
          </div>
        ) : (
          <ItemForm
            draft={creating}
            onChange={setCreating}
            categories={categories}
            locked={false}
            busy={busy}
            submitLabel="追加する"
            onSubmit={() => void create()}
            onCancel={() => setCreating(null)}
          />
        )}
      </Card>

      {anyBlocked && (
        <Disclosure summary="「使用中」の項目を消せない・一部直せない理由">
          <p className="m-0 text-sub">{KPI_ITEM_BLOCKED_WHY}</p>
          <p className="m-0 mt-1 text-sub">{KPI_ITEM_BLOCKED_KEEP}</p>
          <p className="m-0 mt-1 text-sub">{KPI_ITEM_LOCKED_NOTE}</p>
        </Disclosure>
      )}
    </div>
  );
}

function ItemForm({
  draft,
  onChange,
  categories,
  locked,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  categories: KpiItemCategoryOption[];
  locked: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="field-grid">
        <label>
          <span className="block text-note text-[var(--ink-muted)]">項目名</span>
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} className="input mt-1 w-full" placeholder="例：新規契約獲得率" />
        </label>

        {locked ? (
          <p className="m-0 footnote">
            単位・向き・実績区分・分類・金銭系の扱いは使用中のため変更できません（{draft.unit} ／{" "}
            {draft.direction === "lower" ? "低いほど良い" : "高いほど良い"} ／ {draft.measureType} ／{" "}
            {categories.find((c) => c.id === draft.categoryId)?.name ?? "分類未設定"}）。
          </p>
        ) : (
          <>
            <label>
              <span className="block text-note text-[var(--ink-muted)]">単位</span>
              <input value={draft.unit} onChange={(e) => set("unit", e.target.value)} className="input mt-1 w-full" placeholder="例：%" />
            </label>
            <label>
              <span className="block text-note text-[var(--ink-muted)]">向き</span>
              <select
                value={draft.direction}
                onChange={(e) => set("direction", e.target.value === "lower" ? "lower" : "higher")}
                className="input mt-1 w-full"
              >
                <option value="higher">高いほど良い</option>
                <option value="lower">低いほど良い（逆転指標）</option>
              </select>
            </label>
            <label>
              <span className="block text-note text-[var(--ink-muted)]">実績区分</span>
              <select value={draft.measureType} onChange={(e) => set("measureType", e.target.value)} className="input mt-1 w-full">
                {MEASURE_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-note text-[var(--ink-muted)]">分類（カテゴリ）</span>
              <select value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="input mt-1 w-full">
                <option value="">分類未設定</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.isMonetary} onChange={(e) => set("isMonetary", e.target.checked)} />
              <span className="text-note text-[var(--ink-muted)]">金銭系の項目（Chief以上で20点枠の候補にする）</span>
            </label>
          </>
        )}

        <label>
          <span className="block text-note text-[var(--ink-muted)]">計算式（任意）</span>
          <input value={draft.formula} onChange={(e) => set("formula", e.target.value)} className="input mt-1 w-full" placeholder="例：契約件数 ÷ 商談件数" />
        </label>
        <label>
          <span className="block text-note text-[var(--ink-muted)]">計算式の補足（任意）</span>
          <input value={draft.formulaNote} onChange={(e) => set("formulaNote", e.target.value)} className="input mt-1 w-full" />
        </label>
        <label>
          <span className="block text-note text-[var(--ink-muted)]">備考（任意）</span>
          <input value={draft.remarks} onChange={(e) => set("remarks", e.target.value)} className="input mt-1 w-full" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy || draft.name.trim() === "" || (!locked && draft.unit.trim() === "")} onClick={onSubmit}>
          {submitLabel}
        </Button>
        <Button variant="tertiary" disabled={busy} onClick={onCancel}>
          やめる
        </Button>
      </div>
    </div>
  );
}
