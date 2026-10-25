"use client";

import { useMasterAction } from "@/components/use-master-action";
import { useEffect, useId, useState } from "react";
import { Badge, Button, Card, CardHead, Code, DefList, Disclosure, FieldGroup, InlineDetail, ReasonNote } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListAddArea, ListAddRow, ListRowActions, ListRowBody, ListRowItem, ListRows } from "@/components/ListRow";
import { UsedByDetail, blockedRows } from "@/components/UsedByDetail";
import {
  DELETE_LABEL,
  KPI_ITEM_BLOCKED_KEEP,
  KPI_ITEM_BLOCKED_WHY,
  KPI_ITEM_LOCKED_NOTE,
  kpiItemDeleteConfirmText,
} from "@/lib/domain/master-delete";
import type { UsageMap } from "@/lib/master-usage";
import { RefreshStatus } from "@/components/RefreshStatus";
import {
  KpiAskingFields,
  KpiAskingSummary,
  askingDraftFromView,
  askingPayload,
  askingToSend,
  emptyAsking,
  type AskingDraft,
} from "@/components/KpiAskingFields";
import { ASKING_LETTERS, type AskingView } from "@/lib/domain/kpi-asking";
import { kpiItemAnchor } from "@/lib/domain/scheme-steps";

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
  /** 実績の聞き方（設問のひな形と、文字で書いた計算式）。DD-016 */
  asking: AskingView;
  /** 回答を集めたアンケートの呼び名。あれば聞くことの組（足す・消す）を変えられない */
  keySetLockedBy: string | null;
}

/** 新規作成・編集で送る下書きの形。 */
interface Draft {
  name: string;
  unit: string;
  direction: "higher" | "lower";
  measureType: string;
  categoryId: string;
  asking: AskingDraft;
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
  asking: emptyAsking(),
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
  asking: askingDraftFromView(row.asking),
  formulaNote: row.formulaNote ?? "",
  remarks: row.remarks ?? "",
  isMonetary: row.isMonetary,
});

/** 聞くことがまだ無く、アンケートに出ない項目か。固定枠は制度の決まりで聞き方を持たないので含めない */
const unasked = (row: KpiItemRow) => row.isActive && !row.isFixedSlot && row.asking.questions.length === 0;

/** 指されて入力欄を開ける項目。固定枠は直せないので開かない。無い項目を指されたら null */
export function openableItem<T extends { id: string; isFixedSlot: boolean }>(items: readonly T[], id: string | null): T | null {
  return id === null ? null : (items.find((i) => i.id === id && !i.isFixedSlot) ?? null);
}

/** URL の # が指す項目の id（#kpi-item-<id>。kpiItemPath の書き方）。ほかの # なら null */
export function kpiItemIdFromHash(hash: string): string | null {
  const prefix = `#${encodeURIComponent(kpiItemAnchor(""))}`;
  if (!hash.startsWith(prefix) || hash.length === prefix.length) return null;
  try {
    return decodeURIComponent(hash.slice(prefix.length));
  } catch {
    return null; // 壊れた % の並びは、どの項目も指していない
  }
}

/**
 * KPI項目そのもの（名前・単位・向き・分類・実績区分・実績の聞き方）の追加・編集・削除。
 *
 * これまでKPI項目は初期データの投入でしか登録できなかった（→ docs/product/backlog.md）。
 * ここではカテゴリと同じ「使ったら消せない」に加えて、**使ったら意味の変わる列は直せない**
 * という制約を持つ。単位・向き（高いほど良い／低いほど良い）・実績区分・分類・金銭系の扱いは、
 * 一度でもアンケート・評価セット・評価の記録に登場すると計算の前提になるため、
 * 使用中は名前・実績の聞き方・計算式の補足・備考だけを直せる形にしている（サーバー側でも二重に弾く）。
 * 実績の聞き方は、回答を集めたアンケートが使っている項目では、聞くことの組（足す・消す）を変えられない（DD-016）。
 *
 * 比べる警告の「聞き方を決める」は、この画面へ項目を指して来る（scheme-steps.ts の kpiItemPath）。
 * 指された項目は入力欄を開いた状態で描き、各行の id で URL の # からその行へ飛ばす。
 *
 * 行の頭は名前と分類だけにし、聞くことは A・B… と1行ずつ並べる。計算式・実績区分・単位・向きは
 * 開いたときにだけ出す（DD-027 の3）。以前は1行の補足にすべてを「／」でつないでいて、
 * 聞くことが横に詰まって読み分けにくかった。
 */
