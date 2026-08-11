"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Num, ProvisionalMark, ReasonNote } from "@/components/ui";
import { validateScheme, type SchemeSelection } from "@/lib/domain/scheme";
import { describeRule, expectedItemCount, pointsForSlot, type GradePointRule } from "@/lib/domain/grade-points";

export interface KpiOption {
  id: string;
  no: number;
  name: string;
  unit: string;
  categoryId: string | null;
  isFixedSlot: boolean;
  /** 金銭系（20点枠に置ける項目）。No.6 単価率 / No.9 売上達成率 / No.24 利益率 */
  isMonetary: boolean;
  isProvisional: boolean;
  intent: string | null;
  aStandard: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
}

/** 等級区分1つぶんの設定（持ち点の型・いまの選択） */
export interface GroupSetup {
  pointGroup: string;
  /** その等級区分に属する等級名（「等級４：AM Ⅰ・等級４：AM Ⅱ」のような表示用の文字列） */
  gradeLabel: string;
  rule: GradePointRule;
  /**
   * その等級区分でランク基準（A〜E）が定義されている項目のID。
   * 選べる項目を絞るためではなく、「その等級区分を想定していない閾値で採点される」項目に注意を出すために使う。
   */
  ratedItemIds: string[];
  initial: { kpiItemId: string; isFixedSlot: boolean; isMajorSlot: boolean }[];
}

interface Pick {
  /** 重い枠（20点枠）に選んだ項目。この枠を持たない等級区分では null */
  majorId: string | null;
  /** 10点枠に選んだ項目 */
  minorIds: string[];
}

/**
 * 等級区分ごとの項目選択。
 *
 * 選ぶ項目数も配点も等級区分で変わるため、タブで等級区分を切り替えて1つずつ設定する。
 * 配点はこの画面では編集できない（等級区分から決まる）。編集できない理由が分からないと
 * 「壊れている」と受け取られるため、タブごとに1行で理由を出している。
 *
 * 1画面1目的にするため、この画面は「どの項目を評価対象にするか」だけを扱う。
 * 保存はタブ（等級区分）単位で、ほかの等級区分の設定には触らない。
 */
