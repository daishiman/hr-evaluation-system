"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, DefList, Disclosure, InlineDetail, Num, ProvisionalMark, ReasonNote } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { validateScheme, type SchemeSelection } from "@/lib/domain/scheme";
import { RULE_NOTES, expectedItemCount, pointsForSlot, ruleBreakdown, type GradePointRule } from "@/lib/domain/grade-points";

export interface KpiOption {
  id: string;
  no: number;
  name: string;
  unit: string;
  categoryId: string | null;
  isFixedSlot: boolean;
  isProvisional: boolean;
  intent: string | null;
  aStandard: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
}

interface Pick {
  /** 重い枠（20点枠）に選んだ項目。この枠を持たない等級区分では null */
  majorId: string | null;
  /** 10点枠に選んだ項目 */
  minorIds: string[];
}

/**
 * 手順1「この等級区分で使うKPIを選ぶ」。
 *
 * ここは**選ぶだけ**の画面。基準（A〜E）の設定は次の手順で、選んだ項目だけを対象に行う。
 *
 * 直した点（2026-08-11 の指摘「好きなものを選べずデフォルトのままになる」）:
 *   以前は枠が埋まると、選んでいない項目のボタンをすべて押せなくしていた。
 *   初期値が枠を満たしているため**全項目が押せない状態で開く**ことになり、
 *   差し替えるには先に外す必要があると気づけなかった。
 *   いまは常に押せる。上限を超えたら「◯件外してください」と出し、保存だけを止める。
 */