export function KpiItemEditor({
  items,
  categories,
  usage,
  openItemId = null,
}: {
  items: KpiItemRow[];
  categories: KpiItemCategoryOption[];
  usage: UsageMap;
  /** 入力欄を開いておく項目。固定枠は直せないので開かない。無い項目を指されたら何も開かない */
  openItemId?: string | null;
}) {
  const { send, remove, saving, error, message, clearResult } = useMasterAction("kpiItem");
  const [creating, setCreating] = useState<Draft | null>(null);
  /* 開いておくのは、指された項目が変わったときだけ（最初に描くときを含む）。
     保存や取り消しで閉じたあとは、URL に残っていても開き直さない */
  const [opened] = useState(() => openableItem(items, openItemId));
  const [editingId, setEditingId] = useState<string | null>(opened?.id ?? null);
  const [editDraft, setEditDraft] = useState<Draft | null>(() => (opened ? draftFromRow(opened) : null));
  const openRow = (row: KpiItemRow) => {
    setEditingId(row.id);
    setEditDraft(draftFromRow(row));
  };

  /* 画面を開いたまま別の項目を指されたとき（比べる警告の別の行・聞き方を決める）。
     ?item= が変わると、サーバーが描き直して openItemId だけが変わり、この部品は作り直されない */
  const [pointedId, setPointedId] = useState(openItemId);
  if (pointedId !== openItemId) {
    setPointedId(openItemId);
    const row = openableItem(items, openItemId);
    if (row) openRow(row);
  }
  /* # だけが変わったとき（同じ画面の中の #kpi-item-<id> へのリンク・戻る／進む）。?item= は変わらないので、ここで拾う */
  useEffect(() => {
    const onHash = () => {
      const row = openableItem(items, kpiItemIdFromHash(window.location.hash));
      if (row) openRow(row);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [items]);

  const { usedByOf, markOf, anyBlocked } = blockedRows(usage, items);
  const activeCount = items.filter((row) => row.isActive).length;

  /* 失敗したときは入力欄を閉じずに残す（send が true を返したときだけ閉じる）。 */
  const create = async () => {
    if (creating === null) return;
    if (creating.name.trim() === "" || creating.unit.trim() === "") return;
    const asking = askingToSend(creating.asking, null);
    if (asking.problem) return;
    const ok = await send({
      kind: "kpiItemCreate",
      name: creating.name.trim(),
      unit: creating.unit.trim(),
      direction: creating.direction,
      measureType: creating.measureType,
      categoryId: creating.categoryId || null,
      ...(asking.send ? { asking: askingPayload(creating.asking) } : {}),
      formulaNote: creating.formulaNote.trim() || null,
      remarks: creating.remarks.trim() || null,
      isMonetary: creating.isMonetary,
    });
    if (ok) setCreating(null);
  };

  const startEdit = (row: KpiItemRow) => {
    openRow(row);
    clearResult();
  };

  const saveEdit = async (row: KpiItemRow) => {
    if (editDraft === null) return;
    const locked = usedByOf(row.id).length > 0;
    const asking = askingToSend(editDraft.asking, row.asking);
    if (asking.problem) return;
    const payload: Record<string, unknown> = {
      kind: "kpiItemUpdate",
      id: row.id,
      name: editDraft.name.trim(),
      formulaNote: editDraft.formulaNote.trim() || null,
      remarks: editDraft.remarks.trim() || null,
    };
    if (asking.send) payload.asking = askingPayload(editDraft.asking);
    if (!locked) {
      payload.unit = editDraft.unit.trim();
      payload.direction = editDraft.direction;
      payload.measureType = editDraft.measureType;
      payload.categoryId = editDraft.categoryId || null;
      payload.isMonetary = editDraft.isMonetary;
    }
    const ok = await send(payload);
    if (ok) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  const toggleActive = async (row: KpiItemRow) => {
    await send({ kind: "kpiItemUpdate", id: row.id, isActive: !row.isActive });
  };

  return (
    <FieldGroup disabled={saving} aria-busy={saving} bodyClassName="stack">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={saving} />

      {/* 行の形は等級要件・昇格の条件と同じ（番号 → 本文と札 → 補足 → 使っている場所、操作は右の列。spec §28-14）。
          KPI 項目は No. で並ぶので並べ替えは置かない */}
      <Card>
        <div className="card-pad">
          <CardHead
            title="登録しているKPI項目"
            sub={`使う ${activeCount}件・使わない ${items.length - activeCount}件`}
            detail={
              /* 札「聞くことが未定」の意味は、どの行でも同じ文なので頭に1つだけ置く */
              items.some(unasked) && (
                <p className="footnote m-0 mt-1">「聞くことが未定」の項目はアンケートに出ず、点が付きません。</p>
              )
            }
          />
        </div>
        {items.length > 0 && (
          <ListRows label="KPI項目" className="border-t border-line">
            {items.map((row) => {
              const mark = markOf(row.id);
              const locked = usedByOf(row.id).length > 0;
              const isEditing = editingId === row.id;
              const { questions, formula } = row.asking;

              return (
                <ListRowItem key={row.id} id={kpiItemAnchor(row.id)} off={!row.isActive}>
                  {isEditing ? (
                    <ListRowBody number={`No.${row.no}`} wide>
                      <ItemForm
                        draft={editDraft!}
                        onChange={setEditDraft}
                        categories={categories}
                        locked={locked}
                        savedAsking={row.asking}
                        keySetLockedBy={row.keySetLockedBy}
                        busy={saving}
                        submitLabel="保存する"
                        onSubmit={() => void saveEdit(row)}
                        onCancel={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                      />
                    </ListRowBody>
                  ) : (
                    <>
                      <ListRowBody
                        number={`No.${row.no}`}
                        wide
                        text={row.name}
                        badges={
                          (row.isFixedSlot || row.isProvisional || !row.isActive || unasked(row)) && (
                            <span className="inline-flex flex-wrap gap-1">
                              {row.isFixedSlot && <Badge tone="done">固定枠</Badge>}
                              {row.isProvisional && <Badge tone="dropped">仮置き</Badge>}
                              {!row.isActive && <Badge tone="dropped">使用しない</Badge>}
                              {unasked(row) && <Badge tone="required">聞くことが未定</Badge>}
                            </span>
                          )
                        }
                        note={row.categoryName ?? "分類未設定"}
                      >
                        {questions.length > 0 && (
                          <ol aria-label={`${row.name}の聞くこと`} className="footnote m-0 mt-1 list-none p-0">
                            {questions.map((q, i) => (
                              <li key={q.key}>
                                {ASKING_LETTERS[i] ?? "・"} {q.text}
                              </li>
                            ))}
                          </ol>
                        )}
                        <InlineDetail summary={formula ? "計算式・実績区分・単位・向き" : "実績区分・単位・向き"}>
                          <DefList
                            rows={[
                              ...(formula ? [{ label: "計算式", value: <Code>{formula}</Code> }] : []),
                              { label: "実績区分", value: row.measureType },
                              { label: "単位", value: row.unit },
                              { label: "向き", value: row.direction === "lower" ? "低いほど良い" : "高いほど良い" },
                            ]}
                          />
                        </InlineDetail>
                        {mark !== null && <UsedByDetail mark={mark} usedBy={usedByOf(row.id)} />}
                      </ListRowBody>
                      {/* 固定枠（等級要件達成率）は制度の決まりなので、直す・止める・消すを出さない */}
                      {!row.isFixedSlot && (
                        <ListRowActions>
                          <Button variant="tertiary" disabled={saving} onClick={() => startEdit(row)}>
                            内容を直す
                          </Button>
                          {row.isActive ? (
                            <ConfirmButton
                              label="今後使わない"
                              variant="danger-outline"
                              busy={saving}
                              confirm={`「${row.name}」を今後使わない設定にします。評価セットで選べる項目から外れます。過去のアンケートと評価は変わりません。`}
                              onConfirm={() => void toggleActive(row)}
                            />
                          ) : (
                            <Button variant="secondary" disabled={saving} onClick={() => void toggleActive(row)}>
                              もう一度使う
                            </Button>
                          )}
                          {mark === null && (
                            <ConfirmButton
                              label={DELETE_LABEL}
                              variant="danger-outline"
                              busy={saving}
                              confirm={kpiItemDeleteConfirmText(row.name)}
                              onConfirm={() => void remove(row.id)}
                            />
                          )}
                        </ListRowActions>
                      )}
                    </>
                  )}
                </ListRowItem>
              );
            })}
          </ListRows>
        )}
        {/* 足すボタンは、どの一覧でも一覧の下の左端に置く。項目が無いことは、その右に書く（spec §28-14） */}
        <ListAddArea hasRows={items.length > 0}>
          {creating === null ? (
            <ListAddRow
              empty={items.length === 0 && "KPI項目はまだありません。"}
              note="名前・単位・向き・分類などを決めて、新しい項目を1件増やします。"
            >
              <Button variant="secondary" disabled={saving} onClick={() => setCreating(emptyDraft())}>
                ＋ KPI項目を追加
              </Button>
            </ListAddRow>
          ) : (
            <ItemForm
              draft={creating}
              onChange={setCreating}
              categories={categories}
              locked={false}
              savedAsking={null}
              keySetLockedBy={null}
              busy={saving}
              submitLabel="追加する"
              onSubmit={() => void create()}
              onCancel={() => setCreating(null)}
            />
          )}
        </ListAddArea>
      </Card>

      {anyBlocked && (
        <Disclosure summary="「使用中」の項目を消せない・一部直せない理由">
          <p className="m-0 text-sub">{KPI_ITEM_BLOCKED_WHY}</p>
          <p className="m-0 mt-1 text-sub">{KPI_ITEM_BLOCKED_KEEP}</p>
          <p className="m-0 mt-1 text-sub">{KPI_ITEM_LOCKED_NOTE}</p>
        </Disclosure>
      )}
    </FieldGroup>
  );
}

function ItemForm({
  draft,
  onChange,
  categories,
  locked,
  savedAsking,
  keySetLockedBy,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  categories: KpiItemCategoryOption[];
  locked: boolean;
  /** 保存されている聞き方。作るときは null */
  savedAsking: AskingView | null;
  keySetLockedBy: string | null;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value });
  const problemId = useId();
  const { problem } = askingToSend(draft.asking, savedAsking);

  return (
    <div>
      <div className="field-grid">
        <label>
          <span className="block text-note text-ink-muted">項目名</span>
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
              <span className="block text-note text-ink-muted">単位</span>
              <input value={draft.unit} onChange={(e) => set("unit", e.target.value)} className="input mt-1 w-full" placeholder="例：%" />
            </label>
            <label>
              <span className="block text-note text-ink-muted">向き</span>
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
              <span className="block text-note text-ink-muted">実績区分</span>
              <select value={draft.measureType} onChange={(e) => set("measureType", e.target.value)} className="input mt-1 w-full">
                {MEASURE_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-note text-ink-muted">分類（カテゴリ）</span>
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
              <span className="text-note text-ink-muted">金銭系の項目（旧配点の分類・選択制約には使いません）</span>
            </label>
          </>
        )}
      </div>

      {savedAsking?.readonlyReason ? (
        <KpiAskingSummary view={savedAsking} />
      ) : (
        <KpiAskingFields
          draft={draft.asking}
          onChange={(asking) => set("asking", asking)}
          keySetLockedBy={keySetLockedBy}
          busy={busy}
          problem={problem}
          problemId={problemId}
        />
      )}

      <div className="field-grid mt-4">
        <label>
          <span className="block text-note text-ink-muted">計算式の補足（任意）</span>
          <input value={draft.formulaNote} onChange={(e) => set("formulaNote", e.target.value)} className="input mt-1 w-full" />
        </label>
        <label>
          <span className="block text-note text-ink-muted">備考（任意）</span>
          <input value={draft.remarks} onChange={(e) => set("remarks", e.target.value)} className="input mt-1 w-full" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={busy || draft.name.trim() === "" || (!locked && draft.unit.trim() === "") || problem !== null}
          aria-describedby={problem ? problemId : undefined}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
        <Button variant="tertiary" disabled={busy} onClick={onCancel}>
          やめる
        </Button>
      </div>
    </div>
  );
}