export function SchemeEditor({
  schemeId,
  categories,
  kpiItems,
  groups,
  raiseRequiresAllA,
}: {
  schemeId: string;
  categories: CategoryOption[];
  kpiItems: KpiOption[];
  groups: GroupSetup[];
  raiseRequiresAllA: boolean;
}) {
  const router = useRouter();
  const fixedItem = kpiItems.find((k) => k.isFixedSlot) ?? null;

  const [active, setActive] = useState(groups[0]?.pointGroup ?? "");
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      groups.map((g) => [
        g.pointGroup,
        {
          majorId: g.initial.find((i) => i.isMajorSlot && !i.isFixedSlot)?.kpiItemId ?? null,
          minorIds: g.initial.filter((i) => !i.isFixedSlot && !i.isMajorSlot).map((i) => i.kpiItemId),
        },
      ]),
    ),
  );
  const [allA, setAllA] = useState(raiseRequiresAllA);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const group = groups.find((g) => g.pointGroup === active) ?? groups[0] ?? null;
  const pick: Pick = (group && picks[group.pointGroup]) || { majorId: null, minorIds: [] };
  const itemOf = (id: string) => kpiItems.find((k) => k.id === id) ?? null;

  /** その等級区分の選択を、検証と保存に使う形に直す。配点は等級区分の型から入れる。 */
  const selectionsOf = (g: GroupSetup, p: Pick): SchemeSelection[] => {
    const rows: SchemeSelection[] = [];
    if (fixedItem) {
      rows.push({
        kpiItemId: fixedItem.id,
        categoryId: fixedItem.categoryId,
        weight: pointsForSlot(g.rule, "fixed"),
        isFixedSlot: true,
        isMajorSlot: false,
      });
    }
    if (p.majorId) {
      rows.push({
        kpiItemId: p.majorId,
        categoryId: itemOf(p.majorId)?.categoryId ?? null,
        weight: pointsForSlot(g.rule, "major"),
        isFixedSlot: false,
        isMajorSlot: true,
      });
    }
    for (const id of p.minorIds) {
      rows.push({
        kpiItemId: id,
        categoryId: itemOf(id)?.categoryId ?? null,
        weight: pointsForSlot(g.rule, "minor"),
        isFixedSlot: false,
        isMajorSlot: false,
      });
    }
    return rows;
  };

  /** タブの見出しに「あと何項目」を出すため、全タブぶんの検証結果を持っておく */
  const results = useMemo(
    () =>
      Object.fromEntries(
        groups.map((g) => {
          const p = picks[g.pointGroup] ?? { majorId: null, minorIds: [] };
          const sel = selectionsOf(g, p);
          return [
            g.pointGroup,
            {
              selections: sel,
              validation: validateScheme(sel, {
                rule: g.rule,
                fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
                ratedItemIds: g.ratedItemIds,
                itemNameOf: (id) => itemOf(id)?.name ?? id,
              }),
            },
          ];
        }),
      ),
    // 選択（picks）が変わったときだけ作り直す。groups / kpiItems はこの画面が開いている間は変わらない
    [picks, groups, kpiItems],
  );

  if (!group) {
    return <ReasonNote>等級区分ごとの配点ルールが登録されていません。初期データの投入をご確認ください。</ReasonNote>;
  }

  const { selections, validation: v } = results[group.pointGroup];
  const rule = group.rule;
  /* 候補は絞らない。固定枠の項目だけは重複して選べないので外す。
     rated は「その等級区分でランク基準があるか」。選べるかどうかではなく、注意を出すかどうかに使う。 */
  const rated = new Set(group.ratedItemIds);
  const majorOptions = kpiItems.filter((k) => !k.isFixedSlot);
  const minorRemaining = rule.minorSlotCount - pick.minorIds.length;

  const setPick = (next: Partial<Pick>) => {
    setPicks((prev) => ({ ...prev, [group.pointGroup]: { ...prev[group.pointGroup], ...next } }));
    setMessage(null);
    setError(null);
  };

  const toggleMinor = (id: string) => {
    const has = pick.minorIds.includes(id);
    if (!has && minorRemaining <= 0) return; // 上限に達したら足せない（先に外してもらう）
    setPick({ minorIds: has ? pick.minorIds.filter((x) => x !== id) : [...pick.minorIds, id] });
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
          pointGroup: group.pointGroup,
          items: selections.map((x) => ({
            kpiItemId: x.kpiItemId,
            categoryId: x.categoryId,
            isFixedSlot: x.isFixedSlot,
            isMajorSlot: x.isMajorSlot,
          })),
          raiseRequiresAllA: allA,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* 等級区分のタブ。区分ごとに項目数も配点も違うので、1つずつ設定して1つずつ保存する */}
      <div className="mt-1 flex flex-wrap gap-2" role="tablist" aria-label="等級区分">
        {groups.map((g) => {
          const r = results[g.pointGroup].validation;
          return (
            <button
              key={g.pointGroup}
              type="button"
              role="tab"
              aria-selected={g.pointGroup === group.pointGroup}
              onClick={() => setActive(g.pointGroup)}
              className={
                g.pointGroup === group.pointGroup
                  ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                  : "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] hover:border-[var(--brand)]"
              }
            >
              <span className="block font-bold">{g.pointGroup}</span>
              <span className="block text-[11px] text-[var(--ink-muted)]">
                {r.ok ? "設定できています" : "設定が未完了"}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="card-pad hero-tint mt-3">
        <p className="m-0 text-[12px] text-[var(--ink-muted)]">
          {group.pointGroup}（{group.gradeLabel}）の配点
        </p>
        <p className="num-display m-0 text-[36px] leading-tight text-[var(--accent)]">
          {v.total}
          <span className="unit"> / {rule.totalPoints} 点</span>
        </p>
        <p className="footnote m-0 mt-2">{describeRule(rule)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px]">
          <span>
            選んだ項目 <Num value={selections.length} unit="件" /> / {expectedItemCount(rule)}件
          </span>
          {rule.majorSlotCount > 0 && (
            <span>
              {rule.majorSlotPoints}点枠（金銭系）{" "}
              {pick.majorId ? <Badge tone="done">選択済み</Badge> : <Badge tone="required">未選択</Badge>}
            </span>
          )}
          <span>
            {rule.minorSlotPoints}点の項目 あと <Num value={Math.max(0, minorRemaining)} unit="件" />
          </span>
        </div>
      </Card>

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

      {/* 保存はできるが知らせておくこと。エラーと同じ見た目にすると区別が付かないため、
          「保存を止めるものではない」ことを見出しで明示する。 */}
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
      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 mt-3 text-[13px] text-[var(--brand-deep)]">{message}</p>}

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

      {rule.majorSlotCount > 0 && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-heading m-0">
                {rule.majorSlotPoints}点枠（1つ選ぶ） <Badge tone="required">必須</Badge>
              </p>
              <p className="footnote m-0">
                ほかより重い{rule.majorSlotPoints}点の枠です。どの項目でも置けます（分類も問いません）。
                この等級区分でとくに重く見たい項目を1つ選んでください。
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
                onClick={() =>
                  setPick({ majorId: o.id, minorIds: pick.minorIds.filter((x) => x !== o.id) })
                }
                className={
                  pick.majorId === o.id
                    ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                    : "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] hover:border-[var(--brand)]"
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
                <span className="block text-[11px] text-[var(--ink-muted)]">
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
                  const full = !on && minorRemaining <= 0;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      disabled={full}
                      title={full ? "選べる項目数の上限です。ほかの項目を外してから選んでください。" : undefined}
                      onClick={() => toggleMinor(o.id)}
                      className={
                        on
                          ? "rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                          : `rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] ${
                              full ? "opacity-50" : "hover:border-[var(--brand)]"
                            }`
                      }
                    >
                      <span className="block font-bold">
                        {o.name}
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
                      <span className="block text-[11px] text-[var(--ink-muted)]">
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
            {group.pointGroup} は等級要件達成率だけで{rule.totalPoints}点です。
            ほかのKPIはこの等級区分では評価しません（0点として数えるのではなく、評価の対象にしません）。
          </p>
        </Card>
      )}

      <Card className="card-pad mt-4">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={allA} onChange={(e) => setAllA(e.target.checked)} />
          昇給の条件を「選んだ項目がすべてA」にする
        </label>
        <p className="footnote m-0 mt-1">
          外すと「配点の満点と同じ点数を取ったとき」が昇給の条件になります。この設定は全等級区分に共通です。
        </p>
      </Card>

      <Card className="card-pad mt-4">
        <p className="section-heading m-0">ランクを点数に直すやり方</p>
        <p className="footnote m-0">
          A〜Eのランクは、等級区分ごとの配点に割合を掛けて点数にします（A＝満点の100% / B＝80% / C＝60% / D＝40% / E＝0点）。
          移行前の「項目ごとの点数表」は、等級区分ごとに配点が決まるようになったため使いません。
          すでに確定した評価は、確定した当時のやり方のまま残ります。
        </p>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy || !v.ok}>
          {busy ? "保存しています…" : `${group.pointGroup} の内容を保存する`}
        </Button>
        <span className="footnote">
          残り <Num value={rule.totalPoints - v.total} unit="点" />
        </span>
      </div>
      <p className="footnote mt-2">
        保存は表示している等級区分だけに反映されます。ほかの等級区分はタブを切り替えて保存してください。
        確定済みの評価は判定当時の配点のまま残るため、過去の結果は変わりません。
      </p>
    </>
  );
}