export function SchemeGroupPicker({
  schemeId,
  pointGroup,
  gradeNames,
  rule,
  ratedItemIds,
  initial,
  categories,
  kpiItems,
  criteriaPath,
}: {
  schemeId: string;
  pointGroup: string;
  /** この等級区分に入る等級の名前。つないだ1行にせず、並びで出す */
  gradeNames: string[];
  rule: GradePointRule;
  ratedItemIds: string[];
  initial: { kpiItemId: string; isFixedSlot: boolean; isMajorSlot: boolean }[];
  categories: CategoryOption[];
  kpiItems: KpiOption[];
  /** 保存後に進む先（手順2） */
  criteriaPath: string;
}) {
  const router = useRouter();
  const fixedItem = kpiItems.find((k) => k.isFixedSlot) ?? null;
  const draftKey = `hr-eval:scheme-pick:${schemeId}:${pointGroup}:v1`;

  const savedPick: Pick = useMemo(
    () => ({
      majorId: initial.find((i) => i.isMajorSlot && !i.isFixedSlot)?.kpiItemId ?? null,
      minorIds: initial.filter((i) => !i.isFixedSlot && !i.isMajorSlot).map((i) => i.kpiItemId),
    }),
    [initial],
  );

  const [pick, setPickState] = useState<Pick>(savedPick);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  /* 途中で画面を離れても選びかけが消えないようにする。
     黙って戻すと「なぜこの状態なのか」が分からないので、戻したことを画面に出して
     「選び直す前に戻す」も添える（ux-design §4-1）。 */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Pick;
      if (!Array.isArray(draft.minorIds)) return;
      const same =
        draft.majorId === savedPick.majorId &&
        draft.minorIds.length === savedPick.minorIds.length &&
        draft.minorIds.every((id) => savedPick.minorIds.includes(id));
      if (same) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      setPickState(draft);
      setRestored(true);
    } catch {
      /* 保存していた内容が読めなくても、選び直せばよいだけなので黙って捨てる */
    }
  }, [draftKey, savedPick]);

  const setPick = (next: Partial<Pick>) => {
    setPickState((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(merged));
      } catch {
        /* 保存できなくても選択そのものは続けられる */
      }
      return merged;
    });
    setMessage(null);
    setError(null);
  };

  const discardDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* 消せなくても、保存済みの内容に戻せていれば目的は足りている */
    }
    setPickState(savedPick);
    setRestored(false);
  };

  const itemOf = (id: string) => kpiItems.find((k) => k.id === id) ?? null;

  const selections: SchemeSelection[] = [];
  if (fixedItem) {
    selections.push({
      kpiItemId: fixedItem.id,
      categoryId: fixedItem.categoryId,
      weight: pointsForSlot(rule, "fixed"),
      isFixedSlot: true,
      isMajorSlot: false,
    });
  }
  if (pick.majorId) {
    selections.push({
      kpiItemId: pick.majorId,
      categoryId: itemOf(pick.majorId)?.categoryId ?? null,
      weight: pointsForSlot(rule, "major"),
      isFixedSlot: false,
      isMajorSlot: true,
    });
  }
  for (const id of pick.minorIds) {
    selections.push({
      kpiItemId: id,
      categoryId: itemOf(id)?.categoryId ?? null,
      weight: pointsForSlot(rule, "minor"),
      isFixedSlot: false,
      isMajorSlot: false,
    });
  }

  const v = validateScheme(selections, {
    rule,
    fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
    ratedItemIds,
    itemNameOf: (id) => itemOf(id)?.name ?? id,
  });

  const rated = new Set(ratedItemIds);
  const majorOptions = kpiItems.filter((k) => !k.isFixedSlot);
  const minorRemaining = rule.minorSlotCount - pick.minorIds.length;

  const toggleMinor = (id: string) => {
    const has = pick.minorIds.includes(id);
    /* 上限に達していても押せる。押せない形にすると、初期値で枠が埋まっている画面が
       「全部灰色で何も選べない」状態に見えてしまう（今回の指摘の原因）。 */
    setPick({ minorIds: has ? pick.minorIds.filter((x) => x !== id) : [...pick.minorIds, id] });
  };

  const toggleMajor = (id: string) => {
    if (pick.majorId === id) {
      setPick({ majorId: null });
      return;
    }
    setPick({ majorId: id, minorIds: pick.minorIds.filter((x) => x !== id) });
  };

  const toggleComparison = (id: string) => {
    setCompareIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length < 5 ? [...current, id] : current,
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/scheme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemeId,
          pointGroup,
          items: selections.map((x) => ({
            kpiItemId: x.kpiItemId,
            categoryId: x.categoryId,
            isFixedSlot: x.isFixedSlot,
            isMajorSlot: x.isMajorSlot,
          })),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* 保存はできているので、控えが残っても次に開いたときに同じ内容に戻るだけ */
      }
      setRestored(false);
      // 保存できたら手順2（選んだ項目の基準）へ送る。ここで止めると次に何をするか分からない
      router.push(criteriaPath);
      router.refresh();
    } catch {
      setError("通信できませんでした。選んだ内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  /** いま選んでいる項目（外す操作つき）。長い候補一覧を上まで戻らずに見直せるようにする。 */
  const chosen = selections.filter((x) => !x.isFixedSlot);

  return (
    <>
      <Card className="card-pad hero-tint mt-1">
        <p className="m-0 text-note text-[var(--ink-muted)]">{pointGroup} の配点</p>
        <p className="num-display m-0 text-hero-sp leading-tight text-[var(--accent)]">
          {v.total}
          <span className="unit"> / {rule.totalPoints} 点</span>
        </p>

        {/* 等級名は文に混ぜない（5等級ぶんつなぐと1行が130文字を超えていた）。
            どの等級がこの区分に入るかは、数えるものなので並びで出す。 */}
        <p className="m-0 mt-3 text-note text-[var(--ink-muted)]">この等級区分に入る等級</p>
        {gradeNames.length === 0 ? (
          <p className="footnote m-0 mt-1">この等級区分の等級は登録されていません。</p>
        ) : (
          <ul className="m-0 mt-1 list-disc pl-5 text-sub">
            {gradeNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}

        {/* 満点の内訳は足し算。1本の文にせず、枠ごとの並びと合計で出す。 */}
        <p className="m-0 mt-3 text-note text-[var(--ink-muted)]">満点の内訳</p>
        <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sub">
          {ruleBreakdown(rule).map((part) => (
            <li key={part.kind} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="min-w-0">
                {part.label}
                {part.detail && <span className="footnote"> {part.detail}</span>}
              </span>
              <Num value={part.points} unit="点" />
            </li>
          ))}
        </ul>
        <p className="m-0 mt-1 text-sub">
          合計 <Num value={rule.totalPoints} unit="点" />
        </p>

        <ul className="footnote m-0 mt-2 list-disc pl-5">
          {RULE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sub">
          <span>
            選んだ項目 <Num value={selections.length} unit="件" /> / {expectedItemCount(rule)}件
          </span>
          {rule.majorSlotCount > 0 && (
            <span>
              {rule.majorSlotPoints}点枠{" "}
              {pick.majorId ? <Badge tone="done">選択済み</Badge> : <Badge tone="required">未選択</Badge>}
            </span>
          )}
          {rule.minorSlotCount > 0 && (
            <span>
              {rule.minorSlotPoints}点の項目 あと <Num value={Math.max(0, minorRemaining)} unit="件" />
            </span>
          )}
        </div>
      </Card>

      {restored && (
        <div className="mt-3">
          <ReasonNote
            action={
              <Button variant="tertiary" onClick={discardDraft}>
                選びかけを捨てて保存済みに戻す
              </Button>
            }
          >
            前回この画面を離れたときの選びかけを表示しています。まだ保存されていません。
          </ReasonNote>
        </div>
      )}

      {!v.ok && (
        <div className="mt-3">
          <ReasonNote>
            <ul className="m-0 list-disc pl-5">
              {v.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </ReasonNote>
        </div>
      )}

      {v.warnings.length > 0 && (
        <div className="mt-3">
          <ReasonNote>
            <p className="m-0 font-bold">保存はできますが、ご確認ください</p>
            <ul className="m-0 list-disc pl-5">
              {v.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </ReasonNote>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {message && <p className="m-0 mt-3 text-sub text-[var(--brand-deep)]">{message}</p>}

      {fixedItem && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="todo-row-title m-0">
                {fixedItem.name} <Badge tone="done">固定枠</Badge>
              </p>
              <p className="todo-row-sub m-0">
                この枠はどの等級区分でも必ず入り、差し替えできません。等級が上がるほど配点は小さくなります。
              </p>
            </div>
            <p className="m-0">
              <Num value={pointsForSlot(rule, "fixed")} unit="点" />
            </p>
          </div>
        </Card>
      )}

      {chosen.length > 0 && (
        <Card className="card-pad mt-4">
          <p className="section-heading m-0">いま選んでいる項目</p>
          <p className="footnote m-0">
            固定枠のほかに選んだ項目です。差し替えたいときは、ここで外してから下の一覧で選び直してください。
          </p>
          <div className="field-grid mt-3">
            {chosen.map((x) => {
              const item = itemOf(x.kpiItemId);
              return (
                <div
                  key={x.kpiItemId}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-sub"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{item?.name ?? x.kpiItemId}</span>
                    <span className="block text-note text-[var(--ink-muted)]">
                      <Num value={x.weight} unit="点" />
                      {x.isMajorSlot ? "（重い枠）" : ""}
                    </span>
                  </span>
                  <Button
                    variant="tertiary"
                    onClick={() =>
                      x.isMajorSlot ? setPick({ majorId: null }) : toggleMinor(x.kpiItemId)
                    }
                  >
                    外す
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-4">
        <Disclosure summary="KPIの違いを比較する" meta={`選択 ${compareIds.length} / 5件`}>
          <p className="footnote">
            気になるKPIを最大5件選ぶと、目的・単位・Aの目安を同じ並びで比べられます。比較しても評価セットには追加されません。
          </p>
          <div className="card-grid card-grid-3 mt-3" aria-label="比較するKPIを選ぶ">
            {majorOptions.map((item) => {
              const checked = compareIds.includes(item.id);
              const disabled = !checked && compareIds.length >= 5;
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--line)] bg-white p-4 text-sub ${
                    checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : ""
                  } ${disabled ? "opacity-50" : ""}`}
                >
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleComparison(item.id)} />
                  <span>
                    <span className="block font-bold">{item.name}</span>
                    <span className="block text-note text-[var(--ink-muted)]">単位 {item.unit}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {compareIds.length > 0 && (
            <div className="card-grid card-grid-3 mt-4" aria-label="KPIの比較結果">
              {compareIds.map((id) => {
                const item = itemOf(id);
                if (!item) return null;
                const category = categories.find((c) => c.id === item.categoryId);
                return (
                  <Card key={item.id} className="card-pad">
                    <p className="m-0 text-sub font-bold">{item.name}</p>
                    <p className="footnote m-0 mt-1">
                      {category?.name ?? "分類なし"} ／ 単位 {item.unit}
                    </p>
                    <div className="mt-3">
                      <DefList
                        rows={[
                          { label: "評価する目的", value: item.intent ?? "説明は未設定です" },
                          { label: "Aの目安", value: item.aStandard ?? "基準は未設定です" },
                        ]}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Disclosure>
      </div>

      {rule.majorSlotCount > 0 && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-heading m-0">
                {rule.majorSlotPoints}点枠（1つ選ぶ） <Badge tone="required">必須</Badge>
              </p>
              <p className="footnote m-0">
                ほかより重い{rule.majorSlotPoints}点の枠です。どの項目でも置けます（分類も問いません）。
                選び直すときは、別の項目を押すだけで入れ替わります。
              </p>
            </div>
            <p className="m-0">
              <Num value={rule.majorSlotPoints} unit="点" />
            </p>
          </div>
          <div className="field-grid mt-3">
            {majorOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={pick.majorId === o.id}
                onClick={() => toggleMajor(o.id)}
                className={
                  pick.majorId === o.id
                    ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-sub"
                    : "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-sub hover:border-[var(--brand)]"
                }
              >
                <span className="block font-bold">
                  {o.name}
                  {!rated.has(o.id) && (
                    <>
                      {" "}
                      <Badge tone="required">基準未設定</Badge>
                    </>
                  )}
                </span>
                <span className="block text-note text-[var(--ink-muted)]">
                  単位 {o.unit}
                  {o.aStandard ? ` ／ Aの目安 ${o.aStandard}` : ""}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {rule.minorSlotCount > 0 ? (
        categories.map((c) => {
          const options = kpiItems.filter((k) => k.categoryId === c.id && !k.isFixedSlot && k.id !== pick.majorId);
          if (options.length === 0) return null;
          return (
            <Card key={c.id} className="card-pad mt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="section-heading m-0">{c.name}</p>
                  {c.description && <p className="footnote m-0">{c.description}</p>}
                </div>
                <p className="footnote m-0">1項目 {rule.minorSlotPoints}点</p>
              </div>
              <div className="field-grid mt-3">
                {options.map((o) => {
                  const on = pick.minorIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleMinor(o.id)}
                      className={
                        on
                          ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-sub"
                          : "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-sub hover:border-[var(--brand)]"
                      }
                    >
                      <span className="block font-bold">
                        {o.name}
                        {on && (
                          <>
                            {" "}
                            <Badge tone="done">選択中</Badge>
                          </>
                        )}
                        {o.isProvisional && (
                          <>
                            {" "}
                            <ProvisionalMark note="制度として未確定の項目です（叩き台）。" />
                          </>
                        )}
                        {!rated.has(o.id) && (
                          <>
                            {" "}
                            <Badge tone="required">基準未設定</Badge>
                          </>
                        )}
                      </span>
                      <span className="block text-note text-[var(--ink-muted)]">
                        単位 {o.unit}
                        {o.aStandard ? ` ／ Aの目安 ${o.aStandard}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })
      ) : (
        <Card className="card-pad mt-4">
          <p className="section-heading m-0">選ぶ項目はありません</p>
          <p className="footnote m-0">
            {pointGroup} は{fixedItem?.name ?? "固定枠の項目"}だけで{rule.totalPoints}点です。
            ほかのKPIは、この等級区分では評価しません。
            0点として数えるのではなく、評価の対象にしません。
            そのまま下のボタンで次の手順へ進めます。
          </p>
        </Card>
      )}

      <p className="footnote mt-4">保存すると、この等級区分の内容だけが入れ替わります。</p>
      {/* 「ほかは動かない」の内訳は、保存を決めるうえでは背景。押したときに読めればよい */}
      <InlineDetail summary="保存しても変わらないもの">
        <p className="m-0">ほかの等級区分の設定は変わりません。</p>
        <p className="m-0 mt-1">確定済みの評価は、当時の設定のまま残ります。</p>
        <p className="m-0 mt-1">すでに公開したアンケートも、当時の設定のままです。</p>
      </InlineDetail>

      <StickyActionBar
        status={
          <>
            <span className="text-sub text-[var(--ink)]">
              {pointGroup} 合計 <span className="num font-bold">{v.total}</span>
              <span className="unit"> / {rule.totalPoints} 点</span>
            </span>
            <span className="mx-2 text-[var(--line)]">|</span>
            {v.ok ? `残り ${rule.totalPoints - v.total} 点` : (v.errors[0] ?? "設定が未完了です")}
          </>
        }
      >
        <Button variant="primary" onClick={save} disabled={busy || !v.ok}>
          {busy ? "保存しています…" : "保存して次は基準を決める"}
        </Button>
      </StickyActionBar>
    </>
  );
}
