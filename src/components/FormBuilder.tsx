"use client";

import { useRefreshAfterSave } from "@/lib/use-refresh";
import { useRef, useState } from "react";
import { Badge, Button, Card, CardHead, CardRow, ReasonNote } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { NumberField } from "@/components/NumberField";
import { SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import {
  createBlankQuestion,
  insertBlankQuestionAfter,
  withClientKeys,
  type BuilderQuestion,
  type BuilderQuestionDraft,
} from "@/components/form-builder-model";
import { RefreshStatus } from "@/components/RefreshStatus";

export type { BuilderQuestion } from "@/components/form-builder-model";

/**
 * アンケートの設問をクリックで組み立てる画面。
 *
 * 設問文を打ち込む以外は、すべてボタンで完結するようにしている
 * （種類を選ぶ・並べ替える・選択肢を足す）。
 * 集計に使う紐づけ（等級要件・KPI項目）は編集させない。ここを人が触ると
 * 「何の実績としてカウントするか」が分からなくなるため、表示だけにとどめる。
 */

const TYPE_LABEL: Record<string, string> = {
  yesno: "はい / いいえ",
  single: "1つ選ぶ",
  multi: "いくつでも選ぶ",
  number: "数値を入れる",
  text: "文章で書く",
  scale: "段階で選ぶ",
};

export function FormBuilder({
  formId,
  initial,
  editable,
  lockReason,
}: {
  formId: string;
  initial: BuilderQuestion[];
  editable: boolean;
  lockReason?: string;
}) {
  const { refresh, refreshing } = useRefreshAfterSave();
  const [rows, setRows] = useState<BuilderQuestionDraft[]>(() => withClientKeys(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const nextClientKey = useRef(0);

  const newClientKey = () => `new:${nextClientKey.current++}`;

  const patch = (i: number, p: Partial<BuilderQuestion>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) => {
    if (rows[i]?.clientKey === openKey) setOpenKey(null);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const add = (section: string, questionType: string) => {
    const clientKey = newClientKey();
    setRows((prev) => [...prev, createBlankQuestion(section, questionType, clientKey)]);
    setOpenKey(clientKey);
  };

  /* 一覧が長くなるほど、末尾の「設問を足す」まで押しに戻るのが遠くなる。
     いま見ているカードのすぐ下に、同じまとまり・同じ答え方で1問差し込めるようにする。 */
  const addAfter = (i: number) => {
    const clientKey = newClientKey();
    setRows((prev) => insertBlankQuestionAfter(prev, i, clientKey).rows);
    setOpenKey(clientKey);
  };

  const save = async () => {
    const blank = rows.findIndex((r) => !r.title.trim());
    if (blank >= 0) {
      setError(`${blank + 1}問目の設問文が空です。入力してから保存してください。`);
      setOpenKey(rows[blank].clientKey);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/forms/${formId}/questions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questions: rows.map((r) => ({
            id: r.id,
            section: r.section,
            questionType: r.questionType,
            title: r.title,
            helpText: r.helpText,
            unit: r.unit,
            required: r.required,
            validationMin: r.validationMin,
            validationMax: r.validationMax,
            validationInteger: r.validationInteger,
            options: r.options.length > 0 ? r.options : undefined,
            isGate: r.isGate,
            gradeRequirementId: r.gradeRequirementId,
            promotionRequirementId: r.promotionRequirementId,
            behaviorGuidelineId: r.behaviorGuidelineId,
            kpiItemId: r.kpiItemId,
            kpiQuestionKey: r.kpiQuestionKey,
          })),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <>
        <ReasonNote>{lockReason ?? "このアンケートは編集できません。"}</ReasonNote>
        <div className="mt-3">
          <QuestionList rows={rows} />
        </div>
      </>
    );
  }

  return (
    <fieldset disabled={busy || refreshing} aria-busy={busy || refreshing} className="m-0 min-w-0 border-0 p-0">
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={refreshing} target="画面" className="m-0 mb-3 text-sub text-brand-deep" />

      <div className="grid gap-3">
        {rows.map((r, i) => {
          const open = openKey === r.clientKey;
          const title = (
            <>
              <span className="num mr-2 text-ink-muted">{i + 1}.</span>
              {r.title || <span className="text-ink-muted">（設問文が未入力です）</span>}
            </>
          );
          const sub = (
            <>
              {SECTION_LABEL[r.section] ?? r.section} ／ {TYPE_LABEL[r.questionType] ?? r.questionType}
              {r.unit ? ` ／ 単位 ${r.unit}` : ""} ／ {r.required ? "必須" : "任意"}
            </>
          );
          const actions = (
            <>
              {r.isGate && <Badge tone="alert">昇格の必須要件</Badge>}
              <Button onClick={() => move(i, -1)} disabled={i === 0} aria-label="1つ上へ">
                ↑
              </Button>
              <Button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="1つ下へ">
                ↓
              </Button>
              <Button onClick={() => addAfter(i)} aria-label="この下に自由設問を追加">
                この下に追加
              </Button>
              <Button onClick={() => setOpenKey(open ? null : r.clientKey)}>{open ? "閉じる" : "編集"}</Button>
            </>
          );
          return (
          <Card key={r.clientKey} className="card-pad">
            {/* 頭を固定するのは「編集を開いているカード」だけ。
                開くと選択肢の並びまで含めて縦に長くなり、下のほうを直しているときに
                「何問目を・どの答え方で・どの単位で」直しているのかが画面の外へ出てしまう。
                閉じているカードは2行しかなく、固定しても貼り付く前に流れ去るため付けない
                （帯の見た目だけが増えて一覧が読みにくくなる）。
                集計との紐づけは一度読めば済むので帯には載せず、開いた本文の先頭に置く。 */}
            {open ? (
              <CardHead pinned title={title} sub={sub} actions={actions} />
            ) : (
              <CardHead
                title={title}
                sub={sub}
                detail={r.linkLabel ? <p className="footnote m-0 mt-1">集計との紐づけ：{r.linkLabel}</p> : undefined}
                actions={actions}
              />
            )}

            {open && (
              <div className="field-grid mt-3 border-t border-line pt-3">
                <p className="footnote m-0 md:col-span-2">
                  {r.linkLabel ? `集計との紐づけ：${r.linkLabel}` : "自由設問（評価集計には使いません）"}
                </p>
                <label className="md:col-span-2">
                  <span className="block text-note text-ink-muted">設問文</span>
                  <input className="input mt-1 w-full" value={r.title} onChange={(e) => patch(i, { title: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="block text-note text-ink-muted">補足（任意）</span>
                  <input
                    className="input mt-1 w-full"
                    value={r.helpText ?? ""}
                    onChange={(e) => patch(i, { helpText: e.target.value || null })}
                  />
                </label>
                <label>
                  <span className="block text-note text-ink-muted">まとまり</span>
                  <select className="input mt-1 w-full" value={r.section} onChange={(e) => patch(i, { section: e.target.value })}>
                    {SECTION_ORDER.concat("free").map((sec) => (
                      <option key={sec} value={sec}>
                        {SECTION_LABEL[sec] ?? sec}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="block text-note text-ink-muted">答え方</span>
                  <select
                    className="input mt-1 w-full"
                    value={r.questionType}
                    onChange={(e) => patch(i, { questionType: e.target.value })}
                  >
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {r.questionType === "number" && (
                  <>
                    <label>
                      <span className="block text-note text-ink-muted">単位</span>
                      <input
                        className="input mt-1 w-full"
                        value={r.unit ?? ""}
                        onChange={(e) => patch(i, { unit: e.target.value || null })}
                      />
                    </label>
                    <label>
                      <span className="block text-note text-ink-muted">入力できる最小値</span>
                      {/* 回答画面と同じ部品を使う。空欄のままにできる（＝下限を決めない）。
                          以前はここで打った文字をそのまま数値にしていたため、全角で打つと
                          「決めたつもりなのに決まっていない」状態になっていた。 */}
                      <NumberField
                        className="input input-num mt-1 w-24"
                        name={`validationMin_${i}`}
                        ariaLabel="入力できる最小値"
                        defaultValue={r.validationMin ?? null}
                        policy={{ allowNegative: true }}
                        onValueChange={(value) => patch(i, { validationMin: value })}
                      />
                    </label>
                    <label>
                      <span className="block text-note text-ink-muted">小数の扱い</span>
                      {/* 「件」「人」のように数え上げるものは小数が意味を持たない。
                          止めるかどうかは設問ごとに決める（単位だけで決めると、%のように
                          小数が要るものまで巻き込む）。 */}
                      <span className="mt-1 flex items-center gap-2 text-sub">
                        <input
                          type="checkbox"
                          checked={r.validationInteger}
                          onChange={(e) => patch(i, { validationInteger: e.target.checked })}
                        />
                        整数だけにする（小数を受け付けない）
                      </span>
                    </label>
                  </>
                )}
                {(r.questionType === "single" || r.questionType === "multi") && (
                  <div className="md:col-span-2">
                    <span className="block text-note text-ink-muted">選択肢</span>
                    <div className="mt-1 grid gap-2">
                      {r.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            className="input flex-1"
                            value={o.label}
                            onChange={(e) =>
                              patch(i, {
                                options: r.options.map((x, xi) => (xi === oi ? { ...x, label: e.target.value } : x)),
                              })
                            }
                          />
                          <Button onClick={() => patch(i, { options: r.options.filter((_, xi) => xi !== oi) })}>
                            削除
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button
                          onClick={() =>
                            patch(i, {
                              options: [
                                ...r.options,
                                { value: String(r.options.length + 1), label: `選択肢${r.options.length + 1}` },
                              ],
                            })
                          }
                        >
                          選択肢を足す
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sub">
                  <input type="checkbox" checked={r.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                  回答を必須にする
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  <Button variant="danger-outline" onClick={() => remove(i)}>
                    この設問を削除する
                  </Button>
                  <span className="footnote">保存を押すまでは反映されません。</span>
                </div>
              </div>
            )}
          </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="section-heading m-0 mb-2">設問を足す</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => add("free", "yesno")}>はい / いいえ</Button>
          <Button onClick={() => add("free", "single")}>1つ選ぶ</Button>
          <Button onClick={() => add("free", "multi")}>いくつでも選ぶ</Button>
          <Button onClick={() => add("kpi", "number")}>数値を入れる</Button>
          <Button onClick={() => add("free", "text")}>文章で書く</Button>
        </div>
      </div>

      {/* 設問が増えるほど縦に伸びる画面。設問数と保存ボタンは画面下に固定する */}
      <StickyActionBar
        status={
          <>
            <span className="text-sub text-ink">
              設問 <span className="num font-bold">{rows.length}</span>
              <span className="unit"> 問</span>
            </span>
            <span className="mx-2 text-line">|</span>
            保存しても公開はされません。公開はアンケート一覧から行います。
          </>
        }
      >
        <Button variant="primary" onClick={save} disabled={busy || refreshing}>
          {busy ? "保存しています…" : refreshing ? "画面に反映しています…" : "設問を保存する"}
        </Button>
      </StickyActionBar>
    </fieldset>
  );
}

function QuestionList({ rows }: { rows: BuilderQuestion[] }) {
  return (
    <Card>
      {rows.map((r, i) => (
        <CardRow
          key={i}
          alignTop
          title={
            <>
              <span className="num mr-2 text-ink-muted">{i + 1}.</span>
              {r.title}
            </>
          }
          sub={
            <>
              {SECTION_LABEL[r.section] ?? r.section} ／ {TYPE_LABEL[r.questionType] ?? r.questionType}
              {r.unit ? ` ／ 単位 ${r.unit}` : ""} ／ {r.required ? "必須" : "任意"}
            </>
          }
          marks={r.isGate ? <Badge tone="alert">昇格の必須要件</Badge> : undefined}
        />
      ))}
    </Card>
  );
}
